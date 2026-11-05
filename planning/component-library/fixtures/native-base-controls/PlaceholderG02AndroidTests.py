"""Finite Placeholder G02 cohorts; root owns admission, products, guest and cleanup."""
import argparse
import hashlib
import json
import os
import re
import struct
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

from NativeAndroidTestSupport import bounds, copy_node, measured_bounds, parse_hierarchy, recorded_command

ADB = os.environ.get("CODON_ANDROID_ADB", "/Users/gabrielbourget/.local/share/codon-native-lab/sdk/platform-tools/adb")
ORDER = [
    "Light theme", "Dark theme", "Compact width", "library-state", "Toggle placeholder alignment",
    "library-placeholder", "placeholder-g02-state", "G02 prepare placeholder",
    "G02 next placeholder content", "G02 deferred placeholder content", "G02 scene placeholder content",
    "G02 original placeholder callback", "G02 replacement placeholder callback", "G02 absent placeholder callback",
    "G02 toggle placeholder disabled", "G02 default placeholder disabled", "G02 default placeholder selection",
    "G02 enable placeholder selection", "G02 disable placeholder selection", "G02 toggle placeholder label intent",
    "G02 toggle placeholder long press", "G02 remove placeholder", "G02 reinsert placeholder",
    "G02 placeholder disable on press in", "G02 placeholder remove on press in",
    "G02 placeholder no press takeover", "library-button",
]


def command(*argv, cap=15):
    global serial_number
    serial_number += 1
    prefix = args.out / f"{serial_number:03d}"
    timeout = min(cap, args.deadline_unix - time.time())
    assert timeout > 0, "Root work deadline exhausted; root still owns cleanup"
    actual = [ADB, "-s", args.serial, *map(str, argv)]
    print(f"{prefix.name}: {' '.join(map(str, argv))}", flush=True)
    record = recorded_command(actual, prefix, cap, args.deadline_unix)
    assert record.get("ownedGroupGone") is True and "cleanupError" not in record, record
    if record.get("timedOut"):
        raise TimeoutError("Host command timed out; guest outcome remains uncertain")
    output, error = prefix.with_suffix(".stdout").read_bytes(), prefix.with_suffix(".stderr").read_bytes()
    assert record["exitCode"] == 0, (actual, output.decode(errors="replace"), error.decode(errors="replace"))
    return output


def tree():
    result = command("shell", "uiautomator", "dump", remote)
    assert b"dumped to" in result, result
    raw = command("shell", "cat", remote)
    data = parse_hierarchy(raw)
    assert data.get("rotation") == "0", "Root must establish and admit native portrait before this cohort"
    assert not any("isn't responding" in n.get("text", "") for n in data.iter("node")), "Preserve stock ANR; do not dismiss it"
    return data


def find(data, key):
    nodes = list(data.iter("node"))
    matches = [n for n in nodes if n.get("resource-id") == key or n.get("resource-id", "").endswith("/" + key)]
    if not matches:
        matches = [n for n in nodes if n.get("content-desc") == key]
    if not matches:
        matches = [n for n in nodes if n.get("text") == key]
    assert len(matches) <= 1, ("Ambiguous original native node", key)
    return matches[0] if matches else None






def gutter_scroll(data, upward, original_id="library-placeholder"):
    viewport = bounds(find(data, "showcase-scroll"))
    x = viewport[0] + 8
    original = find(data, original_id)
    if original is not None:
        rect = measured_bounds(original, viewport)
        assert not rect[0] <= x <= rect[2], "No measured safe gutter outside original Text"
    top, bottom = viewport[1] + (viewport[3] - viewport[1]) // 4, viewport[1] + 7 * (viewport[3] - viewport[1]) // 10
    command("shell", "input", "touchscreen", "swipe", x, top if upward else bottom, x, bottom if upward else top, 350)


