"""No-SDK controls for the actual standalone XCTest runtime deadline binding."""
import hashlib
from pathlib import Path
import plistlib
import sys
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import NativeXCTestBatch as batch

METHODS = ["ControlTests/testOriginalAssertion"]
STANDALONE = ["IndicatorG04UITests.swift", "LinearProgressG02TrialTests.swift", "PlaceholderG02TrialTests.swift", "PlaceholderG04TrialTests.swift", "TagG02TrialTests.swift", "SliderHitLayoutTrialTests.swift"]


def helper(source):
    start = source.index("private func nativeWorkRemaining()")
    return source[start:source.index("\n}", start) + 2]


class RuntimeDeadlineTests(unittest.TestCase):
    def test_actual_runtime_copy_keeps_products_methods_and_original_input(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, output = Path(tmp) / "Prepared.xctestrun", Path(tmp) / "Runtime.xctestrun"
            target = {"OnlyTestIdentifiers": METHODS, "TestHostPath": "/prepared/Runner.app", "EnvironmentVariables": {"SOURCE": "a" * 64}, "TestTimeoutsEnabled": True, "MaximumTestExecutionTimeAllowance": 180}
            source.write_bytes(plistlib.dumps({"CodonNativeComponents": target}))
            original = source.read_bytes(); deadline = time.time() + 120
            result = batch.bind_runtime_deadline(source, output, deadline)
            actual = plistlib.loads(output.read_bytes())["CodonNativeComponents"]
            self.assertEqual(source.read_bytes(), original)
            self.assertEqual(result["preparedSHA256"], hashlib.sha256(original).hexdigest())
            self.assertEqual(result["selectedMethods"], METHODS)
            self.assertEqual(actual["TestHostPath"], target["TestHostPath"])
            self.assertFalse(actual["TestTimeoutsEnabled"])
            self.assertNotIn("MaximumTestExecutionTimeAllowance", actual)
            for key in ["EnvironmentVariables", "TestingEnvironmentVariables"]:
                self.assertEqual(float(actual[key]["CODON_NATIVE_WORK_DEADLINE_UNIX"]), deadline)
            self.assertEqual(actual["EnvironmentVariables"]["SOURCE"], "a" * 64)
            with self.assertRaises(AssertionError): batch.bind_runtime_deadline(source, output, deadline)

    def test_invalid_deadlines_fail_before_output_or_sdk(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "Prepared.xctestrun"
            source.write_bytes(plistlib.dumps({"CodonNativeComponents": {}}))
            for index, deadline in enumerate([None, True, 0, time.time() - 1, float("nan"), float("inf"), "1800"]):
                output = Path(tmp) / (str(index) + ".xctestrun")
                with self.subTest(deadline=deadline), self.assertRaises(AssertionError): batch.bind_runtime_deadline(source, output, deadline)
                self.assertFalse(output.exists())

    def test_compiled_assertions_cannot_be_excluded(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, output = Path(tmp) / "Prepared.xctestrun", Path(tmp) / "Runtime.xctestrun"
            source.write_bytes(plistlib.dumps({"CodonNativeComponents": {"SkipTestIdentifiers": METHODS}}))
            with self.assertRaises(AssertionError): batch.bind_runtime_deadline(source, output, time.time() + 120)
            self.assertFalse(output.exists())

    def test_each_standalone_helper_is_the_same_executed_shared_predicate(self):
        expected = helper((ROOT / "MeterG02TrialTests.swift").read_text())
        for name in STANDALONE:
            source = (ROOT / name).read_text()
            with self.subTest(source=name):
                self.assertEqual(helper(source), expected)
                self.assertNotRegex(source, r"timeout:\s*(?:5|10)\)")
        self.assertIn("timeout: 0.4", (ROOT / "PlaceholderG04TrialTests.swift").read_text())
        self.assertIn("timeout: 1", (ROOT / "TagG02TrialTests.swift").read_text())
        for name in ["NativeXCTestBatch.py", "NativeIndicatorG04Driver.py"]:
            source = (ROOT / name).read_text()
            self.assertIn("bind_runtime_deadline(", source)
            self.assertIn("runtime['path']", source)


if __name__ == "__main__":
    unittest.main()
