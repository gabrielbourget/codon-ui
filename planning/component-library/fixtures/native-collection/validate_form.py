"""Validate original native form snapshots; source models cannot establish this verdict."""
import json

PROBE = "codon-native-form-document-v1"
INITIAL = ["before", "first", "second", "activity", "after"]
REORDERED = ["before", "second", "first", "activity", "after"]
ORDERS = {
    "initial": INITIAL,
    "reordered": REORDERED,
    "activity-hidden": REORDERED,
    "activity-restored": REORDERED,
    "portal": REORDERED[:-1] + ["portal", "after"],
    "modal": REORDERED[:-1] + ["portal", "modal", "after"],
    "modal-closed": REORDERED[:-1] + ["portal", "after"],
    "external-moved": ["second", "first", "activity", "portal", "after", "before"],
    "root-replaced": ["second", "first", "activity", "portal", "after", "before"],
}


def parse(text):
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def validate(rows, platform, producer):
    assert rows and rows[0]["kind"] == "begin" and rows[0]["platform"] == platform
    assert all(row["probe"] == PROBE and row["producer"] == producer for row in rows)
    assert [row["sequence"] for row in rows] == list(range(1, len(rows) + 1))
    assert not any(row["kind"] in ["failure", "unexpected-input"] for row in rows), "Original failure/input must not be discarded"
    assert not any(row["kind"] == "native-editor-event" and row["type"] in ["focus", "blur"] for row in rows), "Metadata inspection must not move keyboard focus"
    assert rows[-1]["kind"] == "terminal" and rows[-1]["outcome"] == "native-form-order-complete"
    assert rows[-1]["fullFamily"] is False and rows[-1]["fullGoal"] is False
    snapshots = [row for row in rows if row["kind"] == "native-document"]
    assert [row["phase"] for row in snapshots] == list(ORDERS), "Every original phase is required exactly once"
    documents, surfaces, roots, controls = set(), set(), set(), set()
    prior_targets, prior_tokens, form_target = {}, {}, None
    callbacks = [row for row in rows if row["kind"] == "native-mount"]
    assert callbacks and any(row["admitted"] for row in callbacks)
    for row in snapshots:
        phase, response, request = row["phase"], row["originalResponse"], row["request"]
        assert response["requestId"] == request["requestId"] and response["target"] == request["target"]
        assert type(response["surfaceId"]) is int and response["surfaceId"] > 0
        assert response["revision"].isdigit()
        documents.add(response["documentId"]); surfaces.add(response["surfaceId"]); roots.add(response["rootTarget"])
        nodes = response["nodes"]; by_tag = {}; path = []
        for position, node in enumerate(nodes):
            tag, parent = node["target"], node["parent"]
            assert type(tag) is int and tag > 0 and tag not in by_tag
            if position == 0: assert tag == response["rootTarget"] and parent == 0
            else:
                assert parent in path, "Retained preorder cannot reopen a closed subtree"
                path = path[:path.index(parent) + 1]
            path.append(tag); by_tag[tag] = (position, node)
        assert len(response["forms"]) == 1
        form = response["forms"][0]
        assert form["descriptorId"] == "form" and form["formId"] == "owner-form" and form["target"] == request["target"]
        assert by_tag[form["metadataTarget"]][0] == form["position"] and by_tag[form["metadataTarget"]][1]["component"] == "CUIFormRoot"
        descriptors = response["fields"]
        assert request["controlTarget"] in by_tag and request["controlTarget"] not in {field["target"] for field in descriptors}
        root_callbacks = [item["packet"] for item in callbacks if item["admitted"] and item["packet"]["ownerId"] == form["ownerId"] and item["packet"]["descriptorId"] == form["descriptorId"] and item["packet"]["descriptorRevision"] == form["descriptorRevision"] and item["packet"]["target"] == form["metadataTarget"] and item["packet"]["originalTarget"] == form["target"]]
        assert any(packet["metadataOnly"] and packet["surfaceId"] == response["surfaceId"] and ((packet["complete"] and packet["attached"]) or (phase == "modal" and not packet["complete"] and not packet["attached"] and packet["error"] == "form-metadata-detached")) for packet in root_callbacks), "Original current form acknowledgment missing"
        assert len({entry["descriptorId"] for entry in descriptors}) == len(descriptors)
        assert len({entry["metadataTarget"] for entry in descriptors}) == len(descriptors)
        assert len({entry["target"] for entry in descriptors}) == len(descriptors)
        assert [entry["position"] for entry in descriptors] == sorted(entry["position"] for entry in descriptors)
        selected = []
        for field in descriptors:
            assert by_tag[field["metadataTarget"]][0] == field["position"]
            assert by_tag[field["metadataTarget"]][1]["component"] == "CUIFieldBinding"
            assert by_tag[field["target"]][1]["component"] == ("TextInput" if platform == "ios" else "AndroidTextInput")
            if field["hasFormAssociation"]:
                associated = field["formId"] == "owner-form"
            else:
                ancestor = field["target"]
                while ancestor and ancestor != form["target"]: ancestor = by_tag[ancestor][1]["parent"]
                associated = ancestor == form["target"]
            if associated: selected.append(field)
        actual = [entry["descriptorId"] for entry in selected]
        assert actual == ORDERS[phase] == row["selected"], "Actual native preorder/membership mismatch"
        assert set(entry["descriptorId"] for entry in descriptors) == set(actual + ["disassociated"])
        inspection = response["inspection"]
        assert inspection["platform"] == platform and inspection["controlTarget"] == request["controlTarget"]
        controls.add(inspection["controlInstance"])
        assert isinstance(inspection["controlInstance"], str) and inspection["controlInstance"]
        sdk = {entry["descriptorId"]: entry for entry in inspection["fields"]}
        tokens = dict(row["originalRefTokens"])
        for field in selected:
            name = field["descriptorId"]
            if phase == "activity-hidden" and name == "activity":
                ancestor = field["target"]; hidden = False
                while ancestor:
                    node = by_tag[ancestor][1]; hidden |= node["hidden"] or node["displayNone"]; ancestor = node["parent"]
                assert hidden, "Activity requires an actual retained hidden native node"
                continue
            observed = sdk[name]
            assert observed["target"] == field["target"] and observed["metadataTarget"] == field["metadataTarget"]
            assert observed["resolved"] and observed["currentDescriptor"] and observed["metadataOnly"]
            inactive_modal = phase == "modal" and name != "modal" and not observed["available"]
            assert observed["available"] or inactive_modal
            assert observed["state"]["text"] == "Held " + name and observed["stateUnchanged"]
            assert observed["originalClass"]
            assert all(isinstance(observed[key], str) and observed[key] for key in ["originalInstance", "editorInstance", "metadataInstance"])
            assert observed["windowId"] or inactive_modal
            matching = [item["packet"] for item in callbacks if item["admitted"] and item["packet"]["ownerId"] == field["ownerId"] and item["packet"]["descriptorId"] == name and item["packet"]["descriptorRevision"] == field["descriptorRevision"] and item["packet"]["target"] == field["metadataTarget"] and item["packet"]["originalTarget"] == field["target"]]
            assert matching and (inactive_modal or any(packet["complete"] and packet["attached"] and packet["metadataOnly"] and packet["windowId"] == observed["windowId"] and packet["surfaceId"] == response["surfaceId"] for packet in matching))
            if platform == "ios" and inactive_modal:
                assert observed["probeSkipped"] == "inactive-window"
                assert not any(item["label"] == "Form prototype" and item["value"] == "Original editor metadata" for item in observed["customContentCurrent"])
            elif platform == "ios":
                assert observed["customContentBound"] and observed["originalEditorUnchanged"] and observed["delegateUnchanged"] and observed["unregisteredControlUnchanged"] and observed["unregisteredControlAfterUnchanged"]
                assert observed["customContentBefore"] == observed["customContentAfter"]
                assert observed["customContentDuring"] == observed["customContentBefore"] + [{"label":"Form prototype", "value":"Original editor metadata", "importance":0}]
            else: assert observed["sdk"]["editable"]
            if name in prior_targets:
                replaced = phase == "root-replaced" and name not in ["before", "after"]
                assert (prior_targets[name] != field["target"]) if replaced else (prior_targets[name] == field["target"])
                assert (prior_tokens[name] != tokens[name]) if replaced else (prior_tokens[name] == tokens[name])
            prior_targets[name] = field["target"]; prior_tokens[name] = tokens[name]
        if form_target is not None: assert (form_target != request["target"]) if phase == "root-replaced" else (form_target == request["target"])
        form_target = request["target"]
    assert len(controls) == 1, "Independent original native control was replaced"
    assert len(documents) == len(surfaces) == len(roots) == 1, "Modal/portal must remain one actual Fabric document"
    return {"outcome":"native-form-order-complete", "platform":platform, "producer":producer, "phases":list(ORDERS), "nativeMountCallbacks":len(callbacks), "nativeSnapshots":len(snapshots), "originalUIKitGetterRetirement":platform == "ios", "fullFamily":False, "fullGoal":False}
