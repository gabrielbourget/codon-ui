"""Synthetic validator guards only; these records are never native acceptance evidence."""
import copy
import unittest

import callback_validate as validator


def journal():
    records = []
    def append(phase, kind, **data):
        records.append({"probe": validator.PROBE, "sequence": len(records) + 1, "phase": phase, "kind": kind, **data})
    def geometry(kind, revision, x, transaction=""):
        return {"kind": kind, "geometryRevision": revision, "ownerId": "owner", "bindingId": "binding", "target": 10, "windowId": "window", "epoch": 1, "attachmentRevision": 1, "transactionId": transaction, "attached": True, "error": "", "snapshot": {"platform": "android", "coordinateSpace": "window", "units": "dp", "mountObservationAvailable": True, "layout": [x, 24, 100, 80], "untransformed": {"box": [x, 24, 100, 80]}}}
    append("initial", "begin", sourceProducer="a" * 40)
    first = geometry("frame", 1, 24)
    append("initial", "native-geometry", actual=first)
    append("initial", "settled-native-layout", actual=first, sameRoot=True, actualTarget=10)
    previous = 24
    for index, phase in enumerate(["out", "back"]):
        x = 64 if phase == "out" else 24
        before = geometry("mount-before", index * 3 + 2, previous, phase)
        after = geometry("mount-after", index * 3 + 3, x, phase)
        frame = geometry("frame", index * 3 + 4, x)
        append(phase, "native-geometry", actual=before)
        append(phase, "native-geometry", actual=after)
        for name in ["before", "measure", "start", "complete"]:
            args = ["$undefined"] * 3 if name == "before" else [validator.box([x, 24, 100, 80]), validator.box([previous, 24, 100, 80]), "$undefined"]
            append(phase, "source-callback", name=name, callbackStage=phase, args=args, sameRoot=True)
        append(phase, "native-geometry", actual=frame)
        append(phase, "settled-native-layout", actual=frame, sameRoot=True, actualTarget=10)
        previous = x
    append("back", "terminal", outcome="native-records-complete")
    return records


class Guards(unittest.TestCase):
    def test_complete_synthetic_guard_corpus_passes(self):
        self.assertEqual(validator.validate(journal(), "android", "a" * 40)["phases"], 3)

    def test_wrong_callback_argument_shape_is_rejected(self):
        records = journal()
        next(row for row in records if row["kind"] == "source-callback")["args"] = []
        with self.assertRaises(AssertionError): validator.validate(records, "android", "a" * 40)

    def test_a_callback_box_without_sdk_correspondence_is_rejected(self):
        records = journal()
        row = next(row for row in records if row.get("name") == "measure")
        row["args"][0] = validator.box([999, 24, 100, 80])
        with self.assertRaises(AssertionError): validator.validate(records, "android", "a" * 40)

    def test_replaced_native_ref_is_rejected(self):
        records = journal()
        next(row for row in records if row["kind"] == "settled-native-layout")["sameRoot"] = False
        with self.assertRaises(AssertionError): validator.validate(records, "android", "a" * 40)

    def test_replayed_geometry_and_missing_mount_pairs_are_rejected(self):
        for replay in [True, False]:
            records = copy.deepcopy(journal())
            row = next(row for row in records if row["kind"] == "native-geometry" and row["phase"] == "out")
            row["actual"]["geometryRevision" if replay else "transactionId"] = 1 if replay else "different"
            with self.assertRaises(AssertionError): validator.validate(records, "android", "a" * 40)

    def test_an_old_callback_registration_is_rejected(self):
        records = journal()
        next(row for row in records if row["kind"] == "source-callback")["callbackStage"] = "initial"
        with self.assertRaises(AssertionError): validator.validate(records, "android", "a" * 40)


if __name__ == "__main__":
    unittest.main()
