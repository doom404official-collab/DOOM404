"""Run the scheduled workflow's actual Python with synthetic HTTP only."""
import contextlib
import io
import json
import os
from pathlib import Path
import re
import textwrap
import unittest
import urllib.error
from unittest.mock import patch

path = Path(__file__).resolve().parents[1] / 'workflows/glitch-holder-worker-auto.yml'
source = path.read_text()
match = re.search(r"(?m)^( +)python3 - <<'PY'\n", source)
code = compile(textwrap.dedent(source[match.end():source.index(match[1] + 'PY', match.end())]), str(path), 'exec')


def execute(ticks):
    calls = []
    class Opener:
        def open(self, request, timeout):
            calls.append(request.full_url.split('.app')[-1])
            if '/holder-scan-status?' in request.full_url:
                result = dict(status='partial', jobId='latest-job', scan=dict(transactionsChecked=7))
            else:
                assert request.full_url.endswith('/api/holder-scan-tick')
                result = ticks.pop(0)
                if isinstance(result, Exception):
                    raise result
            return io.BytesIO(json.dumps(result).encode())
    output = io.StringIO()
    error = None
    env = dict(GLITCH_PREVIEW_URL='https://doom404-wallet-signal-git-feature-glitch-assess-3d8131-doom-404.vercel.app',
               GLITCH_HOLDER_WORKER_TOKEN='private-worker', GLITCH_HOLDER_SCAN_INTERNAL_TOKEN='private-start',
               VERCEL_AUTOMATION_BYPASS_SECRET='private-bypass')
    with patch.dict(os.environ, env, clear=True), patch('urllib.request.build_opener', return_value=Opener()), \
         patch('socket.socket', side_effect=AssertionError('No network permitted')), \
         patch('time.sleep'), contextlib.redirect_stdout(output):
        try:
            exec(code, {'__name__': '__main__'})
        except (SystemExit, RuntimeError) as exc:
            error = exc
    return error, [json.loads(line) for line in output.getvalue().splitlines()], calls


class TickObservability(unittest.TestCase):
    def test_alternating_jobs_and_verification_are_attributed_separately(self):
        ticks = [dict(status='partial', requestCount=n, jobId=j, holderSetHash=h,
                      checkpoint='private-history', credentials='private-secret')
                 for n, j, h in [(20, 'a', 'ha'), (3, 'b', 'hb'), (18, 'a', 'ha'), (1, 'b', 'hb')]]
        error, logs, calls = execute(ticks)
        self.assertIsNone(error)
        self.assertEqual([row['jobId'] for row in logs], ['a', 'b', 'a', 'b', 'latest-job'])
        self.assertEqual([row['holderSetHash'] for row in logs[:4]], ['ha', 'hb', 'ha', 'hb'])
        self.assertEqual(len(calls), 6)
        for row in logs[:4]:
            self.assertEqual(set(row), {'step', 'batch', 'status', 'requestCount', 'jobId', 'holderSetHash'})
        self.assertNotIn('private-', json.dumps(logs))

    def test_idle_has_no_invented_identity(self):
        error, logs, calls = execute([dict(status='idle')])
        self.assertIsNone(error)
        self.assertIsNone(logs[0]['jobId'])
        self.assertIsNone(logs[0]['holderSetHash'])
        self.assertEqual(len(calls), 3)

    def test_legacy_response_preserves_compatibility(self):
        error, logs, _ = execute([dict(status='complete', requestCount=2)])
        self.assertIsNone(error)
        self.assertIsNone(logs[0]['jobId'])

    def test_failed_tick_still_stops(self):
        error, logs, calls = execute([dict(status='failed', jobId='a', holderSetHash='ha')])
        self.assertIsInstance(error, SystemExit)
        self.assertEqual(len(calls), 2)
        self.assertEqual(logs[0]['jobId'], 'a')

    def test_http_error_has_no_identity_or_raw_body(self):
        exc = urllib.error.HTTPError('https://offline.invalid', 401, 'private-secret', {}, io.BytesIO(b'private-history'))
        error, logs, calls = execute([exc])
        self.assertEqual(str(error), 'Endpoint HTTP 401')
        self.assertEqual(logs, [])
        self.assertEqual(len(calls), 2)


if __name__ == '__main__':
    unittest.main()
