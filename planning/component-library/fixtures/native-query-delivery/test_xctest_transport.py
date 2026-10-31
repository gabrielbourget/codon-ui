import os
import plistlib
import sys
import tempfile
import unittest
from pathlib import Path

from xctest_transport import callback_proof, completed_method_verdict, native_progress, replay_selection, run_bounded


class TransportTests(unittest.TestCase):
    def test_private_launcher_requires_complete_frozen_product_selection(self):
        cache = Path("frozen/Build/Products/Tests.xctestrun")
        with self.assertRaises(ValueError):
            replay_selection(cache, project=Path("Harness.xcodeproj"))
        with self.assertRaises(ValueError):
            replay_selection(cache, Path("Harness.xcodeproj"), "Tests", Path("other-cache"))
        with self.assertRaises(ValueError):
            replay_selection(cache, Path("Harness.xcodeproj"), "Tests", Path("frozen"))
        self.assertEqual(replay_selection(cache), ["-xctestrun", str(cache.resolve())])

    def test_project_configuration_must_match_the_compiled_test_runner(self):
        with tempfile.TemporaryDirectory() as folder:
            derived = Path(folder)
            products = derived / "Build/Products"
            runner = products / "Release-iphonesimulator/Tests-Runner.app"
            bundle = runner / "PlugIns/Tests.xctest"
            bundle.mkdir(parents=True)
            frozen = products / "Tests.xctestrun"
            frozen.write_bytes(plistlib.dumps({"Tests": {
                "TestHostPath": "__TESTROOT__/Release-iphonesimulator/Tests-Runner.app",
                "TestBundlePath": "__TESTHOST__/PlugIns/Tests.xctest",
            }}))
            project = derived / "Harness.xcodeproj"
            with self.assertRaises(ValueError):
                replay_selection(frozen, project, "Tests", derived, "Debug")
            arguments = replay_selection(frozen, project, "Tests", derived, "Release")
            self.assertNotIn("-xctestrun", arguments)
            self.assertEqual(arguments[arguments.index("-configuration") + 1], "Release")
            bundle.rmdir()
            with self.assertRaises(ValueError):
                replay_selection(frozen, project, "Tests", derived, "Release")

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

    def test_runner_bootstrap_failure_is_not_a_completed_selected_method(self):
        summary = {"totalTestCount": 1, "passedTests": 0, "failedTests": 1,
                   "testFailures": [{"testIdentifierString": "Tests-Runner (77) encountered an error",
                                     "failureText": "Test crashed while preparing to run tests."}]}
        self.assertFalse(completed_method_verdict(summary, "Tests/Tests/testRaw"))
        self.assertFalse(completed_method_verdict({**summary, "testFailures": []}, "Tests/Tests/testRaw"))

    def test_actual_method_failures_remain_completed_failed_verdicts(self):
        summary = {"totalTestCount": 1, "passedTests": 0, "failedTests": 1,
                   "testFailures": [{"testIdentifierString": "Tests/testRaw()"}]}
        self.assertTrue(completed_method_verdict(summary, "Tests/Tests/testRaw"))
        self.assertFalse(completed_method_verdict(summary, "Tests/Tests/testInput"))
        self.assertFalse(completed_method_verdict({**summary, "totalTestCount": 2}, "Tests/Tests/testRaw"))

    def test_single_method_pass_and_skipped_result_are_distinct(self):
        summary = {"totalTestCount": 1, "passedTests": 1, "failedTests": 0}
        self.assertTrue(completed_method_verdict(summary, "Tests/Tests/testRaw"))
        self.assertFalse(completed_method_verdict({**summary, "passedTests": 0, "skippedTests": 1}, "Tests/Tests/testRaw"))

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
                                  "import time\nwhile True:\n print('active'); time.sleep(.03)"],
                                 root / "log", root / "result", os.environ.copy(), 1.2, 1, 0.02)
            self.assertEqual(result["stopReason"], "total-cap")
            self.assertNotEqual(result["exitCode"], 0)

    def test_slow_silent_completion_uses_the_configured_allowance(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            result = run_bounded([sys.executable, "-c", "import time; time.sleep(.4)"],
                                 root / "log", root / "result", os.environ.copy(), 3, 2, 0.02)
            self.assertIsNone(result["stopReason"])
            self.assertEqual(result["exitCode"], 0)

    def test_native_session_can_progress_without_stdout(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            native = root / "result"
            native.mkdir()
            script = ("from pathlib import Path\nimport sys,time\n"
                      "path=Path(sys.argv[1])\n"
                      "for index in range(16):\n path.write_text(str(index)); time.sleep(.2)")
            result = run_bounded([sys.executable, "-c", script, str(native / "Session-test.log")],
                                 root / "log", native, os.environ.copy(), 10, 2, 0.02)
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