def reveal(key):
    for _ in range(14):
        data = tree()
        node, viewport = find(data, key), bounds(find(data, "showcase-scroll"))
        if node is not None:
            rect = measured_bounds(node, viewport)
            if rect[2] > rect[0] and rect[3] > rect[1] and rect[1] >= viewport[1] + 4 and rect[3] <= viewport[3] - 4:
                return data, node
            upward = rect[1] < viewport[1] + 4
        else:
            visible = [(ORDER.index(label), n) for label in ORDER if (n := find(data, label)) is not None]
            upward = bool(visible) and ORDER.index(key) < visible[0][0]
        gutter_scroll(data, upward)
    raise AssertionError("Unreachable original control: " + key)


def touch(node, duration=200):
    rect = bounds(node)
    x, y = (rect[0] + rect[2]) // 2, (rect[1] + rect[3]) // 2
    command("shell", "input", "touchscreen", "swipe", x, y, x, y, duration, cap=10)


def capture(name):
    data = tree()
    (args.out / (name + ".xml")).write_bytes(ET.tostring(data, encoding="utf-8"))
    png = command("exec-out", "screencap", "-p")
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    width, height = struct.unpack(">II", png[16:24])
    assert height > width, "Actual screenshot must remain portrait"
    (args.out / (name + ".png")).write_bytes(png)
    return data


def control(label):
    _, node = reveal(label)
    touch(node)
    return capture(f"action-{serial_number:03d}")


def state(data):
    node = find(data, "placeholder-g02-state")
    assert node is not None, "Original JSON readout must be natively observable"
    value = json.loads(node.get("content-desc", ""))
    assert value["dropped"] == 0
    assert [r["sequence"] for r in value["receipts"]] == list(range(1, len(value["receipts"]) + 1))
    assert value["actions"] == sum(r["kind"] == "press" for r in value["receipts"])
    assert value["longActions"] == sum(r["kind"] == "longPress" for r in value["receipts"])
    return value


def inspect_node(exact_id, windows=False):
    extra = ["-e", "windows", "true"] if windows else []
    output = command("shell", "am", "instrument", "-w", "-e", "op", "inspect", "-e", "id", exact_id, *extra, "dev.codonui.lab.number/.Actions", cap=20).decode()
    assert "INSTRUMENTATION_CODE: -1" in output, output
    match = re.search(r"INSTRUMENTATION_RESULT: codon=(.*)", output)
    assert match, output
    native = json.loads(match[1])
    assert native["id"] == exact_id and native["operation"] == "inspect", native
    return native


def owner(data):
    node = find(data, "library-state")
    # The original inspector traverses public AX children without UiAutomator's visible-only dump filter.
    # Its exact original owner ID is learned from the baseline hierarchy before scrolling to the Text.
    text = (node.get("text", "") + " " + node.get("content-desc", "")) if node is not None else inspect_node(owner_id)["text"]
    match = re.search(r"Library action count: (\d+)", text)
    assert match, text
    return int(match[1])


def ready():
    reveal("placeholder-g02-state")
    for _ in range(14):
        data = tree()
        node, readout = find(data, "library-placeholder"), find(data, "placeholder-g02-state")
        viewport = bounds(find(data, "showcase-scroll"))
        if node is not None and readout is not None:
            rect, marker = measured_bounds(node, viewport), measured_bounds(readout, viewport)
            top, bottom = min(rect[1], marker[1]), max(rect[3], marker[3])
            if top >= viewport[1] + 4 and bottom <= viewport[3] - 4:
                assert rect[2] > rect[0] and rect[3] > rect[1], "Zero original Text cannot be used as a gesture target"
                assert marker[2] > marker[0] and marker[3] > marker[1]
                return data, node
            upward = top < viewport[1] + 4
        else:
            assert node is not None or readout is not None, "Lost both original Text and JSON readout"
            upward = node is None
        gutter_scroll(data, upward)
    raise AssertionError("Original Text and readout are not jointly visible")


def baseline():
    global owner_id
    data, owner_node = reveal("library-state")
    owner_id = owner_node.get("resource-id")
    assert owner_id, "Learn the original owner ID from the native hierarchy"
    owner_base = owner(data)
    control("G02 prepare placeholder")
    data, _ = ready()
    value = state(data)
    assert value["receipts"] == [] and value["rootTag"] > 0 and value["refIdentity"] > 0
    return owner_base


