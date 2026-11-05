"""Host controls for the real standard SDK command and failure boundaries."""
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import NativeStandardTests as NATIVE


class StandardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory();self.root = Path(self.temp.name)
    def tearDown(self): self.temp.cleanup()

    def test_actual_entrypoint_refuses_missing_admission_before_sdk_or_output(self):
        path = self.root / "plan.json";out = self.root / "output"
        path.write_text(json.dumps({"cell": "CAT.meter.G02", "nativeStandard": {"platform": "ios", "output": str(out)}}))
        env = {key: value for key, value in os.environ.items() if key != "CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
        result = subprocess.run([sys.executable, "-B", str(ROOT / "NativeStandardTests.py"), "--plan", str(path)], env=env, capture_output=True, text=True, timeout=10)
        self.assertNotEqual(result.returncode, 0);self.assertIn("Use NativeCellVerification.py", result.stderr);self.assertFalse(out.exists())

    def test_exact_known_method_and_cohort_selection(self):
        self.assertEqual(NATIVE.selection("ios")["android"], [])
        self.assertEqual(NATIVE.selection("android")["ios"], [])
        self.assertEqual(len(NATIVE.selection("ios")["ios"]), 4)
        self.assertEqual(NATIVE.selection("android")["android"], ["values", "format", "motion", "events"])

    def test_sdk_xctestrun_binds_actual_product_and_preserves_sdk_host(self):
        template = self.root / "Build/Products/Tests.xctestrun";template.parent.mkdir(parents=True)
        template.write_bytes(plistlib.dumps({"CodonNativeComponents": {"TestHostPath": "__TESTROOT__/Release-iphonesimulator/Runner.app", "OnlyTestIdentifiers": ["Old/obsolete"]}}))
        app = {"product": "/actual/Product.app", "manifestSHA256": "a" * 64};observer = {"manifestSHA256": "b" * 64};out = self.root / "Tests.xctestrun"
        NATIVE.bind_xctestrun(template, app, observer, out)
        value = plistlib.loads(out.read_bytes())["CodonNativeComponents"]
        self.assertEqual(value["TestHostPath"], str(template.parent / "Release-iphonesimulator/Runner.app"))
        self.assertEqual(value["UITargetAppPath"], app["product"])
        self.assertNotIn("OnlyTestIdentifiers", value)
        self.assertTrue(value["TestTimeoutsEnabled"]);self.assertEqual(value["MaximumTestExecutionTimeAllowance"], 180)
        self.assertEqual(value["EnvironmentVariables"]["CODON_METER_PRODUCT_SHA256"], "a" * 64)
        self.assertEqual(value["TestingEnvironmentVariables"]["CODON_METER_OBSERVER_MANIFEST_SHA256"], "b" * 64)
        value["SkipTestIdentifiers"] = ["Required/testCase"];template.write_bytes(plistlib.dumps({"CodonNativeComponents": value}))
        with self.assertRaisesRegex(ValueError, "Do not exclude"): NATIVE.bind_xctestrun(template, app, observer, out)

    def test_product_identity_rejects_changed_missing_and_extra_files(self):
        product = self.root / "Product.app";product.mkdir();(product / "binary").write_bytes(b"real bounded control")
        expected = NATIVE.identity(product);self.assertEqual(NATIVE.verify_product(expected), product.resolve())
        for operation in ["change", "extra", "missing"]:
            (product / "binary").write_bytes(b"real bounded control")
            if (product / "extra").exists(): (product / "extra").unlink()
            if operation == "change": (product / "binary").write_bytes(b"wrong")
            elif operation == "extra": (product / "extra").write_bytes(b"wrong")
            else: (product / "binary").unlink()
            with self.subTest(operation=operation), self.assertRaisesRegex(ValueError, "Product files differ"): NATIVE.verify_product(expected)

    def test_actual_command_runner_fails_closed_on_sdk_exit_timeout_and_group(self):
        session = NATIVE.Session(self.root / "exit", 30, 10)
        with self.assertRaisesRegex(ValueError, "SDK command failed"):
            session.run("sdk", [sys.executable, "-c", "print('preserved stdout',flush=True);raise SystemExit(65)"])
        self.assertEqual(session.rows[0]["exitCode"], 65)
        self.assertIn("preserved stdout", (session.output / "sdk.stdout").read_text())
        session = NATIVE.Session(self.root / "timeout", 30, 10)
        with self.assertRaisesRegex(ValueError, "Command timeout"):
            session.run("sdk", [sys.executable, "-c", "import time;time.sleep(5)"], 0.05)
        self.assertTrue(session.rows[0]["timedOut"]);self.assertTrue(session.rows[0]["ownedGroupGone"])
        session = NATIVE.Session(self.root / "group", 30, 10)
        with patch.object(NATIVE, "stop_owned_process", return_value=False), self.assertRaisesRegex(ValueError, "cleanup failure"):
            session.run("sdk", [sys.executable, "-c", "pass"])

    def test_actual_execution_exit_rejects_failed_sdk_and_uncertain_cleanup(self):
        for index, failed, clean in [(0, False, True), (1, True, True), (2, False, False)]:
            out = self.root / str(index)
            plan = {"nativeStandard": {"action": "build", "platform": "ios", "batch": "meter-g02", "output": str(out)}, "bindings": {"observer": []}, "attempt": {"maximumSeconds": 30, "cleanupReserveSeconds": 10}}
            with patch.object(NATIVE, "build_ios", side_effect=ValueError("saved SDK65") if failed else None, return_value={"product": "CONTROL_NO_SDK"}), patch.object(NATIVE, "cleanup", side_effect=None if clean else ValueError("unverified shutdown")):
                code = NATIVE.execute(plan, {"result": "PASS", "scope": "host sentinel only"})
            self.assertEqual(code, 0 if not failed and clean else 1)
            record = json.loads((out / "terminal.json").read_text());self.assertEqual(record["cleanupVerified"], clean);self.assertEqual(record["gatePromotions"], 0)

    def test_no_sdk_build_recreates_or_copies_a_workspace(self):
        source = (ROOT / "NativeStandardTests.py").read_text()
        self.assertNotIn("copytree", source);self.assertNotIn("UI_SETUP_COMPLETE", source)
        self.assertNotIn("READY_FOR_UI_SETUP", source)
        self.assertIn('"build-for-testing"', source);self.assertIn('"test-without-building"', source)
        self.assertIn('"instrument"', source)
        project = (ROOT / "ios-native-tests/CodonNativeComponents.xcodeproj/project.pbxproj").read_text()
        self.assertIn("../MeterG02TrialTests.swift", project);self.assertNotIn("/tmp/", project)
        self.assertNotIn("Stepper", project);self.assertNotIn("SortFilter", project)

    def test_meter_assertion_methods_remain_byte_exact(self):
        baseline = json.loads((ROOT / "MeterG02SourceBaseline.json").read_text())
        for filename, rows in baseline.items():
            source = (ROOT / filename).read_text()
            for name, expected in rows.items():
                text = member(source, name)
                self.assertEqual(hashlib.sha256(text.encode()).hexdigest(), expected, name)

    def test_actual_meter_semantic_observer_rejects_wrong_targets_and_values(self):
        import MeterG02AndroidTests as checker
        native = {"id": checker.TARGET, "visible": True, "className": "android.view.View", "roleDescription": "Progress Bar", "windowRoots": 1, "windowNodes": [{"id": checker.TARGET}], "stateDescription": None, "contentDescription": checker.NAME + ", 25%", "rangeInfo": {"min": 0, "max": 100, "current": 25}, "currentValue": 25, "text": None, "textIsNull": True, "nativeUptimeMs": 1, "nativeEpochMs": 1}
        checker.semantic(native, 0, 100, 25, "25%")
        for change in [{"id": "wrong-target"}, {"currentValue": 75}, {"className": "android.widget.SeekBar"}, {"windowNodes": [{"id": checker.TARGET}, {"id": checker.TARGET}]}]:
            with self.subTest(change=change), self.assertRaises(AssertionError): checker.semantic({**native, **change}, 0, 100, 25, "25%")

    def test_failed_android_cohort_cannot_produce_native_success(self):
        source = (ROOT / "android-native-inspector/Actions.java").read_text()
        body = member(source, "private JSONObject meterG02BatchCurrent(")
        expression = re.search(r'result.put\("nativeActionSucceeded",(safe[^;]+)\);', body).group(1)
        expression = expression.replace("cases.length()", "actual").replace("names.length", "expected").replace("&&", " and ").replace("!failed", "not failed")
        for safe, failed, actual, expected, verdict in [(True, False, 4, 4, True), (True, True, 4, 4, False), (False, False, 4, 4, False), (True, False, 3, 4, False)]:
            self.assertEqual(eval(expression, {}, {"safe": safe, "failed": failed, "actual": actual, "expected": expected}), verdict)

    def test_missing_avd_directory_rejects_before_any_sdk_command(self):
        session = MagicMock()
        config = {"sdk": str(self.root), "destination": "emulator-5568", "avdHome": str(self.root), "avd": "missing", "androidUserHome": str(self.root)}
        with self.assertRaisesRegex(ValueError, "Selected AVD is missing"): NATIVE.run_android(session, config, {}, {})
        session.run.assert_not_called()

    def test_actual_emulator_spawn_receives_the_bound_avd_environment(self):
        (self.root / "owned.ini").write_text("path=existing-control\n")
        config = {"sdk": str(self.root), "destination": "emulator-5568", "avdHome": str(self.root), "avd": "owned", "androidUserHome": str(self.root), "gpu": "host"}
        session = NATIVE.Session(self.root / "output", 30, 10)
        session.run = MagicMock(side_effect=["", ValueError("stop before SDK wait")])
        socket_control = MagicMock();socket_control.__enter__.return_value.connect_ex.return_value = 111
        with patch.object(NATIVE.socket, "socket", return_value=socket_control), patch.object(NATIVE.subprocess, "Popen", return_value=MagicMock(pid=12345)) as spawn:
            with self.assertRaisesRegex(ValueError, "stop before SDK wait"): NATIVE.run_android(session, config, {}, {})
        environment = spawn.call_args.kwargs["env"]
        self.assertEqual(environment["ANDROID_AVD_HOME"], str(self.root))
        self.assertEqual(environment["ANDROID_USER_HOME"], str(self.root))
        self.assertEqual(environment["ANDROID_SDK_ROOT"], str(self.root))
        self.assertEqual(json.loads((session.output / "emulator-owner.json").read_text())["pid"], 12345)

    def test_actual_cleanup_waits_for_detachment_and_rejects_remaining_serial_or_port(self):
        config = {"platform": "android", "sdk": str(self.root), "destination": "emulator-5568"}
        for scenario in ["delayed-detachment", "remaining-serial", "remaining-port"]:
            session = NATIVE.Session(self.root / scenario, 60, 30)
            session.guest_owned = True;session.emulator = MagicMock()
            responses = ["", "emulator-5568 offline", ""] if scenario == "delayed-detachment" else None
            session.run = MagicMock(side_effect=responses) if responses else MagicMock(return_value="emulator-5568 offline" if scenario == "remaining-serial" else "")
            probe = MagicMock();probe.__enter__.return_value.connect_ex.return_value = 0 if scenario == "remaining-port" else 111
            with patch.object(NATIVE, "stop_owned_process", return_value=True), patch.object(NATIVE.time, "sleep"), patch.object(NATIVE.socket, "socket", return_value=probe):
                if scenario == "delayed-detachment":
                    NATIVE.cleanup(session, config)
                    self.assertEqual(session.run.call_count, 3)
                else:
                    with self.assertRaisesRegex(ValueError, "detachment not verified|port remains open"):
                        NATIVE.cleanup(session, config)


def member(source, signature):
    start = source.index(signature);opening = source.index("{", start);depth = 1;end = opening + 1
    # These preserved test/helper bodies contain balanced interpolation braces.
    while depth:
        depth += (source[end] == "{") - (source[end] == "}");end += 1
    return source[start:end]


if __name__ == "__main__": unittest.main()
