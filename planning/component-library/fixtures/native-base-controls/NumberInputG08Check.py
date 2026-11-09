"""NumberInput's selected native observations. No SDK or lifecycle entry point."""
import hashlib
import json
import math
from pathlib import Path
import re
import struct

from NativeCellVerification import require
from NativeXCTestBatch import reconcile_selected_results

ACTIONS = ["empty", "first-draft", "same-draft", "committed", "invalid-seed", "invalid-restored", "veto-edit", "veto-step-one", "veto-step-two", "default-zero", "default-cleared", "default-prop-updated", "empty-seeded", "bound-baseline", "bound-upper", "bound-lower", "french-baseline", "french-committed", "selection-seed", "selection-edited", "guard-takeover", "disabled", "readonly", "restored-edit", "restored", "retired", "retired-quiet", "fresh"]
STYLES = ["baseline", "error", "warning", "success", "custom", "final", "long-narrow", "long-narrow-keyboard", "long-narrow-first-action", "dark", "light-restored"]
LIFETIME = [mode + "-" + phase for mode in ["normal", "reduced"] for phase in ["first", "second", "interrupted", "retired", "retired-quiet", "fresh"]]


def physical(frame, scale):
    require(type(scale) in [int, float] and math.isfinite(scale) and scale > 0 and len(frame) == 4 and all(type(value) in [int, float] and math.isfinite(value) for value in frame), "Invalid Number physical rectangle")
    return [math.floor(value * scale + .5) for value in frame]


def contains(child, parent):
    x, y, width, height = child
    left, top, outer_width, outer_height = parent
    return width > 0 and height > 0 and left <= x < x + width <= left + outer_width and top <= y < y + height <= top + outer_height


def rgba(value):
    require(type(value) is int, "Missing Number native color")
    value &= 0xffffffff
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255, value >> 24]


