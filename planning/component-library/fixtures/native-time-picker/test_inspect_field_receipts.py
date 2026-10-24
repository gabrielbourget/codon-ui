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


def subphase_fixture():
    rows=fixture();batch=rows[-1];parent=batch["records"][0]
    dispatch=json.loads(rows[0]["data"]["fieldDispatch"])
    dispatch.update(token=2,eventId=2,phase="input")
    raw=dict(target=12,kind="insert",text="٢")
    parent["inputSubphases"]=[dict(token=2,eventId=2,phase="input",identity=copy.deepcopy(dispatch["identity"]))]
    batch["records"].append(dict(kind="original-input",token=2,eventId=2,packet=copy.deepcopy(dispatch),payload=raw))
    rows.insert(-1,dict(kind="segment-input",probe=PROBE,producer="producer",originalPayloadId=2,data={**raw,"fieldDispatch":json.dumps(dispatch)}))
    for index,item in enumerate(rows):item["sequence"]=index+1
    return rows


def pointer_fixture():
    rows=fixture();native=rows[-1]["records"][0]
    dispatch=json.loads(native["event"]["fieldDispatch"]);dispatch["phase"]="pointer-start"
    raw=dict(target=12,pointerId=4,pointerType="touch",button=0,isPrimary=True,clientX=23.5,clientY=40)
    event={**raw,"fieldDispatch":json.dumps(dispatch),"cancelBubble":True}
    native.update(kind="pointer",event={"fieldDispatch":json.dumps(dispatch)})
    for row in rows[:-1]:
        row.update(kind="group-pointer",data=copy.deepcopy(event),stopped=True,prevented=False)
    rows[-1]["records"].append(dict(kind="original-pointer",token=1,eventId=1,payload=raw))
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

    def test_joins_actual_native_subphase_packet_and_arguments(self):
        rows=subphase_fixture()
        result=inspect(rows,"producer")
        self.assertEqual(result["nativeSubphasePackets"],1)
        self.assertEqual(result["joinedCallbacks"],4)
        self.assertFalse(result["fullInputSurface"])
        rows[-2]["data"]["text"]="wrong"
        with self.assertRaises(AssertionError): inspect(rows,"producer")

    def test_rejects_missing_native_packet_and_changed_subphase_group_path(self):
        rows=subphase_fixture();rows[-1]["records"][-1].pop("packet")
        with self.assertRaises((AssertionError,KeyError)): inspect(rows,"producer")
        for change in [lambda packet: packet["groups"].reverse(), lambda packet: packet["groups"][0].update(scopeTarget=99), lambda packet: packet["identity"].update(windowId="foreign")]:
            rows=subphase_fixture();source=rows[-2]["data"]
            dispatch=json.loads(source["fieldDispatch"]);change(dispatch);source["fieldDispatch"]=json.dumps(dispatch)
            with self.assertRaises(AssertionError): inspect(rows,"producer")

    def test_rejects_native_subphase_packet_token_and_parent_mismatch(self):
        for change in [lambda rows: rows[-1]["records"][-1]["packet"].update(token=99), lambda rows: rows[-1]["records"][0]["inputSubphases"][0]["identity"].update(nativeInstance="foreign")]:
            rows=subphase_fixture();change(rows)
            with self.assertRaises(AssertionError): inspect(rows,"producer")

    def test_joins_sdk_pointer_payload_with_react_cancellation(self):
        rows=pointer_fixture()
        rows[-1]["records"][-1]["payload"]["pointerId"]=4.0
        result=inspect(rows,"producer")
        self.assertEqual(result["nativePointerPayloads"],1)
        self.assertEqual(result["joinedCallbacks"],3)
        self.assertFalse(result["fullInputSurface"])

    def test_rejects_changed_pointer_arguments_missing_witness_or_foreign_fields(self):
        for change in [lambda rows: rows[0]["data"].update(clientX=99), lambda rows: rows[0]["data"].pop("pointerId"), lambda rows: rows[0]["data"].update(cancelBubble=1), lambda rows: rows[0]["data"].update(invented=True), lambda rows: rows[-1]["records"].pop(), lambda rows: rows[-1]["records"][-1].update(eventId=99)]:
            rows=pointer_fixture();change(rows)
            with self.assertRaises(AssertionError):inspect(rows,"producer")

    def test_rejects_duplicate_pointer_witness_and_replaced_payload(self):
        for change in [lambda rows: rows[-1]["records"].append(copy.deepcopy(rows[-1]["records"][-1])), lambda rows: rows[1].update(originalPayloadId=99)]:
            rows=pointer_fixture();change(rows)
            with self.assertRaises(AssertionError):inspect(rows,"producer")


if __name__ == "__main__": unittest.main()
