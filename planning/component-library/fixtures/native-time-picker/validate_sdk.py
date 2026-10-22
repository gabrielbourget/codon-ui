"""Validate original owned-editor SDK receipts, never manufacture an acceptance result."""
import json

PROBE = "codon-owned-time-entry-01"
EXPECTED = [
    ("14:45:07", "Time"), ("14:45:07", "Time"), ("08:45:07", "Time"),
    ("2024-10-01T14:45:07", "CalendarDateTime"),
    ("2024-10-01T14:45:07-04:00[America/New_York]", "ZonedDateTime"),
    ("2024-10-01T02:45:07-04:00[America/New_York]", "ZonedDateTime"),
]


def parse(text):
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def validate(rows, producer):
    assert rows and all(row["probe"] == PROBE and row["producer"] == producer and row["sequence"] == index + 1 for index, row in enumerate(rows)), "Wrong original journal identity/order"
    native = [row for row in rows if row["kind"] == "native"]
    assert native, "No original SDK packets"
    instances, sequences, targets = {}, {}, {}
    for row in native:
        data = row["data"]
        segment = data["segmentId"]
        assert row["originalRef"] is True and row["originalTarget"] == data["target"] > 0, "Original owned ref/target changed"
        assert data["ownerId"] and data["bindingRevision"] and data["surfaceId"] > 0
        if data["active"]: assert data["windowId"]
        assert data["nativeInstance"] and data["epoch"] >= 0 and data["sequence"] > sequences.get(segment, 0), "Stale native sequence"
        if segment in instances:
            assert instances[segment] == data["nativeInstance"] and targets[segment] == data["target"], "Owned SDK instance replaced"
        instances[segment], targets[segment], sequences[segment] = data["nativeInstance"], data["target"], data["sequence"]
        if data["kind"] in ["insert", "delete", "marked", "unmark", "focus"]:
            assert data["active"] is True and data["focused"] is True
        if data["kind"] in ["insert", "delete", "marked", "unmark"]:
            assert json.loads(data["nativeData"])["method"], "Original SDK input arguments missing"
            assert not row["readonly"] and not row["disabled"], "Guarded input reached field state"
    assert {"hour", "minute", "second"} <= set(instances)
    assert any(row["data"]["kind"] == "focus" and row["data"]["segmentId"] == "hour" for row in native)
    assert any(row["data"]["kind"] in ["insert", "unmark"] and row["data"]["text"] == "٢" for row in native), "Original Unicode commit missing"
    requests = [row for row in rows if row["kind"] == "request"]
    assert [(row["value"], row["valueClass"]) for row in requests] == EXPECTED, "Source class/value requests differ or duplicate"
    assert [row["echo"] for row in requests] == [False, False, True, False, False, False]
    assert requests[0]["held"] == requests[1]["held"] == "13:45:07"
    assert requests[3]["held"] == "2024-10-01T13:45:07"
    assert requests[4]["held"] == requests[5]["held"] == "2024-10-01T13:45:07-04:00[America/New_York]"
    keys = [row for row in rows if row["kind"] == "key" and row["data"]["phase"] == "down"]
    assert len(keys) == 4 and all(row["data"]["key"] == "ArrowUp" and row["data"]["nativeDefaultHandled"] is True for row in keys), "Original captured keys missing"
    observed = [row for row in rows if row["kind"] == "observation" and row["readonly"] and row["data"]["key"] == "9"]
    assert observed and all(row["data"]["focusedTarget"] == targets["hour"] for row in observed), "Readonly physical key was not observed on the owned editor"
    snapshots = [row["data"] for row in rows if row["kind"] == "snapshot"]
    assert snapshots and any(row["readonly"] and row["focused"] == "hour" and len(row["requests"]) == 2 for row in snapshots)
    assert any(row["value"] == "08:45:07" and row["valueClass"] == "Time" for row in snapshots), "Owner echo missing"
    assert any(row.get("hidden") is True and row["focused"] is None for row in snapshots), "Hidden owned editor stayed focused"
    assert any(row.get("hidden") is False and row["focused"] == "hour" and len(row["requests"]) == 6 for row in snapshots), "Original shown editor focus missing"
    final = snapshots[-1]
    assert final["disabled"] and final["focused"] is None and final["scopeReady"] and len(final["requests"]) == 6
    assert len({row["coreTarget"] for row in snapshots if row["coreTarget"]}) == 1, "Independent core ref target changed"
    assert not any(row["kind"] == "core-change" for row in rows), "Independent core editor changed"
    return {"sdkInputPrerequisite": True, "nativePackets": len(native), "sourceRequests": len(requests), "capturedKeys": len(keys), "ownedInstances": instances, "realCompositionObserved": any(row["data"]["kind"] == "marked" for row in native), "fullIME": False, "fullInputSurface": False, "fullFamily": False, "fullGoal": False}