def validate_rows(rows, names):
    require(sorted(row["name"] for row in rows) == sorted(names), "Missing or duplicate Number observations")
    for row in rows:
        state, scale = row["state"], row["scale"]
        window, parent = row["window"], row["parent"]
        require(physical([0, 0, window[2], window[3]], scale)[2:] == [row["imageWidth"], row["imageHeight"]], "Number window/image orientation differs")
        require(contains(physical([parent[0] - window[0], parent[1] - window[1], *parent[2:]], scale), [0, 0, row["imageWidth"], row["imageHeight"]]), "Number parent crop outside image")
        if not state["visible"]:
            require(not row["root"] and not row["editor"] and not row["targets"] and row["inkPixels"] == 0 and state["inputTag"] is None and state["rootTag"] is None, "Retired Number targets/ref/paint remains")
            continue
        require(state["inputTag"] > 0 and state["rootTag"] > 0 and state["inputTag"] != state["rootTag"], "Number original editor and root tags conflated")
        layout = state["rootLayout"]
        require(layout and layout["generation"] == state["generation"] and layout["target"] == layout["currentTarget"] == state["rootTag"], "Number root layout is stale or wrong target")
        actual = layout["layout"]
        outer = [parent[0] + actual["x"], parent[1] + actual["y"], actual["width"], actual["height"]]
        require(physical(outer, scale) == physical(row["root"], scale) and physical(outer, scale)[2] == physical([0, 0, state["width"], 1], scale)[2], "Number original native root frame differs")
        if state["expectedHeight"] is not None:
            require(physical(outer, scale)[3] == physical([0, 0, 1, state["expectedHeight"]], scale)[3], "Number authored root height differs")
        require(contains(physical(outer, scale), physical(parent, scale)), "Number original root outside isolated parent")
        targets = {target["id"]: target for target in row["targets"]}
        require(len(row["targets"]) == len(targets) == 3 and set(targets) == {"number-native-control-input", "number-native-control-increment", "number-native-control-decrement"}, "Wrong Number native target inventory")
        field = targets["number-native-control-input"]
        require(row["editorIsTextField"] is True and field["isTextField"] is True and field["label"] == "Public Number editor" and field["enabled"] is not (state["disabled"] or state["readOnly"]), "Number actual single-line editor binding/editability differs")
        for direction, label, feasible in [("increment", "Increase Number", "canIncrement"), ("decrement", "Decrease Number", "canDecrement")]:
            target = targets["number-native-control-" + direction]
            require(target["isButton"] is True and target["label"] == label and target["enabled"] is bool(not state["disabled"] and state["rendered"][feasible]), "Number named Button role/guard/feasibility differs")
        for target in targets.values():
            require(contains(physical(target["frame"], scale), physical(outer, scale)), "Number original target outside root")
            if row["keyboard"]:
                x, y, width, height = physical(target["frame"], scale)
                kx, ky, kw, kh = physical(row["keyboard"], scale)
                require(not (x < kx + kw and x + width > kx and y < ky + kh and y + height > ky), "Number original target covered by keyboard")
        expected_text = state["rendered"]["inputValue"]
        require(row["editorValue"] == expected_text or expected_text == "" and row["editorValue"] == "Empty number", "Number native text differs from current draft/display")
        require(state["intl"]["supported"] == ["en-US", "fr-CA"] and state["intl"]["english"] == "7.5" and state["intl"]["french"] == "7,5" and state["intl"]["preparation"] in ["existing", "polyfilled"], "Number actual Intl capability differs")
        refs = {ref["generation"]: ref["input"] for ref in state["refs"] if ref["input"] is not None}
        for event in state["events"]:
            expected = refs.get(event["generation"])
            require(expected is not None and event["target"] == event["currentTarget"] == expected and event["nativeEvent"].get("target", expected) == expected, "Number original native event/ref target differs")
        require(all(not request["stale"] for request in state["requests"] + state["rawChanges"]), "Number stale numeric/raw callback recipient")
        if row["referenceRequested"]:
            require(physical(row["root"], scale) == physical(row["referenceRoot"], scale), "Number independent native root reference frame differs")
            paint = row["paint"]
            require(paint == row["referencePaint"] and len(paint["topBand"]) == 28 and all(type(value) is int and 0 <= value <= 255 for value in paint["topBand"]), "Number native border band/reference differs")
            require(paint["borderRGBA"] == rgba(state["expectedBorderNativeColor"]) and paint["backgroundRGBA"] == rgba(state["expectedBackgroundNativeColor"]), "Number native exact root paint differs")
    return {"status": "PASS", "observations": len(rows)}


def fresh_selection(row, marker_name, start, end):
    marker, state = row[marker_name], row["state"]
    require(type(marker) is int and 0 <= marker < len(state["events"]), "Missing Number fresh selection marker")
    return any(event["phase"] == "selection" and event["generation"] == state["generation"] and event["target"] == event["currentTarget"] == state["inputTag"] and event["nativeEvent"].get("target") == state["inputTag"] and event["nativeEvent"].get("selection") == {"start": start, "end": end} for event in state["events"][marker:])


def public_selection(row, marker_name, start, end):
    marker, state = row[marker_name], row["state"]
    require(type(marker) is int and 0 < marker <= len(state["events"]), "Missing Number original focus boundary")
    request = state["selection"]
    require(request == {"start": start, "end": end, "generation": state["generation"], "inputTag": state["inputTag"]} and state["rendered"]["isFocused"] is True, "Number original public selection request differs")
    events = state["events"][:marker]
    focuses = [index for index, event in enumerate(events) if event["phase"] == "focus" and event["generation"] == state["generation"] and event["target"] == event["currentTarget"] == state["inputTag"] and event["nativeEvent"].get("target") == state["inputTag"]]
    last_blur = max([index for index, event in enumerate(events) if event["phase"] == "blur" and event["generation"] == state["generation"] and event["target"] == event["currentTarget"] == state["inputTag"] and event["nativeEvent"].get("target") == state["inputTag"]], default=-1)
    return bool(focuses) and max(focuses) > last_blur


