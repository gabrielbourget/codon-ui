"""Validate original native callbacks; fixture completion never substitutes for them."""
from pathlib import Path
import hashlib
import json
import math

CONFIGURATION = json.loads((Path(__file__).parent / "phases.json").read_text())
LABELS = {(float, 0): "Zero", (str, ""): "Middle", (str, "tail"): "Tail"}


def key_identity(value):
    assert type(value) in (str, int, float), "typed native key"
    if type(value) is str:
        return str, value
    assert math.isfinite(value), "finite native key"
    return float, value


def parse_records(text):
    records = []
    for line in text.splitlines():
        marker = "CUI_MENU_FOCUS "
        if marker not in line:
            continue
        try:
            value, _ = json.JSONDecoder().raw_decode(line.split(marker, 1)[1])
            if isinstance(value, dict):
                records.append(value)
        except (ValueError, TypeError):
            continue
    return records


def validate(records, platform):
    assert platform in ("android", "ios"), "native platform"
    assert records, "no transported records"
    assert all(row.get("probe") == CONFIGURATION["probe"] for row in records), "probe identity"
    sequences = [row.get("sequence") for row in records]
    assert all(type(value) is int for value in sequences), "record sequence type"
    assert sequences == list(range(1, len(records) + 1)), "original ordered journal"
    by_sequence = {row["sequence"]: row for row in records}
    failures = [row for row in records if row.get("kind") == "failure"]
    assert not failures, "retained fixture failure: " + str(failures[:1])
    assert not [row for row in records if str(row.get("kind", "")).startswith("unexpected-")], "unexpected controlled request/action"
    begins = [row for row in records if row.get("kind") == "begin"]
    assert len(begins) == 1 and begins[0]["libraryProducer"] == CONFIGURATION["libraryProducer"], "library identity"
    expected_phases = [phase["id"] for phase in CONFIGURATION["phases"]]
    assert begins[0]["phases"] == expected_phases, "complete configured phase list"
    completes = [row for row in records if row.get("kind") == "complete"]
    assert len(completes) == 1 and completes[0]["phases"] == len(expected_phases), "complete transport"
    completed = [row for row in records if row.get("kind") == "phase-complete"]
    assert [row["phase"] for row in completed] == expected_phases, "one ordered completion per phase"
    assertions, cells, retained_targets, retained_owners = [], [], {}, {}
    digest = lambda value: hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    for configuration, completion in zip(CONFIGURATION["phases"], completed):
        phase = configuration["id"]
        prefix = "MENU.FOCUS." + platform + ".P01." + phase
        def check(value, suffix):
            assert value, prefix + "." + suffix
            assertions.append(prefix + "." + suffix)
        rows = [row for row in records if row.get("kind") == "phase" and row.get("phase") == phase]
        check(len(rows) == 1, "phase-identity")
        request = rows[0]
        targets = {key_identity(item["key"]): item["target"] for item in request["targets"]}
        check(list(targets) == [key_identity(key) for key in configuration["keys"]], "actual-target-roster")
        check(all(type(tag) is int and tag > 0 for tag in targets.values()) and len(set(targets.values())) == len(targets), "distinct-native-tags")
        for key, tag in targets.items():
            check(key not in retained_targets or retained_targets[key] == tag, "retained-ref-" + str(key))
            retained_targets[key] = tag
        check(request["ownerKeys"] == completion["ownerKeys"] == [0, "missing"], "owner-keys-unchanged")
        window = request["window"]
        check(all(type(window[field]) in (int, float) and math.isfinite(window[field]) and window[field] > 0 for field in ("width", "height", "scale", "fontScale")), "actual-window-metrics")
        check(window["height"] > window["width"] and abs(request["fontScale"] - 1) < 0.01 and abs(window["fontScale"] - 1) < 0.01, "P01-portrait-normal-text")
        check(set(request["safeAreaInsets"]) == {"top", "right", "bottom", "left"} and all(type(value) in (int, float) and math.isfinite(value) and value >= 0 for value in request["safeAreaInsets"].values()), "actual-safe-insets")
        check(request["keyboardVisible"] is False, "no-software-keyboard")
        session = completion["session"]
        check(session == request["session"] and isinstance(session["windowId"], str) and bool(session["windowId"]) and type(session["epoch"]) in (int, float) and session["epoch"] > 0, "acknowledged-native-session")
        focus_record = by_sequence.get(completion["focusSequence"], {})
        snapshot_record = by_sequence.get(completion["snapshotSequence"], {})
        check(focus_record.get("kind") == "focus" and focus_record.get("phase") == phase, "original-focus-record")
        check(snapshot_record.get("kind") == "snapshot" and snapshot_record.get("phase") == phase, "original-snapshot-record")
        focus, snapshot = focus_record["actual"], snapshot_record["actual"]
        key = key_identity(configuration["focusKey"])
        target = targets[key]
        check(key_identity(focus_record["key"]) == key and focus["target"] == snapshot["target"] == target, "actual-focused-instance")
        check(focus["isFocused"] is True and type(focus["isFocusVisible"]) is bool, "native-focus-state")
        check(focus["origin"] in ("unknown", "keyboard", "pointer", "programmatic"), "native-origin")
        check(isinstance(focus["ownerId"], str) and bool(focus["ownerId"]) and snapshot["ownerId"] == focus["ownerId"], "native-owner")
        check(key not in retained_owners or retained_owners[key] == focus["ownerId"], "retained-native-owner")
        retained_owners[key] = focus["ownerId"]
        check(snapshot["platform"] == platform and snapshot["windowId"] == session["windowId"], "actual-native-window")
        check(snapshot["label"] == LABELS[key], "actual-labelled-instance")
        check(all(type(value) in (int, float) and math.isfinite(value) and value > 0 for value in (focus["timestamp"], snapshot["observedAt"])) and snapshot["observedAt"] >= focus["timestamp"], "native-monotonic-clocks")
        check(focus_record["sequence"] < snapshot_record["sequence"] < completion["sequence"], "callback-snapshot-completion-order")
        events = [row for row in records if row.get("kind") == "focus" and row["actual"]["target"] == target and row["sequence"] <= snapshot_record["sequence"]]
        check(bool(events) and events[-1]["actual"]["isFocused"] is True, "focus-retained-at-snapshot")
        dispatches = [row for row in records if row.get("kind") == "dispatch" and row.get("phase") == phase]
        check(len(dispatches) == int(configuration["explicitFocus"]), "only-explicit-middle-dispatch")
        if dispatches:
            check(dispatches[0]["accepted"] is True and dispatches[0]["target"] == target and dispatches[0]["sequence"] < focus_record["sequence"], "dispatch-is-not-completion")
            check(focus["origin"] == "programmatic", "explicit-native-origin")
        cells.append({"id": prefix, "status": "PASS", "focusSequence": focus_record["sequence"], "snapshotSequence": snapshot_record["sequence"], "focusSHA256": digest(focus), "snapshotSHA256": digest(snapshot), "target": target, "nativeOwnerId": focus["ownerId"], "nativeWindowId": snapshot["windowId"], "nativeSessionEpoch": session["epoch"]})
    return {"platform": platform, "nativeSnapshots": len(cells), "nativeFocusEvents": sum(row.get("kind") == "focus" for row in records), "assertionIDs": assertions, "cells": cells, "scope": "Four P01 programmatic focus forms only; external input, other profiles and complete Menu acceptance remain OPEN."}
