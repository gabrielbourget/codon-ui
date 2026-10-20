"""Synthetic validator guard tests only. These records are never native evidence."""
from copy import deepcopy
import unittest

from validate import PROBE, PRODUCER, parse_records, validate


def control():
    records = []
    def add(kind, **values):
        records.append({"probe": PROBE, "sequence": len(records) + 1, "kind": kind, **values})
    def key(event_id, code="KeyE", native_code=33, repeat=False, revision=4, ids=None):
        return {"ownerId": "root", "windowId": "window", "epoch": 1, "eventId": event_id, "observationRevision": revision, "observerIds": ids or ["A", "B", "T1", "T2"], "focusedTarget": 77, "timestamp": 100 + event_id, "defaultCaptured": False, "cancelled": False, "code": code, "nativeCode": native_code, "key": "e" if code == "KeyE" else code, "repeat": repeat}
    add("begin", libraryProducer=PRODUCER, fontScale=1)
    add("scope", ready=True, active=True)
    add("editor-focus", editorTag=77, actual={"target": 77})
    add("owner-commit", value="")
    add("observed-key", observer="A", packetToken=1, actual=key(1))
    add("observed-key", observer="B", packetToken=1, actual=key(1))
    add("editor-change", actual={"text": "e", "eventCount": 1}, ownerBefore="")
    add("owner-commit", value="e")
    add("observer-A-commit", mounted=False)
    add("observed-key", observer="B", packetToken=2, actual=key(2, revision=5, ids=["B", "T1", "T2"]))
    add("editor-change", actual={"text": "ee", "eventCount": 2}, ownerBefore="e")
    add("owner-commit", value="ee")
    add("observed-key", observer="B", packetToken=3, actual=key(3, revision=5, ids=["B", "T1", "T2"]))
    add("editor-change", actual={"text": "eee", "eventCount": 3}, ownerBefore="ee")
    add("observed-key", observer="B", packetToken=4, actual=key(4, revision=5, ids=["B", "T1", "T2"]))
    add("editor-change", actual={"text": "eeee", "eventCount": 4}, ownerBefore="ee")
    add("owner-commit", value="eeee")
    add("editor-selection", actual={"selection": {"start": 0, "end": 0}})
    add("observed-key", observer="B", packetToken=5, actual=key(5, "Home", 122, revision=5, ids=["B", "T1", "T2"]))
    add("observed-key", observer="B", packetToken=6, actual=key(6, "ArrowRight", 22, revision=5, ids=["B", "T1", "T2"]))
    add("observed-key", observer="B", packetToken=7, actual=key(7, "ArrowRight", 22, True, revision=5, ids=["B", "T1", "T2"]))
    add("editor-selection", actual={"selection": {"start": 2, "end": 2}})
    add("scope", ready=False, active=False)
    add("scope", ready=True, active=True)
    add("observed-key", observer="B", packetToken=8, actual=key(8, revision=7, ids=["B2", "T12", "T22"]))
    add("editor-change", actual={"text": "eeeee", "eventCount": 5}, ownerBefore="eeee")
    add("owner-commit", value="eeeee")
    add("complete", ownerValue="eeeee")
    nodes = {name: {"text": value, "focused": "true"} for name, value in [("first-e", "e"), ("second-e", "ee"), ("burst", "eeee"), ("repeat", "eeee"), ("resumed-e", "eeeee")]}
    return records, nodes


class Guards(unittest.TestCase):
    def test_incomplete_final_transport_line_waits_without_inventing_a_record(self):
        self.assertEqual(parse_records('CUI_TOASTER_OBSERVATION {"probe":'), [])

    def test_captured_packet_cannot_pass_from_editor_echo(self):
        records, nodes = control()
        next(row for row in records if row.get("observer") == "B")["actual"]["defaultCaptured"] = True
        with self.assertRaisesRegex(AssertionError, "passive unconsumed packet"):
            validate(records, nodes)

    def test_complete_synthetic_control_is_still_not_full_acceptance(self):
        self.assertFalse(validate(*control())["fullAcceptance"])

    def test_missing_editor_callback_cannot_pass_from_observers(self):
        records, nodes = control()
        next(row for row in records if row["kind"] == "editor-change")["kind"] = "missing"
        with self.assertRaisesRegex(AssertionError, "native downstream editor"):
            validate(records, nodes)

    def test_duplicate_event_cannot_pass_live_delivery(self):
        records, nodes = control()
        observed = [row for row in records if row.get("observer") == "B"]
        observed[1]["actual"]["eventId"] = observed[0]["actual"]["eventId"]
        with self.assertRaisesRegex(AssertionError, "at-most-once"):
            validate(records, nodes)

    def test_wrong_native_editor_cannot_pass_from_owner_echo(self):
        records, nodes = control()
        nodes["first-e"]["text"] = "wrong"
        with self.assertRaisesRegex(AssertionError, "independent native editor"):
            validate(records, nodes)

    def test_missing_repeat_cannot_pass_from_selection(self):
        records, nodes = control()
        next(row for row in records if row.get("actual", {}).get("repeat") is True)["actual"]["repeat"] = False
        with self.assertRaisesRegex(AssertionError, "native key repeat"):
            validate(records, nodes)

    def test_retired_window_identity_cannot_pass_new_revision(self):
        records, nodes = control()
        observed = [row for row in records if row.get("observer") == "B"]
        observed[-1]["actual"]["observerIds"] = deepcopy(observed[-2]["actual"]["observerIds"])
        with self.assertRaisesRegex(AssertionError, "retired window observer"):
            validate(records, nodes)

    def test_different_callback_object_cannot_pass_shared_packet(self):
        records, nodes = control()
        next(row for row in records if row.get("observer") == "A")["packetToken"] = 99
        with self.assertRaisesRegex(AssertionError, "original shared event"):
            validate(records, nodes)


if __name__ == "__main__":
    unittest.main()
