"""Fresh, bounded UIKit primitive characterization; no app replay or drawing acceptance."""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import sys
import time

FIXTURE = Path(__file__).resolve().parent
REPO = FIXTURE.parents[3]
sys.path.insert(0, str(FIXTURE.parent / "native-collection"))
from build import command

SWIFT = Path("/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swiftc")
SDK = Path("/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator26.5.sdk")
DEVICE = "BA2F1A40-2AAF-4A28-BE05-C80C6B5D7B12"
DEVICE_NAME = "Codon Components Recovery 2026-10-13"
RUNTIME = "com.apple.CoreSimulator.SimRuntime.iOS-26-5"
SOURCE = "packages/react-native/ios/CUIMotionContinuousCorners.swift"
NATIVE_FIXTURE = "planning/component-library/fixtures/native-card/NativeMotionContinuousUIKitReference.swift"
HELPER = "planning/component-library/fixtures/native-card/continuous_uikit_probe.py"
PROFILE_NAMES = ["native-r4", "native-r20", "native-r30-overlap", "native-r40-overlap",
    "corrected-separate", "corrected-horizontal-overlap", "corrected-vertical-overlap"]


def digest(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def git(*arguments): return subprocess.check_output(["git", *arguments], cwd=REPO, text=True).strip()


def validate_journal(rows, producer):
    assert rows and rows[0]["kind"] == "begin" and all(row["producer"] == producer for row in rows), "Original native identity journal missing"
    assert type(rows[0]["pid"]) is int and rows[0]["pid"] > 0
    assert rows[-1]["kind"] == "terminal" and rows[-1]["fullCard"] is False and rows[-1]["fullGoal"] is False
    controls = [row for row in rows if row["kind"] == "reference-control"]
    profiles = [row for row in rows if row["kind"] == "profile"]
    raster_controls = [row for row in rows if row["kind"] == "raster-control"]
    native_candidates = [row for row in rows if row["kind"] == "native-layer-candidate"]
    mask_candidates = [row for row in rows if row["kind"] == "native-mask-candidate"]
    assert all(row["kind"] in ["begin", "reference-control", "profile", "raster-control", "native-layer-candidate", "native-mask-candidate", "terminal"] for row in rows)
    assert len(controls) == 1
    outcome = rows[-1]["outcome"]
    if outcome == "native-reference-characterization-complete":
        assert controls[0]["metrics"]["binaryCoverageDifferences"] > 0, "Native raster reference did not distinguish corner curves"
        assert [row["name"] for row in profiles] == PROFILE_NAMES
        assert [row["name"] for row in raster_controls] == [name + "-circular" for name in PROFILE_NAMES]
        assert [row["name"] for row in native_candidates] == [name + "-native-layer" for name in PROFILE_NAMES]
        assert [row["name"] for row in mask_candidates] == [name + "-native-mask" for name in PROFILE_NAMES]
    else:
        assert outcome == "native-reference-capability-unavailable" and not profiles and not raster_controls and not native_candidates and not mask_candidates
        assert controls[0]["metrics"]["binaryCoverageDifferences"] == 0
    return {"outcome": outcome, "nativeProfileCount": len(profiles), "nativePID": rows[0]["pid"], "fullCard": False, "fullGoal": False}


def verify(root):
    assert not (root / "SHA256.json").exists(), "Sealed packets are data only"
    inputs = json.loads((root / "inputs.json").read_text())
    assert git("rev-parse", "HEAD") == inputs["producer"] and not git("status", "--porcelain")
    for name, expected in inputs["sourceInputs"].items(): assert digest(REPO / name) == expected, name
    assert digest(root / "main.swift") == inputs["stagedSourceSHA256"]
    return inputs


def prepare(root):
    assert not root.exists() and not git("status", "--porcelain")
    root.mkdir(parents=True)
    names = [SOURCE, NATIVE_FIXTURE, HELPER, "packages/react-native/package.json", "packages/react-native/CodonNativeInput.podspec", "pnpm-lock.yaml", "AGENTS.md"]
    producer = git("rev-parse", "HEAD")
    fixture = (REPO / NATIVE_FIXTURE).read_text()
    assert fixture.count('"UNFROZEN"') == 1
    (root / "main.swift").write_text((REPO / SOURCE).read_text() + "\n" + fixture.replace('"UNFROZEN"', json.dumps(producer)))
    inputs = {"producer": producer, "sourceInputs": {name: digest(REPO / name) for name in names},
        "stagedSourceSHA256": digest(root / "main.swift"), "SDK": str(SDK), "target": "x86_64-apple-ios15.1-simulator",
        "device": DEVICE, "deviceName": DEVICE_NAME, "scope": "Optimized simulator executable without an explicit signing command; actual unmounted UIKit CPU reference only. No app/consumer/GPU/full Card acceptance"}
    (root / "inputs.json").write_text(json.dumps(inputs, indent=2) + "\n")
    print("Frozen UIKit primitive source", producer, flush=True)


def build(root):
    inputs = verify(root)
    binary = root / "CUIContinuousUIKitReference"
    command(root, "swift-build", [SWIFT, "-target", inputs["target"], "-sdk", SDK, "-O", "-module-cache-path", "/private/tmp/codon-native-card-continuous-uikit-modules", root / "main.swift", "-o", binary], 90)
    verify(root)
    command(root, "binary-kind", ["/usr/bin/file", binary])
    _, load_commands = command(root, "binary-load-commands", ["/usr/bin/otool", "-l", binary])
    (root / "product.json").write_text(json.dumps({"producer": inputs["producer"], "binarySHA256": digest(binary),
        "target": inputs["target"], "scope": inputs["scope"], "explicitSigningCommands": 0,
        "codeSignatureLoadCommand": b"LC_CODE_SIGNATURE" in load_commands}, indent=2) + "\n")


def run(root):
    inputs = verify(root)
    product = json.loads((root / "product.json").read_text())
    assert product["producer"] == inputs["producer"] and digest(root / "CUIContinuousUIKitReference") == product["binarySHA256"]
    state_path = root / "native-run.json"
    assert not state_path.exists(), "Never replay a recorded native cohort"
    state = {"bootAttempts": 0, "nativeProbeAttempts": 0, "appInstallAttempts": 0, "appLaunchAttempts": 0,
        "scope": inputs["scope"], "device": DEVICE, "totalCapSeconds": 480, "cleanupReserveSeconds": 60}
    started = time.monotonic()
    deadline = started + 420

    def save(): state_path.write_text(json.dumps(state, indent=2) + "\n")
    def device_command(name, arguments, cap=30, required=True):
        remaining = deadline - time.monotonic()
        assert remaining > 0, "Native diagnostic bound reached"
        return command(root, name, ["/usr/bin/xcrun", "simctl", *arguments], min(cap, remaining), required=required)
    def devices(name, cleanup=False):
        if cleanup: _, data = command(root, name, ["/usr/bin/xcrun", "simctl", "list", "devices", "available", "--json"], 15)
        else: _, data = device_command(name, ["list", "devices", "available", "--json"])
        entries = [row for row in json.loads(data)["devices"].get(RUNTIME, []) if row["udid"] == DEVICE]
        assert len(entries) == 1 and entries[0]["name"] == DEVICE_NAME and entries[0]["isAvailable"]
        return entries[0]

    save()
    try:
        assert devices("initial-devices")["state"] == "Shutdown", "Retained guest is already in use"
        state["ownedShutdownGuest"] = True
        state["bootAttempts"] = 1
        save()
        device_command("boot", ["boot", DEVICE])
        state["bootCommandSucceeded"] = True
        save()
        device_command("boot-status", ["bootstatus", DEVICE, "-b"], 180)
        assert devices("booted-devices")["state"] == "Booted"
        state["nativeProbeAttempts"] = 1
        save()
        code, data = device_command("original-native-process", ["spawn", "--arch=x86_64", DEVICE, root / "CUIContinuousUIKitReference", root], 60, False)
        rows = [json.loads(line.split("CUI_DRAWING_UIKIT ", 1)[1]) for line in data.decode(errors="replace").splitlines() if line.startswith("CUI_DRAWING_UIKIT ")]
        (root / "original-native-journal.json").write_text(json.dumps(rows, indent=2) + "\n")
        observation = validate_journal(rows, inputs["producer"])
        state["nativeOutcome"] = observation["outcome"]
        state["nativePID"] = observation["nativePID"]
        assert code == 0 and rows[-1]["outcome"] == "native-reference-characterization-complete", "Native reference capability or process failed"
        state["status"] = "NATIVE_PRIMITIVE_CHARACTERIZATION_COMPLETE"
    except BaseException as error:
        state["status"] = "FAIL_OR_BLOCKED"
        state["firstFailure"] = str(error)
        raise
    finally:
        if state.get("ownedShutdownGuest") and state.get("bootCommandSucceeded"):
            try:
                command(root, "owned-guest-stop", ["/usr/bin/xcrun", "simctl", "shutdown", DEVICE], 30, required=False)
                state["ownedGuestStopped"] = devices("final-devices", True)["state"] == "Shutdown"
            except BaseException as error:
                state["ownedGuestStopped"] = False
                state["cleanupFailure"] = str(error)
        else: state["ownedGuestStopped"] = True
        state["elapsedSeconds"] = round(time.monotonic() - started, 3)
        save()
        print(json.dumps(state), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=["prepare", "build", "run"])
    parser.add_argument("root", type=Path)
    arguments = parser.parse_args()
    {"prepare": prepare, "build": build, "run": run}[arguments.phase](arguments.root.resolve())
