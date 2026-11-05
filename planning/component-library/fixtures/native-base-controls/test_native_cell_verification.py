import ast
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

GATE = Path(__file__).with_name("NativeCellVerification.py").resolve()
SPEC = importlib.util.spec_from_file_location("native_cell_gate", GATE)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class NativeCellAdmissionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="codon-native-cell-gate-")
        self.root = Path(self.temp.name)
        self.output = self.root / "driver-entered.json"
        self.driver = self.root / "sentinel.py"
        self.driver.write_text("import sys,json,os\nfrom pathlib import Path\nsys.path.insert(0," + repr(str(GATE.parent)) + ")\nfrom NativeCellVerification import load_admission\nadmission=load_admission(__file__,'CAT.indicator.G04',{'ios':['sentinel'],'android':['sentinel']})\nPath(" + repr(str(self.output)) + ").write_text(json.dumps({'pid':os.getpid(),'admission':admission}))\n")
        self.fixture = self.root / "fixture.txt"
        self.fixture.write_text("synthetic gate test; no component or SDK execution\n")
        binding = lambda path: {"path": str(path), "sha256": MODULE.digest(path)}
        self.control = self.root / "observer-controls.json"
        self.control.write_text(json.dumps({"status": "PASS", "observerSHA256": MODULE.digest(self.fixture), "fixtureSHA256": MODULE.digest(self.fixture), "controls": [{"name": "synthetic sentinel", "kind": "executed", "scope": "gate enforcement only", "result": "PASS"}]}))
        self.plan = {"cell": "CAT.indicator.G04", "checklist": {"version": MODULE.VERSION, "sha256": MODULE.digest(MODULE.CHECKLIST), "read": True, "reader": "unit-test"}, "preparation": {"allChecksPrepared": True, "compatibleChecksBatched": True}, "bindings": {key: [binding(self.fixture)] for key in ["source", "fixture", "observer"]}, "platforms": {key: {"selectedCohorts": ["sentinel"], "reusedEvidence": [], "remaining": ["sentinel"]} for key in ["ios", "android"]}, "observerControls": binding(self.control), "riskControls": {key: {"disposition": "unselected_by_risk", "reason": "Synthetic gate sentinel; no native qualification"} for key in MODULE.RISKS}, "attempt": {"maximumSeconds": 1800, "cleanupReserveSeconds": 120}, "driver": {**binding(self.driver), "argv": [sys.executable, str(self.driver)]}}
        self.plan["rubric"] = binding(MODULE.RUBRIC)
        self.plan["driver"]["cohorts"] = {"ios": ["sentinel"], "android": ["sentinel"]}

    def tearDown(self):
        self.temp.cleanup()

    def invoke(self, plan):
        path = self.root / "plan.json"
        path.write_text(json.dumps(plan))
        receipt = self.root / "preflight.json"
        process = subprocess.run([sys.executable, "-B", str(GATE), "--plan", str(path), "--receipt", str(receipt), "--run"], capture_output=True, text=True, timeout=10)
        return process, json.loads(receipt.read_text())

    def reject(self, change):
        plan = copy.deepcopy(self.plan)
        change(plan)
        process, receipt = self.invoke(plan)
        self.assertEqual(process.returncode, 2)
        self.assertEqual(receipt["status"], "REJECTED")
        self.assertFalse(self.output.exists(), "Rejected plans must never enter the driver")

    def test_valid_plan_executes_same_owner_and_records_version(self):
        process, receipt = self.invoke(self.plan)
        self.assertEqual(process.returncode, 0, process.stderr)
        entered = json.loads(self.output.read_text())
        self.assertEqual(entered["pid"], receipt["ownerPID"])
        self.assertEqual(entered["admission"]["version"], MODULE.VERSION)
        self.assertEqual(entered["admission"]["result"], "PASS")

    def test_missing_read_ack_rejects(self):
        self.reject(lambda plan: plan["checklist"].pop("read"))

    def test_stale_checklist_version_rejects(self):
        self.reject(lambda plan: plan["checklist"].update(version="old"))

    def test_changed_checklist_hash_rejects(self):
        self.reject(lambda plan: plan["checklist"].update(sha256="0" * 64))

    def test_changed_input_rejects(self):
        self.reject(lambda plan: plan["bindings"]["observer"][0].update(sha256="0" * 64))

    def test_missing_platform_rejects(self):
        self.reject(lambda plan: plan["platforms"].pop("android"))

    def test_unprepared_batch_rejects(self):
        self.reject(lambda plan: plan["preparation"].update(allChecksPrepared=False))

    def test_unbatched_checks_rejects(self):
        self.reject(lambda plan: plan["preparation"].update(compatibleChecksBatched=False))

    def test_missing_risk_disposition_rejects(self):
        self.reject(lambda plan: plan["riskControls"].pop("shadow"))

    def test_zero_cleanup_reserve_rejects(self):
        self.reject(lambda plan: plan["attempt"].update(cleanupReserveSeconds=0))

    def test_failed_bound_observer_controls_rejects(self):
        data = json.loads(self.control.read_text())
        data["status"] = "FAIL"
        self.control.write_text(json.dumps(data))
        self.reject(lambda plan: plan["observerControls"].update(sha256=MODULE.digest(self.control)))

    def test_wrong_observer_report_rejects(self):
        data = json.loads(self.control.read_text())
        data["observerSHA256"] = "0" * 64
        self.control.write_text(json.dumps(data))
        self.reject(lambda plan: plan["observerControls"].update(sha256=MODULE.digest(self.control)))

    def test_failed_individual_control_rejects_despite_pass_aggregate(self):
        data = json.loads(self.control.read_text())
        data["controls"][0]["result"] = "FAIL"
        self.control.write_text(json.dumps(data))
        self.reject(lambda plan: plan["observerControls"].update(sha256=MODULE.digest(self.control)))

    def test_missing_rubric_rejects(self):
        self.reject(lambda plan: plan.pop("rubric"))

    def test_actual_driver_batch_mismatch_rejects_before_work(self):
        plan = copy.deepcopy(self.plan)
        plan["platforms"]["ios"]["selectedCohorts"] = ["unadmitted"]
        plan["driver"]["cohorts"]["ios"] = ["unadmitted"]
        process, receipt = self.invoke(plan)
        self.assertEqual(receipt["status"], "PASS")
        self.assertNotEqual(process.returncode, 0)
        self.assertFalse(self.output.exists())

    def test_inconsistent_prepared_batch_rejects(self):
        self.reject(lambda plan: plan["platforms"]["ios"].update(selectedCohorts=["unbound"]))

    def test_over_budget_reused_native_pass_rejects(self):
        log = self.root / "native.log"
        log.write_text("Test Case '-[Module.Case testOverBudget]' passed (209.779 seconds).\n")
        item = {"path": str(log), "sha256": MODULE.digest(log), "claim": "synthetic native result control", "kind": "native_method", "format": "xctest_log", "method": "testOverBudget", "maximumSeconds": 180}
        self.reject(lambda plan: plan["platforms"]["ios"].update(reusedEvidence=[item]))

    def test_timeout_warning_rejects_raw_pass_within_duration(self):
        log = self.root / "native.log"
        log.write_text("Test Case '-[Module.Case testTimeout]' exceeded execution time allowance of 3 minutes.\nTest Case '-[Module.Case testTimeout]' passed (100 seconds).\n")
        item = {"path": str(log), "sha256": MODULE.digest(log), "claim": "synthetic timeout control", "kind": "native_method", "format": "xctest_log", "method": "testTimeout", "maximumSeconds": 180}
        self.reject(lambda plan: plan["platforms"]["ios"].update(reusedEvidence=[item]))

    def test_direct_driver_without_admission_rejects(self):
        env = {key: value for key, value in os.environ.items() if key != "CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
        process = subprocess.run([sys.executable, "-B", str(self.driver)], env=env, capture_output=True, text=True, timeout=10)
        self.assertNotEqual(process.returncode, 0)
        self.assertFalse(self.output.exists())

    def admission_receipt(self, **updates):
        receipt = {"status": "PASS", "cell": self.plan["cell"], "checklistVersion": MODULE.VERSION,
                   "checklistSHA256": MODULE.digest(MODULE.CHECKLIST), "driverSHA256": MODULE.digest(self.driver),
                   "ownerPID": os.getpid(), "driverArgv": self.plan["driver"]["argv"],
                   "driverCohorts": self.plan["driver"]["cohorts"]}
        receipt.update(updates)
        path = self.root / "load-admission.json"
        path.write_text(json.dumps(receipt))
        return path

    def load_bound_admission(self, receipt, argv=None, cohorts=None):
        with patch.dict(os.environ, {"CODON_NATIVE_CELL_PREFLIGHT_RECEIPT": str(receipt)}), \
             patch.object(sys, "argv", argv if argv is not None else [str(self.driver)]):
            return MODULE.load_admission(self.driver, self.plan["cell"], cohorts if cohorts is not None else self.plan["driver"]["cohorts"])

    def test_load_current_receipt_positive_control(self):
        path = self.admission_receipt()
        result = self.load_bound_admission(path)
        self.assertEqual(result, {"path": str(path), "sha256": MODULE.digest(path), "version": MODULE.VERSION, "result": "PASS"})
        self.assertFalse(self.output.exists())

    def test_load_failed_receipt_rejects(self):
        with self.assertRaisesRegex(ValueError, "Preflight did not admit"):
            self.load_bound_admission(self.admission_receipt(status="REJECTED"))

    def test_load_stale_receipt_rejects(self):
        for change in [{"checklistVersion": "old"}, {"checklistSHA256": "0" * 64}]:
            with self.subTest(change=change), self.assertRaisesRegex(ValueError, "Stale preflight checklist"):
                self.load_bound_admission(self.admission_receipt(**change))

    def test_load_wrong_owner_rejects(self):
        with self.assertRaisesRegex(ValueError, "another driver/owner"):
            self.load_bound_admission(self.admission_receipt(ownerPID=os.getpid() + 1))

    def test_load_changed_driver_bytes_rejects(self):
        path = self.admission_receipt()
        self.driver.write_text(self.driver.read_text() + "\n# Changed after admission\n")
        with self.assertRaisesRegex(ValueError, "another driver/owner"):
            self.load_bound_admission(path)

    def test_load_actual_argv_or_cohort_mismatch_rejects(self):
        path = self.admission_receipt()
        for args in [{"argv": [str(self.driver), "different-batch"]}, {"cohorts": {"ios": ["different"], "android": ["sentinel"]}}]:
            with self.subTest(args=args), self.assertRaisesRegex(ValueError, "argv/batch differs"):
                self.load_bound_admission(path, **args)

    def test_saved_native_controls(self):
        self.assertEqual(MODULE.saved_data_controls()["status"], "PASS")

    def test_maintained_entrypoints_reject_direct_invocation_before_work(self):
        prepared = self.root / "prepared"
        prepared.mkdir()
        (prepared / "profile-batches.json").write_text(json.dumps({"P01": {"selectedMethods": []}}))
        (prepared / "observer-build-request.json").write_text(json.dumps({"selectedMethods": []}))
        controls = GATE.parent
        output = self.root / "diagnostics"
        commands = [
            [str(controls / "NativeIndicatorG04Driver.py"), str(prepared)],
            [str(controls / "NativeIndicatorG04ObserverBuild.py"), str(prepared)],
            [str(controls / "NativeCellDiagnostics.py"), "--cell", self.plan["cell"], "--bundle", str(prepared), "--out", str(output)],
        ]
        env = {key: value for key, value in os.environ.items() if key != "CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
        for command in commands:
            with self.subTest(driver=command[0]):
                result = subprocess.run([sys.executable, "-B", *command], env=env, capture_output=True, text=True, timeout=10)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("Use NativeCellVerification.py before this driver", result.stderr)
        self.assertEqual(sorted(path.name for path in prepared.iterdir()), ["observer-build-request.json", "profile-batches.json"])
        self.assertFalse(output.exists())

    def test_maintained_controller_actual_exit_branch_preserves_failure(self):
        driver = GATE.with_name("NativeIndicatorG04Driver.py")
        tree = ast.parse(driver.read_text())
        start = next(index for index, node in enumerate(tree.body) if isinstance(node, ast.ImportFrom) and node.module == "NativeCellVerification" and any(alias.name == "driver_exit_code" for alias in node.names))
        branch = ast.Module(body=tree.body[start + 1:], type_ignores=[])
        code = compile(branch, str(driver), "exec")
        clean = {"selectedDeviceState": "1", "selectedGuestProcesses": [], "selectedGuestOrphanFileHolders": [], "cleanupErrors": [], "shutdownExitCode": 0, "withinAttemptBoundary": True, "cleanupWithin120Seconds": True}
        for sdk, coverage, cleanup, expected in [(65, False, True, 65), (0, False, True, 1), (0, True, False, 1), (0, True, True, 0)]:
            with self.subTest(sdk=sdk, coverage=coverage, cleanup=cleanup):
                values = {"driver_exit_code": MODULE.driver_exit_code, "rows": [{"name": "indicator", "exitCode": sdk}], "outcome": "INDICATOR_SELECTED_PROFILE_BATCH_PASS_PENDING_RECONCILIATION" if coverage else "INDICATOR_P01_EXIT_65", "summary": clean if cleanup else {**clean, "cleanupErrors": ["uncertain"]}}
                with self.assertRaises(SystemExit) as exited:
                    exec(code, values)
                self.assertEqual(exited.exception.code, expected)

    def test_closed_result_export_commands_preserve_scope(self):
        with patch.object(sys, "path", [str(GATE.parent), *sys.path]):
            import NativeCellDiagnostics
        for kind in ["diagnostics", "attachments"]:
            with self.subTest(kind=kind):
                rows = NativeCellDiagnostics.export_commands(Path("closed.xcresult"), Path("output"), kind)
                self.assertEqual(len(rows), 2)
                self.assertEqual(rows[1][0], kind)
                self.assertEqual(rows[1][1][1:], ["export", kind, "--path", "closed.xcresult", "--output-path", "output/" + kind])
                self.assertFalse(any("simctl" in arg or "xcodebuild" in arg for _, argv in rows for arg in argv))
        with self.assertRaises(ValueError):
            NativeCellDiagnostics.export_commands(Path("closed.xcresult"), Path("output"), "launch")

    def test_driver_exit_codes_preserve_sdk_failure_and_reject_incomplete_results(self):
        for sdk, coverage, cleanup, expected in [(65, False, True, 65), (0, False, True, 1), (0, True, False, 1), (None, False, True, 1), (-9, False, True, 1), (0, True, True, 0)]:
            with self.subTest(sdk=sdk, coverage=coverage, cleanup=cleanup):
                self.assertEqual(MODULE.driver_exit_code(sdk, coverage, cleanup), expected)


if __name__ == "__main__":
    unittest.main()
