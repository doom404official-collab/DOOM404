"""Execute actual embedded workflow Python against fake HTTP responses only."""
import contextlib
import copy
import io
import json
import os
import pathlib
import re
import sys
import textwrap
import unittest
import urllib.error
from unittest.mock import patch

WORKFLOWS = [pathlib.Path(value) for value in sys.argv[1:]]
if not WORKFLOWS:
    raise SystemExit("Supply the workflow file(s) to test")


def embedded_python(path):
    text = path.read_text()
    match = re.search(r"(?m)^( +)python3 - <<'PY'\n", text)
    if not match:
        raise AssertionError(f"Embedded Python missing: {path}")
    end = text.index(match[1] + "PY", match.end())
    return compile(textwrap.dedent(text[match.end():end]), str(path), "exec")


HEALTH = dict(total=3, pending=1, verified=2, rejected=0, unavailable=0,
              active_leases=0, expired_leases=0, retry_exhausted=0)
RESULT = dict(status="processed", processed=2, claimed=2, leaseLost=0, requestCount=2,
              queuedSignatures=3, health=HEALTH)


def execute(path, result, http_error=False):
    class FakeOpener:
        def open(self, request, timeout):
            assert request.full_url == "https://test-preview.vercel.app/api/holder-evidence-tick"
            assert request.get_method() == "POST"
            assert timeout == 75
            if http_error:
                raise urllib.error.HTTPError(request.full_url, 503, "Unavailable", {},
                    io.BytesIO(b'{"stage":"checkpoint","code":"EVIDENCE_JOB_NOT_FOUND"}'))
            return io.BytesIO(json.dumps(result).encode())

    output = io.StringIO()
    error = None
    environment = dict(GLITCH_PREVIEW_URL="https://test-preview.vercel.app",
                       GLITCH_HOLDER_WORKER_TOKEN="test-only-worker",
                       VERCEL_AUTOMATION_BYPASS_SECRET="test-only-bypass")
    with patch.dict(os.environ, environment, clear=True), \
         patch("urllib.request.build_opener", return_value=FakeOpener()), \
         patch("socket.socket", side_effect=AssertionError("Network forbidden in unit test")), \
         contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
        try:
            exec(embedded_python(path), {"__name__": "__main__"})
        except (SystemExit, urllib.error.HTTPError) as exc:
            error = exc
    return error, output.getvalue()


class WorkflowResponses(unittest.TestCase):
    def check(self, result, succeeds, marker=None):
        for path in WORKFLOWS:
            with self.subTest(workflow=str(path), response=result):
                error, output = execute(path, result)
                if succeeds:
                    self.assertIsNone(error, output)
                    self.assertNotIn("::error", output)
                else:
                    self.assertIsInstance(error, SystemExit, output)
                    self.assertNotEqual(error.code, 0)
                    self.assertIn("::error", output)
                    if marker:
                        self.assertIn(marker, output)
                self.assertNotIn("test-only-worker", output)
                self.assertNotIn("test-only-bypass", output)

    def test_processed_passes_but_missing_or_null_status_fails(self):
        self.check(copy.deepcopy(RESULT), True)
        legacy = copy.deepcopy(RESULT)
        legacy.pop("status")
        self.check(legacy, False, "unexpected_status")
        legacy["status"] = None
        self.check(legacy, False, "unexpected_status")

    def test_genuine_idle_with_valid_health_passes(self):
        self.check(dict(status="idle", processed=0, claimed=0, leaseLost=0, requestCount=0,
                        health={key: 0 for key in HEALTH}), True)

    def test_stale_job_fails_even_with_plausible_counts_and_health(self):
        self.check(dict(status="stale_job", processed=0), False, "unexpected_status")
        value = copy.deepcopy(RESULT)
        value["status"] = "stale_job"
        self.check(value, False, "unexpected_status")

    def test_malformed_and_unknown_status_fail(self):
        for value in [None, [], "ok", 1, {}]:
            self.check(value, False)
        for status in ["queued", "failed", "error", "missing_job", "no_progress", "stalled"]:
            value = copy.deepcopy(RESULT)
            value["status"] = status
            self.check(value, False, "unexpected_status")

    def test_missing_or_invalid_health_never_passes_as_idle(self):
        for health in [None, {}, [], {"retry_exhausted": 0, "expired_leases": 0}]:
            self.check(dict(status="idle", processed=0, claimed=0, leaseLost=0, requestCount=0, health=health), False,
                       "invalid_or_missing_health")
        for key in HEALTH:
            value = copy.deepcopy(RESULT)
            value["health"].pop(key)
            self.check(value, False, "invalid_or_missing_health")
        for count in [-1, True, "0", 0.5]:
            value = copy.deepcopy(RESULT)
            value["health"]["pending"] = count
            self.check(value, False, "invalid_or_missing_health")

    def test_health_issues_still_fail(self):
        for key in ["expired_leases", "retry_exhausted"]:
            value = copy.deepcopy(RESULT)
            value["health"][key] = 1
            self.check(value, False, key)

    def test_invalid_progress_fails(self):
        for key in ["processed", "requestCount"]:
            for count in [None, -1, True, "0", 0.5, 7]:
                value = copy.deepcopy(RESULT)
                value[key] = count
                self.check(value, False, "invalid_progress_counts")
        value = copy.deepcopy(RESULT)
        value["processed"] = 3
        self.check(value, False, "invalid_progress_counts")
        for count in [None, -1, True, "0", 0.5]:
            value = copy.deepcopy(RESULT)
            value["queuedSignatures"] = count
            self.check(value, False, "missing_queue_count")

    def test_idle_must_have_zero_work(self):
        value = copy.deepcopy(RESULT)
        value["status"] = "idle"
        self.check(value, False, "invalid_idle_response")

    def test_claim_contention_is_explicit_but_lease_loss_is_not_progress(self):
        no_claims = dict(status="no_claims", processed=0, claimed=0, leaseLost=0,
                         requestCount=0, queuedSignatures=3, health=copy.deepcopy(HEALTH))
        no_claims["health"]["active_leases"] = 1
        self.check(no_claims, True)
        for status in ["processed", "lease_lost"]:
            value = copy.deepcopy(no_claims)
            value["status"] = status
            self.check(value, False)
        value = copy.deepcopy(RESULT)
        value.update(processed=1, leaseLost=1)
        self.check(value, False, "lease_lost")
        value.update(status="lease_lost", processed=0, leaseLost=2)
        self.check(value, False, "unexpected_status")
        for key in ["claimed", "leaseLost"]:
            for count in [None, -1, True, "0", 0.5]:
                value = copy.deepcopy(RESULT)
                value[key] = count
                self.check(value, False, "invalid_claim_counts")

    def test_http_failure_cannot_pass(self):
        for path in WORKFLOWS:
            with self.subTest(workflow=str(path)):
                error, _ = execute(path, None, http_error=True)
                self.assertIsNotNone(error)


if __name__ == "__main__":
    unittest.main(argv=[sys.argv[0]], verbosity=2)
