"""Inspect combined prototype custody. Integrity never establishes native acceptance."""
import json

PROBE = "codon-owned-time-entry-01"
CALLBACKS = {"segment-key", "field-key", "child-key", "core-key", "segment-input", "group-pointer", "field-pointer", "child-pointer"}
IDENTITY_FIELDS = {"ownerId", "bindingId", "bindingRevision", "metadataTarget", "outerTarget", "inputTarget", "surfaceId", "target", "documentId", "documentRevision", "windowId", "mountRevision", "outerInstance", "inputInstance", "nativeInstance", "editorInstance", "epoch"}
PHASES = {"down", "up", "cancel", "input", "pointer-start", "pointer-end", "pointer-cancel", "pointer-click"}


def positive(value):
    assert type(value) is int and 0 < value <= 9007199254740991, "Invalid original integer identity"
    return value


def packet(value):
    data = json.loads(value)
    assert set(data) == {"moduleLease", "token", "eventId", "phase", "identity", "groups"}, "Invalid original dispatch packet"
    assert isinstance(data["moduleLease"], str) and data["moduleLease"] and data["phase"] in PHASES
    positive(data["token"]); positive(data["eventId"])
    identity = data["identity"]
    assert set(identity) == IDENTITY_FIELDS, "Incomplete original native identity"
    for name in IDENTITY_FIELDS:
        if name in {"metadataTarget", "outerTarget", "inputTarget", "surfaceId", "target", "epoch"}: positive(identity[name])
        else: assert isinstance(identity[name], str) and identity[name], "Missing original scope identity"
    assert identity["outerTarget"] != identity["inputTarget"]
    assert isinstance(data["groups"], list) and data["groups"], "Missing original group path"
    targets = []
    for group in data["groups"]:
        assert set(group) == {"target", "bindingId", "bindingRevision", "scopeTarget"}
        positive(group["target"]); positive(group["scopeTarget"])
        assert all(isinstance(group[name], str) and group[name] for name in ["bindingId", "bindingRevision"])
        targets.append(group["target"])
    assert len(targets) == len(set(targets)), "Duplicate original group receiver"
    return data


def snapshot_identity(snapshot, identity):
    for name in ["documentId", "surfaceId", "windowId", "outerTarget", "inputTarget", "outerInstance", "inputInstance"]:
        assert snapshot[name] == identity[name], "Original native scope changed"
    originals = [row for row in snapshot["instances"] if row["target"] == identity["target"]]
    assert len(originals) == 1, "Original native target missing or ambiguous"
    for name in ["nativeInstance", "editorInstance"]:
        assert originals[0][name] == identity[name], "Original native object replaced"


def key(data):
    return data["moduleLease"], data["token"], data["eventId"], data["phase"]


def inspect(rows, producer):
    assert rows, "No original combined journal"
    for index, row in enumerate(rows):
        assert row["probe"] == PROBE and row["producer"] == producer and row["sequence"] == index + 1, "Wrong original journal identity/order"
    batches = [row for row in rows if row["kind"] == "native-receipts"]
    assert batches, "No original native receipt batch"
    native = []
    for batch in batches:
        assert type(batch["dropped"]) is int and batch["dropped"] == 0, "Original native records were dropped"
        assert isinstance(batch["records"], list)
        native.extend(batch["records"])
    frames = {}
    for record in native:
        if record["kind"] not in {"key", "pointer", "input"}: continue
        dispatch = packet(record["event"]["fieldDispatch"])
        identity = key(dispatch)
        assert identity not in frames, "Duplicate original native frame"
        assert record["identity"] == dispatch["identity"], "Native frame identity changed"
        snapshot_identity(record["before"], dispatch["identity"])
        if record["scopeCurrent"]:
            assert record["after"], "Current native turn lacks its after observation"
            snapshot_identity(record["after"], dispatch["identity"])
        frames[identity] = record, dispatch
    assert frames, "No original native dispatch frames"
    children = {}; original_inputs = {}
    for identity, (record, parent) in frames.items():
        for child in record.get("inputSubphases", []):
            child_key = parent["moduleLease"], child["token"], child["eventId"], child["phase"]
            assert child_key not in frames and child_key not in children, "Duplicate original input subphase"
            children[child_key] = child
    for record in native:
        if record["kind"] == "original-input":
            child_key = record["token"], record["eventId"]
            assert child_key not in original_inputs, "Duplicate original input payload"
            original_inputs[child_key] = record["payload"]
    callbacks = {}; payload_ids = {}; payload_frames = {}; unjoined = []; pending_subphases = []
    for row in rows:
        if row["kind"] not in CALLBACKS: continue
        data = row["data"]
        if not data.get("fieldDispatch"):
            unjoined.append(row["sequence"])
            continue
        dispatch = packet(data["fieldDispatch"]); identity = key(dispatch)
        if identity in frames:
            record, original = frames[identity]
            assert dispatch == original, "Source packet differs from original native packet"
            if record["kind"] != "input": assert data == record["event"], "Original public event payload changed"
        else:
            assert identity in children, "Source callback has no original native frame"
            child = children[identity]
            assert dispatch["identity"] == child["identity"], "Original input subphase identity changed"
            payload_key = dispatch["token"], dispatch["eventId"]
            assert payload_key in original_inputs, "Original input payload missing"
            for name, value in original_inputs[payload_key].items():
                assert data.get(name) == value, "Original input argument changed"
            pending_subphases.append(row["sequence"])
        payload = positive(row["originalPayloadId"])
        assert payload_ids.setdefault(identity, payload) == payload, "Original event payload was replaced between receivers"
        assert payload_frames.setdefault(payload, identity) == identity, "Original payload identity reused for another native turn"
        callbacks.setdefault(identity, []).append(row)
    for identity, receivers in callbacks.items():
        if identity not in frames: continue
        groups = frames[identity][1]["groups"]
        expected = [group["target"] for group in groups]
        actual = [row["receiverTarget"] for row in receivers if row["kind"] == "field-key"]
        assert actual == expected[:len(actual)], "Original group order/membership changed"
        assert len(actual) == len(set(actual)), "Original group callback duplicated"
    commands = [record for record in native if record["kind"] == "command-native"]
    frame_tokens = {identity[1] for identity in frames} | {identity[1] for identity in children}
    for command in commands:
        assert positive(command["token"]) in frame_tokens, "Original command has no native dispatch turn"
        positive(command["target"])
        assert isinstance(command["command"], str) and command["command"]
        if command["callbackCompleted"] and command["current"] and not command["error"]:
            assert command["before"] and command["after"], "Command completion lacks actual native observations"
    return {"receiptIntegrity": True, "nativeFrames": len(frames), "joinedCallbacks": sum(map(len, callbacks.values())), "unjoinedCallbackSequences": unjoined, "subphaseGroupCustodyNotYetVerified": pending_subphases, "nativeFailures": [record for record in native if record["kind"] == "failure"], "nativeCommands": len(commands), "fullInputSurface": False, "fullFamily": False, "fullGoal": False, "scope": "Original receipt joins only; complete native scenario trial and acceptance parser remain required"}
