"""Require actual SDK focus observations; a JS responder decision is not a verdict."""
import json

PROBE = "codon-original-editor-responder-01"


def parse(text):
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def validate(rows, producer):
    assert rows and all(row["probe"] == PROBE and row["producer"] == producer for row in rows)
    assert [row["sequence"] for row in rows] == list(range(1, len(rows) + 1))
    assert not any(row["kind"] in ["failure", "unexpected-editor-change"] for row in rows)
    captures = [row for row in rows if row["kind"] == "responder-capture"]
    assert [row["mode"] for row in captures] == ["veto", "allow"], "Exactly the original two taps are required"
    assert [row["captured"] for row in captures] == [True, False]
    assert all(row["targetMatchesOriginal"] and str(row["data"]["target"]) == str(row["originalTarget"]) for row in captures)
    assert all(row["currentTargetIsOriginalRoot"] and row["currentRoot"] > 0 for row in captures)
    snapshots = [row for row in rows if row["kind"] == "sdk-snapshot"]
    assert [row["snapshotSequence"] for row in snapshots] == [1, 2, 3]
    identities, states = [], []
    for row in snapshots:
        response = row["response"]
        assert response["requestId"] == "responder:" + str(row["snapshotSequence"])
        field = next(field for field in response["inspection"]["fields"] if field["descriptorId"] == "editor")
        assert all(field[flag] for flag in ["resolved", "available", "currentDescriptor", "metadataOnly", "stateUnchanged"])
        identities.append(tuple(field[key] for key in ["originalInstance", "editorInstance", "metadataInstance"]))
        states.append(field["state"])
    assert len(set(identities)) == 1
    assert [state["text"] for state in states] == ["", "", ""]
    assert [state["focused"] for state in states] == [False, False, True], "Actual native focus did not honor capture"
    assert states[0]["selection"] == states[1]["selection"] and states[2]["selection"] == [0, 0]
    assert snapshots[0]["sequence"] < captures[0]["sequence"] < snapshots[1]["sequence"] < captures[1]["sequence"] < snapshots[2]["sequence"]
    focused = [row for row in rows if row["kind"] == "editor-focus"]
    assert len(focused) == 1 and captures[1]["sequence"] < focused[0]["sequence"] < snapshots[2]["sequence"]
    assert any(row["kind"] == "responder-grant" and captures[0]["sequence"] < row["sequence"] < snapshots[1]["sequence"] for row in rows)
    return {"originalFocusDefaultProof": True, "nativeSnapshots": 3, "fullInputSurface": False,
            "fullFamily": False, "fullGoal": False}
