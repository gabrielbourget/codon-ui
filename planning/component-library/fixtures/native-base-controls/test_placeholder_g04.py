"""Controls for the actual Placeholder packet checker and Java glyph-pixel helper."""
from pathlib import Path
import copy
import importlib.util
import json
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("pht", ROOT / "PlaceholderG04AndroidCheck.py")
CHECKER = importlib.util.module_from_spec(spec)
spec.loader.exec_module(CHECKER)


import time
CONTROL_WORK_DEADLINE = time.time() + 1800 - 120

class Controls(unittest.TestCase):
    def packet(self, root):
        cohorts = []
        for name, observations in CHECKER.EXPECTED.items():
            rows = []
            for label in observations:
                color = 0xFF7E22CE if any(value in label for value in ["final", "explicit", "first-action"]) else 0xFFA66B00 if "custom" in label and "computed" not in label else 0xFF878787 if label == "dark-default" else 0xFF707070
                narrow = label.startswith("narrow-")
                state = {"rootTag": 128, "refIdentity": 1, "dropped": 0, "actions": 1 if "after-first-action" in label else 0, "receipts": [{"kind": value} for value in ["pressIn", "pressOut", "press"]] if "after-first-action" in label else []}
                rows.append({"name": label, "expectedARGB": color, "opaquePixelCount": 137, "frame": [45, 400, 200 if narrow else 630, 92 if narrow else 45], "target": {"id": "library-placeholder"}, "state": state, "png": label + ".png"})
                (root / (label + ".png")).write_bytes(b"\x89PNG\r\n\x1a\nCONTROL_ONLY")
            cohorts.append({"name": name, "status": "NATIVE_ASSERTIONS_PASSED_PENDING_HOST_REVIEW", "elapsedMs": 89000, "observations": rows})
        return {"operation": "placeholder-g04-batch", "nativeActionSucceeded": True, "cohorts": cohorts, "preNavigationReadiness": {"status": "READY", "clearObservedMs": 30000, "fixtureNavigationBeforeReady": 0, "testInputBeforeReady": 0}, "setup": {"status": "READY_FROM_ACTUAL_SINGLE_CONNECTION", "clearObservedMs": 30000}}

    def test_complete_control_packet_and_discriminating_negatives(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            packet = self.packet(root)
            self.assertEqual(len(CHECKER.verify(packet, root)), 3)
            changes = [
                lambda p: p["preNavigationReadiness"].update(status="FAILED"),
                lambda p: p["preNavigationReadiness"].update(clearObservedMs=29999),
                lambda p: p["preNavigationReadiness"].update(fixtureNavigationBeforeReady=1),
                lambda p: p["setup"].update(status="FAILED"),
                lambda p: p.update(nativeActionSucceeded=False),
                lambda p: p["cohorts"].pop(),
                lambda p: p["cohorts"][0].update(elapsedMs=1800001),
                lambda p: p["cohorts"][0].update(status="FAILED_ASSERTION"),
                lambda p: p["cohorts"][0]["observations"].pop(),
                lambda p: p["cohorts"][0]["observations"][0].update(expectedARGB=0xFF0000FF),
                lambda p: p["cohorts"][0]["observations"][0].update(opaquePixelCount=4),
                lambda p: p["cohorts"][0]["observations"][0].update(frame=[45,400,-1,20]),
                lambda p: p["cohorts"][0]["observations"][0]["target"].update(id="library-state"),
                lambda p: p["cohorts"][0]["observations"][0]["state"].update(dropped=1),
                lambda p: p["cohorts"][2]["observations"][2].update(frame=[45,400,630,92]),
                lambda p: p["cohorts"][2]["observations"][2].update(frame=[45,400,200,45]),
                lambda p: p["cohorts"][2]["observations"][3]["state"].update(actions=2),
                lambda p: p["cohorts"][2]["observations"][3]["state"]["receipts"].reverse(),
            ]
            for change in changes:
                bad = copy.deepcopy(packet)
                change(bad)
                with self.assertRaises(ValueError): CHECKER.verify(bad, root)
            (root / "light-default.png").unlink()
            with self.assertRaisesRegex(ValueError, "PNG missing"): CHECKER.verify(packet, root)

    def test_actual_shared_lifecycle_exit_branch(self):
        import ast
        tree = ast.parse((ROOT / "NativeTagG02AndroidDriver.py").read_text())
        branch = compile(ast.Module(body=[tree.body[-1]], type_ignores=[]), "actual-shared-final-exit", "exec")
        class Clock:
            @staticmethod
            def time(): return 100
        for success, clean in [(True, True), (False, True), (True, False)]:
            values = {"passed_outcome": "PLACEHOLDER_G04_BATCH_PENDING_ROOT_REVIEW", "outcome": "PLACEHOLDER_G04_BATCH_PENDING_ROOT_REVIEW" if success else "STOP_AssertionError", "guest_verified": True, "profile_preferences_restored": True, "profile_settings": {}, "serial_absent": True, "ports_free": True, "group_present": False, "cleanup_errors": [] if clean else ["uncertain cleanup"], "time": Clock(), "end": 1800}
            with self.assertRaises(SystemExit) as result: exec(branch, values)
            self.assertEqual(result.exception.code, 0 if success and clean else 1)

    def test_placeholder_mode_rejects_missing_admission_before_sdk(self):
        import os, sys
        env = {key: value for key, value in os.environ.items() if key != "CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
        result = subprocess.run([sys.executable, "-B", str(ROOT / "NativeTagG02AndroidDriver.py"), "--cell", "CAT.placeholder-text.G04", "--prepared", "/tmp/PLACEHOLDER_UNIT_CONTROL_NO_SDK.json"], env=env, capture_output=True, text=True, timeout=10)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Use NativeCellVerification.py", result.stderr)
        self.assertNotIn("ADMISSION", result.stdout)

    def test_actual_readiness_gate_blocks_navigation_and_input(self):
        source = (ROOT / "android-native-inspector/Actions.java").read_text()
        def member(signature):
            start = source.index(signature);opening = source.index("{", start);depth, end = 1, opening + 1
            while depth:
                depth += (source[end] == "{") - (source[end] == "}");end += 1
            return source[start:end]
        members = "\n".join(member(value) for value in ["  private interface ReadinessProbe", "  private interface AdmittedAction", "  private static final class ReadinessGate", "  private static void admitPlaceholderReadiness("])
        main = r'''public static void main(String[] args) throws Exception {
          ReadinessGate navigation=new ReadinessGate(),input=new ReadinessGate();int[] effects={0,0};
          AdmittedAction navigate=()->effects[0]++,act=()->effects[1]++;
          try{navigation.run(navigate);throw new AssertionError("Unadmitted navigation ran");}catch(IllegalStateException expected){}
          try{input.run(act);throw new AssertionError("Unadmitted input ran");}catch(IllegalStateException expected){}
          for(int mode=0;mode<4;mode++){
            final int selected=mode;
            try{admitPlaceholderReadiness(navigation,input,()->{if(selected==0)return false;if(selected==1)throw new Exception("Saved unhealthy window");return true;},()->{navigation.run(navigate);if(selected==2)return false;throw new Exception("Component not ready");});throw new AssertionError("Failed readiness admitted");}catch(Exception expected){}
            try{navigation.run(navigate);throw new AssertionError("Navigation stayed admitted after failure");}catch(IllegalStateException expected){}
            try{input.run(act);throw new AssertionError("Input stayed admitted after failure");}catch(IllegalStateException expected){}
            if(effects[1]!=0)throw new AssertionError("Failed readiness ran test input");
            if(mode<2&&effects[0]!=0)throw new AssertionError("Failed host readiness navigated fixture");
          }
          int before=effects[0];admitPlaceholderReadiness(navigation,input,()->true,()->{navigation.run(navigate);return true;});input.run(act);
          if(effects[0]!=before+1||effects[1]!=1)throw new AssertionError("Normal path lost");
          try{admitPlaceholderReadiness(navigation,input,()->false,()->true);throw new AssertionError("Recheck did not fail");}catch(IllegalStateException expected){}
          try{input.run(act);throw new AssertionError("Prior successful admission survived failed recheck");}catch(IllegalStateException expected){}
          System.out.println("ACTUAL_READINESS_GUARD_FAIL_CLOSED_AND_NORMAL_PATH_PASS");
        }'''
        jdk = Path("/Users/gabrielbourget/.local/share/codon-native-lab/jdk/Contents/Home/bin")
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/"Readiness.java").write_text("public class Readiness {"+members+main+"}")
            subprocess.run([str(jdk/"javac"),"-d",str(root),str(root/"Readiness.java")],check=True,capture_output=True,timeout=CONTROL_WORK_DEADLINE - time.time() - 8)
            result=subprocess.run([str(jdk/"java"),"-XX:ActiveProcessorCount=1","-cp",str(root),"Readiness"],check=True,capture_output=True,text=True,timeout=CONTROL_WORK_DEADLINE - time.time() - 8)
            self.assertIn("ACTUAL_READINESS_GUARD_FAIL_CLOSED_AND_NORMAL_PATH_PASS",result.stdout)

    def test_actual_java_pixel_helper(self):
        source = (ROOT / "android-native-inspector/Actions.java").read_text()
        signature = "  private static int[] placeholderPaintRows("
        start = source.index(signature)
        opening = source.index("{", start)
        depth, end = 1, opening + 1
        while depth:
            depth += (source[end] == "{") - (source[end] == "}")
            end += 1
        method = source[start:end]
        main = '''public static void main(String[] args) {
          int p=0xff7e22ce,b=0xffffffff;
          int[] positive=placeholderPaintRows(new int[]{p,p,b,b,b,b,p,p},2,p);
          if(positive[0]!=4||positive[1]!=2)throw new AssertionError("Exact pixels/two row groups");
          int[] wrong=placeholderPaintRows(new int[]{p,p,b,b,b,b,p,p},2,0xff0000ff);
          if(wrong[0]!=0||wrong[1]!=0)throw new AssertionError("Wrong color must fail");
          int[] edge=placeholderPaintRows(new int[]{0xff7e22cd,p,p,b},2,p);
          if(edge[0]!=2)throw new AssertionError("Near color is never counted");
          try{placeholderPaintRows(new int[]{p},2,p);throw new AssertionError("Fractional row accepted");}catch(IllegalArgumentException expected){}
          System.out.println("ACTUAL_JAVA_PIXEL_HELPER_CONTROLS_PASS");
        }'''
        jdk = Path("/Users/gabrielbourget/.local/share/codon-native-lab/jdk/Contents/Home/bin")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "Pixels.java").write_text("public class Pixels {" + method + main + "}")
            subprocess.run([str(jdk / "javac"), "-d", str(root), str(root / "Pixels.java")], check=True, capture_output=True, timeout=CONTROL_WORK_DEADLINE - time.time() - 8)
            result = subprocess.run([str(jdk / "java"), "-XX:ActiveProcessorCount=1", "-cp", str(root), "Pixels"], check=True, capture_output=True, text=True, timeout=CONTROL_WORK_DEADLINE - time.time() - 8)
            self.assertIn("ACTUAL_JAVA_PIXEL_HELPER_CONTROLS_PASS", result.stdout)


if __name__ == "__main__":
    unittest.main()
