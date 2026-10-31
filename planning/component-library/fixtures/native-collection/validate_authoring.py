"""Join original SDK journals to committed React collection observations; never input/family acceptance."""
import argparse
import json
from pathlib import Path

from validate import parse as parse_journal, retained_positions, sdk_tree

PROBE = "codon-native-collection-authoring-v1"
PHASES = ["initial", "parent-reorder", "local-reorder", "hidden-child", "restored-child", "context", "one-row", "zero-rows", "all-rows", "root-hidden", "root-restored", "empty", "reinserted", "remounted", "modal"]
INITIAL = ["generated", "a", "nested", "b", "c"]
LOCAL = ["c", "a", "nested", "b", "generated"]
ORDERS = {phase: list(LOCAL) for phase in PHASES}
ORDERS.update({"initial": INITIAL, "parent-reorder": ["b", "generated", "c", "a", "nested"], "hidden-child": ["c", "a", "nested", "generated"], "empty": [], "reinserted": INITIAL, "remounted": INITIAL, "modal": INITIAL})
LEASE_KEYS = ["ownerId", "rootId", "rootRevision", "target", "surfaceId", "windowId", "epoch", "sequence"]


def parse(text):
    return parse_journal(text, PROBE, "CUI_COLLECTION_AUTHORING")


def lease(value):
    return tuple(value[key] for key in LEASE_KEYS)


def correspondence(selected, packet):
    assert lease(selected["lease"]) == lease(packet), "joined-lease-without-original-native-packet"
    assert packet["attached"] and packet["complete"] and packet["metadataOnly"] and not packet["error"]
    logical, wire = selected["logical"], json.loads(packet["hierarchy"])
    assert len(logical) == len(wire), "partial-renderer-collection"
    key_by_id = {node["descriptorId"]: node["key"] for node in logical}
    siblings = {}
    for node in wire: siblings.setdefault(node["parentDescriptorId"], []).append(node)
    for node, original in zip(logical, wire):
        assert node["descriptorId"] == original["descriptorId"]
        assert node["descriptorRevision"] == original["descriptorRevision"] != "uncommitted"
        assert node["metadataTarget"] == original["target"]
        assert node["index"] == original["retainedIndex"], "guessed-visible-index"
        assert node["parentKey"] == key_by_id.get(original["parentDescriptorId"])
        group = siblings[original["parentDescriptorId"]]
        index = group.index(original)
        assert node["prevKey"] == (key_by_id[group[index - 1]["descriptorId"]] if index else None)
        assert node["nextKey"] == (key_by_id[group[index + 1]["descriptorId"]] if index + 1 < len(group) else None)
        assert node["originalValue"] and node["originalRef"], "lost-original-js-identity"
    assert set(selected["lookup"]) == {node["key"] for node in logical}
    assert selected["size"] == sum(node["type"] == "item" for node in logical)
    assert not set(selected["visibleTargets"].values()) & {packet["target"], *(node["target"] for node in wire)}, "metadata-ref-exposed-as-visible-ref"


