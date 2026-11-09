"""Focused controls for NumberInput's cell adapter and strict observation reader."""
import copy
import json
import math
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import NumberInputG08Check as CHECK
import NativeStandardTests as NATIVE


class NumberInputControls(unittest.TestCase):
    def row(self):
        state = {"visible": True, "generation": 0, "inputTag": 17, "rootTag": 23, "width": 260, "expectedHeight": 60, "disabled": False, "readOnly": False, "rendered": {"inputValue": "5", "canIncrement": True, "canDecrement": True}, "intl": {"supported": ["en-US", "fr-CA"], "english": "7.5", "french": "7,5", "preparation": "polyfilled"}, "rootLayout": {"generation": 0, "target": 23, "currentTarget": 23, "layout": {"x": 12, "y": 12, "width": 260, "height": 60}}, "refs": [{"generation": 0, "input": 17}], "events": [], "requests": [], "rawChanges": [], "expectedBorderNativeColor": 0xffbb3322, "expectedBackgroundNativeColor": 0xffffffff}
        targets = [{"id": "number-native-control-" + suffix, "isTextField": suffix == "input", "isButton": suffix != "input", "label": label, "enabled": True, "frame": frame} for suffix, label, frame in [("input", "Public Number editor", [14, 14, 154, 56]), ("decrement", "Decrease Number", [172, 20, 44, 44]), ("increment", "Increase Number", [220, 20, 44, 44])]]
        paint = {"topBand": [0, 0, 0, 255] * 7, "borderRGBA": [187, 51, 34, 255], "backgroundRGBA": [255, 255, 255, 255]}
        return {"name": "baseline", "state": state, "scale": 3, "window": [0, 0, 390, 844], "parent": [0, 0, 292, 144], "root": [12, 12, 260, 60], "editor": [14, 14, 154, 56], "targets": targets, "editorIsTextField": True, "editorValue": "5", "keyboard": [], "imageWidth": 1170, "imageHeight": 2532, "referenceRequested": True, "referenceRoot": [12, 12, 260, 60], "paint": paint, "referencePaint": copy.deepcopy(paint)}

    def test_strict_rows_and_target_paint_readiness_negatives(self):
        row = self.row()
        self.assertEqual(CHECK.validate_rows([row], ["baseline"])["observations"], 1)
        mutations = [lambda r: r["state"].update(inputTag=23), lambda r: r["state"]["rootLayout"].update(generation=1), lambda r: r["state"]["rootLayout"].update(target=17), lambda r: r["targets"].pop(), lambda r: r["targets"][0].update(label="Wrong editor"), lambda r: r["targets"][1].update(enabled=False), lambda r: r["targets"][0].update(frame=[12 - 1/3, 14, 154, 56]), lambda r: r["paint"]["borderRGBA"].__setitem__(0, 186), lambda r: r["referencePaint"]["topBand"].__setitem__(0, 1), lambda r: r["state"]["intl"].update(french="7.5"), lambda r: r["state"]["requests"].append({"stale": True}), lambda r: r.update(keyboard=[0, 50, 390, 794]), lambda r: r.update(editorValue="wrong"), lambda r: r.update(imageWidth=1169), lambda r: r.update(scale=math.nan)]
        for mutate in mutations:
            bad = copy.deepcopy(row); mutate(bad)
            with self.subTest(mutation=mutations.index(mutate)), self.assertRaises((ValueError, KeyError)):
                CHECK.validate_rows([bad], ["baseline"])
        for rows in [[], [row, copy.deepcopy(row)]]:
            with self.assertRaises(ValueError): CHECK.validate_rows(rows, ["baseline"])

    def test_physical_pixels_keep_roundoff_and_reject_one_pixel_outside(self):
        self.assertEqual(CHECK.physical([0, 0, 763, 20], 3), CHECK.physical([0, 0, 762.9999999999999, 20], 3))
        self.assertTrue(CHECK.contains(CHECK.physical([0, 0, 763, 20], 3), [0, 0, 2289, 60]))
        self.assertFalse(CHECK.contains(CHECK.physical([-1/3, 0, 763, 20], 3), [0, 0, 2289, 60]))
        for scale in [0, -1, math.nan, math.inf]:
            with self.assertRaises(ValueError): CHECK.physical([0, 0, 20, 20], scale)

    def test_fresh_original_selection_rejects_history_wrong_target_and_generation(self):
        row = self.row(); row["rangeStartEventCount"] = 1
        event = {"phase": "selection", "generation": 0, "target": 17, "currentTarget": 17, "nativeEvent": {"target": 17, "selection": {"start": 0, "end": 3}}}
        row["state"]["events"] = [copy.deepcopy(event), copy.deepcopy(event)]
        self.assertTrue(CHECK.fresh_selection(row, "rangeStartEventCount", 0, 3))
        for key, value in [("generation", 1), ("target", 23), ("currentTarget", 23)]:
            bad = copy.deepcopy(row); bad["state"]["events"][1][key] = value
            self.assertFalse(CHECK.fresh_selection(bad, "rangeStartEventCount", 0, 3))
        row["state"]["events"].pop()
        with self.assertRaises(ValueError): CHECK.fresh_selection(row, "rangeStartEventCount", 0, 3)

    def test_png_inventory_missing_duplicate_wrong_dimensions_and_escape(self):
        row = self.row()
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp); image = directory / "raw.png"
            image.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\0" * 8 + struct.pack(">II", 1170, 2532) + b"\0" * 8 + b"\0\0\0\0IEND\xaeB`\x82")
            attachment = {"suggestedHumanReadableName": "number-baseline-raw_host-control", "exportedFileName": "raw.png"}
            self.assertEqual(len(CHECK.validate_png_inventory([row], directory, [{"attachments": [attachment]}])), 1)
            for items in [[], [attachment, attachment], [dict(attachment, exportedFileName="missing.png")], [dict(attachment, exportedFileName="../raw.png")]]:
                with self.assertRaises(ValueError): CHECK.validate_png_inventory([row], directory, [{"attachments": items}])
            row["imageWidth"] = 1
            with self.assertRaises(ValueError): CHECK.validate_png_inventory([row], directory, [{"attachments": [attachment]}])

    def test_real_stock_terminal_replay_selected_method_independence_and_faults(self):
        # Exact retained Input r3 stock terminal; original hash/provenance stays in local RED evidence.
        original = "Test Case '-[CodonNativeComponents.InputG08TrialTests testInputActionsAndEditorOwnership]' passed (150.481 seconds)."
        broken = r"Test Case '-\\[[^\\]]+ testInputActionsAndEditorOwnership\\]' (passed|failed|skipped) \\(([0-9.]+) seconds?\\)\\."
        self.assertEqual(CHECK.re.findall(broken, original), [])
        self.assertEqual(CHECK.re.findall(r"NUMBER_NATIVE_OBSERVATION (\\{[^\\n]+\\})", 'NUMBER_NATIVE_OBSERVATION {"state":{"mode":"actions"}}'), [])
        methods = NATIVE.selection("ios", "number-input")["ios"]
        terminals = [original.replace("InputG08TrialTests", "NumberInputG08TrialTests").replace("testInputActionsAndEditorOwnership", method.split("/")[-1]) for method in methods]
        rows = [{"name": "host-control", "state": {"mode": mode}} for mode in ["actions", "styles", "lifetime"]]
        observations = ["NUMBER_NATIVE_OBSERVATION " + json.dumps(row) for row in rows]
        seen = []
        def selected(raw, modes):
            values = [json.loads(value) for value in CHECK.re.findall(r"NUMBER_NATIVE_OBSERVATION (\{[^\n]+\})", raw)]
            self.assertEqual([value["state"]["mode"] for value in values], modes); seen.extend(modes)
            return {"status": "HOST_WIRING_ONLY"}
        with patch.object(CHECK, "reconcile", side_effect=selected):
            reports = CHECK.method_results("\n".join(terminals + observations), methods, ["actions", "styles", "lifetime"])
            self.assertTrue(all(row["status"] == "PASS" for row in reports.values()));self.assertEqual(seen, ["actions", "styles", "lifetime"])
            for kind in ["missing", "duplicate", "failed", "skipped"]:
                changed = list(terminals)
                if kind == "missing": changed.pop(0)
                elif kind == "duplicate": changed.append(changed[0])
                else: changed[0] = changed[0].replace("passed", kind)
                result = CHECK.method_results("\n".join(changed + observations), methods, ["actions", "styles", "lifetime"])
                self.assertEqual(result[methods[0]]["status"], "NOT_RUN" if kind == "missing" else "FAILED")
                self.assertEqual(result[methods[1]]["status"], "PASS");self.assertEqual(result[methods[2]]["status"], "PASS")
        with patch.object(CHECK, "reconcile", side_effect=ValueError("strict assertion sentinel")):
            self.assertTrue(all(row["status"] == "FAILED" for row in CHECK.method_results("\n".join(terminals + observations), methods, ["actions", "styles", "lifetime"]).values()))

    def selected_rows(self, mode):
        names = {"actions": CHECK.ACTIONS, "styles": CHECK.STYLES, "lifetime": CHECK.LIFETIME}[mode]
        text = ["", "001.25", "001.25", "1.25", "5", "5", "5", "5", "5", "0", "", "", "0", "0.75", "1", "0.75", "12,5", "7,5", "001.25", "7.25", "5", "5", "5", "6", "7", "", "", "2"]
        rows = []
        requests = [{"value": value, "generation": 0, "stale": False} for value in [1.25, 8, 6, 6, None, 0, 1, .75, 7.5, 7.25, 6, 7]]
        for index, name in enumerate(names):
            row = self.row(); row["name"] = name; state = row["state"]; state.update(mode=mode, tick=0, ownerValue=5, uncontrolled=False, defaultValue=0, fontSize=14, themeMode="dark" if name == "dark" else "light", motionEvents=[name.startswith("reduced")], expectedBorder="#bb3322" if name.endswith("first") else "#117733")
            value = text[index] if mode == "actions" else "1,234,567.875" if name.startswith("long-narrow") else "5"
            state["rendered"].update(inputValue=value, isFocused=False);row["editorValue"] = value
            if mode == "actions":
                if name in ["first-draft", "same-draft"]: row["keyboard"] = [0, 500, 390, 344]
                if name == "same-draft": state.update(tick=1, ownerValue=None);state["rendered"]["isFocused"] = True
                if name == "committed": state["events"] = [{"phase": "submit", "generation": 0, "target": 17, "currentTarget": 17, "nativeEvent": {"target": 17, "text": "001.25"}}]
                if name in ["default-zero", "default-prop-updated"]: state.update(uncontrolled=True, defaultValue=8 if name.endswith("updated") else 0)
                if name in ["selection-seed", "selection-edited"]:
                    state["requests"] = copy.deepcopy(requests[:9]); key, start, end = ("rangeStartEventCount", 0, 3) if name.endswith("seed") else ("cursorStartEventCount", 1, 1)
                    row[key] = 0;state["events"] = [{"phase":"selection","generation":0,"target":17,"currentTarget":17,"nativeEvent":{"target":17,"selection":{"start":start,"end":end}}}]
                    if name == "selection-seed":
                        row[key] = 1;state["rendered"]["isFocused"] = True;state["selection"] = {"start":0,"end":3,"generation":0,"inputTag":17};state["events"] = [{"phase":"focus","generation":0,"target":17,"currentTarget":17,"nativeEvent":{"target":17,"text":""}},{"phase":"change","generation":0,"target":17,"currentTarget":17,"nativeEvent":{"target":17,"text":"001.25"}}]
                if name in ["guard-takeover", "disabled", "readonly"]:
                    state["requests"] = copy.deepcopy(requests[:10]);state["disabled"] = name != "readonly";state["readOnly"] = name == "readonly";row["targets"][0]["enabled"] = False
                    if state["disabled"]:
                        for target in row["targets"][1:]: target["enabled"] = False
                if name in ["retired", "retired-quiet", "fresh"]: state["requests"] = copy.deepcopy(requests)
            elif mode == "styles":
                if name == "long-narrow-keyboard": row["keyboard"] = [0,500,390,344];state["fontSize"] = 24
                if name == "long-narrow-first-action":state["tick"] = 1
            if "retired" in name:
                state.update(visible=False,inputTag=None,rootTag=None);row.update(root=[],editor=[],targets=[],inkPixels=0)
            elif name == "fresh" or name.endswith("-fresh"):
                state.update(generation=1,inputTag=31,rootTag=37);state["rootLayout"].update(generation=1,target=37,currentTarget=37);state["refs"].append({"generation":1,"input":31})
            rows.append(row)
        return rows

    def test_full_selected_actions_styles_lifetime_and_discriminating_negatives(self):
        def raw(rows): return "\n".join("NUMBER_NATIVE_OBSERVATION " + json.dumps(row) for row in rows) + "\nMETER_STYLE_MOTION_ORIGINAL 1\nMETER_STYLE_MOTION_RESTORED 1\n"
        for mode in ["actions", "styles", "lifetime"]:
            rows = self.selected_rows(mode)
            self.assertEqual(CHECK.reconcile(raw(rows), [mode])["status"], "PASS")
            changes = {
                "actions": [("fresh", lambda row: row["state"]["requests"].pop()), ("same-draft", lambda row: row["state"].update(tick=0)), ("committed", lambda row: row["state"]["events"][0]["nativeEvent"].update(text="1.25")), ("selection-edited", lambda row: row.update(cursorStartEventCount=1)), ("disabled", lambda row: row["state"]["requests"].append({"value":6,"generation":0,"stale":False})), ("fresh", lambda row: row["state"]["rawChanges"].append({"value":"wrong","stale":False}))],
                "styles": [("dark", lambda row: row["state"].update(themeMode="light")), ("long-narrow-first-action", lambda row: row["state"].update(tick=0))],
                "lifetime": [("normal-fresh", lambda row: row["state"].update(generation=2)), ("reduced-second", lambda row: row["state"].update(motionEvents=[False]))]
            }[mode]
            for name, change in changes:
                bad = copy.deepcopy(rows);change(next(row for row in bad if row["name"] == name))
                with self.subTest(mode=mode,name=name),self.assertRaises(ValueError):CHECK.reconcile(raw(bad), [mode])
            if mode == "lifetime":
                with self.assertRaises(ValueError):CHECK.reconcile(raw(rows).replace("METER_STYLE_MOTION_RESTORED 1", "METER_STYLE_MOTION_RESTORED 0"), [mode])

    def test_suppressed_programmatic_selection_red_green_and_real_edit_negatives(self):
        rows = self.selected_rows("actions");seed = next(row for row in rows if row["name"] == "selection-seed")
        # Pinned Fabric programmatic setter suppresses onSelectionChange: the old predicate cannot complete.
        self.assertFalse(CHECK.fresh_selection(seed, "rangeStartEventCount", 0, 3))
        self.assertTrue(CHECK.public_selection(seed, "rangeStartEventCount", 0, 3))
        old_cleanup = copy.deepcopy(seed)
        old_cleanup["state"]["events"].insert(1, {"phase":"blur","generation":-1,"target":7,"currentTarget":7,"nativeEvent":{"target":7}})
        old_cleanup["rangeStartEventCount"] = 2
        self.assertTrue(CHECK.public_selection(old_cleanup, "rangeStartEventCount", 0, 3))
        current_blur = copy.deepcopy(old_cleanup)
        current_blur["state"]["events"][1] = {"phase":"blur","generation":0,"target":17,"currentTarget":17,"nativeEvent":{"target":17}}
        self.assertFalse(CHECK.public_selection(current_blur, "rangeStartEventCount", 0, 3))
        for change in [lambda row: row["state"]["selection"].update(inputTag=23),lambda row: row["state"]["selection"].update(generation=9),lambda row: row["state"]["events"][0].update(target=23),lambda row: row["state"]["rendered"].update(isFocused=False)]:
            bad = copy.deepcopy(seed);change(bad)
            if bad["state"]["selection"] != seed["state"]["selection"] or not bad["state"]["rendered"]["isFocused"]:
                with self.assertRaises(ValueError):CHECK.public_selection(bad,"rangeStartEventCount",0,3)
            else:self.assertFalse(CHECK.public_selection(bad,"rangeStartEventCount",0,3))
        raw = lambda values: "\n".join("NUMBER_NATIVE_OBSERVATION " + json.dumps(row) for row in values)
        self.assertEqual(CHECK.reconcile(raw(rows), ["actions"])["status"], "PASS")
        for kind in ["missing-edit","wrong-replacement","historical-cursor","wrong-cursor-target"]:
            bad=copy.deepcopy(rows);edited=next(row for row in bad if row["name"]=="selection-edited")
            if kind=="missing-edit":bad.remove(edited)
            elif kind=="wrong-replacement":edited["state"]["rendered"]["inputValue"]="7001.25";edited["editorValue"]="7001.25"
            elif kind=="historical-cursor":edited["cursorStartEventCount"]=1
            else:edited["state"]["events"][0]["nativeEvent"]["target"]=23
            with self.subTest(kind=kind),self.assertRaises(ValueError):CHECK.reconcile(raw(bad),["actions"])

    def test_post_type_evidence_precedes_unchanged_expected_value_red_green(self):
        source=(ROOT/"MeterG02TrialTests.swift").read_text().split("func testNumberInputActionsAndOwnership()",1)[1].split("func testNumberInputStylesAndConstraint()",1)[0]
        segment=source.split('editor().typeText("8")',1)[1].split('try capture("veto-edit")',1)[0]
        emit=segment.index('FileHandle.standardOutput.write(Data("NUMBER_NATIVE_DIAGNOSTIC ')
        expect=segment.index('expected("8")')
        self.assertLess(emit,expect)
        for capture in ['let deliveredEditor=editor()','let deliveredValue:Any','diagnostic["state"]=try state()','diagnostic["stateReadError"]','app.keyboards.firstMatch.exists','add(stateAttachment)','add(screenshotAttachment)','add(hierarchyAttachment)']:
            self.assertLess(segment.index(capture),expect)
        self.assertLess(segment.index('let deliveredValue:Any'),segment.index('diagnostic["state"]=try state()'))
        self.assertIn('editorExists ? (deliveredEditor.value ?? NSNull()) : NSNull()',segment)
        guarded=segment.split('if editorExists {',1)[1].split('}',1)[0]
        for field in ['deliveredEditor.identifier','deliveredEditor.isEnabled','deliveredEditor.frame']:self.assertIn(field,guarded)
        self.assertEqual(segment.count('expected("8")'),1)
        self.assertIn('expected("8");editor().typeText("\\n");expected("5")',segment)
        # Replay actual source operation order only. Host proof of retention, not Swift/native delivery.
        # Original r2 went straight from type8 to expected8; a mismatch/delay hid the next capture.
        for actual in [{"state":{"rendered":{"inputValue":"58"},"selection":{"start":0,"end":1}},"editorExists":True,"editorValue":"58"},{"state":{"rendered":{"inputValue":"5"},"selection":None},"editorExists":True,"editorValue":"8"},{"stateReadError":"malformed state JSON","editorExists":True,"editorValue":"58"},{"stateReadError":"missing state after editor removal","editorExists":False,"editorValue":None}]:
            def replay(operations):
                retained=[]
                for operation in operations:
                    if operation=="emit":retained.append(json.loads(json.dumps(actual)))
                    elif actual.get("state",{}).get("rendered",{}).get("inputValue")!="8":break
                return retained
            self.assertEqual(replay(["expect","emit"]),[]) # preserved pre-fix source ordering RED
            ordered=[name for _,name in sorted([(emit,"emit"),(expect,"expect")])]
            self.assertEqual(replay(ordered),[actual]) # wrong/delayed values retained unchanged GREEN
        self.assertNotIn("sleep",segment)
        self.assertNotIn("while_running",segment)

    def test_selection_post_type_capture_precedes_unchanged_seed_expectation(self):
        source = (ROOT / "MeterG02TrialTests.swift").read_text().split("func testNumberInputActionsAndOwnership()", 1)[1].split("func testNumberInputStylesAndConstraint()", 1)[0]
        segment = source.split('next("selection")', 1)[1].split('wait("Original Number public range requested after original focus")', 1)[0]
        def capture_order(value):
            emitted = value.index('FileHandle.standardOutput.write(Data("NUMBER_NATIVE_DIAGNOSTIC ')
            expected = value.index('expected("001.25")')
            self.assertLess(emitted, expected)
            for capture in ['let deliveredEditor=editor()', 'let deliveredValue:Any', 'diagnostic["state"]=try state()', 'diagnostic["stateReadError"]', 'app.keyboards.firstMatch.exists', 'add(stateAttachment)', 'add(screenshotAttachment)', 'add(hierarchyAttachment)']:
                self.assertLess(value.index(capture), expected)
            self.assertLess(value.index('let deliveredValue:Any'), value.index('diagnostic["state"]=try state()'))
            self.assertIn('editorExists ? (deliveredEditor.value ?? NSNull()) : NSNull()', value)
            guarded = value.split('if editorExists {', 1)[1].split('}', 1)[0]
            for field in ['deliveredEditor.identifier', 'deliveredEditor.isEnabled', 'deliveredEditor.frame']:
                self.assertIn(field, guarded)
            return emitted, expected
        emitted, expected = capture_order(segment)
        self.assertEqual(segment.count('editor().typeText("001.25")'), 1)
        self.assertEqual(segment.count('expected("001.25")'), 1)
        for attachment in ['number-selection-before-expect-001.25-state', 'number-selection-before-expect-001.25-raw', 'number-selection-before-expect-001.25-hierarchy']:
            self.assertIn(attachment, segment)
        for mutation in [segment.replace('add(stateAttachment)', ''), segment.replace('add(screenshotAttachment)', ''), segment.replace('add(hierarchyAttachment)', ''), segment.replace('diagnostic["stateReadError"]', 'ignoredStateReadError'), segment.replace('if editorExists {', 'if true {')]:
            with self.assertRaises((ValueError, AssertionError, IndexError)):
                capture_order(mutation)
        # Source-order replay retains evidence before the identical exact predicate; it proves no native cause.
        for actual in [{"state": {"rendered": {"inputValue": "5"}}, "editorExists": True, "editorValue": "5"}, {"state": {"rendered": {"inputValue": "5"}}, "editorExists": True, "editorValue": "001.25"}, {"stateReadError": "malformed state JSON", "editorExists": True, "editorValue": "001.25"}, {"stateReadError": "missing state after editor removal", "editorExists": False, "editorValue": None}]:
            def replay(operations):
                retained = []
                for operation in operations:
                    if operation == "emit": retained.append(json.loads(json.dumps(actual)))
                    elif actual.get("state", {}).get("rendered", {}).get("inputValue") != "001.25": break
                return retained
            self.assertEqual(replay(["expect", "emit"]), [])
            self.assertEqual(replay([name for _, name in sorted([(emitted, "emit"), (expected, "expect")])]), [actual])
        self.assertIn('expected("7.25")', source)
        self.assertIn('range["start"] as? Int==1 && range["end"] as? Int==1', source)
        self.assertNotIn("sleep", segment)
        self.assertNotIn("while_running", segment)

    def test_actual_driver_failure_and_cleanup_uncertainty_nonzero(self):
        for failed, clean in [(False, True), (True, True), (False, False)]:
            with tempfile.TemporaryDirectory() as temp:
                output = Path(temp) / "out"
                plan = {"nativeStandard": {"action": "build", "platform": "ios", "batch": "number-input", "output": str(output)}, "bindings": {"observer": []}, "attempt": {"maximumSeconds": 30, "cleanupReserveSeconds": 10}}
                with patch.object(NATIVE, "build_ios", side_effect=ValueError("saved SDK65") if failed else None, return_value={"product": "HOST_CONTROL_NO_SDK"}), patch.object(NATIVE, "cleanup", side_effect=None if clean else ValueError("uncertain shutdown")):
                    code = NATIVE.execute(plan, {"result": "PASS", "scope": "Number host control only"})
                self.assertEqual(code, 0 if not failed and clean else 1)
                terminal = json.loads((output / "terminal.json").read_text())
                self.assertEqual(terminal["cleanupVerified"], clean);self.assertEqual(terminal["gatePromotions"], 0)

    def test_exact_methods_and_missing_admission_reject_before_sdk(self):
        for batch, modes in NATIVE.NUMBER_BATCHES.items():
            self.assertEqual(len(NATIVE.selection("ios", batch)["ios"]), len(modes))
            with tempfile.TemporaryDirectory() as temp:
                path = Path(temp) / "plan.json"
                path.write_text(json.dumps({"cell": "CAT.number-input.G08", "nativeStandard": {"platform": "ios", "batch": batch, "output": str(Path(temp) / "never")}}))
                with patch.dict(NATIVE.os.environ, {key: value for key, value in NATIVE.os.environ.items() if key != "CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}, clear=True), patch.object(sys, "argv", [str(ROOT / "NativeStandardTests.py"), "--plan", str(path)]), patch.object(NATIVE, "execute") as sdk:
                    with self.assertRaisesRegex(ValueError, "Use NativeCellVerification.py"): NATIVE.main()
                    sdk.assert_not_called()


if __name__ == "__main__": unittest.main()