def reconcile(raw, modes):
    rows = [json.loads(value) for value in re.findall(r"NUMBER_NATIVE_OBSERVATION (\{[^\n]+\})", raw)]
    require(set(row["state"]["mode"] for row in rows) == set(modes), "Missing or foreign Number method ownership")
    results = {}
    for mode in modes:
        selected = [row for row in rows if row["state"]["mode"] == mode]
        names = {"actions": ACTIONS, "styles": STYLES, "lifetime": LIFETIME}[mode]
        results[mode] = validate_rows(selected, names)
        named = {row["name"]: row for row in selected}
        if mode == "actions":
            expected = {"empty": "", "first-draft": "001.25", "same-draft": "001.25", "committed": "1.25", "invalid-seed": "5", "invalid-restored": "5", "veto-edit": "5", "veto-step-one": "5", "veto-step-two": "5", "default-zero": "0", "default-cleared": "", "default-prop-updated": "", "empty-seeded": "0", "bound-baseline": "0.75", "bound-upper": "1", "bound-lower": "0.75", "french-baseline": "12,5", "french-committed": "7,5", "selection-seed": "001.25", "selection-edited": "7.25", "guard-takeover": "5", "disabled": "5", "readonly": "5", "restored-edit": "6", "restored": "7", "fresh": "2"}
            for name, value in expected.items():
                require(named[name]["state"]["rendered"]["inputValue"] == value, "Number selected raw/formatted outcome differs: " + name)
            require(named["first-draft"]["keyboard"] and named["same-draft"]["state"]["tick"] == 1 and named["same-draft"]["state"]["rendered"]["isFocused"] is True and named["same-draft"]["state"]["ownerValue"] is None, "Number unpaced draft/same-owner rerender proof missing")
            requests = [request["value"] for request in named["fresh"]["state"]["requests"]]
            require(requests == [1.25, 8, 6, 6, None, 0, 1, .75, 7.5, 7.25, 6, 7], "Number exact numeric owner requests differ")
            require([event["nativeEvent"]["text"] for event in named["fresh"]["state"]["events"] if event["phase"] == "change"] == [change["value"] for change in named["fresh"]["state"]["rawChanges"]], "Number original raw change callbacks differ")
            require(any(event["phase"] == "submit" and event["nativeEvent"].get("text") == "001.25" for event in named["committed"]["state"]["events"]), "Number genuine final raw native text missing")
            require(public_selection(named["selection-seed"], "rangeStartEventCount", 0, 3) and fresh_selection(named["selection-edited"], "cursorStartEventCount", 1, 1), "Number original public range/fresh user cursor differs")
            require(named["guard-takeover"]["state"]["disabled"] is True and named["disabled"]["state"]["requests"] == named["selection-edited"]["state"]["requests"] + [{"value": 7.25, "generation": named["selection-edited"]["state"]["generation"], "stale": False}], "Number pending edit guard invented a numeric request")
            require(named["readonly"]["state"]["requests"] == named["disabled"]["state"]["requests"], "Number read-only native action changed owner")
            require(named["default-zero"]["state"]["inputTag"] == named["default-prop-updated"]["state"]["inputTag"] and named["default-zero"]["state"]["uncontrolled"] is True and named["default-prop-updated"]["state"]["defaultValue"] == 8, "Number mounted default ownership/ref differs")
            require(named["retired-quiet"]["state"]["requests"] == named["retired"]["state"]["requests"] == named["fresh"]["state"]["requests"] and named["fresh"]["state"]["inputTag"] != named["restored"]["state"]["inputTag"], "Number retired numeric work/ref survived")
        elif mode == "styles":
            require(len({row["state"]["inputTag"] for row in selected}) == 1 and len({row["state"]["rootTag"] for row in selected}) == 1, "Number style/provider replaced original targets")
            require(named["dark"]["state"]["themeMode"] == "dark" and named["light-restored"]["state"]["themeMode"] == "light", "Number provider restoration differs")
            narrow = named["long-narrow-keyboard"]
            require(narrow["keyboard"] and narrow["state"]["fontSize"] == 24 and narrow["editorValue"] == "1,234,567.875", "Number enlarged narrow keyboard constraint missing")
            require(named["long-narrow-first-action"]["state"]["tick"] == narrow["state"]["tick"] + 1, "Number first keyboard-active fixture action missing")
        else:
            for name, reduced in [("normal", False), ("reduced", True)]:
                first, fresh = named[name + "-first"]["state"], named[name + "-fresh"]["state"]
                require(fresh["inputTag"] != first["inputTag"] and fresh["rootTag"] != first["rootTag"] and fresh["generation"] == first["generation"] + 1, "Number fresh ownership differs")
                for phase in ["first", "second", "interrupted", "retired", "retired-quiet", "fresh"]:
                    state = named[name + "-" + phase]["state"]
                    require(state["motionEvents"][-1] is reduced and state["expectedBorder"] == ("#bb3322" if phase == "first" else "#117733"), "Number actual border/reduction state differs")
                    require(state["requests"] == first["requests"], "Number inactive lifetime invented numeric work")
            original = re.findall(r"METER_STYLE_MOTION_ORIGINAL ([01])", raw)
            require(len(original) == 1 and original == re.findall(r"METER_STYLE_MOTION_RESTORED ([01])", raw), "Number exact Reduce Motion restoration missing")
    return {"status": "PASS", "methods": results}


