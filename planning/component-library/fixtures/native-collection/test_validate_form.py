"""Verifier integrity models only; these rows are never native acceptance evidence."""
import copy
import unittest
from validate_form import ORDERS, PROBE, validate


def model(platform="ios"):
    rows = []
    def record(kind, phase="initial", **values):
        rows.append(dict(probe=PROBE, producer="model-only", sequence=len(rows) + 1, phase=phase, kind=kind, **values))
    record("begin", platform=platform)
    tags = {name: 100 + index * 10 for index, name in enumerate(["before", "first", "second", "activity", "portal", "modal", "after", "disassociated"])}
    for phase_index, (phase, expected) in enumerate(ORDERS.items()):
        offset = 1000 if phase == "root-replaced" else 0
        form_target = 20 + offset; nodes = []; fields = []
        def node(tag, parent, component="View", hidden=False):
            nodes.append(dict(target=tag, parent=parent, component=component, hidden=hidden, displayNone=hidden))
        def field(name, parent, explicit=False):
            current = tags[name] + (offset if name not in ["before", "after", "disassociated"] else 0)
            node(current, parent, hidden=phase == "activity-hidden" and name == "activity")
            node(current + 1, current, "CUIFieldBinding"); node(current + 2, current, "TextInput" if platform == "ios" else "AndroidTextInput")
            fields.append(dict(ownerId="owner:" + name, descriptorId=name, descriptorRevision=phase + ":" + name, metadataTarget=current + 1, target=current + 2, position=len(nodes) - 2, hasFormAssociation=explicit, formId="" if name == "disassociated" or not explicit else "owner-form"))
        node(1, 0, "RootView"); moved = phase in ["external-moved", "root-replaced"]
        if not moved: field("before", 1, True)
        node(form_target, 1); node(form_target + 1, form_target, "CUIFormRoot")
        form = dict(ownerId="form-owner", descriptorId="form", descriptorRevision=phase, metadataTarget=form_target + 1, target=form_target, position=len(nodes) - 1, formId="owner-form")
        for name in expected:
            if name not in ["before", "after"]: field(name, form_target)
        field("after", 1, True)
        if moved: field("before", 1, True)
        field("disassociated", 1, True); node(900, 1, "TextInput" if platform == "ios" else "AndroidTextInput")
        request = dict(target=form_target, requestId=phase, inspect=True, controlTarget=900)
        response = dict(documentId="native-root:model", rootTarget=1, surfaceId=11, revision=str(phase_index + 1), target=form_target, requestId=phase, nodes=nodes, forms=[form], fields=fields)
        sdk = []
        for descriptor in [form] + fields:
            packet = dict(ownerId=descriptor["ownerId"], descriptorId=descriptor["descriptorId"], descriptorRevision=descriptor["descriptorRevision"], target=descriptor["metadataTarget"], originalTarget=descriptor["target"], surfaceId=11, windowId="window:modal" if descriptor["descriptorId"] == "modal" else "window:main", epoch=phase_index + 1, sequence=phase_index + 1, complete=True, attached=True, metadataOnly=True)
            record("native-mount", phase, id=descriptor["descriptorId"], admitted=True, packet=packet)
            if descriptor is form: continue
            name = descriptor["descriptorId"]
            entry = dict(descriptorId=name, target=descriptor["target"], metadataTarget=descriptor["metadataTarget"], available=True, resolved=True, currentDescriptor=True, metadataOnly=True, originalClass="ModelOriginalEditor", originalInstance="model-core:" + str(descriptor["target"]), editorInstance="model-editor:" + str(descriptor["target"]), metadataInstance="model-meta:" + str(descriptor["metadataTarget"]), windowId=packet["windowId"], state=dict(text="Held " + name), stateUnchanged=True)
            if platform == "ios": entry.update(customContentBound=True, originalEditorUnchanged=True, delegateUnchanged=True, unregisteredControlUnchanged=True, unregisteredControlAfterUnchanged=True, customContentBefore=[], customContentAfter=[], customContentDuring=[dict(label="Form prototype", value="Original editor metadata", importance=0)])
            else: entry["sdk"] = dict(editable=True)
            sdk.append(entry)
        response["inspection"] = dict(platform=platform, controlTarget=900, controlInstance="model-control:900", fields=sdk)
        tokens = [(name, tags[name] + (offset if name not in ["before", "after"] else 0)) for name in expected]
        record("native-document", phase, request=request, originalResponse=response, selected=expected, originalRefTokens=tokens)
    record("terminal", "root-replaced", outcome="native-form-order-complete", fullFamily=False, fullGoal=False)
    return rows


class FormVerifierIntegrity(unittest.TestCase):
    def test_complete_scoped_models(self):
        for platform in ["ios", "android"]:
            result = validate(model(platform), platform, "model-only")
            self.assertEqual(result["nativeSnapshots"], 9)
            self.assertFalse(result["fullFamily"]); self.assertFalse(result["fullGoal"])

    def test_rejects_corrupted_original_observations(self):
        snapshot = lambda rows: next(row for row in rows if row["kind"] == "native-document")["originalResponse"]
        changes = {
            "foreign producer": lambda rows: rows[0].update(producer="other"),
            "missing phase": lambda rows: rows.pop(next(index for index, row in enumerate(rows) if row["kind"] == "native-document")),
            "unexpected input": lambda rows: rows[1].update(kind="unexpected-input"),
            "wrong order": lambda rows: snapshot(rows)["fields"].reverse(),
            "missing getter restoration": lambda rows: snapshot(rows)["inspection"]["fields"][0].update(customContentAfter=["polluted"]),
            "control polluted during lease": lambda rows: snapshot(rows)["inspection"]["fields"][0].update(unregisteredControlUnchanged=False),
            "changed intrinsic value": lambda rows: snapshot(rows)["inspection"]["fields"][0]["state"].update(text="changed"),
            "missing current descriptor": lambda rows: snapshot(rows)["inspection"]["fields"][0].update(currentDescriptor=False),
            "split modal document": lambda rows: next(row for row in rows if row["kind"] == "native-document" and row["phase"] == "modal")["originalResponse"].update(documentId="foreign-window"),
            "missing root replacement": lambda rows: next(row for row in rows if row["kind"] == "native-document" and row["phase"] == "root-replaced")["request"].update(target=20),
            "foreign mount surface": lambda rows: [row["packet"].update(surfaceId=99) for row in rows if row["kind"] == "native-mount"],
            "false completion scope": lambda rows: rows[-1].update(fullFamily=True),
        }
        for name, change in changes.items():
            with self.subTest(name=name):
                rows = copy.deepcopy(model()); change(rows)
                with self.assertRaises(AssertionError): validate(rows, "ios", "model-only")


if __name__ == "__main__": unittest.main()
