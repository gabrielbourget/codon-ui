"""One source-matched owned time-entry SDK cohort. No startup repair or replay."""
from pathlib import Path
import argparse
import json
import signal
import subprocess
import time

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-collection"))
from build import LAB, REPO, command, digest, verify
from validate_sdk import PROBE, parse, validate

DEVICE = "BA2F1A40-2AAF-4A28-BE05-C80C6B5D7B12"
DEVICE_NAME = "Codon Components Recovery 2026-10-13"
RUNTIME = "com.apple.CoreSimulator.SimRuntime.iOS-26-5"
BUNDLE = "dev.codonui.showcase"


def run_ios(root):
    inputs = verify(root)
    assert inputs["profile"] == "time-entry"
    assert subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip() == inputs["producer"]
    assert not subprocess.check_output(["git", "status", "--porcelain"], cwd=REPO)
    products = {platform: json.loads((root / (platform + "-product.json")).read_text()) for platform in ["android", "ios"]}
    assert all(product["producer"] == inputs["producer"] for product in products.values())
    app = LAB / "ios-app-derived-data/Build/Products/Release-iphonesimulator/CodonNativeShowcase.app"
    assert digest(app / "CodonNativeShowcase") == products["ios"]["binarySHA256"] and digest(app / "main.jsbundle") == products["ios"]["bundleSHA256"]
    assert all(digest(app / name) == value for name, value in products["ios"]["bundleFilesSHA256"].items())
    assert not (root / "time-entry-ios-run.json").exists(), "Recorded cohorts cannot restart"
    tests = json.loads((root / "time-entry-tests.json").read_text())
    for name, expected in tests["filesSHA256"].items(): assert digest(Path(tests["derivedData"]) / name) == expected
    state = dict(platform="ios", producer=inputs["producer"], device=DEVICE, status="RUNNING", stage="identity", bootAttempts=0, installAttempts=0, launchAttempts=0, nativeTestInvocations=0, totalCapSeconds=1200, cleanupReserveSeconds=60)
    deadline = time.monotonic() + 1200
    cutoff = deadline - 60
    def save(): (root / "time-entry-ios-run.json").write_text(json.dumps(state, indent=2) + "\n")
    def sim(name, arguments, cap=30, required=True):
        remaining = cutoff - time.monotonic()
        assert remaining > 11, "Original work cutoff; cleanup reserved"
        return command(root, name, ["/usr/bin/xcrun", "simctl", *arguments], min(cap, remaining - 10), required=required)
    def interrupted(signum, frame): raise KeyboardInterrupt("Owned time-entry cohort interrupted")
    signal.signal(signal.SIGTERM, interrupted)
    save()
    try:
        _, raw = sim("time-entry-ios-inventory", ["list", "devices", "available", "--json"])
        devices = json.loads(raw)["devices"]
        retained = [row for row in devices.get(RUNTIME, []) if row["udid"] == DEVICE]
        assert len(retained) == 1 and retained[0]["name"] == DEVICE_NAME and retained[0]["state"] == "Shutdown"
        assert not any(row["state"] == "Booted" for group in devices.values() for row in group), "Do not interrupt another guest"
        state.update(ownedShutdownGuest=True, stage="boot", bootAttempts=1); save()
        sim("time-entry-ios-boot", ["boot", DEVICE]); sim("time-entry-ios-bootstatus", ["bootstatus", DEVICE, "-b"], 180)
        _, registry = sim("time-entry-ios-app-registry-readiness", ["listapps", DEVICE], 20)
        registry_file = root / "time-entry-ios-app-registry.plist"; registry_file.write_bytes(registry)
        command(root, "time-entry-ios-app-registry-decode", ["/usr/bin/plutil", "-convert", "json", "-o", "-", registry_file], 5)
        state.update(stage="install", installAttempts=1); save()
        sim("time-entry-ios-install", ["install", DEVICE, app], 120)
        _, location = sim("time-entry-ios-installed-app", ["get_app_container", DEVICE, BUNDLE, "app"])
        installed = Path(location.decode().strip())
        assert all(digest(installed / name) == value for name, value in products["ios"]["bundleFilesSHA256"].items())
        assert digest(installed / "CodonNativeShowcase") == products["ios"]["binarySHA256"] and digest(installed / "main.jsbundle") == products["ios"]["bundleSHA256"]
        _, location = sim("time-entry-ios-data-container", ["get_app_container", DEVICE, BUNDLE, "data"])
        cache = Path(location.decode().strip()) / "Library/Caches"
        for index, old in enumerate(cache.rglob(PROBE + ".jsonl")):
            (root / ("time-entry-ios-preexisting-journal-" + str(index) + ".jsonl")).write_bytes(old.read_bytes())
            old.unlink()
        state.update(stage="launch", launchAttempts=1); save()
        _, launched = sim("time-entry-ios-launch", ["launch", "--stdout=" + str(root / "time-entry-ios-stdout.log"), "--stderr=" + str(root / "time-entry-ios-stderr.log"), DEVICE, BUNDLE], 90)
        state["launchReply"] = launched.decode().strip(); state["stage"] = "original-sdk-journal"; save()
        state.update(stage="native-test", nativeTestInvocations=1); save()
        remaining = cutoff - time.monotonic()
        total = min(600, int(remaining - 160))
        assert total >= 60, "Insufficient original cohort time for one test and evidence export"
        code, _ = command(root, "time-entry-ios-native-test", ["/usr/bin/python3", REPO / "planning/component-library/fixtures/native-query-delivery/xctest_transport.py", "--xctestrun", tests["xctestrun"], "--device", DEVICE, "--method", "TimeEntryTrial/TimeEntryTrialTests/testOwnedSegmentEntry", "--output", root / "time-entry-ios-xctest", "--developer-dir", "/Applications/Xcode.app/Contents/Developer", "--total-seconds", str(total), "--silence-seconds", "90"], total + 140, required=False)
        state["nativeTestResult"] = json.loads((root / "time-entry-ios-xctest/attempt.json").read_text()); save()
        assert code == 0, "Single native test failed: " + json.dumps(state["nativeTestResult"].get("exports", {}).get("summaryData", state["nativeTestResult"]))
        journals = list(cache.rglob(PROBE + ".jsonl"))
        assert len(journals) == 1, "Original SDK journal missing or ambiguous"
        original = journals[0].read_bytes()
        (root / "time-entry-ios-original-journal.jsonl").write_bytes(original)
        verdict = validate(parse(original.decode()), inputs["producer"])
        (root / "time-entry-ios-sdk-verdict.json").write_text(json.dumps(verdict, indent=2) + "\n")
        sim("time-entry-ios-final-screen", ["io", DEVICE, "screenshot", "--type=png", root / "time-entry-ios-final.png"], 20)
        state.update(status="OWNED_TIME_ENTRY_SDK_PREREQUISITE_PASS", stage="complete", nativePackets=verdict["nativePackets"], fullInputSurface=verdict["fullInputSurface"], fullFamily=False, fullGoal=False)
    except BaseException as error:
        state.update(status="FAIL_OR_BLOCKED", firstFailure=str(error))
        if "cache" in locals():
            for index, path in enumerate(cache.rglob(PROBE + ".jsonl")):
                (root / ("time-entry-ios-first-failure-journal-" + str(index) + ".jsonl")).write_bytes(path.read_bytes())
        raise
    finally:
        save()
        if state.get("ownedShutdownGuest"):
            if state["launchAttempts"]: command(root, "time-entry-ios-terminate", ["/usr/bin/xcrun", "simctl", "terminate", DEVICE, BUNDLE], 10, required=False)
            command(root, "time-entry-ios-shutdown", ["/usr/bin/xcrun", "simctl", "shutdown", DEVICE], min(30, max(1, deadline - time.monotonic() - 10)), required=False)
            code, raw = command(root, "time-entry-ios-cleanup-inventory", ["/usr/bin/xcrun", "simctl", "list", "devices", "available", "--json"], 5, required=False)
            observed = code == 0 and any(row["udid"] == DEVICE and row["state"] == "Shutdown" for group in json.loads(raw)["devices"].values() for row in group)
            state["ownedGuestShutdownObserved"] = observed
            if not observed and "firstFailure" not in state:
                state.update(status="FAIL_OR_BLOCKED", firstFailure="Owned guest shutdown not observed")
        state["finished"] = True; save()
        if state.get("firstFailure") == "Owned guest shutdown not observed": raise AssertionError(state["firstFailure"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("root", type=Path)
    run_ios(parser.parse_args().root.resolve())
