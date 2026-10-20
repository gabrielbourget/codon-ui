"""One owned MainActivity launch for actual Card/editor queries and SDK observations."""
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
    replacements = [
        ("from validate import parse, validate", "from editor_validate import parse, parse_sdk, validate\nfrom editor_control import advance as advance_editor"),
        ('"ReactNativeJS:V", "*:S"', '"ReactNativeJS:V", "CUI_CARD_EDITOR_SDK:V", "AndroidRuntime:E", "DEBUG:E", "libc:F", "*:S"'),
        ('180 if inputs.get("profile") == "authoring" else 90', '180 if inputs.get("profile") in ["authoring", "card-editor"] else 90'),
        ('records, authoring_records = None, None', 'records, authoring_records = None, None\n        sdk_records = []\n        next_health = time.monotonic() + 5\n        health = 0'),
        ('while time.time() < deadline:\n            assert emulator.poll()', 'while time.time() < deadline:\n            if time.monotonic() >= next_health:\n                code, live_pid = device(f"app-alive-{health:02d}", ["shell", "pidof", package], 10, False)\n                health += 1\n                next_health = time.monotonic() + 5\n                assert code == 0 and live_pid.strip() == pid.strip(), "Original Card process exited"\n            assert emulator.poll()'),
        ('if candidate and candidate[-1].get("kind") == "terminal":', 'try: sdk_records = parse_sdk(data)\n            except (AssertionError, json.JSONDecodeError): sdk_records = []\n            if candidate:\n                advance_editor(device, candidate, sdk_records, state)\n                save()\n            if candidate and candidate[-1].get("kind") == "terminal":'),
        ('verdict = validate(records, "android", inputs["producer"])', 'assert sdk_records and all(row["pid"] == int(pid.strip()) for row in sdk_records), "Original SDK records must match launched app PID"\n        (root / "original-sdk-editor-journal.json").write_text(json.dumps(sdk_records, indent=2) + "\\n")\n        verdict = validate(records, "android", inputs["producer"], sdk_records)'),
        ('command(root, "failure-window",', 'command(root, "failure-native-crash", [ADB, "-s", SERIAL, "logcat", "-b", "crash", "-d", "-t", "200"], 30, required=False)\n            command(root, "failure-window",'),
        ("New metadata construction gate; original native callbacks/direct SDK queries; no physical input/profile/family acceptance", "Actual mounted Card cached-editor native queries and independent original SDK editor state; no full Card/profile/closure acceptance"),
        ("actual native host public SDK inspection", "actual native editor/cache/ref/selection and evaluated Card geometry correspondence"),
    ]
    for old, new in replacements:
        assert old in source, old
        source = source.replace(old, new)
    compile(source, "card-editor-live-runner", "exec")
    runner = root.parent / (root.name + "-live-runner.py")
    assert not runner.exists()
    runner.write_text(source)
    raise SystemExit(subprocess.call([sys.executable, "-u", str(runner), str(root)]))
