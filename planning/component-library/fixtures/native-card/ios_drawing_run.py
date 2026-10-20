"""One matching app/window cohort with original phase PNGs; never replay a result."""
from pathlib import Path
import argparse
import json
import math
import plistlib
import re
import subprocess
import time

from continuous_uikit_probe import DEVICE, DEVICE_NAME, RUNTIME, native_command
from drawing_raster_validate import PAIRS
from ios_geometry_build import REPO, command, digest, verify

PROBE = "codon-native-card-drawing-v1"
READER = "planning/component-library/fixtures/native-card/NativeDrawingScreenReadback.swift"


def validate_ready(row, producer, step, nonce=None):
    assert row["probe"] == PROBE and row["producer"] == producer and row["status"] == "ready"
    assert row["nonce"].startswith(producer + ":") and (nonce is None or row["nonce"] == nonce)
    assert row["step"] == step and row["pairIndex"] == step // 2
    assert (row["profile"], row["mode"]) == PAIRS[step // 2]
    name = row["profile"]
    expected_control = "outline" if name.startswith("outline-") else "border" if name.startswith(("native-border-", "asymmetric-", "dashed-", "dotted-")) else "outer-shadow" if name.startswith(("outer-", "raised-")) else "inset-shadow" if name.startswith("inset-") else "plain"
    assert row["control"] == expected_control
    assert row["kind"] == ("calibration" if step % 2 == 0 else "owned") and row["appState"] == "active"
    assert len(row["targets"]) == 3 and len(set(row["targets"])) == 3 and all(type(value) is int and value > 0 for value in row["targets"])
    assert len(row["frames"]) == 3 and all(len(frame) == 4 and all(type(value) in [int, float] and math.isfinite(value) for value in frame) for frame in row["frames"])
    assert row["frames"][0][2:] == row["frames"][1][2:] == [120, 80] and row["frames"][2][2:] == [32, 8]
    assert type(row["density"]) in [int, float] and math.isfinite(row["density"]) and row["density"] > 0 and row["screen"]["scale"] == row["density"]
    assert all(type(row["screen"][key]) in [int, float] and math.isfinite(row["screen"][key]) and row["screen"][key] > 0 for key in ["width", "height"])


def validate_pixels(pixels, row):
    assert all(pixels[key] == row[key] for key in ["producer", "nonce", "pairIndex", "step", "profile", "mode", "kind"]), "Original screenshot phase identity mismatch"
    assert pixels["markerMatched"] is True and pixels["referenceControlPassed"] is True, "Original displayed reference control failed"
    assert pixels["fullCard"] is False and pixels["fullGoal"] is False
    assert pixels["changedBytes"] == 0 and pixels["maximumChannelDifference"] == 0 and pixels["nativeSHA256"] == pixels["ownedSHA256"], "Original displayed pair differs"
    assert re.fullmatch(r"[a-f0-9]{64}", pixels["nativeSHA256"])
    assert [pixels["cropWidth"], pixels["cropHeight"]] == [168 * row["density"], 128 * row["density"]]
    assert [pixels["imageWidth"], pixels["imageHeight"]] == [row["screen"]["width"] * row["density"], row["screen"]["height"] * row["density"]]


def build_reader(root):
    inputs = verify(root)
    assert inputs["profile"] == "card-ios-drawing"
    developer = Path("/Applications/Xcode.app/Contents/Developer")
    sdk = developer / "Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk"
    compiler = developer / "Toolchains/XcodeDefault.xctoolchain/usr/bin/swiftc"
    command(root, "screen-reader-build", [compiler, "-O", "-sdk", sdk, "-target", "x86_64-apple-macos13.0",
        "-module-cache-path", "/private/tmp/codon-native-card-window-readback-modules", REPO / READER, "-o", root / "screen-readback"], 90)
    (root / "reader-product.json").write_text(json.dumps({"sourceSHA256": inputs["sourceInputs"][READER], "binarySHA256": digest(root / "screen-readback")}, indent=2) + "\n")


def run(root):
    inputs = verify(root)
    assert inputs["profile"] == "card-ios-drawing"
    product = json.loads((root / "ios-product.json").read_text())
    reader = json.loads((root / "reader-product.json").read_text())
    assert reader["binarySHA256"] == digest(root / "screen-readback") and reader["sourceSHA256"] == inputs["sourceInputs"][READER]
    app = root / "CodonNativeShowcase.app"
    assert product["producer"] == inputs["producer"] and product["unsignedSimulator"]
    for name, expected in product["appFilesSHA256"].items(): assert digest(app / name) == expected, name
    bundle = plistlib.loads((app / "Info.plist").read_bytes())["CFBundleIdentifier"]
    assert bundle == "dev.codonui.showcase" and not (root / "native-run.json").exists()
    started = time.monotonic(); deadline = started + 420
    state = {"platform": "ios", "device": DEVICE, "totalCapSeconds": 480, "cleanupReserveSeconds": 60,
        "bootAttempts": 0, "installAttempts": 0, "launchAttempts": 0, "externalInputActions": 0, "capturedSteps": 0,
        "scope": inputs["scope"], "status": "RUNNING"}
    results = []
    def save(): (root / "native-run.json").write_text(json.dumps(state, indent=2) + "\n")
    def sim(name, arguments, cap=30, required=True):
        return native_command(root, name, ["/usr/bin/xcrun", "simctl", *arguments], deadline, cap, required)
    def inventory(name, cleanup=False):
        args = ["/usr/bin/xcrun", "simctl", "list", "devices", "available", "--json"]
        _, value = command(root, name, args, 5) if cleanup else native_command(root, name, args, deadline)
        return json.loads(value)
    save()
    try:
        devices = inventory("initial-devices")
        retained = [row for row in devices["devices"].get(RUNTIME, []) if row["udid"] == DEVICE]
        assert len(retained) == 1 and retained[0]["name"] == DEVICE_NAME and retained[0]["state"] == "Shutdown"
        assert not [row for group in devices["devices"].values() for row in group if row["state"] == "Booted"]
        state.update(ownedShutdownGuest=True, bootAttempts=1); save()
        sim("boot", ["boot", DEVICE]); sim("boot-status", ["bootstatus", DEVICE, "-b"], 180)
        state.update(installAttempts=1); save()
        sim("install", ["install", DEVICE, app], 120)
        _, location = sim("installed-container", ["get_app_container", DEVICE, bundle, "app"])
        installed = Path(location.decode().strip())
        assert digest(installed / "CodonNativeShowcase") == product["binarySHA256"] and digest(installed / "main.jsbundle") == product["bundleSHA256"]
        _, location = sim("data-container", ["get_app_container", DEVICE, bundle, "data"])
        cache = Path(location.decode().strip()) / "Library/Caches"
        cache.mkdir(exist_ok=True)
        ready = cache / (PROBE + ".ready.json"); ack = cache / (PROBE + ".ack.json")
        previous = ready.stat().st_mtime_ns if ready.exists() else None
        ack.write_text("{}\n")
        state.update(launchAttempts=1); save()
        _, reply = sim("launch", ["launch", "--stdout=" + str(root / "app-stdout.log"), "--stderr=" + str(root / "app-stderr.log"), DEVICE, bundle], 90)
        match = re.fullmatch(re.escape(bundle) + r": (\d+)", reply.decode().strip()); assert match
        state["appPID"] = int(match[1]); save()
        nonce = None
        for step in range(len(PAIRS) * 2):
            stop = min(deadline - 26, time.monotonic() + (90 if step == 0 else 35))
            row = None; raw = None
            while time.monotonic() < stop:
                if ready.exists() and ready.stat().st_mtime_ns != previous:
                    try:
                        raw = ready.read_bytes(); candidate = json.loads(raw)
                        assert candidate["producer"] == inputs["producer"]
                        assert candidate["status"] != "failure", candidate
                        if candidate.get("step") == step:
                            validate_ready(candidate, inputs["producer"], step, nonce); row = candidate; break
                    except json.JSONDecodeError: pass
                time.sleep(0.1)
            assert row is not None and raw is not None, "Original displayed phase did not become ready: " + str(step)
            nonce = row["nonce"]
            prefix = "step-" + str(step).zfill(2)
            metadata = root / (prefix + "-ready.json"); metadata.write_bytes(raw)
            screenshot = root / (prefix + ".png")
            sim(prefix + "-screen", ["io", DEVICE, "screenshot", "--type=png", screenshot], 10)
            verdict_path = root / (prefix + "-pixels.json")
            native_command(root, prefix + "-readback", [root / "screen-readback", screenshot, metadata, verdict_path], deadline, 15)
            pixels = json.loads(verdict_path.read_text())
            results.append({"metadata": row, "pixels": pixels, "screenshotSHA256": digest(screenshot)})
            (root / "original-screen-results.json").write_text(json.dumps(results, indent=2) + "\n")
            validate_pixels(pixels, row)
            if step % 2: assert results[-2]["metadata"]["kind"] == "calibration"
            ack.write_text(json.dumps({"nonce": nonce, "step": step, "screenshotSHA256": digest(screenshot)}) + "\n")
            state["capturedSteps"] = step + 1; save()
            print("Original display pair", step + 1, "/", len(PAIRS) * 2, row["profile"], row["kind"], "byte exact", flush=True)
        stop = min(deadline - 11, time.monotonic() + 10)
        terminal = None
        while time.monotonic() < stop:
            try:
                candidate = json.loads(ready.read_text())
                if candidate.get("status") == "complete": terminal = candidate; break
            except json.JSONDecodeError: pass
            time.sleep(0.1)
        assert terminal is not None, "Original app terminal did not complete"
        assert terminal["producer"] == inputs["producer"] and terminal["nonce"] == nonce and terminal["capturedSteps"] == len(PAIRS) * 2
        assert terminal["fullCard"] is False and terminal["fullGoal"] is False
        (root / "original-app-terminal.json").write_text(json.dumps(terminal, indent=2) + "\n")
        verify(root)
        state.update(status="SCOPED_DISPLAYED_DRAWING_PASS", comparedOwnedPairs=len(PAIRS), referenceCalibrations=len(PAIRS), fullCard=False, fullGoal=False)
    except BaseException as error:
        state.update(status="FAIL_OR_BLOCKED", firstFailure=str(error))
        if state["installAttempts"] and deadline - time.monotonic() > 21:
            try: sim("failure-screen", ["io", DEVICE, "screenshot", root / "failure-screen.png"], 8, False)
            except Exception as capture: state["failureCapture"] = str(capture)
        raise
    finally:
        if state.get("ownedShutdownGuest"):
            try:
                if state["launchAttempts"]: command(root, "owned-app-terminate", ["/usr/bin/xcrun", "simctl", "terminate", DEVICE, bundle], 5, required=False)
                command(root, "owned-guest-stop", ["/usr/bin/xcrun", "simctl", "shutdown", DEVICE], 15, required=False)
                devices = inventory("final-devices", True)
                state["ownedGuestStopped"] = any(row["udid"] == DEVICE and row["state"] == "Shutdown" for group in devices["devices"].values() for row in group)
            except BaseException as cleanup: state.update(ownedGuestStopped=False, cleanupFailure=str(cleanup))
        else: state["ownedGuestStopped"] = True
        state["elapsedSeconds"] = round(time.monotonic() - started, 3); save(); print(json.dumps(state), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("phase", choices=["build-reader", "run"]); parser.add_argument("root", type=Path)
    args = parser.parse_args()
    (build_reader if args.phase == "build-reader" else run)(args.root.resolve())
