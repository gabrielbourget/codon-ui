"""Inspect original SDK observations. A dispatch acknowledgement is not an edit verdict."""
import json

PROBE = "codon-original-editor-keyboard-01"
EXPECTED_TEXT = ["", "", "b", "ba", "bac", "bac", "bacA", "bacA", "bacA", "bacA", "", "b"]


def validate(rows, producer):
    assert rows and all(row["probe"] == PROBE and row["producer"] == producer for row in rows)
    assert [row["sequence"] for row in rows] == list(range(1, len(rows) + 1))
    assert not any(row["kind"] == "failure" for row in rows), "Preserve original SDK/query failures"
    snapshots = [row for row in rows if row["kind"] == "sdk-snapshot"]
    assert [row["sequence"] for row in snapshots] != []
    observed = []
    identities = []
    for row in snapshots:
        fields = row["response"]["inspection"]["fields"]
        field = next(field for field in fields if field["descriptorId"] == "editor")
        assert field["resolved"] and field["currentDescriptor"] and field["metadataOnly"] and field["stateUnchanged"]
        state = field["state"]
        observed.append(state["text"])
        assert state["selection"] == [len(state["text"]), len(state["text"])]
        identities.append(tuple(field[key] for key in ["originalInstance", "editorInstance", "metadataInstance"]))
    assert observed == EXPECTED_TEXT, "Actual SDK text sequence differs or is incomplete: " + repr(observed)
    assert len(set(identities[:10])) == 1 and identities[10] != identities[0] and identities[11] == identities[10]
    calls = [row for row in rows if row["kind"] == "caller"]
    assert calls and all(row["originalRef"] for row in calls)
    owned = {(row["data"]["windowId"], row["data"]["epoch"], row["data"]["eventId"]): row for row in rows if row["kind"] == "owned"}
    acknowledgements = [row for row in rows if row["kind"] == "acknowledgement"]
    seen = set()
    for call in calls:
        data = call["data"]
        key = (data["windowId"], data["epoch"], data["eventId"])
        assert key not in seen and key in owned and owned[key]["originalRef"]
        seen.add(key)
        matching = [row for row in acknowledgements if all(row["request"][field] == data[field] for field in ["ownerId", "bindingId", "bindingRevision", "target", "windowId", "epoch", "eventId", "phase"])]
        assert len(matching) == 1 and matching[0]["accepted"]
        assert owned[key]["sequence"] < call["sequence"] < matching[0]["sequence"]
    assert {row["data"]["phase"] for row in calls} >= {"down", "up"}
    assert any(row["kind"] == "stale-ack" and row["accepted"] is False for row in rows)
    assert any(row["kind"] == "callback-exception" for row in rows)
    assert any(row["kind"] == "late-prevent" for row in rows)
    return {"basicOriginalDefaultProof": True, "nativeSnapshots": len(snapshots), "fullPrototype": False,
            "remainingProof": ["repeat/cancel", "busy-JS/reentrancy", "full family built-in/caller ordering", "Android installed"],
            "fullFamily": False, "fullGoal": False}


def parse(text):
    return [json.loads(line) for line in text.splitlines() if line.strip()]
