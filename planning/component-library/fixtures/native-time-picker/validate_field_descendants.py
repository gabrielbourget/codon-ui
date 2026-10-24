"""Combined descendant contracts. This is not the complete adoption gate."""
from inspect_field_receipts import inspect, packet, key as dispatch_key

CASES = (
    "authored-child-stops-group",
    "authored-child-before-group-navigation",
    "negative-tab-to-original-core",
    "original-core-editor-default",
    "group-veto-before-core-editor-default",
    "outer-core-to-nested-hour",
    "nested-hour-to-minute",
    "nested-owner-veto",
)
SETUPS = (
    "authored-child-stop-setup",
    "authored-child-navigation-setup",
    "negative-tab-navigation-setup",
    "core-editor-default-setup",
    "core-editor-veto-setup",
    "outer-to-nested-setup",
    "nested-navigation-setup",
    "nested-owner-veto-setup",
)


def validate(rows, producer, checkpoints):
    integrity = inspect(rows, producer)
    reports = {row["case"]: row for row in checkpoints}
    assert len(reports) == len(checkpoints), "Duplicate native trial checkpoint"
    assert set(CASES + SETUPS) <= set(reports), "Incomplete descendant trial coverage"
    batches = {row["batch"]: row for row in rows if row["kind"] == "native-receipts"}
    assert len(batches) == sum(row["kind"] == "native-receipts" for row in rows), "Duplicate receipt batch"
    matched = []
    for index, name in enumerate(CASES):
        setup, report = reports[SETUPS[index]], reports[name]
        assert setup["batch"] < report["batch"] and report["batch"] in batches, "Native trial/batch mismatch"
        start, end = batches[setup["batch"]]["sequence"], batches[report["batch"]]["sequence"]
        source = [row for row in rows if start < row["sequence"] < end]
        field_names = {row["outerTarget"]: row["field"] for row in rows if row["kind"] == "field-state" and row["sequence"] < end}
        native = batches[report["batch"]]["records"]
        assert not any(row["kind"] == "failure" for row in native), "Native descendant failure"
        requests = [row for row in source if row["kind"] == "value-request"]
        if index != 7: assert not requests, "Descendant action changed the time owner"
        expected_key = "ArrowRight" if index in {0, 1, 2, 5, 6} else "7" if index == 3 else "9" if index == 4 else "ArrowUp"
        keys = [row for row in native if row["kind"] == "key" and row["event"].get("key") == expected_key and packet(row["event"]["fieldDispatch"])["phase"] == "down"]
        assert len(keys) == 1, "Missing or repeated original descendant key"
        frame = keys[0]
        assert all(frame[name] is True for name in ["deliveryStarted", "deliveryReturned", "renderPhasesComplete", "scopeCurrent"])
        assert frame["error"] == "" and frame["decision"] in {"allowed", "prevented"}, "Original descendant turn failed"
        dispatch = packet(frame["event"]["fieldDispatch"])
        callbacks = [row for row in source if row["kind"] in {"child-key", "field-key"} and dispatch_key(packet(row["data"]["fieldDispatch"])) == dispatch_key(dispatch)]
        owner = "inner" if index >= 6 else "outer"
        states = [row for row in rows if row["kind"] == "field-state" and row["field"] == owner and row["sequence"] < keys_source_sequence(source, dispatch)]
        assert states, "Missing actual owner guard state"
        state = states[-1]
        assert state["disabled"] is False and state["readonly"] is False
        if index == 0:
            assert state["stop"] is True
            assert [row["kind"] for row in callbacks] == ["child-key"], "Stopped child reached group callbacks"
            assert not any(row["kind"] == "focus" for row in native), "Stopped group performed focus work"
        elif index in {1, 2, 5, 6}:
            assert state["stop"] is False and state["direction"] == "ltr"
            assert frame["decision"] == "prevented" and frame["originalDefaultPrevented"] is True
            expected_callbacks = (["child-key"] if index == 1 else []) + ["field-key"]
            assert [row["kind"] for row in callbacks] == expected_callbacks, "Original child/group order differs"
            assert callbacks[-1]["receiverTarget"] == dispatch["groups"][0]["target"]
            assert callbacks[-1]["field"] == owner, "Navigation reached another field's caller"
            focuses = [row for row in native if row["kind"] == "focus"]
            assert len(focuses) == 1 and all(row["requested"] and row["observed"] and row["current"] and row["after"]["focusedTarget"] == row["target"] for row in focuses), "Group navigation lacks one actual focus observation"
            assert (focuses[0]["token"], focuses[0]["eventId"]) == (dispatch["token"], dispatch["eventId"])
            assert focuses[0]["action"] == "next" and focuses[0]["groupTarget"] == dispatch["groups"][0]["scopeTarget"]
            originals = [row for row in frame["before"]["originals"] if row["eligible"]]
            current = next(i for i, row in enumerate(originals) if row["target"] == dispatch["identity"]["target"])
            assert current + 1 < len(originals), "Original logical successor missing"
            assert focuses[-1]["target"] == originals[current + 1]["target"], "Navigation skipped the original logical successor"
            next_case = CASES[index + 1]
            core_batch = batches[reports[next_case]["batch"]]
            next_key = "ArrowRight" if index in {1, 5} else "7" if index == 2 else "ArrowUp"
            core_keys = [row for row in core_batch["records"] if row["kind"] == "key" and row["event"].get("key") == next_key and packet(row["event"]["fieldDispatch"])["phase"] == "down"]
            if index == 1:
                assert originals[current + 1]["tabStop"] is False, "Negative-tab original missing from logical order"
            assert len(core_keys) == 1 and focuses[-1]["target"] == core_keys[0]["identity"]["target"], "Navigation did not reach the next original key receiver"
            ups = [row for row in native if row["kind"] == "key" and row["event"].get("key") == expected_key and packet(row["event"]["fieldDispatch"])["phase"] == "up"]
            assert len(ups) == 1 and ups[0]["identity"]["target"] == focuses[0]["target"], "Key up did not reach the newly focused original"
            assert all(ups[0][flag] is True for flag in ["deliveryStarted", "deliveryReturned", "renderPhasesComplete", "scopeCurrent"])
            assert ups[0]["error"] == "" and ups[0]["decision"] in {"allowed", "prevented"}
            up_dispatch = packet(ups[0]["event"]["fieldDispatch"])
            up_callbacks = [row for row in source if row["kind"] == "field-key" and dispatch_key(packet(row["data"]["fieldDispatch"])) == dispatch_key(up_dispatch)]
            assert [row["receiverTarget"] for row in up_callbacks] == [group["target"] for group in up_dispatch["groups"]], "New target's original key-up group path differs"
            assert [row["field"] for row in up_callbacks] == [field_names[group["scopeTarget"]] for group in up_dispatch["groups"]], "Key up reached a different field owner"
            if index == 6:
                assert len(dispatch["groups"]) > 1 and dispatch["groups"][0]["scopeTarget"] == dispatch["identity"]["outerTarget"]
                assert focuses[-1]["groupTarget"] == dispatch["identity"]["outerTarget"], "Nested navigation used its ancestor scope"
        elif index == 7:
            assert state["echo"] is False and state["value"] == "08:15:00" and state["valueClass"] == "Time"
            assert len(requests) == 1, "Nested edit request missing or repeated"
            request = requests[0]
            assert all(request[name] == value for name, value in {"field":"inner", "held":"08:15:00", "heldClass":"Time", "value":"08:16:00", "valueClass":"Time", "echo":False}.items()), "Nested owner request differs"
            assert [row["receiverTarget"] for row in callbacks] == [group["target"] for group in dispatch["groups"]]
            assert [row["field"] for row in callbacks] == [field_names[group["scopeTarget"]] for group in dispatch["groups"]], "Nested edit lost the actual ancestor path"
            assert callbacks[0]["field"] == "inner" and callbacks[-1]["field"] == "outer"
            segments = [row for row in source if row["kind"] == "segment-key" and dispatch_key(packet(row["data"]["fieldDispatch"])) == dispatch_key(dispatch)]
            assert len(segments) == 1 and segments[0]["field"] == "inner"
            assert segments[0]["sequence"] < request["sequence"] < callbacks[0]["sequence"], "Nested value/segment/group ordering differs"
            outer_states = [row for row in rows if row["kind"] == "field-state" and row["field"] == "outer" and row["sequence"] < end]
            assert outer_states[-1]["value"] is None and outer_states[-1]["valueClass"] is None, "Nested edit changed the outer owner"
            assert frame["originalDefaultPrevented"] is True
        else:
            assert state["veto"] is (index == 4)
            assert report["nativeValues"]["outer-core-editor"] == "7", "Original native editor value differs"
            changes = [row for row in source if row["kind"] == "core-change" and row["field"] == "outer"]
            raw_changes = [row for row in source if row["kind"] == "core-native-change" and row["field"] == "outer"]
            if index == 3:
                assert [row["text"] for row in changes] == ["7"], "Original core edit callback missing or repeated"
                assert len(raw_changes) == 1 and raw_changes[0]["data"]["text"] == "7", "Original native change payload differs"
                assert raw_changes[0]["data"]["target"] == frame["identity"]["target"], "Another editor supplied the change callback"
                assert frame["originalDefaultPrevented"] is False
            else:
                assert not changes and not raw_changes, "Vetoed native editor changed"
                assert frame["originalDefaultPrevented"] is True and frame["decision"] == "prevented", "Core default was not vetoed"
        matched.append(name)
    return {"descendantCheckpointContracts": matched, "nativeReceiptIntegrity": integrity["receiptIntegrity"], "fullInputSurface": False, "fullFamily": False, "fullGoal": False}


def keys_source_sequence(source, dispatch):
    rows = [row["sequence"] for row in source if row["kind"] in {"child-key", "field-key"} and dispatch_key(packet(row["data"]["fieldDispatch"])) == dispatch_key(dispatch)]
    assert rows, "Original key has no source receiver"
    return min(rows)
