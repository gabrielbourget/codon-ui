"""One supplemental public Text selection cohort under the actual public Button."""

import argparse
import hashlib
import json
import time
from pathlib import Path

import PlaceholderG02AndroidTests as observed
from NativeAndroidTestSupport import bounds, copy_node, measured_bounds


CONTENT = "Choose a context item"
TARGET = "text-g02-context-target"
OWNER = "text-g02-context-owner"
STATE = "text-g02-context-state"


def reveal(key):
    for _ in range(24):
        data = observed.tree()
        viewport = bounds(observed.find(data, "showcase-scroll"))
        node = observed.find(data, key)
        if node is not None:
            rect = measured_bounds(node, viewport)
            if rect[2] > rect[0] and rect[3] > rect[1] and rect[1] >= viewport[1] + 4 and rect[3] <= viewport[3] - 4:
                return data, node
            upward = rect[1] < viewport[1] + 4
        else:
            upward = False
        observed.gutter_scroll(data, upward, original_id=TARGET)
    raise AssertionError("Unreachable actual Text context node: " + key)


def ready():
    reveal(STATE)
    for _ in range(12):
        data = observed.tree()
        owner, marker = observed.find(data, OWNER), observed.find(data, STATE)
        viewport = bounds(observed.find(data, "showcase-scroll"))
        assert owner is not None and marker is not None
        frame, readout = measured_bounds(owner, viewport), measured_bounds(marker, viewport)
        top, bottom = min(frame[1], readout[1]), max(frame[3], readout[3])
        if top >= viewport[1] + 4 and bottom <= viewport[3] - 4:
            bounds(owner)
            bounds(marker)
            return data, owner
        observed.gutter_scroll(data, top < viewport[1] + 4, original_id=TARGET)
    raise AssertionError("Text context owner and readout are not jointly visible")


def capture(name, reposition=True):
    if reposition:
        ready()
    return observed.capture(name)


def state(data):
    node = observed.find(data, STATE)
    assert node is not None
    value = json.loads(node.get("content-desc"))
    assert value["parentOrdinary"] == len(value["receipts"])
    assert [row["sequence"] for row in value["receipts"]] == list(range(1, len(value["receipts"]) + 1))
    assert all(row["kind"] == "parentPress" for row in value["receipts"])
    return value


def control(label):
    _, node = reveal(label)
    observed.touch(node)
    return capture("control-" + str(observed.serial_number))


def run():
    control("G02 prepare Text button context")
    initial = state(capture("context-initial"))
    observed.owner_id = "library-state"
    caller_base = observed.owner(observed.tree())
    parent_base = initial["parentOrdinary"]
    assert initial["policy"] == "default" and initial["rootTag"] > 0 and initial["refIdentity"] > 0

    def retained(value, data):
        for key in ["rootTag", "refIdentity", "attaches", "detaches"]:
            assert value[key] == initial[key], (key, value, initial)
        assert observed.owner(data) == caller_base + value["parentOrdinary"] - parent_base
        for row in value["receipts"]:
            assert row["rootTag"] == initial["rootTag"] and row["refIdentity"] == initial["refIdentity"]

    def policy(label, expected):
        before = state(capture("before-policy-" + expected))
        data = control(label)
        value = state(data)
        assert value["policy"] == expected and value["receipts"] == before["receipts"]
        retained(value, data)
        time.sleep(0.75)
        quiet = capture("quiet-policy-" + expected)
        assert state(quiet)["receipts"] == before["receipts"]
        retained(state(quiet), quiet)

    def hold(name, expected_policy, enabled):
        data, owner = ready()
        children = [node for node in owner.iter("node") if node.get("resource-id") == TARGET]
        assert len(children) == 1, "Use the unique actual Text child of the actual public Button"
        target = children[0]
        inner, outer = bounds(target), bounds(owner)
        assert outer[0] <= inner[0] < inner[2] <= outer[2] and outer[1] <= inner[1] < inner[3] <= outer[3]
        assert target.get("text") == CONTENT
        before = state(data)
        assert before["policy"] == expected_policy
        retained(before, data)
        observed.touch(target, 1000)
        menu = capture("context-menu-" + name, reposition=False)
        native = observed.inspect_node(TARGET, windows=True)
        (args.out / ("native-" + name + ".json")).write_text(json.dumps(native, indent=2) + "\n")
        assert native["text"] == CONTENT and native["editable"] is False
        current = capture("context-range-" + name, reposition=False)
        current_native = observed.inspect_node(TARGET, windows=True)
        (args.out / ("native-current-" + name + ".json")).write_text(json.dumps(current_native, indent=2) + "\n")
        copy = copy_node(current, current_native)
        assert (copy_node(menu, native) is not None) == enabled and (copy is not None) == enabled
        start, end = native["selectionStart"], native["selectionEnd"]
        if enabled:
            assert 0 <= start < end <= len(CONTENT) and CONTENT[start:end]
        else:
            assert start < 0 or end <= start
        value = state(current)
        assert 0 <= value["parentOrdinary"] - before["parentOrdinary"] <= 1
        retained(value, current)
        if enabled:
            assert copy.get("enabled") == "true"
            observed.touch(copy)
            copied = capture("context-copy-" + name, reposition=False)
            assert state(copied)["receipts"] == value["receipts"]
            retained(state(copied), copied)
        time.sleep(0.75)
        quiet = capture("context-quiet-" + name, reposition=False)
        after = state(quiet)
        assert 0 <= after["parentOrdinary"] - before["parentOrdinary"] <= 1
        retained(after, quiet)

    hold("initial-default", "default", False)
    policy("G02 enable Text context selection", "explicit-true")
    hold("explicit-true", "explicit-true", True)
    policy("G02 default Text context selection", "default")
    hold("restored-default", "default", False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial", required=True)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--deadline-unix", required=True, type=float)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    observed.args = args
    observed.serial_number = 0
    observed.remote = "/sdcard/codon-text-context-" + hashlib.sha256(str(args.out).encode()).hexdigest()[:12] + ".xml"
    result = {"cell": "CAT.text.G02", "cohort": "button-context-selection", "startedEpoch": time.time(), "wholeG02": False, "rootOwnsAdmissionAndCleanup": True}
    try:
        run()
        result["status"] = "SCOPED_ASSERTIONS_PASSED"
    except BaseException as error:
        result.update(status="FAILED", error=repr(error))
        raise
    finally:
        result["endedEpoch"] = time.time()
        (args.out / "terminal.json").write_text(json.dumps(result, indent=2) + "\n")
