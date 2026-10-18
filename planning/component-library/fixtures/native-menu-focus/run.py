"""One bounded Menu focus invocation per platform, using original native callbacks and persisted receipts."""
from pathlib import Path
import argparse
import json
import os
import re
import signal
import shutil
import subprocess
import time

from build import LAB, digest, environment, verify_inputs
from validate import parse_records, validate

ADB = LAB / "sdk/platform-tools/adb"
AVD = "codon_components_recovery_20261013"
SERIAL = "emulator-5568"
UDID = "BA2F1A40-2AAF-4A28-BE05-C80C6B5D7B12"


def command(root, name, args, env, cap=60, required=True):
    start = time.monotonic()
    path = root / (name + ".log")
    timed_out = False
    with path.open("wb") as log:
        process = subprocess.Popen(list(map(str, args)), env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        print(name, "PID", process.pid, "cap", cap, flush=True)
        while process.poll() is None:
            try:
                process.wait(timeout=min(20, max(1, cap - (time.monotonic() - start))))
            except subprocess.TimeoutExpired:
                print(name, "confirmed live", round(time.monotonic() - start, 1), "seconds;", path.stat().st_size, "log bytes", flush=True)
            if process.poll() is None and time.monotonic() - start >= cap:
                timed_out = True
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
                break
    code, output = (124 if timed_out else process.returncode), path.read_bytes()
    (root / (name + ".json")).write_text(json.dumps({"command": list(map(str, args)), "exitCode": code, "durationSeconds": round(time.monotonic() - start, 3), "logSHA256": digest(root / (name + ".log"))}, indent=2) + "\n")
    if required:
        assert code == 0, name + ": " + output.decode(errors="replace")[-1500:]
    return code, output.decode(errors="replace")


def observe(root, channels, cap=240):
    start, notice = time.monotonic(), 0
    while time.monotonic() - start < cap:
        counts = {}
        for name, path in channels:
            records = parse_records(path.read_text(errors="replace") if path.exists() else "")
            counts[name] = len(records)
            # Choose by transport completeness, never by which field values pass.
            if any(row.get("kind") in ("complete", "failure") for row in records):
                return name, path, records
        if time.monotonic() >= notice:
            print("Native observer", round(time.monotonic() - start, 1), "seconds; parsed channel records", counts, flush=True)
            notice = time.monotonic() + 20
        time.sleep(2)
    return channels[0][0], channels[0][1], parse_records(channels[0][1].read_text(errors="replace") if channels[0][1].exists() else "")


def run(output, platform):
    inputs = verify_inputs(output)
    assert not any((parent / "SEALED").exists() for parent in [output, *output.parents])
    for name in [platform]:
        proof = json.loads((output / "products" / name / "proof.json").read_text())
        assert proof["fixtureSHA256"]["App.tsx"] == inputs["fixtureInputs"]["App.tsx"]
    state_path = output / "observations.json"
    state = json.loads(state_path.read_text()) if state_path.exists() else {"deadlineUnix": time.time() + 1800, "platforms": {}}
    assert platform not in state["platforms"], "A recorded platform invocation cannot be replayed"
    assert time.time() < state["deadlineUnix"]
    root = output / "installed" / platform
    root.mkdir(parents=True)
    env = environment()
    env.update({"ANDROID_AVD_HOME": str(LAB / "avd"), "ANDROID_USER_HOME": str(LAB / "android-user")})
    record = {"status": "RUNNING", "bootAttempts": 0, "installAttempts": 0, "launchAttempts": 0, "libraryProducer": inputs["libraryProducer"], "fixtureProducer": inputs["fixtureProducer"]}
    state["platforms"][platform] = record
    state_path.write_text(json.dumps(state, indent=2) + "\n")
    emulator, monitor, started_guest = None, None, False
    stage = "identity"
    try:
        if platform == "android":
            apk = output / "products/android/observer.apk"
            assert digest(apk) == json.loads((apk.parent / "proof.json").read_text())["productSHA256"]
            _, devices = command(root, "initial-devices", [ADB, "devices", "-l"], env)
            assert SERIAL not in devices, "Selected lab port already has a guest"
            _, badging = command(root, "badging", [LAB / "sdk/build-tools/36.0.0/aapt2", "dump", "badging", apk], env)
            package = re.search(r"package: name='([^']+)'", badging)[1]
            activity = re.search(r"launchable-activity: name='([^']+)'", badging)[1]
            assert package == "dev.codonui.showcase"
            stage = "boot"
            record["bootAttempts"] = 1
            native_log = (root / "emulator.log").open("wb")
            emulator = subprocess.Popen([str(LAB / "sdk/emulator/emulator"), "-avd", AVD, "-port", "5568", "-no-window", "-no-audio", "-no-snapshot-load", "-no-snapshot-save", "-no-boot-anim", "-gpu", "swiftshader_indirect", "-cores", "2", "-memory", "3072"], env=env, stdout=native_log, stderr=subprocess.STDOUT, start_new_session=True)
            started_guest = True
            record["emulatorPID"] = emulator.pid
            print("Android one boot PID", emulator.pid, flush=True)
            boot_start, ready = time.monotonic(), False
            while time.monotonic() - boot_start < 480:
                if emulator.poll() is not None:
                    raise RuntimeError("emulator exited " + str(emulator.returncode))
                try:
                    result = subprocess.run([str(ADB), "-s", SERIAL, "shell", "getprop", "sys.boot_completed"], env=env, capture_output=True, timeout=15)
                    if result.returncode == 0 and result.stdout.strip() == b"1":
                        ready = True
                        break
                except subprocess.TimeoutExpired:
                    # A bridge observation timeout does not restart or declare the live guest terminal.
                    pass
                print("Android boot live", round(time.monotonic() - boot_start, 1), "seconds", flush=True)
                time.sleep(10)
            assert ready, "one boot readiness deadline"
            command(root, "wake", [ADB, "-s", SERIAL, "shell", "input", "keyevent", "KEYCODE_WAKEUP"], env)
            command(root, "dismiss-keyguard", [ADB, "-s", SERIAL, "shell", "wm", "dismiss-keyguard"], env)
            stage = "install"
            record["installAttempts"] = 1
            command(root, "install", [ADB, "-s", SERIAL, "install", "-r", apk], env, 120)
            stage = "installed-product-identity"
            _, installed_path = command(root, "installed-package-path", [ADB, "-s", SERIAL, "shell", "pm", "path", package], env)
            package_paths = [line.removeprefix("package:").strip() for line in installed_path.splitlines() if line.startswith("package:")]
            assert len(package_paths) == 1, "one installed base APK"
            _, installed_hash = command(root, "installed-package-hash", [ADB, "-s", SERIAL, "shell", "sha256sum", package_paths[0]], env)
            record["installedProductSHA256"] = installed_hash.split()[0]
            assert record["installedProductSHA256"] == digest(apk), "installed APK identity mismatch"
            stage = "launch"
            record["launchAttempts"] = 1
            command(root, "launch", [ADB, "-s", SERIAL, "shell", "am", "start", "-W", "-n", package + "/" + activity], env, 90)
            _, pid = command(root, "app-pid", [ADB, "-s", SERIAL, "shell", "pidof", package], env)
            assert re.fullmatch(r"\d+", pid.strip()), "actual app PID"
            record["appPID"] = int(pid.strip())
            capture = root / "native.log"
            handle = capture.open("wb")
            monitor = subprocess.Popen([str(ADB), "-s", SERIAL, "logcat", "--pid", pid.strip(), "-v", "raw"], env=env, stdout=handle, stderr=subprocess.STDOUT, start_new_session=True)
            channels = [("logcat", capture)]
        else:
            app = output / "products/ios/CodonNativeShowcase.app"
            proof = json.loads((app.parent / "proof.json").read_text())
            assert digest(app / "CodonNativeShowcase") == proof["productSHA256"]
            import plistlib
            info = plistlib.loads((app / "Info.plist").read_bytes())
            package, executable = info["CFBundleIdentifier"], info["CFBundleExecutable"]
            _, inventory = command(root, "initial-devices", ["/usr/bin/xcrun", "simctl", "list", "devices", "available", "--json"], env)
            device = next(d for devices in json.loads(inventory)["devices"].values() for d in devices if d["udid"] == UDID)
            assert device["state"] == "Shutdown" and device["name"] == "Codon Components Recovery 2026-10-13"
            stage = "boot"
            record["bootAttempts"] = 1
            command(root, "boot", ["/usr/bin/xcrun", "simctl", "boot", UDID], env)
            started_guest = True
            command(root, "boot-status", ["/usr/bin/xcrun", "simctl", "bootstatus", UDID, "-b"], env, 480)
            stage = "install"
            record["installAttempts"] = 1
            command(root, "install", ["/usr/bin/xcrun", "simctl", "install", UDID, app], env, 480)
            stage = "installed-product-identity"
            _, installed_path = command(root, "installed-package-path", ["/usr/bin/xcrun", "simctl", "get_app_container", UDID, package, "app"], env)
            installed_app = Path(installed_path.strip())
            record["installedProductSHA256"] = digest(installed_app / executable)
            record["installedBundleSHA256"] = digest(installed_app / "main.jsbundle")
            assert record["installedProductSHA256"] == digest(app / executable), "installed iOS executable identity mismatch"
            assert record["installedBundleSHA256"] == digest(app / "main.jsbundle"), "installed iOS bundle identity mismatch"
            _, data_path = command(root, "app-data-container", ["/usr/bin/xcrun", "simctl", "get_app_container", UDID, package, "data"], env)
            probe = json.loads((Path(__file__).parent / "phases.json").read_text())["probe"]
            receipt_path = Path(data_path.strip()) / "Library/Caches" / (probe + ".jsonl")
            assert not receipt_path.exists(), "Versioned receipt must not predate this invocation"
            record["receiptPath"] = str(receipt_path)
            capture = root / "native.log"
            handle = capture.open("wb")
            monitor = subprocess.Popen(["/usr/bin/xcrun", "simctl", "spawn", UDID, "log", "stream", "--style", "compact", "--level", "debug", "--predicate", 'process == "' + executable + '"'], env=env, stdout=handle, stderr=subprocess.STDOUT, start_new_session=True)
            stage = "launch"
            record["launchAttempts"] = 1
            command(root, "launch", ["/usr/bin/xcrun", "simctl", "launch", "--stdout=" + str(root / "app.stdout"), "--stderr=" + str(root / "app.stderr"), UDID, package], env, 180)
            channels = [("file-receipt", receipt_path), ("unified-log", capture), ("stderr", root / "app.stderr"), ("stdout", root / "app.stdout")]
        stage = "native-observation"
        channel, path, records = observe(root, channels, min(240, max(1, int(state["deadlineUnix"] - time.time()))))
        if channel == "file-receipt":
            copied = root / "native-receipt.jsonl"
            shutil.copy2(path, copied)
            path = copied
        record.update({"selectedTransport": channel, "rawLog": str(path), "rawLogSHA256": digest(path) if path.exists() else None, "parsedRecords": len(records)})
        (root / "records.json").write_text(json.dumps(records, indent=2) + "\n")
        stage = "receipt-transport"
        assert any(row.get("kind") in ("complete", "failure") for row in records), "incomplete receipt transport; native focus unproven"
        stage = "native-focus-verdict"
        verdict = validate(records, platform)
        (root / "verdict.json").write_text(json.dumps(verdict, indent=2) + "\n")
        record.update({"status": "PASS", "nativeSnapshots": verdict["nativeSnapshots"], "assertionCount": len(verdict["assertionIDs"])})
    except Exception as error:
        record.update({"status": "FAIL", "stage": stage, "reason": str(error)})
        (root / "failure.json").write_text(json.dumps(record, indent=2) + "\n")
        print(platform, "retained failure", stage, str(error), flush=True)
    finally:
        if monitor and monitor.poll() is None:
            os.killpg(monitor.pid, signal.SIGTERM)
            try:
                monitor.wait(timeout=15)
            except subprocess.TimeoutExpired:
                os.killpg(monitor.pid, signal.SIGKILL)
                monitor.wait()
        if started_guest:
            if platform == "android":
                command(root, "stop-owned-guest", [ADB, "-s", SERIAL, "emu", "kill"], env, 30, False)
                if emulator and emulator.poll() is None:
                    try:
                        emulator.wait(timeout=30)
                    except subprocess.TimeoutExpired:
                        os.killpg(emulator.pid, signal.SIGTERM)
                        emulator.wait(timeout=30)
            else:
                command(root, "stop-owned-guest", ["/usr/bin/xcrun", "simctl", "shutdown", UDID], env, 60, False)
        record["finishedUnix"] = time.time()
        state_path.write_text(json.dumps(state, indent=2) + "\n")
        print(platform, "terminal", record["status"], "boot/install/launch attempts", record["bootAttempts"], record["installAttempts"], record["launchAttempts"], flush=True)
    return record["status"] == "PASS"


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("platform", choices=["android", "ios"])
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    raise SystemExit(0 if run(args.output, args.platform) else 1)
