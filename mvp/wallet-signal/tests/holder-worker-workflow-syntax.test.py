"""Statically compile the manual holder workflow's Python without running it."""

import pathlib
import re
import textwrap
import unittest


WORKFLOW = (
    pathlib.Path(__file__).resolve().parents[3]
    / ".github/workflows/glitch-holder-worker-manual.yml"
)


def embedded_python(workflow):
    blocks = list(re.finditer(
        r"^(?P<indent> +)python3 - <<'PY'\n"
        r"(?P<source>.*?)^(?P=indent)PY[ \t]*$",
        workflow,
        re.MULTILINE | re.DOTALL,
    ))
    if len(blocks) != 1:
        raise ValueError("Expected exactly one complete Python heredoc")
    return textwrap.dedent(blocks[0].group("source"))


class HolderWorkerWorkflowSyntaxTests(unittest.TestCase):
    def test_embedded_python_compiles_without_execution(self):
        # compile() never executes scan requests or reads runtime credentials.
        compile(embedded_python(WORKFLOW.read_text()), f"{WORKFLOW}:embedded-python", "exec")

    def test_check_rejects_the_escaped_newline_regression(self):
        broken = (
            "        python3 - <<'PY'\n"
            "        class NoRedirect(urllib.request.HTTPRedirectHandler):\\n"
            "            def redirect_request(self,req,fp,code,msg,hdrs,newurl):\\n"
            "                raise RuntimeError('Redirect refused')\\n"
            "        opener=urllib.request.build_opener(NoRedirect)\n"
            "        PY\n"
        )
        with self.assertRaises(SyntaxError):
            compile(embedded_python(broken), "<escaped-newline-regression>", "exec")

    def test_check_rejects_a_missing_or_unclosed_heredoc(self):
        for workflow in ("", "        python3 - <<'PY'\n        pass\n"):
            with self.subTest(workflow=workflow), self.assertRaises(ValueError):
                embedded_python(workflow)


if __name__ == "__main__":
    unittest.main()
