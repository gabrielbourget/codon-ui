"""Original callback/guard/layout/unmount lifetimes, without an adoption verdict."""
from inspect_field_receipts import inspect, packet, key

MUTATIONS = ("callback", "disabled", "readonly", "layout", "unmount")
RETIRED_ERRORS = {"", "field-input-original-mount-event-retired"}


def completed(frame):
    assert all(frame[name] is True for name in ["deliveryStarted", "deliveryReturned", "renderPhasesComplete", "scopeCurrent"])
    assert frame["error"] == "" and frame["decision"] in {"allowed", "prevented"}


def validate(rows, producer, checkpoints):
    integrity = inspect(rows, producer)
    reports = {row["case"]: row for row in checkpoints}
    assert len(reports) == len(checkpoints)
    cases = ["mutation-" + name + suffix for name in MUTATIONS for suffix in ["-setup", "", "-probe-setup", "-probe"]]
    assert set(cases) <= set(reports), "Incomplete mutation trial coverage"
    batches = {row["batch"]: row for row in rows if row["kind"] == "native-receipts"}
    assert len(batches) == sum(row["kind"] == "native-receipts" for row in rows)
    for mutation in MUTATIONS:
        name = "mutation-" + mutation
        setup, changed, probe_setup, probe = [reports[name + suffix] for suffix in ["-setup", "", "-probe-setup", "-probe"]]
        assert setup["batch"] < changed["batch"] < probe_setup["batch"] < probe["batch"]
        start, end = batches[setup["batch"]]["sequence"], batches[changed["batch"]]["sequence"]
        source = [row for row in rows if start < row["sequence"] < end]
        before = [row for row in rows if row["kind"] == "scene-state" and row["sequence"] < start][-1]
        after = [row for row in source if row["kind"] == "scene-state"][-1]
        assert before["mutation"] == after["mutation"] == mutation
        expected = {name: before[name] for name in ["mutation", "revision", "layoutRevision", "disabled", "readonly", "visible"]}
        if mutation == "callback": expected["revision"] += 1
        elif mutation == "layout": expected["layoutRevision"] += 1
        elif mutation == "unmount": expected["visible"] = False
        else: expected[mutation] = True
        assert all(after[name] == value and changed["scene"][name] == value for name, value in expected.items()), "Mutation was not committed to the original scene"
        assert not any(row["kind"] == "value-request" for row in source)
        native = batches[changed["batch"]]["records"]
        assert not any(row["kind"] in {"failure", "focus", "command-native", "command"} for row in native), "Mutation performed unexpected native work"
        frames = [row for row in native if row["kind"] == "key" and row["event"].get("key") == "m" and packet(row["event"]["fieldDispatch"])["phase"] == "down"]
        assert len(frames) == 1
        frame = frames[0]; dispatch = packet(frame["event"]["fieldDispatch"])
        assert frame["deliveryStarted"] is True
        assert frame["before"]["focusedTarget"] == frame["identity"]["target"], "Mutation used an obsolete native target"
        calls = [row for row in source if row["kind"] == "mutation-call"]
        returned = [row for row in source if row["kind"] == "mutation-return"]
        assert len(calls) == len(returned) == 1
        assert calls[0]["sequence"] < returned[0]["sequence"] < after["sequence"]
        for row in calls + returned:
            assert row["field"] == "outer" and row["mutation"] == mutation and row["revision"] == before["revision"]
            assert key(packet(row["data"]["fieldDispatch"])) == key(dispatch)
        callbacks = [row for row in source if row["kind"] == "field-key" and key(packet(row["data"]["fieldDispatch"])) == key(dispatch)]
        assert len(callbacks) == 1 and callbacks[0]["revision"] == before["revision"] and callbacks[0]["receiverTarget"] == dispatch["groups"][0]["target"]
        trace = [row["kind"] for row in source if row["kind"] in {"child-key", "field-key", "mutation-call", "mutation-return"} and key(packet(row["data"]["fieldDispatch"])) == key(dispatch)]
        assert trace == ["child-key", "field-key", "mutation-call", "mutation-return"], "Original mutation callback order differs"
        if mutation == "layout":
            completed(frame)
            assert frame["decision"] == "prevented" and frame["originalDefaultPrevented"] is True
            old = next(row for row in frame["before"]["originals"] if row["target"] == frame["identity"]["target"])
            new = next(row for row in frame["after"]["originals"] if row["target"] == frame["identity"]["target"])
            assert abs(new["rect"]["x"] - old["rect"]["x"] - 16) < 0.001, "New native layout was not observed"
            ups = [row for row in native if row["kind"] == "key" and row["event"].get("key") == "m" and packet(row["event"]["fieldDispatch"])["phase"] == "up"]
            assert len(ups) == 1
            completed(ups[0])
            for name in ["target", "bindingRevision", "nativeInstance", "editorInstance"]: assert ups[0]["identity"][name] == frame["identity"][name]
        else:
            assert frame["scopeCurrent"] is False and frame["decision"] == frame["wait"] == "retired" and frame["error"] in RETIRED_ERRORS
            assert frame["deliveryReturned"] is True and frame["renderPhasesComplete"] is True
            for later in native:
                if later["kind"] != "key" or packet(later["event"]["fieldDispatch"])["phase"] != "up": continue
                assert mutation != "unmount", "Unmounted field received key up"
                completed(later)
                assert later["identity"]["bindingRevision"] != frame["identity"]["bindingRevision"], "Retired binding received key up"
                up_packet = packet(later["event"]["fieldDispatch"])
                up_callbacks = [row for row in source if row["kind"] == "field-key" and key(packet(row["data"]["fieldDispatch"])) == key(up_packet)]
                assert len(up_callbacks) == 1 and up_callbacks[0]["revision"] == after["revision"], "Key up reached a stale callback"
        pstart, pend = batches[probe_setup["batch"]]["sequence"], batches[probe["batch"]]["sequence"]
        psource = [row for row in rows if pstart < row["sequence"] < pend]
        assert not any(row["kind"] in {"value-request", "mutation-call", "mutation-return"} for row in psource)
        pnative = batches[probe["batch"]]["records"]
        assert not any(row["kind"] in {"failure", "focus", "command-native", "command"} for row in pnative)
        fresh = [row for row in pnative if row["kind"] == "key" and row["event"].get("key") == "j"]
        assert len(fresh) == 2 and [packet(row["event"]["fieldDispatch"])["phase"] for row in fresh] == ["down", "up"]
        for row in fresh:
            completed(row)
            current = packet(row["event"]["fieldDispatch"])
            assert row["before"]["focusedTarget"] == row["after"]["focusedTarget"] == current["identity"]["target"]
            assert current["identity"]["windowId"] == dispatch["identity"]["windowId"]
            field_callbacks = [item for item in psource if item["kind"] == "field-key" and key(packet(item["data"]["fieldDispatch"])) == key(current)]
            assert len(field_callbacks) == 1 and field_callbacks[0]["revision"] == after["revision"]
            assert field_callbacks[0]["receiverTarget"] == current["groups"][0]["target"]
            assert [item["kind"] for item in psource if item["kind"] in {"child-key", "field-key"} and key(packet(item["data"]["fieldDispatch"])) == key(current)] == ["child-key", "field-key"]
            if mutation == "unmount":
                assert current["identity"]["outerTarget"] != dispatch["identity"]["outerTarget"] and current["identity"]["target"] != dispatch["identity"]["target"]
            else:
                for name in ["outerTarget", "inputTarget", "outerInstance", "inputInstance", "target", "nativeInstance", "editorInstance"]:
                    assert current["identity"][name] == dispatch["identity"][name], "Mutation replaced a retained original"
                if mutation != "layout": assert current["identity"]["bindingRevision"] != dispatch["identity"]["bindingRevision"]
        assert probe["scene"]["visible"] is True and probe["scene"]["disabled"] is False and probe["scene"]["readonly"] is False
        assert probe["scene"]["revision"] == after["revision"] and probe["scene"]["layoutRevision"] == after["layoutRevision"]
    return {"mutationContracts": list(MUTATIONS), "nativeReceiptIntegrity": integrity["receiptIntegrity"], "fullInputSurface": False, "fullFamily": False, "fullGoal": False}


