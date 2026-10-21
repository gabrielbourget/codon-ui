"""One source-matched form SDK cohort. No startup repair or replay."""
from pathlib import Path
import argparse
import json
import signal
import subprocess
import time

from build import LAB, REPO, command, digest, verify
from validate_form import PROBE, parse, validate

DEVICE = "BA2F1A40-2AAF-4A28-BE05-C80C6B5D7B12"
DEVICE_NAME = "Codon Components Recovery 2026-10-13"
RUNTIME = "com.apple.CoreSimulator.SimRuntime.iOS-26-5"
BUNDLE = "dev.codonui.showcase"


def run_ios(root):
    inputs = verify(root)
    assert inputs["profile"] == "form"
    assert subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip() == inputs["producer"]
    assert not subprocess.check_output(["git", "status", "--porcelain"], cwd=REPO)
    products = {platform: json.loads((root / (platform + "-product.json")).read_text()) for platform in ["android", "ios"]}
    assert all(product["producer"] == inputs["producer"] for product in products.values())
    app = LAB / "ios-app-derived-data/Build/Products/Release-iphonesimulator/CodonNativeShowcase.app"
    assert digest(app / "CodonNativeShowcase") == products["ios"]["binarySHA256"] and digest(app / "main.jsbundle") == products["ios"]["bundleSHA256"]
    assert all(digest(app / name) == value for name, value in products["ios"]["bundleFilesSHA256"].items())
    assert not (root / "form-ios-run.json").exists(), "Recorded cohorts cannot restart"
    state = dict(platform="ios", producer=inputs["producer"], device=DEVICE, status="RUNNING", stage="identity", bootAttempts=0, installAttempts=0, launchAttempts=0, externalInputActions=0, totalCapSeconds=1200, cleanupReserveSeconds=60)
    deadline = time.monotonic() + 1200
    cutoff = deadline - 60
    def save(): (root / "form-ios-run.json").write_text(json.dumps(state, indent=2) + "\n")
    def sim(name, arguments, cap=30, required=True):
        remaining = cutoff - time.monotonic()
        assert remaining > 11, "Original work cutoff; cleanup reserved"
        return command(root, name, ["/usr/bin/xcrun", "simctl", *arguments], min(cap, remaining - 10), required=required)
    def interrupted(signum, frame): raise KeyboardInterrupt("Owned form cohort interrupted")
    signal.signal(signal.SIGTERM, interrupted)
    save()
    try:
        _, raw = sim("form-ios-inventory", ["list", "devices", "available", "--json"])
        devices = json.loads(raw)["devices"]
        retained = [row for row in devices.get(RUNTIME, []) if row["udid"] == DEVICE]
        assert len(retained) == 1 and retained[0]["name"] == DEVICE_NAME and retained[0]["state"] == "Shutdown"
        assert not any(row["state"] == "Booted" for group in devices.values() for row in group), "Do not interrupt another guest"
        state.update(ownedShutdownGuest=True, stage="boot", bootAttempts=1); save()
        sim("form-ios-boot", ["boot", DEVICE]); sim("form-ios-bootstatus", ["bootstatus", DEVICE, "-b"], 180)
        _, registry = sim("form-ios-app-registry-readiness", ["listapps", DEVICE], 20)
        registry_file = root / "form-ios-app-registry.plist"; registry_file.write_bytes(registry)
        command(root, "form-ios-app-registry-decode", ["/usr/bin/plutil", "-convert", "json", "-o", "-", registry_file], 5)
        state.update(stage="install", installAttempts=1); save()
        sim("form-ios-install", ["install", DEVICE, app], 120)
        _, location = sim("form-ios-installed-app", ["get_app_container", DEVICE, BUNDLE, "app"])
        installed = Path(location.decode().strip())
        assert all(digest(installed / name) == value for name, value in products["ios"]["bundleFilesSHA256"].items())
        assert digest(installed / "CodonNativeShowcase") == products["ios"]["binarySHA256"] and digest(installed / "main.jsbundle") == products["ios"]["bundleSHA256"]
        _, location = sim("form-ios-data-container", ["get_app_container", DEVICE, BUNDLE, "data"])
        cache = Path(location.decode().strip()) / "Library/Caches"
        for index, old in enumerate(cache.rglob(PROBE + ".jsonl")):
            (root / ("form-ios-preexisting-journal-" + str(index) + ".jsonl")).write_bytes(old.read_bytes())
            old.unlink()
        state.update(stage="launch", launchAttempts=1); save()
        _, launched = sim("form-ios-launch", ["launch", "--stdout=" + str(root / "form-ios-stdout.log"), "--stderr=" + str(root / "form-ios-stderr.log"), DEVICE, BUNDLE], 90)
        state["launchReply"] = launched.decode().strip(); state["stage"] = "original-sdk-journal"; save()
        journal_deadline = min(cutoff - 20, time.monotonic() + 150)
        original = None
        while time.monotonic() < journal_deadline:
            for path in cache.rglob(PROBE + ".jsonl"):
                try:
                    data = path.read_bytes(); rows = parse(data.decode())
                except (json.JSONDecodeError, UnicodeDecodeError): continue
                if rows and rows[-1].get("kind") == "terminal": original = data; break
            if original is not None: break
            time.sleep(0.5)
        assert original is not None, "Original form SDK journal did not complete"
        (root / "form-ios-original-journal.jsonl").write_bytes(original)
        verdict = validate(parse(original.decode()), "ios", inputs["producer"])
        (root / "form-ios-sdk-verdict.json").write_text(json.dumps(verdict, indent=2) + "\n")
        sim("form-ios-final-screen", ["io", DEVICE, "screenshot", "--type=png", root / "form-ios-final.png"], 20)
        state.update(status="SDK_ORDER_PASS", stage="complete", nativeSnapshots=verdict["nativeSnapshots"], fullFamily=False, fullGoal=False)
    except BaseException as error:
        state.update(status="FAIL_OR_BLOCKED", firstFailure=str(error)); raise
    finally:
        save()
        if state.get("ownedShutdownGuest"):
            if state["launchAttempts"]: command(root, "form-ios-terminate", ["/usr/bin/xcrun", "simctl", "terminate", DEVICE, BUNDLE], 10, required=False)
            command(root, "form-ios-shutdown", ["/usr/bin/xcrun", "simctl", "shutdown", DEVICE], min(30, max(1, deadline - time.monotonic() - 10)), required=False)
            code, raw = command(root, "form-ios-cleanup-inventory", ["/usr/bin/xcrun", "simctl", "list", "devices", "available", "--json"], 5, required=False)
            observed = code == 0 and any(row["udid"] == DEVICE and row["state"] == "Shutdown" for group in json.loads(raw)["devices"].values() for row in group)
            state["ownedGuestShutdownObserved"] = observed
            if not observed and "firstFailure" not in state:
                state.update(status="FAIL_OR_BLOCKED", firstFailure="Owned guest shutdown not observed")
        state["finished"] = True; save()
        if state.get("firstFailure") == "Owned guest shutdown not observed": raise AssertionError(state["firstFailure"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("root", type=Path)
    run_ios(parser.parse_args().root.resolve())
