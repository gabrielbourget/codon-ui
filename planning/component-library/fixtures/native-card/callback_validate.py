"""Actual private Card callback/geometry journal gate; synthetic guards are never SDK acceptance."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "native-collection"))
from validate import parse as parse_journal

PROBE = "codon-native-card-callback-v1"
PHASES = ["initial", "out", "back"]


def parse(text):
    return parse_journal(text, PROBE, "CUI_CARD_CALLBACK")


def box(rect):
    return {"x": {"min": rect[0], "max": rect[0] + rect[2]}, "y": {"min": rect[1], "max": rect[1] + rect[3]}}


def validate(records, platform, producer):
    assert records[0]["kind"] == "begin" and records[0]["sourceProducer"] == producer and len(producer) == 40
    assert all(row["probe"] == PROBE for row in records)
    assert not [row for row in records if row["kind"] == "failure"]
    assert records[-1]["kind"] == "terminal" and records[-1]["outcome"] == "native-records-complete"
    native = [row for row in records if row["kind"] == "native-geometry"]
    assert native, "no-original-native-geometry"
    selected = {row["phase"]: row for row in records if row["kind"] == "settled-native-layout"}
    assert list(selected) == PHASES
    initial = selected["initial"]["actual"]
    revision = 0
    for row in native:
        actual = row["actual"]
        assert all(actual[key] == initial[key] for key in ["ownerId", "bindingId", "target", "windowId", "epoch", "attachmentRevision"]), "native-owner-replaced"
        assert actual["attached"] and not actual["error"]
        assert actual["geometryRevision"] > revision, "replayed-native-geometry"
        revision = actual["geometryRevision"]
        assert actual["snapshot"]["platform"] == platform and actual["snapshot"]["coordinateSpace"] == "window"
        assert actual["snapshot"]["units"] == ("dp" if platform == "android" else "points")
        assert actual["snapshot"]["mountObservationAvailable"]
    for phase, observation in selected.items():
        actual = observation["actual"]
        assert observation["sameRoot"] and observation["actualTarget"] == initial["target"], "actual-root-ref-replaced"
        assert any(row["actual"] == actual for row in native), "settled-layout-without-original-native-record"
        assert actual["kind"] in ["frame", "sample"]
        layout = actual["snapshot"]["layout"]
        origin = initial["snapshot"]["layout"]
        assert abs(layout[0] - origin[0] - (40 if phase == "out" else 0)) < 0.001
        assert layout[1:] == origin[1:]
        if phase == "initial": continue
        callbacks = [row for row in records if row["kind"] == "source-callback" and row["phase"] == phase]
        assert {row["name"] for row in callbacks} >= {"before", "measure", "start", "complete"}, "missing-layout-callback"
        for callback in callbacks:
            assert callback["callbackStage"] == phase, "retired-callback-handler"
            if callback["name"] == "before": assert callback["args"] == ["$undefined"] * 3 and callback["sameRoot"]
            if callback["name"] == "measure":
                assert len(callback["args"]) == 3 and callback["args"][2] == "$undefined" and callback["sameRoot"]
                assert any(callback["args"][0] == box(row["actual"]["snapshot"]["untransformed"]["box"]) for row in native if row["phase"] == phase), "callback-box-without-native-correspondence"
        mounts = [row["actual"] for row in native if row["phase"] == phase and row["actual"]["transactionId"]]
        assert any(before["kind"] == "mount-before" and after["kind"] == "mount-after" and before["transactionId"] == after["transactionId"] and before["geometryRevision"] < after["geometryRevision"] for before in mounts for after in mounts), "missing-original-native-mount-pair"
    return {"producer": producer, "platform": platform, "scope": "Actual private Card basic layout callback/geometry/ref correspondence only; font/corners/genuine input/pixels/full Card/profile/closure remain OPEN", "phases": 3, "nativeGeometryRecords": len(native), "sourceCallbacks": sum(row["kind"] == "source-callback" for row in records), "fullCard": False, "fullGoal": False}
