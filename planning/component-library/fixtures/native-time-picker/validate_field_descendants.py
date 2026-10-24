"""Combined descendant contracts. This is not the complete adoption gate."""
from inspect_field_receipts import inspect, packet, key as dispatch_key

CASES = (
    "authored-child-stops-group",
    "authored-child-before-group-navigation",
    "negative-tab-to-original-core",
    "original-core-editor-default",
    "group-veto-before-core-editor-default",
)
SETUPS = (
    "authored-child-stop-setup",
    "authored-child-navigation-setup",
    "negative-tab-navigation-setup",
    "core-editor-default-setup",
    "core-editor-veto-setup",
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
        native = batches[report["batch"]]["records"]
        assert not any(row["kind"] == "failure" for row in native), "Native descendant failure"
        assert not any(row["kind"] == "value-request" for row in source), "Descendant action changed the time owner"
        expected_key = "ArrowRight" if index < 3 else "7" if index == 3 else "9"
        keys = [row for row in native if row["kind"] == "key" and row["event"].get("key") == expected_key and packet(row["event"]["fieldDispatch"])["phase"] == "down"]
        assert len(keys) == 1, "Missing or repeated original descendant key"
        frame = keys[0]
        assert all(frame[name] is True for name in ["deliveryStarted", "deliveryReturned", "renderPhasesComplete", "scopeCurrent"])
        assert frame["error"] == "" and frame["decision"] in {"allowed", "prevented"}, "Original descendant turn failed"
        dispatch = packet(frame["event"]["fieldDispatch"])
        callbacks = [row for row in source if row["kind"] in {"child-key", "field-key"} and dispatch_key(packet(row["data"]["fieldDispatch"])) == dispatch_key(dispatch)]
        states = [row for row in rows if row["kind"] == "field-state" and row["field"] == "outer" and row["sequence"] < keys_source_sequence(source, dispatch)]
        assert states, "Missing actual owner guard state"
        state = states[-1]
        assert state["disabled"] is False and state["readonly"] is False
        if index == 0:
            assert state["stop"] is True
            assert [row["kind"] for row in callbacks] == ["child-key"], "Stopped child reached group callbacks"
            assert not any(row["kind"] == "focus" for row in native), "Stopped group performed focus work"
        elif index in {1, 2}:
            assert state["stop"] is False and state["direction"] == "ltr"
            expected_callbacks = (["child-key"] if index == 1 else []) + ["field-key"] * len(dispatch["groups"])
            assert [row["kind"] for row in callbacks] == expected_callbacks, "Original child/group order differs"
            focuses = [row for row in native if row["kind"] == "focus"]
            assert focuses and all(row["requested"] and row["observed"] and row["current"] and row["after"]["focusedTarget"] == row["target"] for row in focuses), "Group navigation lacks actual focus observation"
            originals = [row for row in frame["before"]["originals"] if row["eligible"]]
            current = next(i for i, row in enumerate(originals) if row["target"] == dispatch["identity"]["target"])
            assert current + 1 < len(originals), "Original logical successor missing"
            assert focuses[-1]["target"] == originals[current + 1]["target"], "Navigation skipped the original logical successor"
            next_case = CASES[2] if index == 1 else CASES[3]
            core_batch = batches[reports[next_case]["batch"]]
            core_keys = [row for row in core_batch["records"] if row["kind"] == "key" and row["event"].get("key") == "7" and packet(row["event"]["fieldDispatch"])["phase"] == "down"]
            if index == 1:
                core_keys = [row for row in core_batch["records"] if row["kind"] == "key" and row["event"].get("key") == "ArrowRight" and packet(row["event"]["fieldDispatch"])["phase"] == "down"]
                assert originals[current + 1]["tabStop"] is False, "Negative-tab original missing from logical order"
            assert len(core_keys) == 1 and focuses[-1]["target"] == core_keys[0]["identity"]["target"], "Navigation did not reach the next original key receiver"
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
