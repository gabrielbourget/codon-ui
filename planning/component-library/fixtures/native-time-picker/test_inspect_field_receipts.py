import copy
import json
import unittest

from inspect_field_receipts import PROBE, inspect


def fixture():
    identity = dict(ownerId="owner", bindingId="binding", bindingRevision="revision", metadataTarget=5, outerTarget=10, inputTarget=11, surfaceId=1, target=12, documentId="document", documentRevision="1", windowId="window", mountRevision="1", outerInstance="outer", inputInstance="input", nativeInstance="component", editorInstance="editor", epoch=1)
    dispatch = dict(moduleLease="module", token=1, eventId=1, phase="down", identity=identity, groups=[dict(target=t, bindingId="binding", bindingRevision="revision", scopeTarget=10) for t in [11, 10]])
    event = dict(key="ArrowUp", target=12, phase="down", fieldDispatch=json.dumps(dispatch))
    snapshot = {name: identity[name] for name in ["documentId", "surfaceId", "windowId", "outerTarget", "inputTarget", "outerInstance", "inputInstance"]}
    snapshot.update(focusedTarget=12, instances=[dict(target=12, nativeInstance="component", editorInstance="editor")])
    native = dict(kind="key", event=copy.deepcopy(event), identity=identity, before=copy.deepcopy(snapshot), after=copy.deepcopy(snapshot), scopeCurrent=True)
    rows = []
    def add(kind, **values): rows.append(dict(kind=kind, probe=PROBE, producer="producer", sequence=len(rows)+1, **values))
    add("segment-key", data=copy.deepcopy(event), originalPayloadId=1)
    for target in [11, 10]: add("field-key", data=copy.deepcopy(event), originalPayloadId=1, receiverTarget=target)
    add("native-receipts", records=[native, dict(kind="command-native", token=1, target=12, command="focus", callbackCompleted=True, current=True, error="", before=snapshot, after=snapshot)], dropped=0)
    return rows


class ReceiptIntegrity(unittest.TestCase):
    def test_joins_original_frames_and_keeps_acceptance_open(self):
        result = inspect(fixture(), "producer")
        self.assertTrue(result["receiptIntegrity"])
        self.assertEqual(result["joinedCallbacks"], 3)
        self.assertEqual(result["nativeCommands"], 1)
        self.assertFalse(result["fullInputSurface"])
        self.assertFalse(result["fullFamily"])
        self.assertFalse(result["fullGoal"])

    def test_rejects_source_only_or_dropped_native_evidence(self):
        for change in [lambda rows: rows[-1].update(records=[]), lambda rows: rows[-1].update(dropped=1), lambda rows: rows[-1]["records"].append(copy.deepcopy(rows[-1]["records"][0]))]:
            rows=fixture();change(rows)
            with self.assertRaises(AssertionError): inspect(rows,"producer")

    def test_rejects_changed_payload_identity_or_native_data(self):
        for change in [lambda rows: rows[1].update(originalPayloadId=2), lambda rows: rows[1]["data"].update(key="ArrowDown"), lambda rows: rows[-1]["records"][0]["identity"].update(windowId="foreign")]:
            rows=fixture();change(rows)
            with self.assertRaises(AssertionError): inspect(rows,"producer")

    def test_rejects_wrong_receiver_order_duplicates_and_foreign_commands(self):
        for change in [lambda rows: rows[1].update(receiverTarget=10), lambda rows: rows[2].update(receiverTarget=11), lambda rows: rows[-1]["records"][1].update(token=99), lambda rows: rows[-1]["records"][1].update(after=None)]:
            rows=fixture();change(rows)
            with self.assertRaises(AssertionError): inspect(rows,"producer")

    def test_missing_private_packet_is_reported_not_promoted(self):
        rows=fixture();rows[0]["data"].pop("fieldDispatch")
        result=inspect(rows,"producer")
        self.assertEqual(result["unjoinedCallbackSequences"],[1])
        self.assertFalse(result["fullInputSurface"])

    def test_rejects_native_root_or_backed_editor_replacement(self):
        for change in [lambda rows: rows[-1]["records"][0]["after"].update(outerInstance="replacement"), lambda rows: rows[-1]["records"][0]["before"]["instances"][0].update(editorInstance="replacement")]:
            rows=fixture();change(rows)
            with self.assertRaises(AssertionError): inspect(rows,"producer")

    def test_preserves_subphase_arguments_without_claiming_unverified_group_custody(self):
        rows=fixture();batch=rows[-1];parent=batch["records"][0]
        dispatch=json.loads(rows[0]["data"]["fieldDispatch"])
        dispatch.update(token=2,eventId=2,phase="input")
        raw=dict(target=12,kind="insert",text="٢")
        parent["inputSubphases"]=[dict(token=2,eventId=2,phase="input",identity=copy.deepcopy(dispatch["identity"]))]
        batch["records"].append(dict(kind="original-input",token=2,eventId=2,payload=raw))
        row=dict(kind="segment-input",probe=PROBE,producer="producer",originalPayloadId=2,data={**raw,"fieldDispatch":json.dumps(dispatch)})
        rows.insert(-1,row)
        for index,item in enumerate(rows):item["sequence"]=index+1
        result=inspect(rows,"producer")
        self.assertEqual(result["subphaseGroupCustodyNotYetVerified"],[4])
        self.assertFalse(result["fullInputSurface"])
        row["data"]["text"]="wrong"
        with self.assertRaises(AssertionError): inspect(rows,"producer")


if __name__ == "__main__": unittest.main()
