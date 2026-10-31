"""One owned Android SDK-gate boot/install/launch; no startup repair or replay."""
from pathlib import Path
import argparse
import json
import os
import re
import signal
import subprocess
import time

from build import LAB, command, digest, environment, verify
from validate import parse, validate
from validate_authoring import parse as parse_authoring, validate as validate_authoring

ADB = LAB / "sdk/platform-tools/adb"
SERIAL = "emulator-5568"
AVD = "codon_components_recovery_20261013"


def run(root):
    inputs = verify(root)
    product = json.loads((root / "android-product.json").read_text())
    assert product["producer"] == inputs["producer"]
    apk = root / "app-release.apk"
    assert digest(apk) == product["apkSHA256"]
    state_path = root / "native-run.json"
    assert not state_path.exists(), "Never restart a recorded native cohort"
    state = {"stage": "identity", "deadlineUnix": time.time() + 1200, "bootAttempts": 0, "installAttempts": 0, "launchAttempts": 0, "externalTestInputActions": 0, "scope": "New metadata construction gate; original native callbacks/direct SDK queries; no physical input/profile/family acceptance"}
    emulator = monitor = capture = None

    def save(): state_path.write_text(json.dumps(state, indent=2) + "\n")

    def device(name, args, cap=30, required=True):
        assert time.time() < state["deadlineUnix"]
        return command(root, name, [ADB, "-s", SERIAL, *args], min(cap, max(1, int(state["deadlineUnix"] - time.time()))), required=required)

    save()
    try:
        _, devices = command(root, "initial-devices", [ADB, "devices", "-l"])
        assert SERIAL.encode() not in devices, "Owned serial already in use"
        _, badging = command(root, "gate-badging", [LAB / "sdk/build-tools/36.0.0/aapt2", "dump", "badging", apk])
        text = badging.decode()
        package = re.search(r"package: name='([^']+)'", text)[1]
        activity = re.search(r"launchable-activity: name='([^']+)'", text)[1]
        assert package == "dev.codonui.showcase"
        state.update({"stage": "boot", "bootAttempts": 1})
        save()
        with (root / "emulator.log").open("wb") as log:
            emulator = subprocess.Popen([str(LAB / "sdk/emulator/emulator"), "-avd", AVD, "-port", "5568", "-no-window", "-no-audio", "-no-snapshot-load", "-no-snapshot-save", "-no-boot-anim", "-gpu", "swiftshader_indirect", "-cores", "2", "-memory", "3072"], env=environment(), stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        state["emulatorPID"] = emulator.pid
        save()
        ready = False
        started = time.monotonic()
        for index in range(80):
            assert emulator.poll() is None, "Owned emulator stopped"
            assert time.monotonic() - started < 480, "One boot readiness cap"
            code, output = device(f"boot-status-{index:02d}", ["shell", "getprop", "sys.boot_completed"], 15, False)
            if code == 0 and output.strip() == b"1": ready = True; break
            time.sleep(5)
        assert ready, "No OS boot completion in the single attempt"
        _, name = device("owned-avd", ["emu", "avd", "name"])
        assert name.decode().splitlines()[0].strip() == AVD
        state["serialOwnershipVerified"] = True
        state["stage"] = "guest-profile"
        save()
        device("guest-build", ["shell", "getprop", "ro.build.fingerprint"])
        device("font-scale", ["shell", "settings", "get", "system", "font_scale"])
        device("display", ["shell", "wm", "size"])
        device("wake", ["shell", "input", "keyevent", "KEYCODE_WAKEUP"])
        device("keyguard", ["shell", "wm", "dismiss-keyguard"])
        state.update({"stage": "install", "installAttempts": 1})
        save()
        device("install", ["install", "-r", str(apk)], 120)
        _, paths = device("installed-package", ["shell", "pm", "path", package])
        installed = [line.removeprefix("package:").strip() for line in paths.decode().splitlines() if line.startswith("package:")]
        assert len(installed) == 1
        _, checksum = device("installed-sha256", ["shell", "sha256sum", installed[0]])
        assert checksum.decode().split()[0] == product["apkSHA256"]
        capture = (root / "native.log").open("wb")
        monitor = subprocess.Popen([str(ADB), "-s", SERIAL, "logcat", "-v", "raw", "-T", "1", "ReactNativeJS:V", "*:S"], env=environment(), stdout=capture, stderr=subprocess.STDOUT, start_new_session=True)
        state.update({"stage": "launch", "launchAttempts": 1})
        save()
        device("launch", ["shell", "am", "start", "-W", "-n", package + "/" + activity], 90)
        _, pid = device("app-pid", ["shell", "pidof", package])
        assert re.fullmatch(rb"\d+", pid.strip())
        state.update({"appPID": pid.decode().strip(), "stage": "original-native-records"})
        save()
        deadline = min(time.time() + (180 if inputs.get("profile") == "authoring" else 90), state["deadlineUnix"])
        records, authoring_records = None, None
        while time.time() < deadline:
            assert emulator.poll() is None and monitor.poll() is None, "Owned guest or original-log transport stopped"
            data = (root / "native.log").read_text(errors="replace")
            if not data.endswith("\n"): data = data.rsplit("\n", 1)[0]
            try: candidate = parse(data)
            except (AssertionError, json.JSONDecodeError): candidate = []
            if candidate and candidate[-1].get("kind") == "terminal":
                records = candidate
                if inputs.get("profile") != "authoring" or candidate[-1].get("outcome") != "native-records-complete": break
                try: authoring_candidate = parse_authoring(data)
                except (AssertionError, json.JSONDecodeError): authoring_candidate = []
                if authoring_candidate and authoring_candidate[-1].get("kind") == "terminal": authoring_records = authoring_candidate; break
            time.sleep(1)
        assert records is not None, "Original native gate journal did not complete"
        (root / "original-native-journal.json").write_text(json.dumps(records, indent=2) + "\n")
        if authoring_records is not None: (root / "original-authoring-journal.json").write_text(json.dumps(authoring_records, indent=2) + "\n")
        state["nativeCallbackCount"] = sum(row["kind"].startswith("native-") for row in records)
        state["acceptedSdkInspections"] = sum(row["kind"] == "native-inspection" and row["actual"]["accepted"] for row in records)
        state["stage"] = "validate-sdk-observations"
        save()
        verdict = validate(records, "android", inputs["producer"])
        (root / "native-sdk-verdict.json").write_text(json.dumps(verdict, indent=2) + "\n")
        if inputs.get("profile") == "authoring":
            assert authoring_records is not None, "Original React authoring/native join journal did not complete"
            authoring_verdict = validate_authoring(authoring_records, "android", inputs["producer"])
            (root / "native-authoring-verdict.json").write_text(json.dumps(authoring_verdict, indent=2) + "\n")
        device("final-window", ["shell", "dumpsys", "window", "windows"], required=False)
        state.update({"status": "SDK_JOURNAL_PASS", "stage": "complete", "inspectorIdentity": {"kind": "actual native host public SDK inspection", "producer": inputs["producer"], "installedAPK": product["apkSHA256"]}})
    except BaseException as error:
        state.update({"status": "FAIL_OR_BLOCKED", "firstFailure": str(error)})
        print("Original native gate stopped:", str(error), flush=True)
        if state.get("serialOwnershipVerified"):
            command(root, "failure-window", [ADB, "-s", SERIAL, "shell", "dumpsys", "window", "windows"], 30, required=False)
            command(root, "failure-system-log", [ADB, "-s", SERIAL, "logcat", "-d", "-t", "300"], 30, required=False)
        raise
    finally:
        if monitor is not None and monitor.poll() is None:
            os.killpg(monitor.pid, signal.SIGTERM)
            try: monitor.wait(timeout=10)
            except subprocess.TimeoutExpired: os.killpg(monitor.pid, signal.SIGKILL); monitor.wait()
        if capture is not None: capture.close()
        if emulator is not None and emulator.poll() is None:
            if state.get("serialOwnershipVerified"):
                command(root, "owned-guest-stop", [ADB, "-s", SERIAL, "emu", "kill"], 30, required=False)
            try: emulator.wait(timeout=30)
            except subprocess.TimeoutExpired: os.killpg(emulator.pid, signal.SIGTERM); emulator.wait(timeout=15)
        state["ownedGuestStopped"] = emulator is None or emulator.poll() is not None
        state["completedUnix"] = time.time()
        save()
        print(json.dumps(state), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    run(parser.parse_args().root.resolve())
