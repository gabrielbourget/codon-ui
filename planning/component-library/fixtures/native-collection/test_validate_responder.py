"""Integrity models only, never SDK evidence."""
import copy
import unittest
from validate_responder import PROBE, validate


def model():
    rows = []
    def record(kind, **values): rows.append(dict(probe=PROBE, producer="model-only", sequence=len(rows) + 1, kind=kind, **values))
    def snapshot(sequence, focused):
        field = dict(descriptorId="editor", resolved=True, available=True, currentDescriptor=True, metadataOnly=True, stateUnchanged=True,
                     originalInstance="core", editorInstance="editor", metadataInstance="metadata", state=dict(text="", focused=focused, selection=[0, 0]))
        record("sdk-snapshot", snapshotSequence=sequence, response=dict(requestId="responder:" + str(sequence), inspection=dict(fields=[field])))
    snapshot(1, False)
    record("responder-capture", mode="veto", captured=True, targetMatchesOriginal=True, originalTarget=17, currentRoot=20, currentTargetTag=20, currentTargetIsOriginalRoot=True, data=dict(target=17))
    record("responder-grant")
    snapshot(2, False)
    record("responder-capture", mode="allow", captured=False, targetMatchesOriginal=True, originalTarget=17, currentRoot=20, currentTargetTag=20, currentTargetIsOriginalRoot=True, data=dict(target=17))
    record("editor-focus")
    snapshot(3, True)
    return rows


class ResponderVerifierIntegrity(unittest.TestCase):
    def test_requires_original_sdk_verdict(self):
        self.assertTrue(validate(model(), "model-only")["originalFocusDefaultProof"])
        self.assertFalse(validate(model(), "model-only")["fullFamily"])

    def test_rejects_callback_success_without_native_veto(self):
        rows = model(); rows[3]["response"]["inspection"]["fields"][0]["state"]["focused"] = True
        with self.assertRaises(AssertionError): validate(rows, "model-only")

    def test_rejects_identity_event_and_order_corruption(self):
        changes = [lambda rows: rows[-1]["response"]["inspection"]["fields"][0].update(editorInstance="replacement"),
                   lambda rows: rows[1].update(currentTargetIsOriginalRoot=False), lambda rows: rows[1].update(targetMatchesOriginal=False),
                   lambda rows: rows[-2].update(kind="failure"), lambda rows: rows[-1]["response"]["inspection"]["fields"][0]["state"].update(text="mutated"),
                   lambda rows: rows.append(dict(rows[1]))]
        for change in changes:
            with self.subTest(change=change):
                rows = copy.deepcopy(model()); change(rows)
                with self.assertRaises(AssertionError): validate(rows, "model-only")


if __name__ == "__main__": unittest.main()
