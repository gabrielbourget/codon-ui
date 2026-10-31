"""Original mounted Card queries/native editor state; synthetic guards are not native proof."""
import json
import math

PHASES = ["initial", "narrow", "restore"]


def chunks(text, prefix):
    groups = {}
    for line in text.splitlines():
        marker = prefix + "_CHUNK "
        if marker not in line: continue
        value = json.loads(line.split(marker, 1)[1])
        key = value["message"]
        assert type(key) is int and key > 0 and 0 <= value["part"] < value["parts"] <= 100
        group = groups.setdefault(key, {"parts": value["parts"], "values": {}})
        assert group["parts"] == value["parts"]
        assert value["part"] not in group["values"] or group["values"][value["part"]] == value["content"]
        group["values"][value["part"]] = value["content"]
    assert groups and set(groups) == set(range(1, max(groups) + 1))
    result = []
    for key in sorted(groups):
        group = groups[key]
        assert set(group["values"]) == set(range(group["parts"]))
        result.append(json.loads("".join(group["values"][part] for part in range(group["parts"]))))
    return result


def parse(text): return chunks(text, "CUI_CARD_EDITOR")
def parse_sdk(text): return chunks(text, "CUI_CARD_EDITOR_SDK")


def validate(records, platform, producer, sdk):
    assert platform == "android" and records[0]["kind"] == "begin" and records[0]["producer"] == producer
    assert records[-1]["kind"] == "terminal" and records[-1]["producer"] == producer and records[-1]["outcome"] == "native-editor-records-complete"
    assert not any(row["kind"] == "failure" for row in records)
    assert [row["sequence"] for row in records] == list(range(1, len(records) + 1))
    assert all(row["producer"] == producer and row["kind"] != "native-editor-failure" for row in sdk)
    assert len({row["pid"] for row in sdk}) == 1
    assert [row["phase"] for row in records if row["kind"] == "phase-complete"] == PHASES
    evaluated = {}
    original_refs = None
    for phase in PHASES:
        before = [row for row in sdk if row["kind"] == "native-editor-before" and row["phase"] == phase]
        after = [row for row in sdk if row["kind"] == "native-editor-after" and row["phase"] == phase]
        assert len(before) == len(after) == 1
        assert after[0]["originalFontCachesUnchanged"] is True and before[0]["editors"] == after[0]["editors"]
        editors = before[0]["editors"]
        ready = [row for row in records if row["kind"] == "phase-ready" and row["phase"] == phase]
        assert len(ready) == 1 and [value["tag"] for value in ready[0]["fields"]] == [editor["tag"] for editor in editors]
        assert len(editors) == 2 and editors[0]["text"] == "" and "native_input" in editors[1]["text"]
        refs = [(row["tag"], row["nativeRef"], row["editableRef"]) for row in editors]
        if original_refs is None: original_refs = refs
        assert refs == original_refs
        assert all(row["cachedStateMapCount"] == 0 and row["stateRef"] and row["spans"] for row in editors)
        values = [row for row in records if row["kind"] == "evaluated" and row["phase"] == phase]
        assert [row["field"] for row in values] == [0, 1]
        for row in values:
            assert row["sameRefs"] and row["callbacksBefore"] == row["callbacksAfter"]
            assert row["values"] == [editor["text"] for editor in editors]
            before_geometry, after_geometry, result = row["before"], row["after"], row["result"]
            assert before_geometry["target"] in [parent["tag"] for parent in editors[row["field"]]["parents"]]
            for key in ["ownerId", "bindingId", "target", "windowId", "scopeOwnerId", "epoch", "attachmentRevision"]:
                assert before_geometry[key] == after_geometry[key] == result[key]
            assert before_geometry["commitRevision"] == after_geometry["commitRevision"] == result["nativeViewRevision"]
            assert before_geometry["snapshot"]["layout"] == after_geometry["snapshot"]["layout"]
            assert result["kind"] == "evaluated-layout" and result["surfaceId"] > 0
            assert len(result["results"]) == 3
            for index, stage in enumerate(result["results"]):
                assert stage["index"] == index and stage["metrics"]["width"] == [240, 180, 240][index]
                assert math.isfinite(stage["metrics"]["height"]) and stage["metrics"]["height"] > 0
            actual = before_geometry["snapshot"]["layout"]
            stage = result["results"][1 if phase == "narrow" else 0]["metrics"]
            assert abs(stage["height"] - actual[3]) <= 1 / before_geometry["snapshot"]["density"] + 0.001, (phase, row["field"], "native-height-mismatch", stage, actual)
            evaluated[phase, row["field"]] = row
    for field in [0, 1]:
        prediction = evaluated["initial", field]["result"]["results"][1]["metrics"]["height"]
        actual = evaluated["narrow", field]["before"]["snapshot"]
        assert abs(prediction - actual["layout"][3]) <= 1 / actual["density"] + 0.001
    changes = [row for row in records if row["kind"] == "change-text"]
    assert any(row["field"] == 0 and row["value"] for row in changes) and any(row["field"] == 0 and row["value"] == "" for row in changes)
    assert any(row["field"] == 1 and "native_input" in row["value"] for row in changes)
    return {"producer": producer, "platform": platform, "mountedCards": 2, "nativeEditors": 2, "phases": 3, "actualNativeQueries": 6, "nativeEvaluatedStages": 18, "nativeEditorInspectionPairs": 3, "scope": "Mounted Card cached-editor dimensions and original held native editor state only; retirement/fonts/API<28/drawing/gesture/consumer/profile/closure gates remain required", "fullCard": False, "fullGoal": False}
