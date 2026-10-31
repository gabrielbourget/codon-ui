"""Original mounted UIKit clip/observer records; source models are not native proof."""
import json

PROBE = "codon-native-card-geometry-v1"
PHASES = ["initial", "narrow", "restore"]
WIDTHS = [120, 96, 120]


def parse(text):
    return [json.loads(line.split("CUI_CARD_GEOMETRY ", 1)[1]) for line in text.splitlines() if line.startswith("CUI_CARD_GEOMETRY ")]


def validate(rows, producer):
    assert rows and rows[0]["kind"] == "begin" and rows[0]["producer"] == producer
    assert all(row["probe"] == PROBE for row in rows)
    assert [row["sequence"] for row in rows] == list(range(1, len(rows) + 1))
    assert rows[-1]["kind"] == "terminal" and rows[-1]["outcome"] == "native-geometry-records-complete"
    assert not any(row["kind"] == "failure" for row in rows)
    native = [row["actual"] for row in rows if row["kind"] == "native-geometry"]
    assert native and all(after["geometryRevision"] > before["geometryRevision"] for before, after in zip(native, native[1:]))
    selected = [row for row in rows if row["kind"] == "phase-complete"]
    assert [row["phase"] for row in selected] == PHASES
    first = selected[0]
    transactions = set()
    for index, row in enumerate(selected):
        actual = row["actual"]
        mount = row["mount"]
        assert actual in native and actual["kind"] == "frame" and actual["attached"] and not actual["error"]
        assert mount in native and mount["kind"] == "mount-after" and mount["transactionId"] and mount["geometryRevision"] < actual["geometryRevision"]
        assert all(actual[key] == first["actual"][key] for key in ["ownerId", "bindingId", "target", "windowId", "scopeOwnerId", "epoch", "attachmentRevision"])
        assert all(mount[key] == actual[key] for key in ["ownerId", "bindingId", "target", "windowId", "scopeOwnerId", "epoch", "attachmentRevision"])
        assert mount["attached"] and not mount["error"] and mount["snapshot"]["layout"] == actual["snapshot"]["layout"]
        assert actual["windowId"] and actual["scopeOwnerId"]
        transactions.add(mount["transactionId"])
        assert row["sameRefs"] and row["actualTarget"] == actual["target"] and row["editorTargets"] == first["editorTargets"]
        assert len(set(row["editorTargets"])) == 2 and all(type(tag) is int and tag > 0 for tag in row["editorTargets"])
        assert row["textCallbacks"] == 0
        snapshot = actual["snapshot"]
        assert snapshot["platform"] == "ios" and snapshot["coordinateSpace"] == "window" and snapshot["units"] == "points"
        assert snapshot["mountObservationAvailable"] and snapshot["density"] > 0
        assert snapshot["layout"][2:] == [WIDTHS[index], 80]
        assert snapshot["ancestors"] and snapshot["layers"] and all(value["clip"]["complete"] for value in [*snapshot["ancestors"], *snapshot["layers"]])
        masks = [value["clip"].get("mask") for value in snapshot["ancestors"]]
        shapes = [mask for mask in masks if isinstance(mask, dict) and isinstance(mask.get("nativePrimitive"), dict) and mask["nativePrimitive"].get("kind") == "cui-owned-path-mask"]
        assert shapes and all(mask["pathAvailable"] and mask["path"] and mask["fillRule"] for mask in shapes)
    assert len(transactions) == 3, "Each authored width requires its actual original native mount transaction"
    return {"producer": producer, "platform": "ios", "mountedPhases": 3, "nativeGeometryRecords": len(native), "scope": "Actual nested Card owned clip/observer/ref correspondence only; no native editor-state/typing/GPU pixel/full Card acceptance", "fullCard": False, "fullGoal": False}
