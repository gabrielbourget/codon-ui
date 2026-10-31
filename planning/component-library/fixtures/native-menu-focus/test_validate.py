"""Synthetic validator checks only; these are never installed focus evidence."""
import copy
import json
import unittest

from validate import CONFIGURATION, LABELS, key_identity, parse_records, validate


def sample(platform):
    records = []
    def emit(record):
        value = {"probe": CONFIGURATION["probe"], "sequence": len(records) + 1, **record}
        records.append(value)
        return value["sequence"]
    emit({"kind": "begin", "libraryProducer": CONFIGURATION["libraryProducer"], "phases": [phase["id"] for phase in CONFIGURATION["phases"]]})
    tags = {(float, 0): 11, (str, ""): 22, (str, "tail"): 33}
    for index, phase in enumerate(CONFIGURATION["phases"]):
        session = {"windowId": "unit-" + platform, "epoch": 1}
        target = tags[key_identity(phase["focusKey"])]
        emit({"kind": "phase", "phase": phase["id"], "targets": [{"key": key, "target": tags[key_identity(key)]} for key in phase["keys"]], "session": session, "window": {"width": 360, "height": 800, "scale": 2, "fontScale": 1}, "fontScale": 1, "safeAreaInsets": {"top": 20, "right": 0, "bottom": 0, "left": 0}, "keyboardVisible": False, "keyboardFrame": None, "ownerKeys": [0, "missing"]})
        if phase["explicitFocus"]:
            emit({"kind": "dispatch", "phase": phase["id"], "accepted": True, "target": target})
        focus = {"ownerId": "unit-owner-" + str(target), "target": target, "isFocused": True, "isFocusVisible": False, "origin": "programmatic", "timestamp": 100 + index * 20}
        focus_sequence = emit({"kind": "focus", "phase": phase["id"], "key": phase["focusKey"], "actual": focus})
        actual = {"ownerId": focus["ownerId"], "target": target, "windowId": session["windowId"], "platform": platform, "selected": False, "containerType": -1 if platform == "android" else 0, "containerTitle": "", "roleDescription": "", "label": LABELS[key_identity(phase["focusKey"])], "hint": "", "value": "", "description": "", "details": "", "descriptionAvailable": False, "detailsAvailable": False, "observedAt": focus["timestamp"] + 5}
        snapshot_sequence = emit({"kind": "snapshot", "phase": phase["id"], "actual": actual})
        emit({"kind": "phase-complete", "phase": phase["id"], "focusSequence": focus_sequence, "snapshotSequence": snapshot_sequence, "session": session, "ownerKeys": [0, "missing"]})
    emit({"kind": "complete", "phases": len(CONFIGURATION["phases"])})
    return records


class ValidateTests(unittest.TestCase):
    def test_four_exact_forms_on_both_platforms(self):
        for platform in ["android", "ios"]:
            verdict = validate(sample(platform), platform)
            self.assertEqual(verdict["nativeSnapshots"], 4)
            self.assertEqual(len(verdict["cells"]), 4)
            self.assertTrue(all(cell["status"] == "PASS" for cell in verdict["cells"]))

    def test_parses_raw_log_prefix_and_preserves_false_zero_empty(self):
        row = {"probe": CONFIGURATION["probe"], "key": 0, "empty": "", "flag": False}
        self.assertEqual(parse_records("W ReactNativeJS: CUI_MENU_FOCUS " + json.dumps(row)), [row])
        self.assertEqual(parse_records('CUI_MENU_FOCUS "not a record"'), [])

    def test_completion_and_dispatch_do_not_substitute_for_native_callback(self):
        rows = sample("android")
        next(row for row in rows if row["kind"] == "focus")["kind"] = "desired-target"
        with self.assertRaisesRegex(AssertionError, "original-focus-record"):
            validate(rows, "android")

    def test_rejects_false_focus_native_owner_and_native_window(self):
        for field, value, expected in [("isFocused", False, "native-focus-state"), ("ownerId", "foreign", "native-owner")]:
            rows = sample("ios")
            next(row for row in rows if row["kind"] == "focus")["actual"][field] = value
            with self.assertRaisesRegex(AssertionError, expected):
                validate(rows, "ios")
        rows = sample("ios")
        next(row for row in rows if row["kind"] == "snapshot")["actual"]["windowId"] = "foreign"
        with self.assertRaisesRegex(AssertionError, "actual-native-window"):
            validate(rows, "ios")

    def test_rejects_retained_instance_replacement(self):
        rows = sample("android")
        [row for row in rows if row["kind"] == "phase"][1]["targets"][0]["target"] = 99
        with self.assertRaisesRegex(AssertionError, "retained-ref"):
            validate(rows, "android")

    def test_rejects_owner_normalization_and_wrong_native_clock(self):
        rows = sample("android")
        next(row for row in rows if row["kind"] == "phase-complete")["ownerKeys"] = []
        with self.assertRaisesRegex(AssertionError, "owner-keys-unchanged"):
            validate(rows, "android")
        rows = sample("android")
        next(row for row in rows if row["kind"] == "snapshot")["actual"]["observedAt"] = 1
        with self.assertRaisesRegex(AssertionError, "native-monotonic-clocks"):
            validate(rows, "android")

    def test_rejects_blur_after_a_successful_focus_before_snapshot(self):
        rows = sample("ios")
        snapshot = [row for row in rows if row["kind"] == "snapshot"][-1]
        focus = [row for row in rows if row["kind"] == "focus"][-1]
        insertion = snapshot["sequence"]
        for row in rows:
            if row["sequence"] >= insertion:
                row["sequence"] += 1
            if row.get("snapshotSequence", 0) >= insertion:
                row["snapshotSequence"] += 1
        blur = copy.deepcopy(focus)
        blur["sequence"] = insertion
        blur["actual"]["isFocused"] = False
        rows.insert(insertion - 1, blur)
        with self.assertRaisesRegex(AssertionError, "focus-retained-at-snapshot"):
            validate(rows, "ios")


if __name__ == "__main__":
    unittest.main()
