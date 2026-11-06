"""One fresh-device install comparison; no app launch, XCTest or qualification."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import time

from NativeAndroidTestSupport import recorded_command
from NativeCellVerification import load_admission
from NativeXCTestBatch import verify_identity


def installed_identity(path, expected):
    actual = {str(p.relative_to(path)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(path.rglob("*")) if p.is_file()}
    differences = sorted(key for key in set(actual) | set(expected) if actual.get(key) != expected.get(key))
    return {"files": len(actual), "differences": differences, "exact": actual == expected}


def require_success(row):
    if row.get("exitCode") != 0 or row.get("timedOut") or row.get("ownedGroupGone") is not True:
        raise RuntimeError("Diagnostic command incomplete or uncertain; cleanup only")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cell", required=True)
    parser.add_argument("--identity", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--device-type", required=True)
    parser.add_argument("--runtime", required=True)
    args = parser.parse_args()
    admission = load_admission(__file__, args.cell, {"ios": ["observer-first-install"], "android": []})
    identity = json.loads(args.identity.read_text())
    verify_identity(identity, len(identity["filesSHA256"]))
    args.out.mkdir(exist_ok=False)
    start = time.time()
    end = start + admission["attempt"]["maximumSeconds"]
    work = end - admission["attempt"]["cleanupReserveSeconds"]
    cli = "/Applications/Xcode.app/Contents/Developer/usr/bin/simctl"
    env = {**os.environ, "DEVELOPER_DIR": "/Applications/Xcode.app/Contents/Developer"}
    device = None
    rows = []
    errors = []
    outcome = "NOT_COMPLETED"
    clean = False
    now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
    write = lambda name, value: (args.out / name).write_text(json.dumps(value, indent=2) + "\n")
    write("admission.json", {"preflight": admission, "startedUTC": now(), "workDeadlineUnix": work, "deadlineUnix": end, "maximumSeconds": admission["attempt"]["maximumSeconds"], "cleanupReserveSeconds": admission["attempt"]["cleanupReserveSeconds"], "deviceName": args.name, "runtime": args.runtime, "deviceType": args.device_type, "identitySHA256": hashlib.sha256(args.identity.read_bytes()).hexdigest(), "componentMethods": 0, "preferenceMutations": 0})

    def run(name, argv, *, cleanup=False):
        print("START " + json.dumps({"name": name, "atUTC": now(), "argv": argv}), flush=True)
        row = recorded_command(argv, args.out / name, None, end if cleanup else work, env)
        rows.append({"name": name, **row})
        write("steps.json", rows)
        require_success(row)
        return (args.out / (name + ".stdout")).read_text().strip()

    def cutoff(_signal, _frame):
        raise TimeoutError("Mechanical diagnostic cutoff; cleanup remains reserved")

    signal.signal(signal.SIGALRM, cutoff)
    signal.signal(signal.SIGTERM, cutoff)
    signal.signal(signal.SIGINT, cutoff)
    signal.setitimer(signal.ITIMER_REAL, max(.01, work - time.time()))
    try:
        adb = str(Path.home() / ".local/share/codon-native-lab/sdk/platform-tools/adb")
        android = run("android-devices-before", [adb, "devices", "-l"])
        assert not any(line.startswith("emulator-") for line in android.splitlines()), "Android guest still exists"
        for port in [5568, 5569]:
            with socket.socket() as probe:
                probe.settimeout(.5)
                assert probe.connect_ex(("127.0.0.1", port)) != 0, "Android guest port still exists"
        devices = json.loads(run("devices-before", [cli, "list", "devices", "-j"]))["devices"]
        assert not any(p["state"] == "Booted" or p["name"] == args.name for rows in devices.values() for p in rows), "Guest/name already exists"
        created = run("create", [cli, "create", args.name, args.device_type, args.runtime])
        assert re.fullmatch(r"[A-F0-9-]{36}", created), "Uncertain device identity; preserve create result"
        device = created
        write("created-device.json", {"device": device, "name": args.name, "createdUTC": now()})
        run("boot", [cli, "boot", device])
        run("boot-readiness", [cli, "bootstatus", device, "-b"])
        run("install-once", [cli, "install", device, identity["product"]])
        product = Path(identity["product"])
        import plistlib
        bundle = plistlib.loads((product / "Info.plist").read_bytes())["CFBundleIdentifier"]
        installed = Path(run("registered-observer", [cli, "get_app_container", device, bundle, "app"]))
        containers = Path.home() / "Library/Developer/CoreSimulator/Devices" / device / "data/Containers/Bundle/Application"
        assert installed.is_absolute() and installed.is_dir() and installed.resolve().is_relative_to(containers.resolve())
        result = installed_identity(installed, identity["filesSHA256"])
        write("installed-identity.json", {"path": str(installed), **result})
        assert result["exact"], "Registered observer differs from prepared bytes"
        outcome = "FRESH_OBSERVER_INSTALL_EXACT"
    except BaseException as error:
        write("exception.json", {"type": type(error).__name__, "message": str(error), "atUTC": now()})
        print("STOP " + repr(error), flush=True)
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        cleanup_started = time.time()
        end = min(end, cleanup_started + admission["attempt"]["cleanupReserveSeconds"])
        signal.setitimer(signal.ITIMER_REAL, max(.01, end - time.time() - 8))
        try:
            # A timed-out create may have succeeded. Resolve only this unique name for cleanup.
            if device is None:
                listed = json.loads(run("resolve-created-cleanup", [cli, "list", "devices", "-j"], cleanup=True))["devices"]
                matches = [p for rows in listed.values() for p in rows if p["name"] == args.name]
                assert len(matches) <= 1
                device = matches[0]["udid"] if matches else None
            if device:
                run("shutdown", [cli, "shutdown", device], cleanup=True)
                listed = json.loads(run("devices-after", [cli, "list", "devices", "-j"], cleanup=True))["devices"]
                matches = [p for rows in listed.values() for p in rows if p["udid"] == device]
                assert len(matches) == 1 and matches[0]["state"] == "Shutdown"
                processes = run("processes-after", ["ps", "-axo", "pid,ppid,command"], cleanup=True)
                assert not any(device in line and "launchd_sim " in line for line in processes.splitlines())
                orphans = [line.split()[0] for line in processes.splitlines() if "/RuntimeRoot/" in line and len(line.split()) > 1 and line.split()[1] == "1"]
                if orphans:
                    files = run("orphan-open-files", ["/usr/sbin/lsof", "-nP", "-Fpcn", "-p", ",".join(orphans)], cleanup=True)
                    assert not any(line.startswith("n") and device in line for line in files.splitlines()), "Selected guest orphan retains device files"
                data = Path.home() / "Library/Developer/CoreSimulator/Devices" / device / "data"
                for name, source in [("mobile-installation.log", data / "Library/Logs/MobileInstallation/mobile_installation.log.0"), ("pending-work.plist", data / "Containers/Shared/SystemGroup/systemgroup.com.apple.installcoordinationd/Library/InstallCoordination/PendingWork.plist")]:
                    if source.is_file(): shutil.copy2(source, args.out / name)
            clean = True
        except BaseException as error:
            errors.append(repr(error))
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)
            terminal = {"outcome": outcome, "finishedUTC": now(), "elapsedSeconds": time.time() - start, "withinBoundary": time.time() < end, "cleanupComplete": clean, "cleanupSeconds": time.time() - cleanup_started, "cleanupErrors": errors, "device": device, "devicePreserved": True, "componentMethods": 0, "ledgerChanged": False, "preferenceMutations": 0}
            write("terminal.json", terminal)
            print("TERMINAL " + json.dumps(terminal), flush=True)
    raise SystemExit(0 if outcome == "FRESH_OBSERVER_INSTALL_EXACT" and clean and not errors and time.time() < end else 1)


if __name__ == "__main__":
    main()
