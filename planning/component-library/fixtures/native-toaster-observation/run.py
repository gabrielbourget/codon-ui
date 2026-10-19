"""One owned Android boot/install/launch, actual native input, original callbacks, cleanup."""
from pathlib import Path
import argparse
import json
import os
import re
import signal
import subprocess
import time
import xml.etree.ElementTree as ET

from build import LAB, command, digest, environment, verify
from validate import parse_records, validate

ADB = LAB / "sdk/platform-tools/adb"
SERIAL = "emulator-5568"
AVD = "codon_components_recovery_20261013"


def run(output):
    inputs = verify(output)
    product = json.loads((output / "products/proof.json").read_text())
    apk = output / "products/observer.apk"
    assert digest(apk) == product["apkSHA256"]
    assert not (output / "installed").exists(), "A recorded invocation cannot be replayed"
    root = output / "installed"
    root.mkdir()
    state = {"status": "RUNNING", "libraryProducer": inputs["libraryProducer"], "fixtureProducer": inputs["fixtureProducer"], "bootAttempts": 0, "installAttempts": 0, "launchAttempts": 0, "nativeInputCommands": [], "sourceOrModelPacketsInjected": 0}
    def save():
        (root / "state.json").write_text(json.dumps(state, indent=2) + "\n")
    def device(name, args, cap=60, required=True, binary=False, cleanup=False):
        if not cleanup:
            assert time.time() < inputs["deadlineUnix"], "Original cohort deadline"
        return command(root, name, [ADB, "-s", SERIAL, *args], cap if cleanup else min(cap, max(1, int(inputs["deadlineUnix"] - time.time()))), required=required, binary=binary)
    emulator = monitor = None
    original_timeout = None
    changed_timeout = False
    stage = "identity"
    nodes = {}
    save()
    def interrupted(signum, frame):
        raise KeyboardInterrupt("Owned cohort interrupted")
    signal.signal(signal.SIGTERM, interrupted)
    def records():
        path = root / "native.log"
        return parse_records(path.read_text(errors="replace") if path.exists() else "")
    def wait_for(name, predicate, cap=45):
        start = time.monotonic()
        while time.monotonic() - start < cap and time.time() < inputs["deadlineUnix"]:
            if monitor is not None:
                assert monitor.poll() is None, "Native log transport stopped"
            current = records()
            assert not any(row.get("kind") == "failure" for row in current), "Native fixture reports failure"
            if predicate(current):
                print(name, "observed; original records", len(current), flush=True)
                return current
            if int(time.monotonic() - start) % 10 == 0:
                print(name, "waiting; original records", len(current), flush=True)
            time.sleep(1)
        raise AssertionError(name + ": native observation deadline")
    def tree(name):
        remote = "/data/local/tmp/" + name + "-toaster-observation.xml"
        device(name + "-dump", ["shell", "uiautomator", "dump", remote], 45)
        _, text = device(name + "-xml", ["exec-out", "cat", remote], 20)
        (root / (name + ".xml")).write_text(text)
        element = ET.fromstring(text)
        joined = " ".join(node.get("text", "") for node in element.iter()).lower().replace("’", "'")
        assert not any(value in joined for value in ["system ui isn't responding", "system ui keeps stopping", "system ui is not responding"]), "Stock SystemUI error; no repair/replay"
        return list(element.iter("node"))
    def editor_node(name):
        values = [node.attrib for node in tree(name) if node.get("content-desc") == "Toaster native observation editor" or node.get("resource-id") == "toaster-observation-editor"]
        assert len(values) == 1, "one actual native editor"
        nodes[name] = values[0]
        (root / "editor-nodes.json").write_text(json.dumps(nodes, indent=2) + "\n")
        return values[0]
    def tap(name, node):
        bounds = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node["bounds"])
        assert bounds, "actual native bounds"
        left, top, right, bottom = map(int, bounds.groups())
        assert right > left and bottom > top
        state["nativeInputCommands"].append({"case": name, "kind": "tap", "nativeBounds": node["bounds"]})
        save()
        device(name, ["shell", "input", "tap", str((left + right) // 2), str((top + bottom) // 2)])
    def key(name, values):
        state["nativeInputCommands"].append({"case": name, "kind": "keyevent", "arguments": values, "beforeJournalSequence": records()[-1]["sequence"] if records() else 0})
        save()
        device(name, ["shell", "input", "keyevent", *values])
    try:
        _, inventory = command(root, "initial-devices", [ADB, "devices", "-l"])
        assert SERIAL not in inventory, "Owned lab serial already in use"
        _, badging = command(root, "badging", [LAB / "sdk/build-tools/36.0.0/aapt2", "dump", "badging", apk])
        package = re.search(r"package: name='([^']+)'", badging)[1]
        activity = re.search(r"launchable-activity: name='([^']+)'", badging)[1]
        assert package == "dev.codonui.showcase"
        stage = "boot"
        state["bootAttempts"] = 1
        with (root / "emulator.log").open("wb") as log:
            emulator = subprocess.Popen([str(LAB / "sdk/emulator/emulator"), "-avd", AVD, "-port", "5568", "-no-window", "-no-audio", "-no-snapshot-load", "-no-snapshot-save", "-no-boot-anim", "-gpu", "swiftshader_indirect", "-cores", "2", "-memory", "3072"], env=environment(), stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        state["emulatorPID"] = emulator.pid
        save()
        started = time.monotonic()
        ready = False
        for index in range(80):
            assert emulator.poll() is None, "Owned emulator stopped"
            assert time.monotonic() - started < 480, "Original boot cap"
            code, value = device(f"boot-status-{index:02d}", ["shell", "getprop", "sys.boot_completed"], 15, False)
            if code == 0 and value.strip() == "1":
                ready = True
                break
            time.sleep(5)
        assert ready, "one boot readiness cap"
        _, owned_avd = device("owned-avd-name", ["emu", "avd", "name"])
        assert owned_avd.splitlines()[0].strip() == AVD, "Owned serial/AVD identity"
        state["serialOwnershipVerified"] = True
        stage = "guest-preflight"
        device("wake", ["shell", "input", "keyevent", "KEYCODE_WAKEUP"])
        device("keyguard", ["shell", "wm", "dismiss-keyguard"])
        device("guest-build", ["shell", "getprop", "ro.build.fingerprint"])
        device("font-scale", ["shell", "settings", "get", "system", "font_scale"])
        device("input-help", ["shell", "input", "help"])
        device("initial-power", ["shell", "dumpsys", "power"])
        _, image = device("preflight-screen", ["exec-out", "screencap", "-p"], binary=True)
        (root / "preflight.png").write_bytes(image)
        tree("guest-preflight")
        _, timeout = device("screen-timeout-before", ["shell", "settings", "get", "system", "screen_off_timeout"])
        original_timeout = timeout.strip()
        assert original_timeout == "null" or re.fullmatch(r"\d+", original_timeout)
        device("screen-timeout-owned-test", ["shell", "settings", "put", "system", "screen_off_timeout", "600000"])
        changed_timeout = True
        stage = "install"
        state["installAttempts"] = 1
        save()
        device("install", ["install", "-r", apk], 120)
        _, paths = device("installed-package", ["shell", "pm", "path", package])
        paths = [line.removeprefix("package:").strip() for line in paths.splitlines() if line.startswith("package:")]
        assert len(paths) == 1
        _, checksum = device("installed-hash", ["shell", "sha256sum", paths[0]])
        assert checksum.split()[0] == product["apkSHA256"], "installed product identity"
        capture = (root / "native.log").open("wb")
        monitor = subprocess.Popen([str(ADB), "-s", SERIAL, "logcat", "-v", "raw", "-T", "1", "ReactNativeJS:V", "*:S"], env=environment(), stdout=capture, stderr=subprocess.STDOUT, start_new_session=True)
        stage = "launch"
        state["launchAttempts"] = 1
        save()
        device("launch", ["shell", "am", "start", "-W", "-n", package + "/" + activity], 90)
        _, pid = device("app-pid", ["shell", "pidof", package])
        assert re.fullmatch(r"\d+", pid.strip())
        state["appPID"] = pid.strip()
        stage = "native-scope-readiness"
        wait_for("actual native ready/active scope", lambda rows: any(row.get("kind") == "scope" and row.get("ready") is True and row.get("active") is True for row in rows), 90)
        node = editor_node("initial-editor")
        tap("focus-editor", node)
        wait_for("original native editor focus", lambda rows: any(row.get("kind") == "editor-focus" for row in rows))
        stage = "plain-key-and-retirement"
        key("first-e", ["KEYCODE_E"])
        wait_for("first E callbacks, editor request and A retirement", lambda rows: any(row.get("kind") == "editor-change" and row["actual"]["text"] == "e" for row in rows) and any(row.get("observer") == "B" and row["actual"]["code"] == "KeyE" for row in rows) and any(row.get("kind") == "observer-A-commit" and row["mounted"] is False for row in rows))
        editor_node("first-e")
        key("second-e", ["KEYCODE_E"])
        wait_for("second live B and native editor request", lambda rows: len([row for row in rows if row.get("observer") == "B" and row["actual"]["code"] == "KeyE"]) == 2 and any(row.get("kind") == "editor-change" and row["actual"]["text"] == "ee" for row in rows))
        editor_node("second-e")
        stage = "focused-native-burst"
        key("burst-e", ["KEYCODE_E", "KEYCODE_E"])
        wait_for("same-command burst/native request", lambda rows: len([row for row in rows if row.get("observer") == "B" and row["actual"]["code"] == "KeyE"]) == 4 and any(row.get("kind") == "editor-change" and row["actual"]["text"] == "eeee" for row in rows))
        editor_node("burst")
        stage = "native-repeat-default-selection"
        key("home", ["KEYCODE_MOVE_HOME"])
        wait_for("original native Home selection", lambda rows: any(row.get("kind") == "editor-selection" and row["actual"]["selection"] == {"start": 0, "end": 0} and row["sequence"] > max(item["sequence"] for item in rows if item.get("kind") == "editor-change") for row in rows))
        key("repeat-right", ["--longpress", "KEYCODE_DPAD_RIGHT"])
        wait_for("native repeat plus default selection", lambda rows: any(row.get("observer") == "B" and row["actual"]["code"] == "ArrowRight" and row["actual"]["repeat"] is True for row in rows) and any(row.get("kind") == "editor-selection" and row["actual"]["selection"] == {"start": 2, "end": 2} and row["sequence"] > max(item["sequence"] for item in rows if item.get("kind") == "editor-change") for row in rows))
        editor_node("repeat")
        stage = "window-retirement-and-resume"
        before = records()[-1]["sequence"]
        device("cover-window", ["shell", "am", "start", "-W", "-a", "android.settings.SETTINGS"], 90)
        inactive_rows = wait_for("original native inactive window", lambda rows: any(row.get("kind") == "scope" and row.get("active") is False and row["sequence"] > before for row in rows))
        inactive_sequence = max(row["sequence"] for row in inactive_rows if row.get("kind") == "scope" and row.get("active") is False)
        device("return-from-settings", ["shell", "input", "keyevent", "KEYCODE_BACK"])
        wait_for("original native active window resumes", lambda rows: any(row.get("kind") == "scope" and row.get("ready") is True and row.get("active") is True and row["sequence"] > inactive_sequence for row in rows))
        _, resumed = device("resumed-pid", ["shell", "pidof", package])
        assert resumed.strip() == state["appPID"], "No process restart is an acceptance substitute"
        resumed_editor = editor_node("resumed-before-e")
        assert resumed_editor["text"] == "eeee" and resumed_editor["focused"] == "true", "Original editor retained through window change"
        key("resumed-e", ["KEYCODE_E"])
        wait_for("current resumed native key and editor request", lambda rows: len([row for row in rows if row.get("observer") == "B" and row["actual"]["code"] == "KeyE"]) == 5 and any(row.get("kind") == "editor-change" and row["actual"]["text"] == "eeeee" for row in rows))
        editor_node("resumed-e")
        stage = "finish-and-native-verdict"
        finish = [node.attrib for node in tree("finish") if node.get("content-desc") == "Finish Toaster observation"]
        assert len(finish) == 1
        tap("finish-observation", finish[0])
        final = wait_for("terminal native receipt", lambda rows: any(row.get("kind") == "complete" for row in rows))
        (root / "records.json").write_text(json.dumps(final, indent=2) + "\n")
        verdict = validate(final, nodes)
        (root / "verdict.json").write_text(json.dumps(verdict, indent=2) + "\n")
        state.update({"status": "PASS", "scope": verdict["scope"], "assertions": verdict["assertions"]})
    except BaseException as error:
        state.update({"status": "INTERRUPTED" if isinstance(error, KeyboardInterrupt) else "FAIL", "stage": stage, "reason": str(error)})
        (root / "failure.json").write_text(json.dumps(state, indent=2) + "\n")
        print("Retained first cohort failure", stage, str(error), flush=True)
    finally:
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        if (root / "native.log").exists():
            try:
                (root / "records.json").write_text(json.dumps(records(), indent=2) + "\n")
            except Exception as error:
                state["receiptParseFailure"] = str(error)
        if emulator is not None and emulator.poll() is None and state.get("serialOwnershipVerified"):
            device("final-window", ["shell", "dumpsys", "window", "windows"], 30, False, cleanup=True)
            if changed_timeout:
                restore = ["delete", "system", "screen_off_timeout"] if original_timeout == "null" else ["put", "system", "screen_off_timeout", original_timeout]
                code, _ = device("restore-timeout", ["shell", "settings", *restore], 30, False, cleanup=True)
                _, restored = device("verify-timeout", ["shell", "settings", "get", "system", "screen_off_timeout"], 30, False, cleanup=True)
                state["screenTimeoutRestored"] = code == 0 and restored.strip() == original_timeout
            device("stop-owned-guest", ["emu", "kill"], 30, False, cleanup=True)
        if emulator is not None and emulator.poll() is None:
            try:
                emulator.wait(timeout=60)
            except subprocess.TimeoutExpired:
                os.killpg(emulator.pid, signal.SIGTERM)
                emulator.wait(timeout=15)
        if emulator is not None:
            state["ownedGuestStopped"] = emulator.poll() is not None
        if monitor is not None and monitor.poll() is None:
            os.killpg(monitor.pid, signal.SIGTERM)
            monitor.wait(timeout=15)
        save()
        print("One cohort terminal", state["status"], "stage", stage, flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    run(parser.parse_args().output)
