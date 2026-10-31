"""Verifier integrity models, never native input evidence."""
import copy
import unittest
from validate_keyboard import EXPECTED_TEXT, PROBE, validate


def model():
    rows = []
    def row(kind, **values):
        rows.append(dict(probe=PROBE, producer="model-only", sequence=len(rows) + 1, kind=kind, **values))
    for index, text in enumerate(EXPECTED_TEXT):
        field = dict(descriptorId="editor", resolved=True, currentDescriptor=True, metadataOnly=True, stateUnchanged=True,
                     state=dict(text=text, selection=[len(text), len(text)]),
                     originalInstance="new" if index >= 10 else "old", editorInstance="editor", metadataInstance="metadata")
        row("sdk-snapshot", response=dict(inspection=dict(fields=[field])))
    for event_id, phase in [(1, "down"), (2, "up")]:
        data = dict(ownerId="owner", bindingId="binding", bindingRevision="revision", target=11, windowId="window", epoch=1, eventId=event_id, phase=phase)
        row("owned", data=data, originalRef=True)
        row("caller", data=data, originalRef=True)
        row("acknowledgement", request=data, accepted=True)
    row("stale-ack", accepted=False)
    row("callback-exception")
    row("late-prevent")
    return rows


class KeyboardVerifierIntegrity(unittest.TestCase):
    def test_basic_proof_does_not_claim_full_prototype(self):
        result = validate(model(), "model-only")
        self.assertTrue(result["basicOriginalDefaultProof"])
        self.assertFalse(result["fullPrototype"])
        self.assertFalse(result["fullFamily"])

    def test_rejects_false_edit_and_identity_verdicts(self):
        changes = [lambda rows: rows[1]["response"]["inspection"]["fields"][0]["state"].update(text="a"),
                   lambda rows: rows[2]["response"]["inspection"]["fields"][0].update(originalInstance="foreign"),
                   lambda rows: rows[-1].update(kind="failure"),
                   lambda rows: rows[-3].update(accepted=True),
                   lambda rows: rows[12].update(originalRef=False),
                   lambda rows: rows[14].update(accepted=False)]
        for change in changes:
            with self.subTest(change=change):
                rows = copy.deepcopy(model()); change(rows)
                with self.assertRaises(AssertionError): validate(rows, "model-only")


if __name__ == "__main__": unittest.main()
