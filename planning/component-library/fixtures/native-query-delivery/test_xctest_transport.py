import os
import sys
import tempfile
import unittest
from pathlib import Path

from xctest_transport import callback_proof, native_progress, run_bounded


class TransportTests(unittest.TestCase):
    def test_callback_requires_native_owner_and_single_pass(self):
        method = "Tests/Tests/testTransportPreflight"
        summary = {"totalTestCount": 1, "passedTests": 1, "failedTests": 0}
        proof = {"frames": {"diag-transport-owner": {"label": "Transport 1"}}}
        self.assertTrue(callback_proof(summary, [proof], method))
        self.assertFalse(callback_proof(summary, [], method))
        self.assertFalse(callback_proof(summary, [proof, proof], method))
        self.assertFalse(callback_proof({**summary, "totalTestCount": 2}, [proof], method))
        self.assertFalse(callback_proof(summary, [proof], "Tests/Tests/testRaw"))

    def test_native_session_progress_excludes_bundle_initialization(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "Info.plist").write_text("metadata")
            self.assertEqual(native_progress(root), ())
            session = root / "Session-test.log"
            session.write_text("session started")
            before = native_progress(root)
            session.write_text("session started and runner connected")
            self.assertNotEqual(before, native_progress(root))

    def test_silent_process_is_stopped_and_recorded(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            result = run_bounded([sys.executable, "-c", "import time; time.sleep(20)"],
                                 root / "log", root / "result", os.environ.copy(), 2, 0.2, 0.02)
            self.assertEqual(result["stopReason"], "no-session-or-stdout-progress")
            self.assertLess(result["elapsedSeconds"], 2)
            self.assertNotEqual(result["exitCode"], 0)

    def test_continual_progress_still_has_total_cap(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            result = run_bounded([sys.executable, "-u", "-c",
                                  "import time\nwhile True:\n print('active'); time.sleep(.02)"],
                                 root / "log", root / "result", os.environ.copy(), 0.3, 0.2, 0.01)
            self.assertEqual(result["stopReason"], "total-cap")
            self.assertNotEqual(result["exitCode"], 0)

    def test_native_session_can_progress_without_stdout(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            native = root / "result"
            native.mkdir()
            script = ("from pathlib import Path\nimport sys,time\n"
                      "path=Path(sys.argv[1])\n"
                      "for index in range(8):\n path.write_text(str(index)); time.sleep(.04)")
            result = run_bounded([sys.executable, "-c", script, str(native / "Session-test.log")],
                                 root / "log", native, os.environ.copy(), 2, 0.15, 0.01)
            self.assertIsNone(result["stopReason"])
            self.assertEqual(result["exitCode"], 0)

    def test_failed_test_exit_is_preserved(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            result = run_bounded([sys.executable, "-c", "raise SystemExit(65)"],
                                 root / "log", root / "result", os.environ.copy(), 2, 1, 0.02)
            self.assertIsNone(result["stopReason"])
            self.assertEqual(result["exitCode"], 65)


if __name__ == "__main__":
    unittest.main()