def first_s02():
    owner_base = baseline()
    def press(name, expected, callback="original", duration=200):
        data, node = ready()
        before = state(data)
        touch(node, duration)
        after_data = capture(name)
        after = state(after_data)
        actual = after["receipts"][len(before["receipts"]):]
        assert [r["kind"] for r in actual] == expected, actual
        for row in actual:
            assert row["callback"] == callback and row["afterDetach"] is False, row
            assert row["rootTag"] == row["native"]["target"] == before["rootTag"], row
            assert row["refIdentity"] == before["refIdentity"], row
            assert row["eventIdentity"] > 0 and row["nativeIdentity"] > 0, row
        assert owner(after_data) == owner_base + after["actions"]
        # Reobserve after real hierarchy transport to expose delayed actions; no new touch is synthesized.
        assert args.deadline_unix - time.time() > 0.75, "Insufficient time for unchanged0.75s late-event checkpoint"
        time.sleep(0.75)
        assert state(tree())["receipts"] == after["receipts"]
        return after
    initial = press("s02-first", ["pressIn", "pressOut", "press"])
    control("G02 replacement placeholder callback")
    replacement = press("s02-replacement", ["pressIn", "pressOut", "press"], "replacement")
    assert (initial["rootTag"], initial["refIdentity"]) == (replacement["rootTag"], replacement["refIdentity"])
    control("G02 toggle placeholder long press")
    press("s02-long", ["pressIn", "longPress", "pressOut"], "replacement", 1000)
    control("G02 toggle placeholder disabled")
    press("s02-disabled", [])
    control("G02 toggle placeholder disabled")
    press("s02-reenabled", ["pressIn", "pressOut", "press"], "replacement")
    control("G02 absent placeholder callback")
    press("s02-absent", [])


def selection_s03():
    owner_base = baseline()
    control("G02 absent placeholder callback")
    initial = state(ready()[0])
    def observe(name, enabled):
        data, node = ready()
        before = state(data)
        assert (before["rootTag"], before["refIdentity"]) == (initial["rootTag"], initial["refIdentity"])
        before_id = node.get("resource-id")
        assert before_id
        pre_native = inspect_node(before_id)
        (args.out / ("s03-pre-native-" + name + ".json")).write_text(json.dumps(pre_native, indent=2) + "\n")
        capture("s03-before-hold-" + name)
        touch(node, 1000)
        menu = capture("s03-menu-" + name)
        actual = find(menu, "library-placeholder")
        assert actual is not None
        exact_id = actual.get("resource-id")
        assert exact_id == before_id, "Use the same original native ID across the real hold"
        native = inspect_node(exact_id, windows=True)
        (args.out / ("s03-native-" + name + ".json")).write_text(json.dumps(native, indent=2) + "\n")
        assert native["operation"] == "inspect" and native["text"] == "Choose an item" and native["editable"] is False, native
        start, end = native["selectionStart"], native["selectionEnd"]
        assert type(start) is int and type(end) is int
        current = capture("s03-range-" + name)
        current_windows = inspect_node(exact_id, windows=True)
        (args.out / ("s03-current-windows-" + name + ".json")).write_text(json.dumps(current_windows, indent=2) + "\n")
        copy = copy_node(current, current_windows)
        assert (copy_node(menu, native) is not None) == enabled and (copy is not None) == enabled
        after = state(current)
        assert after["receipts"] == [] and after["actions"] == after["longActions"] == 0
        assert owner(current) == owner_base
        assert (after["rootTag"], after["refIdentity"]) == (before["rootTag"], before["refIdentity"])
        if enabled:
            assert 0 <= start < end <= len(native["text"]), native
            assert native["text"][start:end], native
            assert copy.get("enabled") == "true", copy.attrib
            touch(copy)
            copied = capture("s03-copy-activated-" + name)
            assert state(copied)["receipts"] == [] and owner(copied) == owner_base
        else:
            assert start < 0 or end <= start, native
    control("G02 default placeholder selection")
    observe("default-p", True)
    control("G02 disable placeholder selection")
    observe("false-p", False)
    control("G02 toggle placeholder label intent")
    control("G02 default placeholder selection")
    observe("default-label", False)
    control("G02 enable placeholder selection")
    observe("true-label", True)