def validate_busy(rows, producer, checkpoints):
    integrity = inspect(rows, producer)
    reports = {row["case"]: row for row in checkpoints}
    assert len(reports) == len(checkpoints)
    names = ["busy-original-setup", "busy-original-expiry", "busy-original-followup"]
    assert set(names) <= set(reports), "Incomplete original busy-JS trial"
    setup, expired, followup = [reports[name] for name in names]
    assert setup["batch"] < expired["batch"] < followup["batch"]
    assert 0 < expired["nativeActionElapsedSeconds"] < 5, "Native busy-JS action exceeded its bound"
    batches = {row["batch"]: row for row in rows if row["kind"] == "native-receipts"}
    start, end = batches[setup["batch"]]["sequence"], batches[expired["batch"]]["sequence"]
    source = [row for row in rows if start < row["sequence"] < end]
    assert len([row for row in source if row["kind"] == "busy-start"]) == 1
    finished = [row for row in source if row["kind"] == "busy-end"]
    assert len(finished) == 1 and finished[0]["elapsedMilliseconds"] >= 10000, "JS was not actually occupied"
    native = batches[expired["batch"]]["records"]
    frames = [row for row in native if row["kind"] == "key" and row["event"].get("key") == "q"]
    assert [packet(row["event"]["fieldDispatch"])["phase"] for row in frames] == ["down", "up"]
    for frame in frames:
        assert frame["decision"] == frame["wait"] == "timed-out" and frame["error"] == ""
        assert all(frame[flag] is False for flag in ["deliveryStarted", "deliveryReturned", "renderPhasesComplete", "originalDefaultPrevented"])
    assert not any(row["kind"] in {"failure", "focus", "command-native"} for row in native)
    assert not any(row["kind"] in {"field-key", "child-key", "segment-key"} and row.get("data", {}).get("key") == "q" for row in rows), "Expired original key was delivered later"
    recovery = [row for row in batches[followup["batch"]]["records"] if row["kind"] == "key" and row["event"].get("key") == "j"]
    assert [packet(row["event"]["fieldDispatch"])["phase"] for row in recovery] == ["down", "up"]
    for frame in recovery:
        completed(frame)
        assert frame["decision"] == "allowed"
    assert recovery[0]["identity"]["target"] == frames[0]["identity"]["target"], "Busy recovery replaced the original focus target"
    return {"busyJSContract": True, "nativeReceiptIntegrity": integrity["receiptIntegrity"], "fullInputSurface": False, "fullFamily": False, "fullGoal": False}