def validate(records, platform, producer):
    assert records[0]["kind"] == "begin" and records[0]["sourceProducer"] == producer and len(producer) == 40
    assert all(row["probe"] == PROBE for row in records)
    assert not [row for row in records if row["kind"] == "failure"]
    assert records[-1]["kind"] == "terminal" and records[-1]["outcome"] == "native-records-complete"
    commits, inspections, selected = {}, {}, {}
    tokens, native_targets, sequence_by_target = set(), set(), {}
    for row in records:
        kind = row["kind"]
        if kind == "selected-collection":
            assert row["phase"] not in selected, "repeated-phase-selection"
            selected[row["phase"]] = row
        if kind not in ["native-commit", "native-inspection"]: continue
        assert type(row["eventToken"]) is int and row["eventToken"] > 0 and row["eventToken"] not in tokens, "reused-native-callback"
        tokens.add(row["eventToken"])
        actual = row["actual"]
        if kind == "native-inspection":
            assert actual["requestId"] not in inspections
            inspections[actual["requestId"]] = actual
            continue
        assert actual["ownerId"] and actual["rootId"] and actual["target"] > 0
        if not actual["attached"]: continue
        assert actual["surfaceId"] > 0 and actual["windowId"] and actual["epoch"] > 0
        assert actual["sequence"] > sequence_by_target.get(actual["target"], 0), "replayed-native-receipt"
        sequence_by_target[actual["target"]] = actual["sequence"]
        assert actual["mountRevision"].startswith("android-ui-mount-batch:" if platform == "android" else "ios-surface:")
        assert lease(actual) not in commits
        commits[lease(actual)] = actual
        native_targets.add(actual["target"])
        native_targets.update(node["target"] for node in json.loads(actual["hierarchy"]))
    assert set(selected) == set(PHASES) - {"root-hidden"}
    for phase, observation in selected.items():
        packet = commits[lease(observation["lease"])]
        correspondence(observation, packet)
        assert [node["role"] for node in observation["logical"]] == ORDERS[phase], phase
        expected_context = "first" if phase in ["initial", "parent-reorder", "local-reorder", "hidden-child", "restored-child", "remounted", "modal"] else "second"
        assert all(node["textValue"] == node["role"] + ":" + expected_context for node in observation["logical"])
        expected_visible = ["c"] if phase == "one-row" else [] if phase == "zero-rows" else ORDERS[phase]
        assert set(observation["visibleTargets"]) == set(expected_visible), ("materialized-membership", phase)
        query = inspections[phase + ":current"]
        assert query["accepted"] and not query["error"] and lease(query) == lease(packet)
        facts = json.loads(query["inspection"])
        assert not facts["focusRequestAccepted"] and facts["focusedBefore"] == facts["focusedAfter"]
        sdk_tree(facts["tree"], platform, native_targets)
        retained_positions(json.loads(packet["hierarchy"]), facts["tree"])
    for request_id, inspection in inspections.items():
        if request_id.endswith(":stale"): assert not inspection["accepted"], "stale-sdk-inspection-admitted"
    assert any(row["kind"] == "collection-commit" and row["status"] == "pending" for row in records)
    hidden = [row for row in records if row["kind"] == "hidden-root-observed"]
    assert len(hidden) == 1 and hidden[0]["visibleTargets"] == {}, "hidden-root-visible-refs"
    assert any(row["kind"] == "native-commit" and row["phase"] == "root-hidden" and row["actual"]["error"] == "metadata-root-hidden" for row in records)
    assert selected["all-rows"]["visibleTargets"] == selected["root-restored"]["visibleTargets"], "activity-visible-host-replacement"
    assert selected["all-rows"]["lookup"] == selected["root-restored"]["lookup"], "activity-lookup-history-lost"
    for phase in ["parent-reorder", "local-reorder"]:
        assert selected["initial"]["visibleTargets"] == selected[phase]["visibleTargets"], "reorder-visible-host-replacement"
    for phase in ["hidden-child", "restored-child", "context"]:
        for role in ["generated", "a", "nested", "c"]:
            assert selected["initial"]["visibleTargets"][role] == selected[phase]["visibleTargets"][role], "unrelated-row-remount"
    generated = {phase: next(node["key"] for node in observation["logical"] if node["role"] == "generated") for phase, observation in selected.items() if observation["logical"]}
    assert isinstance(generated["initial"], str) and generated["initial"].startswith("react-aria-")
    assert all(generated[phase] == generated["initial"] for phase in PHASES[:11] if phase != "root-hidden")
    assert generated["reinserted"] != generated["initial"]
    assert selected["remounted"]["lease"]["target"] != selected["reinserted"]["lease"]["target"]
    assert selected["modal"]["lease"]["target"] != selected["remounted"]["lease"]["target"]
    assert any(row["kind"] == "native-modal-show" for row in records)
    visible = [row for row in records if row["kind"] == "visible-lifetime" and row["attached"]]
    assert visible and all(row["held"] == 7 for row in visible)
    assert len({row["instance"] for row in records if row["kind"] == "author-lifetime"}) == 3, "opaque-author-remount"
    return {"scope": "Actual native hierarchy/SDK and committed React descriptor/receiver lifetimes; action ACK, genuine input, full contexts, VirtualizedList, pixels/AT/profiles/families remain open", "platform": platform, "producer": producer, "phases": len(PHASES), "joinedCollections": len(selected), "originalNativeCallbacks": len(tokens), "familyAcceptance": False, "fullGoal": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("journal", type=Path)
    parser.add_argument("--platform", choices=["android", "ios"], required=True)
    parser.add_argument("--producer", required=True)
    args = parser.parse_args()
    print(json.dumps(validate(parse(args.journal.read_text()), args.platform, args.producer), indent=2))