def readout_capture(name):
    reveal("placeholder-g02-state")
    return capture(name)


def quiet_capture(name, expected_rows):
    assert args.deadline_unix - time.time() > 0.75, "Insufficient0.75s late-event checkpoint"
    time.sleep(0.75)
    data = readout_capture(name)
    assert state(data)["receipts"] == expected_rows
    return data


def assert_native_rows(rows, expected, original):
    assert [row["kind"] for row in rows] == expected, rows
    for row in rows:
        assert row["callback"] == "original" and row["afterDetach"] is False, row
        assert row["rootTag"] == row["native"]["target"] == original["rootTag"], row
        assert row["refIdentity"] == original["refIdentity"], row
        assert row["eventIdentity"] > 0 and row["nativeIdentity"] > 0, row


def content_s01():
    owner_base = baseline()
    data, node = ready()
    initial, exact_id = state(data), node.get("resource-id")
    assert exact_id
    cases = [("zero", "0"), ("empty", ""), ("false", ""), ("null", ""), ("restored", "Restored owner content"), ("deferred", "Deferred owner content")]
    for mode, expected_text in cases:
        control("G02 deferred placeholder content" if mode == "deferred" else "G02 next placeholder content")
        current = readout_capture("s01-" + mode)
        value = state(current)
        native = inspect_node(exact_id)
        (args.out / ("s01-native-" + mode + ".json")).write_text(json.dumps(native, indent=2) + "\n")
        # Empty native Text is observed through its original ID/ref and actual text, never a hit rectangle.
        assert type(native["textIsNull"]) is bool, native
        if expected_text == "":
            assert native["text"] == "" or (native["textIsNull"] is True and native["text"] == "null"), native
        else:
            assert native["textIsNull"] is False and native["text"] == expected_text, native
        assert value["contentMode"] == mode and value["receipts"] == []
        assert (value["rootTag"], value["refIdentity"]) == (initial["rootTag"], initial["refIdentity"])
        assert owner(current) == owner_base


def interrupted_s02():
    owner_base = baseline()
    data, node = ready()
    original, frame, viewport = state(data), bounds(node), bounds(find(data, "showcase-scroll"))
    density_text = command("shell", "wm", "density").decode()
    densities = re.findall(r"(?:Physical|Override) density:\s*(\d+)", density_text)
    assert densities, density_text
    scale = int(densities[-1]) / 160
    margin, retention = round(80 * scale), round(30 * scale)
    x, y = (frame[0] + frame[2]) // 2, (frame[1] + frame[3]) // 2
    end_y = frame[1] - margin if frame[1] - viewport[1] > margin + 4 else frame[3] + margin
    assert viewport[1] + 4 <= end_y <= viewport[3] - 4
    assert end_y < frame[1] - retention or end_y > frame[3] + retention
    command("shell", "input", "touchscreen", "swipe", x, y, x, end_y, 400, cap=10)
    current = readout_capture("s02-interrupted")
    value = state(current)
    assert_native_rows(value["receipts"], ["pressIn", "pressOut"], original)
    assert value["actions"] == value["longActions"] == 0 and owner(current) == owner_base
    quiet_capture("s02-interrupted-quiet", value["receipts"])
    control("G02 prepare placeholder")
    control("G02 placeholder disable on press in")
    data, node = ready()
    original = state(data)
    touch(node, 1000)
    current = readout_capture("s02-disabled-takeover")
    value, rows = state(current), state(current)["receipts"]
    assert value["disabled"] is True
    assert rows and rows[0]["kind"] == "pressIn"
    assert_native_rows(rows[:1], ["pressIn"], original)
    assert sum(row["kind"] == "pressIn" for row in rows) == 1
    assert all(row["kind"] in ["pressIn", "pressOut"] for row in rows)
    assert sum(row["kind"] == "pressOut" for row in rows) <= 1
    assert value["actions"] == value["longActions"] == 0 and owner(current) == owner_base
    stable = quiet_capture("s02-disabled-takeover-quiet", rows)
    assert owner(stable) == owner_base


