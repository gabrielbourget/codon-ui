"""Original touch/placeholder checkpoint; the complete adoption gate remains open."""
from inspect_field_receipts import inspect, packet, key

CASES = ("placeholder-touch-release", "placeholder-scroll-cancel")
SETUPS = ("placeholder-touch-setup", "placeholder-scroll-setup")


def placeholder_target(frame):
    snapshot = frame["before"]
    order = [row["target"] for row in snapshot["instances"]]
    hit = frame["identity"]["target"]
    assert order.count(hit) == 1, "Original hit missing or ambiguous"
    originals = [row for row in snapshot["originals"] if row["eligible"] and row["tabStop"]]
    assert len(originals) >= 2, "Placeholder run missing"
    assert len({row["target"] for row in originals}) == len(originals)
    positions = [order.index(row["target"]) for row in originals]
    assert positions == sorted(positions), "Original focus order differs from retained native order"
    preceding = [index for index, position in enumerate(positions) if position < order.index(hit)]
    assert preceding, "Placeholder test hit does not follow an original segment"
    last = preceding[-1]
    first = last
    while first > 0 and originals[first]["placeholder"] and originals[first - 1]["placeholder"]:
        first -= 1
    assert first < last and all(row["placeholder"] for row in originals[first:last + 1]), "Hit does not follow a contiguous placeholder run"
    return originals[first]["target"]


def validate(rows, producer, checkpoints):
    integrity = inspect(rows, producer)
    reports = {row["case"]: row for row in checkpoints}
    assert len(reports) == len(checkpoints) and set(CASES + SETUPS) <= set(reports), "Incomplete pointer checkpoint coverage"
    batches = {row["batch"]: row for row in rows if row["kind"] == "native-receipts"}
    assert len(batches) == sum(row["kind"] == "native-receipts" for row in rows)
    for setup_name, name in zip(SETUPS, CASES):
        setup, report = reports[setup_name], reports[name]
        assert setup["batch"] < report["batch"]
        start, end = batches[setup["batch"]]["sequence"], batches[report["batch"]]["sequence"]
        source = [row for row in rows if start < row["sequence"] < end]
        assert not any(row["kind"] == "value-request" for row in source), "Pointer action changed the time owner"
        states = [row for row in rows if row["kind"] == "field-state" and row["field"] == "outer" and row["sequence"] < end]
        assert states and states[-1]["value"] is None and states[-1]["valueClass"] is None
        assert all(states[-1][guard] is False for guard in ["disabled", "readonly", "veto"])
        native = batches[report["batch"]]["records"]
        assert not any(row["kind"] == "failure" for row in native)
        frames = [row for row in native if row["kind"] == "pointer"]
        assert frames, "Original pointer frames missing"
        phases = []
        pointer_ids = set()
        hit_targets = set()
        for frame in frames:
            dispatch = packet(frame["event"]["fieldDispatch"])
            phases.append(dispatch["phase"])
            assert all(frame[flag] is True for flag in ["deliveryStarted", "deliveryReturned", "renderPhasesComplete", "scopeCurrent"])
            assert frame["error"] == "" and frame["decision"] in {"allowed", "prevented"}
            witnesses = [row for row in native if row["kind"] == "original-pointer" and (row["token"], row["eventId"]) == (dispatch["token"], dispatch["eventId"])]
            assert len(witnesses) == 1
            payload = witnesses[0]["payload"]
            assert payload["pointerType"] == "touch" and payload["isPrimary"] is True
            pointer_ids.add(payload["pointerId"])
            hit_targets.add(dispatch["identity"]["target"])
            callbacks = [row for row in source if row["kind"] in {"group-pointer", "field-pointer"} and row["data"].get("fieldDispatch") and key(packet(row["data"]["fieldDispatch"])) == key(dispatch)]
            assert callbacks and callbacks[0]["kind"] == "group-pointer", "Original group pointer callback missing"
        assert len(pointer_ids) == 1, "Pointer contact changed during the gesture"
        focuses = [row for row in native if row["kind"] == "focus"]
        assert phases[0] == "pointer-start"
        if name == CASES[0]:
            assert phases == ["pointer-start", "pointer-end", "pointer-click"], "Touch press did not complete exactly once"
            assert len(hit_targets) == 1
            expected = placeholder_target(frames[-1])
            click = packet(frames[-1]["event"]["fieldDispatch"])
            assert len(focuses) == 1, "Touch focus occurred before release or repeated"
            focus = focuses[0]
            assert (focus["token"], focus["eventId"]) == (click["token"], click["eventId"])
            assert focus["action"] == "press" and focus["groupTarget"] == click["identity"]["outerTarget"]
            assert focus["target"] == expected and focus["after"]["focusedTarget"] == expected
            assert all(focus[flag] is True for flag in ["requested", "observed", "current"])
        else:
            assert "pointer-click" not in phases and phases[-1] in {"pointer-end", "pointer-cancel"}, "Scroll generated a group click or lacked termination"
            assert not focuses, "Cancelled scroll performed group press focus"
    return {"pointerCheckpointContracts": list(CASES), "nativeReceiptIntegrity": integrity["receiptIntegrity"], "fullInputSurface": False, "fullFamily": False, "fullGoal": False}
