"""Modifier and consecutive-key custody. Hardware burst/repeat qualification remains separate."""
from inspect_field_receipts import inspect, packet, key

MODIFIERS = ("shiftKey", "altKey", "ctrlKey", "metaKey")
CASES = tuple("modifier-" + str(mask) for mask in range(16)) + ("consecutive-original-navigation",)


def completed(frame):
    assert all(frame[name] is True for name in ["deliveryStarted", "deliveryReturned", "renderPhasesComplete", "scopeCurrent"])
    assert frame["error"] == "" and frame["decision"] in {"allowed", "prevented"}


def validate(rows, producer, checkpoints):
    integrity = inspect(rows, producer)
    reports = {row["case"]: row for row in checkpoints}
    assert len(reports) == len(checkpoints), "Duplicate key profile attachment"
    assert set(CASES) | {name + "-setup" for name in CASES} <= set(reports), "Incomplete key profile coverage"
    batches = {row["batch"]: row for row in rows if row["kind"] == "native-receipts"}
    assert len(batches) == sum(row["kind"] == "native-receipts" for row in rows)
    for profile, name in enumerate(CASES):
        setup, report = reports[name + "-setup"], reports[name]
        assert setup["batch"] < report["batch"]
        start, end = batches[setup["batch"]]["sequence"], batches[report["batch"]]["sequence"]
        source = [row for row in rows if start < row["sequence"] < end]
        assert not any(row["kind"] == "value-request" for row in source), "Navigation changed an owner value"
        native = batches[report["batch"]]["records"]
        assert not any(row["kind"] == "failure" for row in native)
        for frame in native:
            if frame["kind"] == "key": completed(frame)
        states = [row for row in rows if row["kind"] == "field-state" and row["sequence"] < start]
        latest = {row["field"]: row for row in states}
        assert {"outer", "inner"} <= set(latest)
        owners = {row["outerTarget"]: row for row in latest.values()}
        assert len(owners) == len(latest) and all(root > 0 for root in owners)
        outer = next(row for row in owners.values() if row["field"] == "outer")
        arrows = [row for row in native if row["kind"] == "key" and row["event"].get("key") == "ArrowRight"]
        steps, mask = (1, profile) if profile < 16 else (4, 0)
        assert len(arrows) == steps * 2, "Original arrow count differs"
        focuses = [row for row in native if row["kind"] == "focus"]
        assert len(focuses) == steps and not any(row["kind"] == "command-native" for row in native)
        expected_target = outer["buttonTarget"]
        for step in range(steps):
            down, up = arrows[step * 2:step * 2 + 2]
            down_packet, up_packet = packet(down["event"]["fieldDispatch"]), packet(up["event"]["fieldDispatch"])
            assert (down_packet["phase"], up_packet["phase"]) == ("down", "up"), "Original phases reordered"
            for frame in [down, up]:
                completed(frame)
                event = frame["event"]
                assert all(type(event[flag]) is bool and event[flag] == bool(mask & (1 << bit)) for bit, flag in enumerate(MODIFIERS)), "Original modifier profile differs"
                assert event["repeat"] is False and type(event["capsLock"]) is bool
                assert type(event["nativeCode"]) is int and event["nativeCode"] > 0
                assert isinstance(event["nativeModifierData"], str) and event["nativeModifierData"]
            assert down["event"]["capsLock"] == up["event"]["capsLock"]
            assert down["identity"]["target"] == expected_target == down["before"]["focusedTarget"], "Key used an obsolete native focus target"
            owner = owners[down["identity"]["outerTarget"]]
            assert owner["disabled"] is False and owner["readonly"] is False and owner["direction"] == "ltr"
            originals = [row for row in down["before"]["originals"] if row["eligible"]]
            current = next(i for i, row in enumerate(originals) if row["target"] == expected_target)
            assert current + 1 < len(originals), "Logical successor missing"
            successor = originals[current + 1]
            if step == 0: assert successor["tabStop"] is False, "Negative tab stop was skipped"
            matching = [row for row in focuses if row["token"] == down_packet["token"] and row["eventId"] == down_packet["eventId"]]
            assert len(matching) == 1
            focus = matching[0]
            assert focus["action"] == "next" and focus["groupTarget"] == down_packet["groups"][0]["scopeTarget"]
            assert all(focus[flag] is True for flag in ["requested", "observed", "current"])
            expected_target = successor["target"]
            assert focus["target"] == focus["after"]["focusedTarget"] == down["after"]["focusedTarget"] == up["identity"]["target"] == expected_target
            assert up["before"]["focusedTarget"] == up["after"]["focusedTarget"] == expected_target
            actual = [row for row in focus["after"]["instances"] if row["target"] == expected_target]
            assert len(actual) == 1 and all(up["identity"][name] == actual[0][name] for name in ["nativeInstance", "editorInstance"]), "Key up used a replaced original"
            assert down["decision"] == "prevented" and down["originalDefaultPrevented"] is True
            for frame, dispatch, groups in [(down, down_packet, down_packet["groups"][:1]), (up, up_packet, up_packet["groups"])]:
                callbacks = [row for row in source if row["kind"] == "field-key" and key(packet(row["data"]["fieldDispatch"])) == key(dispatch)]
                assert [row["receiverTarget"] for row in callbacks] == [group["target"] for group in groups]
                assert [row["field"] for row in callbacks] == [owners[group["scopeTarget"]]["field"] for group in groups]
        if steps == 4:
            assert arrows[-2]["identity"]["outerTarget"] != outer["outerTarget"], "Consecutive keys never reached the nested field"
        for root, before in owners.items():
            after = [row for row in rows if row["kind"] == "field-state" and row["outerTarget"] == root and row["sequence"] < end][-1]
            assert (after["value"], after["valueClass"]) == (before["value"], before["valueClass"])
    return {"keyProfileContracts": list(CASES), "nativeReceiptIntegrity": integrity["receiptIntegrity"], "unpacedHardwareBurst": False, "hardwareRepeat": False, "fullInputSurface": False, "fullFamily": False, "fullGoal": False}
