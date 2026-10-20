"""Adapt the existing one-boot/install/launch runner for original native font records."""
from pathlib import Path
import argparse
import subprocess
import sys

from font_snapshot_build import COLLECTION, FIXTURE, verify


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    arguments = parser.parse_args()
    root = arguments.root.resolve()
    verify(root)
    source = (COLLECTION / "run.py").read_text()
    source = "import sys\nsys.path.insert(0, " + repr(str(COLLECTION)) + ")\nsys.path.insert(0, " + repr(str(FIXTURE)) + ")\n" + source
    source = source.replace("from validate import parse, validate", "from font_validate import parse, validate")
    source = source.replace('activity = re.search(r"launchable-activity: name=\'([^\']+)\'", text)[1]', 'activity = inputs["nativeActivity"]')
    source = source.replace('"ReactNativeJS:V", "*:S"', '"CUI_CARD_FONT:V", "AndroidRuntime:E", "DEBUG:E", "libc:F", "*:S"')
    source = source.replace("New metadata construction gate; original native callbacks/direct SDK queries; no physical input/profile/family acceptance", "Installed native font isolation gate; no full Card/editor/physical/profile acceptance")
    source = source.replace("actual native host public SDK inspection", "actual pinned font span/cache/layout correspondence")
    source = source.replace('state["nativeCallbackCount"] =', 'assert records[0]["pid"] == int(pid.strip()), "Original native journal PID does not match the launched app"\n        state["nativeCallbackCount"] =')
    source = source.replace('command(root, "failure-window",', 'command(root, "failure-native-crash", [ADB, "-s", SERIAL, "logcat", "-b", "crash", "-d", "-t", "200"], 30, required=False)\n            command(root, "failure-window",')
    runner = root.parent / (root.name + "-live-runner.py")
    assert not runner.exists(), "Never replace an executed cohort helper"
    runner.write_text(source)
    raise SystemExit(subprocess.call([sys.executable, "-u", str(runner), str(root)]))
