"""One owned UIKit boot/install/launch and original mounted Card journal; no replay."""
from pathlib import Path
import argparse
import json
import plistlib
import re
import shutil
import time

from continuous_uikit_probe import DEVICE, DEVICE_NAME, RUNTIME, native_command
from ios_geometry_build import command, digest, verify
from ios_geometry_validate import PROBE, parse, validate


def run(root):
    inputs = verify(root)
    product = json.loads((root / "ios-product.json").read_text())
    app = root / "CodonNativeShowcase.app"
    assert inputs["producer"] == product["producer"] and product["unsignedSimulator"]
    for name, expected in product["appFilesSHA256"].items(): assert digest(app / name) == expected, name
    bundle = plistlib.loads((app / "Info.plist").read_bytes())["CFBundleIdentifier"]
    assert bundle == "dev.codonui.showcase"
    state_path = root / "native-run.json"
    assert not state_path.exists(), "Never replay a recorded native cohort"
    started = time.monotonic()
    deadline = started + 420
    state = {"platform": "ios", "device": DEVICE, "totalCapSeconds": 480, "cleanupReserveSeconds": 60,
        "startedUnix": time.time(), "bootAttempts": 0, "installAttempts": 0, "launchAttempts": 0, "externalTestInputActions": 0, "scope": inputs["scope"]}

    def save(): state_path.write_text(json.dumps(state, indent=2) + "\n")
    def sim(name, args, cap=30, required=True):
        return native_command(root, name, ["/usr/bin/xcrun", "simctl", *args], deadline, cap, required)
    def inventory(name, cleanup=False):
        args = ["/usr/bin/xcrun", "simctl", "list", "devices", "available", "--json"]
        _, data = command(root, name, args, 5) if cleanup else native_command(root, name, args, deadline)
        return json.loads(data)

    save()
    try:
        devices = inventory("initial-devices")
        retained = [row for row in devices["devices"].get(RUNTIME, []) if row["udid"] == DEVICE]
        assert len(retained) == 1 and retained[0]["name"] == DEVICE_NAME and retained[0]["state"] == "Shutdown"
        assert not [row for group in devices["devices"].values() for row in group if row["state"] == "Booted"], "Another guest is active"
        state.update({"ownedShutdownGuest": True, "bootAttempts": 1, "stage": "boot"})
        save()
        sim("boot", ["boot", DEVICE])
        sim("boot-status", ["bootstatus", DEVICE, "-b"], 180)
        state.update({"stage": "install", "installAttempts": 1})
        save()
        sim("install", ["install", DEVICE, app], 120)
        _, location = sim("installed-container", ["get_app_container", DEVICE, bundle, "app"])
        installed = Path(location.decode().strip())
        assert digest(installed / "CodonNativeShowcase") == product["binarySHA256"]
        assert digest(installed / "main.jsbundle") == product["bundleSHA256"]
        _, location = sim("data-container", ["get_app_container", DEVICE, bundle, "data"])
        journal = Path(location.decode().strip()) / "Library/Caches" / (PROBE + ".jsonl")
        previous = journal.stat().st_mtime_ns if journal.exists() else None
        state.update({"stage": "launch", "launchAttempts": 1})
        save()
        _, reply = sim("launch", ["launch", "--stdout=" + str(root / "app-stdout.log"), "--stderr=" + str(root / "app-stderr.log"), DEVICE, bundle], 90)
        match = re.fullmatch(re.escape(bundle) + r": (\d+)", reply.decode().strip())
        assert match, "Original app launch PID required"
        state.update({"appPID": int(match[1]), "stage": "original-mounted-journal"})
        save()
        rows = None
        stop = min(deadline - 11, time.monotonic() + 180)
        while time.monotonic() < stop:
            if journal.exists() and journal.stat().st_mtime_ns != previous:
                try:
                    candidate = parse(journal.read_text())
                    if candidate and candidate[-1]["kind"] == "terminal": rows = candidate; break
                except (AssertionError, json.JSONDecodeError): pass
            time.sleep(1)
        assert rows is not None, "Original mounted Card journal did not complete"
        shutil.copyfile(journal, root / "original-native-cache.jsonl")
        (root / "original-native-journal.json").write_text(json.dumps(rows, indent=2) + "\n")
        verdict = validate(rows, inputs["producer"])
        (root / "native-observer-verdict.json").write_text(json.dumps(verdict, indent=2) + "\n")
        sim("final-screen", ["io", DEVICE, "screenshot", root / "final-screen.png"], 10)
        verify(root)
        state.update({"status": "SCOPED_NATIVE_OBSERVER_PASS", "stage": "complete", "installedBinary": product["binarySHA256"], "installedBundle": product["bundleSHA256"]})
    except BaseException as error:
        state.update({"status": "FAIL_OR_BLOCKED", "firstFailure": str(error)})
        if state.get("installAttempts") and deadline - time.monotonic() > 21:
            try: sim("failure-screen", ["io", DEVICE, "screenshot", root / "failure-screen.png"], 8, False)
            except Exception as capture: state["failureCapture"] = str(capture)
        raise
    finally:
        if state.get("ownedShutdownGuest"):
            try:
                if state["launchAttempts"]:
                    command(root, "owned-app-terminate", ["/usr/bin/xcrun", "simctl", "terminate", DEVICE, bundle], 5, required=False)
                command(root, "owned-guest-stop", ["/usr/bin/xcrun", "simctl", "shutdown", DEVICE], 15, required=False)
                devices = inventory("final-devices", True)
                state["ownedGuestStopped"] = any(row["udid"] == DEVICE and row["state"] == "Shutdown" for group in devices["devices"].values() for row in group)
            except BaseException as cleanup:
                state.update({"ownedGuestStopped": False, "cleanupFailure": str(cleanup)})
        else: state["ownedGuestStopped"] = True
        state["elapsedSeconds"] = round(time.monotonic() - started, 3)
        save()
        print(json.dumps(state), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    run(parser.parse_args().root.resolve())