def context_s05():
    owner_base = baseline()
    data, node = ready()
    original = state(data)
    touch(node)
    current = readout_capture("s05-first-press")
    initial = state(current)
    assert_native_rows(initial["receipts"], ["pressIn", "pressOut", "press"], original)
    assert initial["actions"] == 1 and owner(current) == owner_base + 1
    quiet_capture("s05-first-quiet", initial["receipts"])
    for index, label in enumerate(["Toggle placeholder alignment", "Dark theme", "Compact width", "Light theme"]):
        control(label)
        current, node = ready()
        current = capture("s05-context-" + str(index))
        value = state(current)
        assert (value["rootTag"], value["refIdentity"]) == (initial["rootTag"], initial["refIdentity"])
        assert value["actions"] == 1 and value["receipts"] == initial["receipts"]
        assert node.get("text", "") == "Choose an item", node.attrib
        assert owner(current) == owner_base + 1


def retirement_s06():
    owner_base = baseline()
    initial = state(ready()[0])
    control("G02 remove placeholder")
    removed = readout_capture("s06-removed")
    value = state(removed)
    assert find(removed, "library-placeholder") is None and value["visible"] is False
    assert value["rootTag"] is None and value["refIdentity"] is None
    assert value["detaches"] == initial["detaches"] + 1 and value["receipts"] == []
    assert owner(removed) == owner_base
    control("G02 reinsert placeholder")
    current, node = ready()
    value = state(current)
    assert value["rootTag"] > 0 and value["refIdentity"] > 0 and value["refIdentity"] != initial["refIdentity"]
    assert value["receipts"] == [] and node.get("text", "") == "Choose an item"
    assert owner(current) == owner_base
    control("G02 placeholder remove on press in")
    data, node = ready()
    original = state(data)
    touch(node, 1000)
    retired = readout_capture("s06-held-retirement")
    value, rows = state(retired), state(retired)["receipts"]
    assert find(retired, "library-placeholder") is None and value["visible"] is False
    assert value["rootTag"] is None and value["refIdentity"] is None
    assert rows and rows[0]["kind"] == "pressIn"
    assert_native_rows(rows[:1], ["pressIn"], original)
    assert sum(row["kind"] == "pressIn" for row in rows) == 1
    assert all(row["kind"] in ["pressIn", "pressOut"] for row in rows)
    assert sum(row["kind"] == "pressOut" for row in rows) <= 1
    assert value["actions"] == value["longActions"] == 0 and owner(retired) == owner_base
    stable = quiet_capture("s06-held-retirement-quiet", rows)
    assert owner(stable) == owner_base


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial", required=True)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--deadline-unix", required=True, type=float, help="Root work deadline, before root cleanup reserve")
    cohorts = {"first-s02": first_s02, "selection-s03": selection_s03, "content-s01": content_s01,
               "interrupted-s02": interrupted_s02, "context-s05": context_s05, "retirement-s06": retirement_s06}
    parser.add_argument("--cohort", required=True, choices=list(cohorts))
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    serial_number = 0
    remote = "/sdcard/codon-placeholder-" + hashlib.sha256(str(args.out).encode()).hexdigest()[:12] + ".xml"
    result = {"cohort": args.cohort, "serial": args.serial, "startedEpoch": time.time(), "scriptSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "wholeG02": False, "rootOwnsAdmissionAndCleanup": True}
    try:
        cohorts[args.cohort]()
        result["status"] = "SCOPED_ASSERTIONS_PASSED"
    except BaseException as error:
        result.update(status="STOPPED", error=repr(error))
        raise
    finally:
        result["endedEpoch"] = time.time()
        (args.out / "terminal.json").write_text(json.dumps(result, indent=2) + "\n")
