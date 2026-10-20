"""Validate original native collection journals. Synthetic guard tests are never native evidence."""
import argparse
import json
from pathlib import Path

PROBE = "codon-native-collection-gate-v1"
PHASES = ["initial", "parent-reorder", "local-reorder", "hidden", "restored", "context", "duplicate", "duplicate-recovered", "owner-mismatch", "owner-recovered", "empty", "reinserted", "remounted", "modal"]
ORDERS = {
    "initial": ["$generated", "a", "nested", "b", "c"],
    "parent-reorder": ["b", "$generated", "c", "a", "nested"],
    "local-reorder": ["c", "a", "nested", "b", "$generated"],
    "hidden": ["c", "a", "nested", "$generated"],
    "restored": ["c", "a", "nested", "b", "$generated"],
    "context": ["c", "a", "nested", "b", "$generated"],
    "duplicate-recovered": ["c", "a", "nested", "b", "$generated"],
    "owner-recovered": ["c", "a", "nested", "b", "$generated"],
    "empty": [], "reinserted": ["$generated", "a", "nested", "b", "c"],
    "remounted": ["$generated", "a", "nested", "b", "c"],
    "modal": ["$generated", "a", "nested", "b", "c"],
}


def parse(text):
    records, chunks = {}, {}
    for line in text.splitlines():
        if "CUI_COLLECTION_GATE_CHUNK " in line:
            value = json.loads(line.split("CUI_COLLECTION_GATE_CHUNK ", 1)[1])
            assert value["probe"] == PROBE
            key = value["recordSequence"]
            assert isinstance(key, int) and key > 0 and 0 <= value["part"] < value["parts"] <= 100
            group = chunks.setdefault(key, {"parts": value["parts"], "values": {}})
            assert group["parts"] == value["parts"]
            assert value["part"] not in group["values"] or group["values"][value["part"]] == value["content"]
            group["values"][value["part"]] = value["content"]
        elif "CUI_COLLECTION_GATE " in line:
            value = json.loads(line.split("CUI_COLLECTION_GATE ", 1)[1])
            records[value["sequence"]] = value
    for key, group in chunks.items():
        assert set(group["values"]) == set(range(group["parts"])), ("missing-journal-chunk", key)
        line = "".join(group["values"][part] for part in range(group["parts"]))
        assert line.startswith("CUI_COLLECTION_GATE ")
        value = json.loads(line.removeprefix("CUI_COLLECTION_GATE "))
        assert value["sequence"] == key
        assert key not in records or records[key] == value
        records[key] = value
    assert records and set(records) == set(range(1, max(records) + 1)), "noncontiguous-original-journal"
    return [records[key] for key in sorted(records)]


def normalize(key):
    return "$generated" if key.startswith("generated:") else key


def sdk_tree(tree, platform, native_targets):
    assert tree["target"] in native_targets
    assert tree["alpha"] == 0 and tree["width"] == 0 and tree["height"] == 0
    if platform == "android":
        assert tree["importantForAccessibility"] == 4
        assert not tree["focused"] and not tree["focusable"] and not tree["clickable"]
        assert tree["focusCandidates"] == 0 and tree["touchCandidates"] == 0
        assert tree["accessibleChildren"] == 0
        assert not tree["accessibilityFocusable"] and not tree["accessibilityClickable"] and not tree["accessibilityVisible"]
        assert tree["target"] not in tree["parentAccessibleTargets"]
        assert 1 not in tree["accessibilityActions"] and 16 not in tree["accessibilityActions"]
    else:
        assert not tree["userInteractionEnabled"] and not tree["canBecomeFocused"] and not tree["canBecomeFirstResponder"]
        assert not tree["isFirstResponder"] and tree["hitTarget"] == -1
        assert not tree["isAccessibilityElement"] and tree["accessibilityElementsHidden"]
        assert tree["accessibilityElementCount"] == 0 and tree["explicitAccessibilityElements"] == 0
    for child in tree["children"]:
        sdk_tree(child, platform, native_targets)