def validate_png_inventory(rows, directory, manifest):
    directory = Path(directory)
    attachments = [item for method in manifest for item in method["attachments"]]
    result = []
    for row in rows:
        candidates = [item for item in attachments if item["suggestedHumanReadableName"].startswith("number-" + row["name"] + "-raw_")]
        require(len(candidates) == 1, "Missing or duplicate Number raw PNG attachment")
        path = directory / candidates[0]["exportedFileName"]
        require(path.parent == directory and path.is_file(), "Missing Number raw PNG")
        data = path.read_bytes()
        require(data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 36 and data[-12:] == b"\x00\x00\x00\x00IEND\xaeB`\x82" and list(struct.unpack(">II", data[16:24])) == [row["imageWidth"], row["imageHeight"]], "Number PNG header/dimensions/trailer differs")
        result.append({"name": row["name"], "path": str(path), "sha256": hashlib.sha256(data).hexdigest()})
    return result


def method_results(raw, methods, modes):
    records = reconcile_selected_results({}, raw, methods)["rawMethodResults"]
    values = re.findall(r"NUMBER_NATIVE_OBSERVATION (\{[^\n]+\})", raw)
    reports = {}
    for method, mode in zip(methods, modes):
        terminals = [row for row in records if row["method"] == method]
        selected = [value for value in values if json.loads(value)["state"]["mode"] == mode]
        if not terminals:
            reports[method] = {"status": "NOT_RUN", "observations": len(selected)}
        elif len(terminals) != 1 or terminals[0]["result"] != "passed":
            reports[method] = {"status": "FAILED", "native": terminals}
        else:
            try:
                selected_raw = "\n".join("NUMBER_NATIVE_OBSERVATION " + value for value in selected)
                motion = "\n".join(line for line in raw.splitlines() if line.startswith("METER_STYLE_MOTION_"))
                reports[method] = {"status": "PASS", "nativeSeconds": terminals[0]["durationSeconds"], "reader": reconcile(selected_raw + "\n" + motion, [mode])}
            except (ValueError, KeyError, TypeError) as error:
                reports[method] = {"status": "FAILED", "failure": str(error), "nativeSeconds": terminals[0]["durationSeconds"]}
    return reports
