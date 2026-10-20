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

    def type_into(field, location, text, clear=False):
        editor = location["editors"][field]
        assert editor["tag"] == tags[field]
        x, y, width, height = editor["screenPixels"]
        assert width > 0 and height > 0
        device(f"input-tap-{field}", ["shell", "input", "tap", str(round(x + width / 2)), str(round(y + height / 2))])
        time.sleep(0.4)
        device(f"input-text-{field}", ["shell", "input", "text", text])
        if clear: device("input-empty-delete", ["shell", "input", "keyevent", "KEYCODE_DEL"])
        state["externalTestInputActions"] += 3 if clear else 2

    if phase == "initial" and "typed-initial" not in actions:
        if "locate-empty" not in actions: inspect("locate", "locate-empty"); return
        empty_location = native_response("locate-empty")
        if empty_location is None: return
        if "typed-empty" not in actions:
            type_into(0, empty_location, "x", True); actions.append("typed-empty"); return
        if "locate-dirty" not in actions: inspect("locate", "locate-dirty"); return
        dirty_location = native_response("locate-dirty")
        if dirty_location is None: return
        type_into(1, dirty_location, "native_input")
        actions.append("typed-initial")
        state["editorInputCompletedMonotonic"] = time.monotonic()
        return
    if phase == "initial":
        elapsed = time.monotonic() - state["editorInputCompletedMonotonic"]
        latest = {}
        for row in records:
            if row["kind"] == "change-text": latest[row["field"]] = row["value"]
        assert elapsed < 25 or latest.get(0) == "" and "native_input" in latest.get(1, ""), "Original native editor input callbacks did not arrive"
        if elapsed < 1 or latest.get(0) != "" or "native_input" not in latest.get(1, ""): return
    before = "before-" + phase
    if before not in actions: inspect("before", before); return
    complete = any(row["kind"] == "queries-complete" and row["phase"] == phase for row in records)
    after = "after-" + phase
    if complete and after not in actions: inspect("after", after)