def validate(records, platform, producer):
    assert records[0]["kind"] == "begin" and records[0]["sourceProducer"] == producer and len(producer) == 40
    assert all(row["probe"] == PROBE for row in records)
    assert not [row for row in records if row["kind"] == "failure"]
    assert records[-1]["kind"] == "terminal" and records[-1]["outcome"] == "native-records-complete"
    commits, inspections = {}, {}
    previous_sequence = {}
    all_native_targets = set()
    token_records = set()
    for record in records:
        if record["kind"] not in ["native-commit", "native-inspection"]:
            continue
        assert isinstance(record["eventToken"], int) and record["eventToken"] > 0
        assert record["eventToken"] not in token_records, "reused-native-event-object"
        token_records.add(record["eventToken"])
        actual = record["actual"]
        assert actual["ownerId"] and actual["rootId"] and actual["target"] > 0 and actual["surfaceId"] > 0
        assert actual["windowId"] and actual["epoch"] > 0 and actual["sequence"] > 0
        if record["kind"] == "native-inspection":
            key = actual["requestId"]
            assert key not in inspections, "duplicate-native-inspection"
            inspections[key] = record
            continue
        if not actual["attached"]:
            continue
        target = actual["target"]
        assert actual["sequence"] > previous_sequence.get(target, 0), "replayed-native-commit"
        previous_sequence[target] = actual["sequence"]
        assert actual["mountRevision"].startswith("android-ui-mount-batch:" if platform == "android" else "ios-surface:")
        nodes = json.loads(actual["hierarchy"])
        all_native_targets.add(target)
        all_native_targets.update(node["target"] for node in nodes)
        commits.setdefault(record["phase"], []).append(record)
    selected, phase_inspections = {}, []
    for phase in PHASES:
        query = inspections[phase + ":current"]
        actual = query["actual"]
        candidates = [row for row in commits.get(phase, []) if all(row["actual"][key] == actual[key] for key in ["ownerId", "rootId", "rootRevision", "target", "surfaceId", "windowId", "epoch", "sequence"])]
        assert len(candidates) == 1, ("inspection-without-original-commit", phase)
        packet = candidates[0]["actual"]
        selected[phase] = packet
        if phase in ["duplicate", "owner-mismatch"]:
            assert not packet["complete"] and not actual["accepted"] and actual["error"] == "metadata-inspection-stale"
            assert packet["error"] == ("invalid-descriptor-identity" if phase == "duplicate" else "metadata-owner-mismatch")
            continue
        assert actual["accepted"] and not actual["error"] and packet["complete"] and packet["metadataOnly"] and not packet["error"]
        nodes = json.loads(packet["hierarchy"])
        assert [normalize(node["descriptorId"]) for node in nodes] == ORDERS[phase], phase
        positions = {}
        for node in nodes:
            parent = "a" if node["descriptorId"] == "nested" else ""
            assert node["parentDescriptorId"] == parent and node["index"] == positions.get(parent, 0)
            positions[parent] = node["index"] + 1
            if phase == "context": assert node["descriptorRevision"].endswith(":second")
        facts = json.loads(actual["inspection"])
        assert not facts["focusRequestAccepted"] and facts["focusedBefore"] == facts["focusedAfter"]
        sdk_tree(facts["tree"], platform, all_native_targets)
        phase_inspections.append(phase)
    first_nodes = {node["descriptorId"]: node["target"] for node in json.loads(selected["initial"]["hierarchy"])}
    for phase in ["parent-reorder", "local-reorder", "restored", "context"]:
        assert {node["descriptorId"]: node["target"] for node in json.loads(selected[phase]["hierarchy"])} == first_nodes, "opaque-row-remount"
    for phase in [value for value in PHASES[1:] if value not in ["duplicate", "owner-mismatch"]]:
        assert phase + ":stale" in inspections and not inspections[phase + ":stale"]["actual"]["accepted"]
    assert selected["remounted"]["target"] != selected["reinserted"]["target"]
    assert selected["modal"]["target"] != selected["remounted"]["target"]
    assert [row for row in records if row["kind"] == "native-modal-show"]
    mounts = [row for row in records if row["kind"] == "author-mount"]
    assert len(mounts) == 3, ("authoring-lifetime", len(mounts))
    return {"scope": "Actual native retained hierarchy and direct SDK inspection only; pixels/genuine pointer/keyboard/AT/profile/family acceptance remain separate", "platform": platform, "producer": producer, "phases": len(PHASES), "sdkInspectedPhases": phase_inspections, "actualNativeTargets": len(all_native_targets), "originalNativeCallbackObjects": len(token_records), "familyAcceptance": False, "fullGoal": False}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("journal", type=Path)
    parser.add_argument("--platform", choices=["android", "ios"], required=True)
    parser.add_argument("--producer", required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = validate(parse(args.journal.read_text()), args.platform, args.producer)
    text = json.dumps(result, indent=2) + "\n"
    if args.output: args.output.write_text(text)
    print(text)


if __name__ == "__main__":
    main()
