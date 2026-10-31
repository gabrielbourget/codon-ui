"""Drive real SDK input and independent held-editor inspections in one native cohort."""
import shlex
import time

RECEIVER = "dev.codonui.showcase/com.codonui.input.CardEditorInspectionProvider$Receiver"


def advance(device, records, sdk, state):
    failures = [row for row in [*records, *sdk] if row["kind"] in ["failure", "native-editor-failure"]]
    assert not failures, failures
    actions = state.setdefault("editorControls", [])
    ready = [row for row in records if row["kind"] == "phase-ready"]
    if not ready: return
    current = ready[-1]
    phase = current["phase"]
    tags = [value["tag"] for value in current["fields"]]
    assert len(tags) == 2 and all(type(tag) is int and tag > 0 for tag in tags)

    def inspect(mode, request):
        device("sdk-" + request, ["shell", "am", "broadcast", "-n", shlex.quote(RECEIVER), "--es", "phase", phase, "--es", "mode", mode, "--es", "request", request, "--eia", "targets", ",".join(map(str, tags))])
        actions.append(request)

    def native_response(request):
        values = [row for row in sdk if row.get("request") == request]
        assert len(values) <= 1
        return values[0] if values else None

    def tap_into(field, location):
        editor = location["editors"][field]
        assert editor["tag"] == tags[field]
        x, y, width, height = editor["screenPixels"]
        assert width > 0 and height > 0
        assert editor["shown"] and editor["enabled"] and editor["focusable"]
        center_x, center_y = x + width / 2, y + height / 2
        for parent in editor["parents"]:
            left, top, parent_width, parent_height = parent["screenPixels"]
            assert left <= center_x < left + parent_width and top <= center_y < top + parent_height, ("Editor input point outside native ancestor", field, parent)
        device(f"input-tap-{field}", ["shell", "input", "tap", str(round(center_x)), str(round(center_y))])
        state["externalTestInputActions"] += 1

    latest = {}
    for row in records:
        if row["kind"] == "change-text": latest[row["field"]] = row["value"]

    def observed(label, field, ready):
        waits = state.setdefault("editorInputWaits", {})
        wait = waits.setdefault(label, {"started": time.monotonic(), "attempt": 0})
        assert time.monotonic() - wait["started"] < 45, ("Native editor input acknowledgment did not arrive", label)
        request = label + "-" + str(wait["attempt"])
        if request not in actions: inspect("locate", request); return None
        response = native_response(request)
        if response is None: return None
        assert [row["nativeRef"] for row in response["editors"]] == state["editorOriginalRefs"], "Original input editors replaced"
        editor = response["editors"][field]
        assert editor["tag"] == tags[field]
        if ready(editor): return response
        wait["attempt"] += 1
        inspect("locate", label + "-" + str(wait["attempt"]))
        return None

    def focused(editor):
        return editor["focused"] and editor["windowFocused"] and editor["imeVisible"]

    def text_input(field, text):
        device(f"input-text-{field}", ["shell", "input", "text", text])
        state["externalTestInputActions"] += 1

    if phase == "initial" and "typed-initial" not in actions:
        if "locate-empty" not in actions: inspect("locate", "locate-empty"); return
        empty_location = native_response("locate-empty")
        if empty_location is None: return
        state.setdefault("editorOriginalRefs", [row["nativeRef"] for row in empty_location["editors"]])
        if "tap-empty" not in actions:
            tap_into(0, empty_location); actions.append("tap-empty"); return
        if "typed-empty" not in actions:
            if observed("focus-empty", 0, focused) is None: return
            text_input(0, "x"); actions.append("typed-empty"); return
        if "deleted-empty" not in actions:
            if observed("typed-empty", 0, lambda editor: focused(editor) and editor["text"] == "x" and latest.get(0) == "x") is None: return
            device("input-empty-delete", ["shell", "input", "keyevent", "KEYCODE_DEL"])
            state["externalTestInputActions"] += 1
            actions.append("deleted-empty"); return
        if observed("cleared-empty", 0, lambda editor: focused(editor) and editor["text"] == "" and latest.get(0) == "") is None: return
        if "locate-dirty" not in actions: inspect("locate", "locate-dirty"); return
        dirty_location = native_response("locate-dirty")
        if dirty_location is None: return
        if "tap-dirty" not in actions:
            tap_into(1, dirty_location); actions.append("tap-dirty"); return
        if "typed-dirty" not in actions:
            if observed("focus-dirty", 1, focused) is None: return
            text_input(1, "native_input"); actions.append("typed-dirty"); return
        if observed("typed-dirty", 1, lambda editor: focused(editor) and "native_input" in editor["text"] and "native_input" in latest.get(1, "")) is None: return
        actions.append("typed-initial")
        state["editorInputCompletedMonotonic"] = time.monotonic()
        return
    if phase == "initial":
        elapsed = time.monotonic() - state["editorInputCompletedMonotonic"]
        assert elapsed < 25 or latest.get(0) == "" and "native_input" in latest.get(1, ""), "Original native editor input callbacks did not arrive"
        if elapsed < 1 or latest.get(0) != "" or "native_input" not in latest.get(1, ""): return
    before = "before-" + phase
    if before not in actions: inspect("before", before); return
    complete = any(row["kind"] == "queries-complete" and row["phase"] == phase for row in records)
    after = "after-" + phase
    if complete and after not in actions: inspect("after", after)
