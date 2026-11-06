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
        self.assertEqual(NATIVE.selection("android", "meter-style")["android"], ["dimensions", "geometry", "slots", "context-motion"])
        self.assertEqual(NATIVE.selection("ios", "meter-style")["ios"], ["MeterStyleTrialTests/" + name for name in NATIVE.IOS_STYLE_METHODS])
        self.assertEqual(NATIVE.selection("ios", "meter-style-remaining")["ios"], ["MeterStyleTrialTests/" + name for name in NATIVE.IOS_REMAINING_STYLE_METHODS])
        with self.assertRaises(ValueError): NATIVE.selection("android", "meter-style-remaining")
        self.assertEqual(NATIVE.selection("ios", "meter-style-affected")["ios"], ["MeterStyleTrialTests/testMeterStyleConstraint", "MeterStyleTrialTests/testMeterStyleMotionAndReset", "MeterStyleTrialTests/testMeterStyleRaised"])
        with self.assertRaises(ValueError): NATIVE.selection("android", "meter-style-affected")
        self.assertEqual(NATIVE.selection("ios", "meter-events")["ios"], ["MeterG02TrialTests/" + NATIVE.METHODS[-1]])
        with self.assertRaises(ValueError): NATIVE.selection("android", "meter-events")

    def test_sdk_xctestrun_binds_revision_specific_observer_on_supported_simulator_path(self):
        template = self.root / "Build/Products/Tests.xctestrun";template.parent.mkdir(parents=True)
        installed = self.root / "Installed.app";bundle = installed / "PlugIns/CodonNativeComponents.xctest";bundle.mkdir(parents=True)
        (bundle / "CodonNativeComponents").write_bytes(b"corrected actual observer")
        bundle_id = "dev.codonui.lab.components.r123456789abc.xctrunner"
        (installed / "Info.plist").write_bytes(plistlib.dumps({"CFBundleIdentifier": bundle_id}))
        template.write_bytes(plistlib.dumps({"CodonNativeComponents": {"TestHostPath": str(installed), "TestHostBundleIdentifier": bundle_id, "OnlyTestIdentifiers": ["Old/obsolete"]}}))
        app = {"product": "/actual/Product.app", "manifestSHA256": "a" * 64};observer = NATIVE.identity(installed);out = self.root / "Tests.xctestrun"
        NATIVE.bind_xctestrun(template, app, observer, out, installed)
        value = plistlib.loads(out.read_bytes())["CodonNativeComponents"]
        self.assertFalse(value.get("UseDestinationArtifacts", False))
        self.assertEqual(value["TestHostPath"], str(installed))
        self.assertEqual(value["TestHostBundleIdentifier"], bundle_id)
        self.assertEqual(value["UITargetAppBundleIdentifier"], "dev.codonui.showcase")
        self.assertEqual(value["UITargetAppPath"], app["product"])
        self.assertNotIn("OnlyTestIdentifiers", value)
        self.assertTrue(value["TestTimeoutsEnabled"]);self.assertEqual(value["MaximumTestExecutionTimeAllowance"], 180)
        self.assertEqual(value["EnvironmentVariables"]["CODON_METER_PRODUCT_SHA256"], "a" * 64)
        self.assertEqual(value["TestingEnvironmentVariables"]["CODON_METER_OBSERVER_MANIFEST_SHA256"], observer["manifestSHA256"])
        value["SkipTestIdentifiers"] = ["Required/testCase"];template.write_bytes(plistlib.dumps({"CodonNativeComponents": value}))
        with self.assertRaisesRegex(ValueError, "Do not exclude"): NATIVE.bind_xctestrun(template, app, observer, out, installed)
        value.pop("SkipTestIdentifiers");value["TestHostBundleIdentifier"] = "dev.codonui.lab.components.xctrunner";template.write_bytes(plistlib.dumps({"CodonNativeComponents": value}))
        NATIVE.bind_xctestrun(template, app, observer, out, installed)
        self.assertEqual(plistlib.loads(out.read_bytes())["CodonNativeComponents"]["TestHostBundleIdentifier"], bundle_id)
        value["TestHostBundleIdentifier"] = bundle_id;value["UseDestinationArtifacts"] = True;template.write_bytes(plistlib.dumps({"CodonNativeComponents": value}))
        with self.assertRaisesRegex(ValueError, "unsupported"): NATIVE.bind_xctestrun(template, app, observer, out, installed)

    def test_runtime_loaded_identity_rejects_retired_bundle_missing_log_and_changed_bytes(self):
        installed = self.root / "Current.app";bundle = installed / "PlugIns/CodonNativeComponents.xctest";bundle.mkdir(parents=True)
        executable = bundle / "CodonNativeComponents";executable.write_bytes(b"corrected executable")
        observer = NATIVE.identity(installed)
        diagnostics = self.root / "diagnostics";diagnostics.mkdir();log = diagnostics / "Session-tests.log"
        log.write_text("Loading test bundle at: " + bundle.as_uri() + "/\n")
        self.assertEqual(NATIVE.verify_loaded_observer(diagnostics, installed, observer)["executableSHA256"], NATIVE.digest(executable))
        log.write_text("Loading test bundle at: file:///Library/Caches/Dead/Old.app/PlugIns/CodonNativeComponents.xctest/\n")
        with self.assertRaisesRegex(ValueError, "Product files differ"): NATIVE.verify_loaded_observer(diagnostics, installed, observer)
        log.write_text("")
        with self.assertRaisesRegex(ValueError, "multiple or unrecorded"): NATIVE.verify_loaded_observer(diagnostics, installed, observer)
        log.write_text("Loading test bundle at: " + bundle.as_uri() + "/\n");executable.write_bytes(b"stale executable")
        with self.assertRaisesRegex(ValueError, "Product files differ"): NATIVE.verify_loaded_observer(diagnostics, installed, observer)

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

    def test_ios_installed_identity_is_required_before_xctest(self):
        device = "2244051E-D143-40F5-BEF1-7B4CCFC355A1"
        state = self.root / "Library/Developer/CoreSimulator/Devices" / device / "device.plist"
        state.parent.mkdir(parents=True);state.write_bytes(plistlib.dumps({"state": 1}))
        app_path = self.root / "Product.app";app_path.mkdir();(app_path / "main.jsbundle").write_bytes(b"current")
        observer_path = self.root / "Observer.app";observer_path.mkdir();(observer_path / "binary").write_bytes(b"current observer")
        bundle_id = "dev.codonui.lab.components.r123456789abc.xctrunner"
        (observer_path / "Info.plist").write_bytes(plistlib.dumps({"CFBundleIdentifier": bundle_id}))
        plugin = observer_path / "PlugIns/CodonNativeComponents.xctest";plugin.mkdir(parents=True);(plugin / "CodonNativeComponents").write_bytes(b"current plugin")
        stale = self.root / "Stale.app";stale.mkdir();(stale / "main.jsbundle").write_bytes(b"old installed bundle")
        wrong_observer = self.root / "WrongObserver.app";wrong_observer.mkdir();(wrong_observer / "binary").write_bytes(b"Indicator runner")
        app = NATIVE.identity(app_path);observer = NATIVE.identity(observer_path)
        template = self.root / "Template.xctestrun";template.write_bytes(plistlib.dumps({"CodonNativeComponents": {"TestHostPath": str(observer_path), "TestHostBundleIdentifier": bundle_id}}))
        observer["xctestrun"] = {"path": str(template), "sha256": NATIVE.digest(template)}
        raw = "\n".join("Test Case '-[CodonNativeComponents.MeterG02TrialTests " + name + "]' passed (1.0 seconds)." for name in NATIVE.METHODS)
        summary = {"result": "Passed", "totalTestCount": 4, "passedTests": 4, "failedTests": 0, "skippedTests": 0}
        for scenario in ["matching", "legacy-cutoff", "affected-method", "retired-plugin", "sdk-failed", "stale-app", "wrong-observer", "install-failed", "not-ready"]:
            session = MagicMock();session.output = self.root / scenario;session.output.mkdir()
            def command(name, argv, cap=None):
                if scenario == "not-ready" and name == "boot-readiness": raise ValueError("OS not ready")
                if scenario == "install-failed" and name == "install-app": raise ValueError("SDK install failed")
                if name in ["preflight-installed-app", "installed-app"]: return str(stale if scenario == "stale-app" else app_path)
                if name in ["preflight-installed-observer", "installed-observer"]: return str(wrong_observer if scenario == "wrong-observer" else observer_path)
                if name == "xctest":
                    if scenario == "sdk-failed": raise ValueError("SDK65")
                    return raw.splitlines()[-1] if scenario == "affected-method" else raw
                if name == "xctest-runtime-diagnostics":
                    logs = session.output / "runtime-diagnostics";logs.mkdir()
                    loaded = self.root / "Dead/Old.app/PlugIns/CodonNativeComponents.xctest" if scenario == "retired-plugin" else plugin
                    (logs / "Session-tests.log").write_text("Loading test bundle at: " + loaded.as_uri() + "/\n")
                if name == "xctest-summary": return json.dumps({**summary, "totalTestCount": 1, "passedTests": 1} if scenario == "affected-method" else summary)
                return ""
            session.run.side_effect = command
            config = {"destination": device, "batch": "meter-events" if scenario == "affected-method" else "meter-g02"}
            if scenario == "legacy-cutoff": config["installationMaximumSeconds"] = 1
            with self.subTest(scenario=scenario), patch.object(NATIVE.Path, "home", return_value=self.root):
                if scenario in ["matching", "legacy-cutoff", "affected-method"]: self.assertEqual(NATIVE.run_ios(session, config, app, observer)["status"], "PASS")
                else:
                    with self.assertRaises(ValueError): NATIVE.run_ios(session, {"destination": device}, app, observer)
            commands = [call.args[0] for call in session.run.call_args_list]
            if scenario in ["matching", "legacy-cutoff", "affected-method"]:
                self.assertTrue(all(len(call.args) == 2 for call in session.run.call_args_list))
                selected = next(call.args[1] for call in session.run.call_args_list if call.args[0] == "xctest")
                self.assertEqual(len([arg for arg in selected if str(arg).startswith("-only-testing:")]), 1 if scenario == "affected-method" else 4)
                self.assertLess(commands.index("boot-readiness"), commands.index("install-app"))
                self.assertLess(commands.index("preflight-installed-app"), commands.index("install-observer"))
                self.assertLess(commands.index("preflight-installed-observer"), commands.index("xctest"))
            elif scenario in ["retired-plugin", "sdk-failed"]:
                self.assertIn("xctest-runtime-diagnostics", commands);self.assertNotIn("xctest-summary", commands)
            else: self.assertNotIn("xctest", commands)
            if scenario == "not-ready": self.assertNotIn("install-app", commands)

    def test_existing_pending_app_observation_never_reissues_install(self):
        current = self.root / "Current.app";current.mkdir();(current / "main.jsbundle").write_bytes(b"selected product")
        old = self.root / "Old.app";old.mkdir();(old / "main.jsbundle").write_bytes(b"stale product")
        app = NATIVE.identity(current)
        for name, responses, passes in [("already-complete", [str(current)], True), ("longer-scoped-budget", [str(current)], True), ("resumes", [str(old), str(current)], True), ("remains-pending", [str(old), str(old)], False)]:
            session = MagicMock();session.output = self.root / name;session.output.mkdir();session.run.side_effect = responses;session.work = 1000
            clock = [0]
            def pause(seconds): clock[0] += seconds
            with self.subTest(name=name), patch.object(NATIVE.time, "time", side_effect=lambda: clock[0]), patch.object(NATIVE.time, "sleep", side_effect=pause):
                if passes: NATIVE.wait_ios_pending_app(session, "EXPLICIT-CONTROL-DEVICE", app, 300 if name == "longer-scoped-budget" else 10)
                else:
                    with self.assertRaisesRegex(ValueError, "no install reissued"): NATIVE.wait_ios_pending_app(session, "EXPLICIT-CONTROL-DEVICE", app, 300 if name == "longer-scoped-budget" else 10)
            observations = json.loads((session.output / "pending-app-observations.json").read_text())
            self.assertEqual(observations[-1]["matched"], passes)
            self.assertTrue(all(call.args[1][1] == "get_app_container" for call in session.run.call_args_list))
        for invalid in [0, -1, True, "180"]:
            with self.assertRaises(ValueError): NATIVE.wait_ios_pending_app(MagicMock(), "CONTROL", app, invalid)

    def test_resume_mode_preserves_identity_gate_and_diagnoses_pending_failure(self):
        device = "2244051E-D143-40F5-BEF1-7B4CCFC355A1"
        state = self.root / "Library/Developer/CoreSimulator/Devices" / device / "device.plist";state.parent.mkdir(parents=True);state.write_bytes(plistlib.dumps({"state": 1}))
        observer = self.root / "Observer.app";observer.mkdir();(observer / "Info.plist").write_bytes(plistlib.dumps({"CFBundleIdentifier": "dev.codonui.lab.components.r123456789abc.xctrunner"}))
        for passes in [True, False]:
            session = MagicMock();session.output = self.root / str(passes);session.output.mkdir()
            config = {"destination": device, "resumePendingApplicationInstall": True, "pendingInstallObservationSeconds": 180}
            session.run.return_value = "/registered-control-app"
            with patch.object(NATIVE.Path, "home", return_value=self.root), patch.object(NATIVE, "wait_ios_pending_app", side_effect=None if passes else ValueError("saved pending failure")), patch.object(NATIVE, "verify_product", side_effect=ValueError("stop at identity control")):
                with self.assertRaises(ValueError): NATIVE.run_ios(session, config, {}, {"product": str(observer)})
            names = [call.args[0] for call in session.run.call_args_list]
            self.assertFalse(any(name.startswith("install-") for name in names));self.assertNotIn("xctest", names)
            self.assertEqual("pending-install-diagnostics" in names, not passes)
            if passes: self.assertIn("preflight-installed-app", names)

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

    def test_infrastructure_uses_remaining_owner_budget_and_retains_cleanup_reserve(self):
        session = NATIVE.Session(self.root / "budget", 1800, 120)
        process = MagicMock(pid=54321);process.poll.return_value = 0
        with patch.object(NATIVE.subprocess, "Popen", return_value=process), patch.object(NATIVE, "stop_owned_process", return_value=True):
            session.run("sdk-infrastructure", ["CONTROL_NO_SDK"])
        actual = process.wait.call_args.kwargs["timeout"]
        self.assertGreater(actual, 1600);self.assertLessEqual(actual, session.work - session.start - 8)
        self.assertIsNone(session.rows[0]["explicitCapSeconds"]);self.assertEqual(session.rows[0]["deadlineKind"], "work")
        session.work = NATIVE.time.time() + 7
        with patch.object(NATIVE.subprocess, "Popen") as spawn, self.assertRaisesRegex(ValueError, "No command budget"):
            session.run("exhausted", ["CONTROL_NO_SDK"])
        spawn.assert_not_called()

    def test_swift_geometry_regression_program_uses_actual_observer_predicate(self):
        program = NATIVE.geometry_control_source()
        self.assertIn("9.9998779296875", program);self.assertIn("saved.doubleValue", program)
        self.assertIn("(9, 10, 3, false)", program);self.assertIn("Double.nan", program)
        self.assertIn("abs(delivered - expected) * scale <= 1", program)
        self.assertIn("stylePixelsMatch", program);self.assertIn("wrong[7] = 0", program)
        self.assertIn("shadowFallsDown",program);self.assertIn("[248,248,248,255]",program)

    def test_ios_style_reconciliation_requires_all_observations_and_exact_motion_restoration(self):
        from MeterStyleAndroidCheck import EXPECTED
        rows = [{"name":name,"wholeParentExact":True,"comparedPixels":100,"state":{"rootTag":1},"afterState":{"rootTag":1}} for names in EXPECTED.values() for name in names]
        raised = next(row for row in rows if row["name"]=="raised")
        raised.update(opaqueSamplesExact=True,shadowPresenceDirection=True,opaqueSamples=[{"rgba":rgba,"referenceRGBA":rgba}for rgba in [[37,99,235,255],[255,255,255,255],[158,158,158,255],[158,158,158,255]]],shadowSamples=[{"aboveRGBA":[248,248,248,255],"belowRGBA":[225,225,225,255]},{"aboveRGBA":[248,248,248,255],"belowRGBA":[227,227,227,255]}])
        def logs(values,restored="0"):
            return "\n".join("METER_STYLE_OBSERVATION " + json.dumps(row) for row in values) + "\nMETER_STYLE_MOTION_ORIGINAL 0\nMETER_STYLE_MOTION_RESTORED " + restored + "\n"
        self.assertEqual(len(NATIVE.reconcile_ios_styles(logs(rows))),28)
        raised["wholeParentExact"] = False
        self.assertEqual(len(NATIVE.reconcile_ios_styles(logs(rows))),28)
        wrong_shadow = json.loads(json.dumps(rows));next(row for row in wrong_shadow if row["name"]=="raised")["shadowSamples"][0]["belowRGBA"]=[255,255,255,255]
        with self.assertRaises(ValueError):NATIVE.reconcile_ios_styles(logs(wrong_shadow))
        for values,restored in [(rows[:-1],"0"),(rows+[rows[0]],"0"),(rows,"1"),([{**row,"wholeParentExact":False}for row in rows],"0"),([{**row,"afterState":{"rootTag":2}}for row in rows],"0")]:
            with self.assertRaises(ValueError):NATIVE.reconcile_ios_styles(logs(values,restored))

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
        self.assertIn("-no-window", spawn.call_args.args[0])
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
            with patch.object(NATIVE, "stop_owned_process", return_value=True), patch.object(NATIVE.time, "sleep", side_effect=lambda _: setattr(session, "end", session.end - 60)), patch.object(NATIVE.socket, "socket", return_value=probe):
                if scenario == "delayed-detachment":
                    NATIVE.cleanup(session, config)
                    self.assertEqual(session.run.call_count, 3)
                else:
                    with self.assertRaisesRegex(ValueError, "detachment not verified|port remains open"):
                        NATIVE.cleanup(session, config)


    def test_motion_preference_failure_still_stops_owned_guest_and_preserves_error(self):
        config = {"platform": "android", "sdk": str(self.root), "destination": "emulator-5568"}
        for name, original, restored in [("exact-null", "null", "null"), ("exact-value", "0.5", "0.5"), ("mismatch", "1", "0"), ("restore-fails", "1", None)]:
            session = NATIVE.Session(self.root / name, 60, 30);session.guest_owned = True;session.emulator = MagicMock();session.motion_setting = original
            def command(label, argv, *args, **kwargs):
                if label == "restore-motion-setting" and restored is None: raise ValueError("SDK denied restoration")
                return restored if label == "verify-motion-setting" else ""
            session.run = MagicMock(side_effect=command)
            probe = MagicMock();probe.__enter__.return_value.connect_ex.return_value = 111
            with patch.object(NATIVE, "stop_owned_process", return_value=True) as stopped, patch.object(NATIVE.socket, "socket", return_value=probe):
                NATIVE.cleanup(session, config)
            stopped.assert_called_once_with(session.emulator)
            self.assertIn("emulator-shutdown", [call.args[0] for call in session.run.call_args_list])
            self.assertEqual(bool(session.cleanup_errors), name in ["mismatch", "restore-fails"])
            if name == "exact-null": self.assertIn("delete", session.run.call_args_list[0].args[1])


def member(source, signature):
    start = source.index(signature);opening = source.index("{", start);depth = 1;end = opening + 1
    # These preserved test/helper bodies contain balanced interpolation braces.
    while depth:
        depth += (source[end] == "{") - (source[end] == "}");end += 1
    return source[start:end]


if __name__ == "__main__": unittest.main()
