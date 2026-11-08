"""Exercise maintained deadline paths with virtual time; no SDK or guest is started."""
import ast
import contextlib
import importlib
import io
import json
import os
from pathlib import Path
import runpy
import signal
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import NativeAndroidTestSupport as SUPPORT


def function(filename, name, namespace):
    tree = ast.parse((ROOT / filename).read_text())
    node = next(node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef) and node.name == name)
    exec(compile(ast.Module(body=[node], type_ignores=[]), filename, "exec"), namespace)
    return namespace[name]


class Budgets(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory();self.root = Path(self.temp.name)
    def tearDown(self): self.temp.cleanup()

    def test_pending_installer_can_finish_after60_seconds_within_overall_budget(self):
        value=[0.0]
        pause=lambda seconds:value.__setitem__(0,value[0]+seconds)
        pending=types.SimpleNamespace(exists=lambda:value[0]<65)
        wait=function("NativeXCTestBatch.py","wait_for_pending_transaction",{"time":types.SimpleNamespace(time=lambda:value[0],sleep=pause)})
        wait(pending,120)
        self.assertEqual(value[0],65)

    def test_pending_installer_stops_at_overall_deadline_without_installing(self):
        value=[0.0]
        pause=lambda seconds:value.__setitem__(0,value[0]+seconds)
        pending=types.SimpleNamespace(exists=lambda:True)
        wait=function("NativeXCTestBatch.py","wait_for_pending_transaction",{"time":types.SimpleNamespace(time=lambda:value[0],sleep=pause)})
        with self.assertRaisesRegex(TimeoutError,"overall work deadline"):wait(pending,55)
        self.assertEqual(value[0],55)

    def test_recorded_infrastructure_uses_owner_deadline_without_stage_cap(self):
        child = MagicMock(pid=12345);child.poll.return_value = 0;child.communicate.return_value = (b"valid", b"")
        clock = types.SimpleNamespace(time=lambda: 0)
        with patch.object(SUPPORT, "time", clock), patch.object(SUPPORT.subprocess, "Popen", return_value=child), patch.object(SUPPORT, "stop_owned_process", return_value=True):
            row = SUPPORT.recorded_command(["CONTROL_NO_SDK"], self.root / "result", None, 500)
        self.assertEqual(child.communicate.call_args.kwargs["timeout"], 492)
        self.assertTrue(row["ownedGroupGone"]);self.assertEqual(row["exitCode"], 0)

    def test_both_xctest_lifecycles_allow_infrastructure_past_old_stage_limits(self):
        for filename in ["NativeXCTestBatch.py", "NativeIndicatorG04Driver.py"]:
            root = self.root / filename;root.mkdir();moments = iter([0, 75, 75, 75])
            clock = types.SimpleNamespace(time=lambda: next(moments, 75), sleep=lambda _: None)
            child = MagicMock(pid=12345);child.poll.side_effect = [None, 0, 0]
            sdk = types.SimpleNamespace(Popen=MagicMock(return_value=child), STDOUT=subprocess.STDOUT, DEVNULL=subprocess.DEVNULL)
            namespace = dict(time=clock, root=root, now=lambda: "CONTROL_UTC", subprocess=sdk, os=os, children=[], rows=[], cleaning=False, work=500, cleanupDeadline=600, stop=lambda *args: True, json=json, signal=MagicMock())
            run = function(filename, "run", namespace)
            with self.subTest(path=filename), contextlib.redirect_stdout(io.StringIO()): row = run("controlled", ["NO_SDK"])
            self.assertNotIn("timedOut", row);self.assertEqual(row["exitCode"], 0);self.assertTrue(row["ownedGroupGone"])

    def test_shared_android_and_diagnostic_wrappers_pass_no_infrastructure_cap(self):
        for filename in ["NativeTagG02AndroidDriver.py", "NativeTagG02ObserverBuild.py", "NativeSimulatorInstallDiagnostic.py", "TextG02AndroidTests.py", "PlaceholderG02AndroidTests.py"]:
            root = self.root / filename;root.mkdir();calls = []
            def recorded(argv, prefix, cap, deadline, env=None):
                calls.append((cap, deadline));Path(prefix).with_suffix(".stdout").write_text("valid");Path(prefix).with_suffix(".stderr").write_text("")
                return {"ownedGroupGone": True, "exitCode": 0, "status": "TERMINAL"}
            namespace = dict(root=root, OUT=root, args=types.SimpleNamespace(out=root, deadline_unix=500, serial="CONTROL"), work=500, end=600, cleanup_deadline=600, env={}, rows=[], steps=[], number=0, serial_number=0, adb="NO_SDK", ADB="NO_SDK", time=types.SimpleNamespace(time=lambda: 0), now=lambda: "CONTROL_UTC", datetime=importlib.import_module("datetime"), json=json, write=lambda *args: None, recorded_command=recorded, require_success=lambda row: None)
            name = "command" if filename in ["TextG02AndroidTests.py", "PlaceholderG02AndroidTests.py"] else "run"
            run = function(filename, name, namespace)
            with self.subTest(path=filename), contextlib.redirect_stdout(io.StringIO()):
                if filename == "TextG02AndroidTests.py": run("control", ["NO_SDK"])
                elif filename == "PlaceholderG02AndroidTests.py": run("NO_SDK")
                else: run("control", ["NO_SDK"])
            self.assertEqual(calls, [(None, 500)])

    def test_both_observer_builds_use_admitted_budget_beyond_old_240_seconds(self):
        for filename in ["NativeXCTestObserverBuild.py", "NativeIndicatorG04ObserverBuild.py"]:
            tree = ast.parse((ROOT / filename).read_text())
            wait = next(node for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "wait")
            expression = next(key.value for key in wait.keywords if key.arg == "timeout")
            namespace = {"time": types.SimpleNamespace(monotonic=lambda: 400), "started": 0, "work_seconds": 1680}
            with self.subTest(path=filename): self.assertEqual(eval(compile(ast.Expression(expression), filename, "eval"), namespace), 1280)

    def test_closed_export_uses_admitted_work_budget_for_both_commands(self):
        import NativeCellVerification as ADMISSION
        out = self.root / "export";calls = []
        def recorded(argv, prefix, cap, deadline, env=None):
            calls.append((cap, deadline));return {"exitCode": 0, "ownedGroupGone": True}
        argv = ["NativeCellDiagnostics.py", "--cell", "CAT.meter.G02", "--bundle", str(self.root / "Closed.xcresult"), "--out", str(out)]
        import time
        started = time.time()
        with patch.object(sys, "argv", argv), patch.object(ADMISSION, "load_admission", return_value={"attempt": {"maximumSeconds": 1800, "cleanupReserveSeconds": 120}}), patch.object(SUPPORT, "recorded_command", side_effect=recorded), contextlib.redirect_stdout(io.StringIO()), self.assertRaises(SystemExit) as status:
            runpy.run_path(str(ROOT / "NativeCellDiagnostics.py"), run_name="__main__")
        self.assertEqual(status.exception.code, 0);self.assertEqual(len(calls), 2)
        self.assertTrue(all(cap is None and deadline - started > 1600 for cap, deadline in calls))

    def test_shared_paint_oracles_use_owner_budget_past_ten_seconds(self):
        for filename in ["MeterG02AndroidTests.py", "LinearProgressG02AndroidTests.py"]:
            tree = ast.parse((ROOT / filename).read_text())
            call = next(node for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "communicate")
            timeout = next(key.value for key in call.keywords if key.arg == "timeout")
            namespace = {"deadline": 500, "time": types.SimpleNamespace(time=lambda: 75)}
            with self.subTest(path=filename): self.assertEqual(eval(compile(ast.Expression(timeout), filename, "eval"), namespace), 417)

    def test_host_compilers_use_whole_control_activity_budget(self):
        for filename in ["test_tag_g02_android_check.py", "test_placeholder_g04.py"]:
            source = (ROOT / filename).read_text();tree = ast.parse(source);timeouts = []
            for call in ast.walk(tree):
                if isinstance(call, ast.Call) and isinstance(call.func, ast.Attribute) and call.func.attr == "run" and call.args and "jdk" in ast.get_source_segment(source, call.args[0]):
                    timeouts.extend(key.value for key in call.keywords if key.arg == "timeout")
            self.assertTrue(timeouts)
            for expression in timeouts:
                namespace = {"CONTROL_WORK_DEADLINE": 500, "time": types.SimpleNamespace(time=lambda: 75)}
                self.assertEqual(eval(compile(ast.Expression(expression), filename, "eval"), namespace), 417)

    def test_legacy_android_cleanup_uses_reserved_time_after_work_expires(self):
        tree = ast.parse((ROOT / "NativeTagG02AndroidDriver.py").read_text())
        call = next(node for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name) and node.func.value.id == "emu" and node.func.attr == "wait")
        expression = next(key.value for key in call.keywords if key.arg == "timeout")
        namespace = {"cleanup_deadline": 600, "entry_work": 500, "time": types.SimpleNamespace(time=lambda: 550)}
        self.assertEqual(eval(compile(ast.Expression(expression), "cleanup", "eval"), namespace), 42)

    def test_style_decoder_uses_same_owner_work_deadline(self):
        tree = ast.parse((ROOT / "MeterStyleAndroidCheck.py").read_text())
        call = next(node for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "run")
        timeout = next(key.value for key in call.keywords if key.arg == "timeout")
        namespace = {"args": types.SimpleNamespace(deadline_unix=500), "time": types.SimpleNamespace(time=lambda: 75)}
        self.assertEqual(eval(compile(ast.Expression(timeout), "decoder", "eval"), namespace), 417)


if __name__ == "__main__": unittest.main()
