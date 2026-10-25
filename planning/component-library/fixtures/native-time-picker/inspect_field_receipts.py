"""Inspect combined prototype custody. Integrity never establishes native acceptance."""
import json

PROBE = "codon-owned-time-entry-01"
CALLBACKS = {"segment-key", "field-key", "child-key", "core-key", "segment-input", "group-pointer", "field-pointer", "child-pointer", "original-command-call", "original-command-return", "mutation-call", "mutation-return"}
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
        assert set(group) == {"target", "bindingId", "bindingRevision", "scopeTarget", "containsTarget"}
        assert type(group["containsTarget"]) is bool
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
    children = {}; original_inputs = {}; original_pointers = {}
    for identity, (record, parent) in frames.items():
        for child in record.get("inputSubphases", []):
            child_key = parent["moduleLease"], child["token"], child["eventId"], child["phase"]
            assert child_key not in frames and child_key not in children, "Duplicate original input subphase"
            children[child_key] = child
    for record in native:
        if record["kind"] == "original-pointer":
            pointer_key = positive(record["token"]), positive(record["eventId"])
            assert pointer_key not in original_pointers, "Duplicate original pointer payload"
            parents = [(identity, frame) for identity, (frame, dispatch) in frames.items() if identity[1:3] == pointer_key and frame["kind"] == "pointer"]
            assert len(parents) == 1, "Original pointer payload has no unique native turn"
            original_pointers[pointer_key] = record["payload"]
        if record["kind"] == "original-input":
            child_key = record["token"], record["eventId"]
            assert child_key not in original_inputs, "Duplicate original input payload"
            original = packet(json.dumps(record["packet"]))
            assert (original["token"], original["eventId"]) == child_key, "Native input packet belongs to another subphase"
            assert key(original) in children, "Native input packet has no parent subphase result"
            assert original["identity"] == children[key(original)]["identity"], "Native input packet scope differs from parent result"
            original_inputs[child_key] = record["payload"], original
    callbacks = {}; payload_ids = {}; payload_frames = {}; unjoined = []
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
            if record["kind"] == "pointer":
                pointer_key = dispatch["token"], dispatch["eventId"]
                assert pointer_key in original_pointers, "Original native pointer payload missing"
                original = original_pointers[pointer_key]
                assert "fieldDispatch" not in original, "Original SDK pointer already contains a dispatch packet"
                public_payload(data, {**original, "fieldDispatch": record["event"]["fieldDispatch"]})
            elif record["kind"] != "input": public_payload(data, record["event"])
        else:
            assert identity in children, "Source callback has no original native frame"
            child = children[identity]
            assert dispatch["identity"] == child["identity"], "Original input subphase identity changed"
            payload_key = dispatch["token"], dispatch["eventId"]
            assert payload_key in original_inputs, "Original input payload missing"
            payload, original = original_inputs[payload_key]
            assert dispatch == original, "Original native subphase group packet changed"
            for name, value in payload.items():
                assert data.get(name) == value, "Original input argument changed"
        payload = positive(row["originalPayloadId"])
        assert payload_ids.setdefault(identity, payload) == payload, "Original event payload was replaced between receivers"
        assert payload_frames.setdefault(payload, identity) == identity, "Original payload identity reused for another native turn"
        callbacks.setdefault(identity, []).append(row)
    for identity, receivers in callbacks.items():
        if identity in frames: groups = frames[identity][1]["groups"]
        else: groups = original_inputs[(identity[1], identity[2])][1]["groups"]
        expected = [group["target"] for group in groups]
        actual = [row["receiverTarget"] for row in receivers if row["kind"] in {"field-key", "group-pointer"}]
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
    return {"receiptIntegrity": True, "nativeFrames": len(frames), "joinedCallbacks": sum(map(len, callbacks.values())), "unjoinedCallbackSequences": unjoined, "nativeSubphasePackets": len(original_inputs), "nativePointerPayloads": len(original_pointers), "nativeFailures": [record for record in native if record["kind"] == "failure"], "nativeCommands": len(commands), "fullInputSurface": False, "fullFamily": False, "fullGoal": False, "scope": "Original receipt joins only; complete native scenario trial and acceptance parser remain required"}


def public_payload(data, original):
    # React's SyntheticEvent writes these flags onto the same original native payload.
    cancellation = {"cancelBubble": True, "returnValue": False}
    assert set(data) <= set(original) | set(cancellation), "Unexpected public payload property"
    for name, value in original.items():
        if name in cancellation and data.get(name) is cancellation[name]: continue
        assert name in data and same_argument(data[name], value), "Original public argument changed"
    for name, value in cancellation.items():
        if name not in original and name in data:
            assert data[name] is value, "Invalid React cancellation flag"


def same_argument(actual, original):
    # JS has one numeric type; folly and JSON.stringify may encode 1.0 and 1.
    if type(actual) in {int, float} and type(original) in {int, float}: return actual == original
    if type(actual) is not type(original): return False
    if isinstance(original, dict): return actual.keys() == original.keys() and all(same_argument(actual[name], value) for name, value in original.items())
    if isinstance(original, list): return len(actual) == len(original) and all(same_argument(a, b) for a, b in zip(actual, original))
    return actual == original


def validate_combined(rows, producer, checkpoints):
    from validate_field_descendants import validate as descendants, validate_portals
    from validate_field_pointers import validate as pointers, validate_streams
    from validate_field_key_profiles import validate as key_profiles, completed
    from validate_field_mutations import validate as mutations, validate_busy
    integrity = inspect(rows, producer)
    assert not integrity["nativeFailures"], "Combined original native input failed"
    reports = {row["case"]: row for row in checkpoints}
    assert len(reports) == len(checkpoints), "Duplicate original trial checkpoint"
    batches = {row["batch"]: row for row in rows if row["kind"] == "native-receipts"}
    values = [
        ("Time", "13:45:07", "14:45:07"),
        ("CalendarDateTime", "2024-10-01T13:45:07", "2024-10-01T14:45:07"),
        ("ZonedDateTime", "2024-10-01T13:45:07-04:00[America/New_York]", "2024-10-01T14:45:07-04:00[America/New_York]"),
    ]
    matched_values = []
    previous = 0
    original_hour = None
    for value_class, held, requested in values:
        for arabic in [False, True]:
            name = "original-" + value_class + ("-Arabic-veto" if arabic else "-veto")
            assert name in reports, "Missing original TimeValue/locale trial"
            batch = batches[reports[name]["batch"]]
            source = [row for row in rows if previous < row["sequence"] < batch["sequence"]]
            requests = [row for row in source if row["kind"] == "value-request"]
            assert len(requests) == 1, "TimeValue request missing or repeated"
            request = requests[0]
            assert all(request[key] == value for key, value in dict(field="outer", value=requested, valueClass=value_class, held=held, heldClass=value_class, echo=False).items())
            states = [row for row in source if row["kind"] == "field-state" and row["field"] == "outer"]
            assert states and states[-1]["value"] == held and states[-1]["valueClass"] == value_class
            assert states[-1]["locale"] == ("ar-EG" if arabic else "en-GB")
            assert states[-1]["direction"] == ("rtl" if arabic else "ltr")
            frames = [row for row in batch["records"] if row["kind"] == "key" and row["event"].get("key") == "ArrowUp"]
            assert [packet(row["event"]["fieldDispatch"])["phase"] for row in frames] == ["down", "up"]
            for frame in frames: completed(frame)
            if original_hour is None: original_hour = frames[0]["identity"]
            for frame in frames:
                assert all(frame["identity"][key] == original_hour[key] for key in ["target", "nativeInstance", "editorInstance", "windowId"]), "TimeValue/locale replacement changed the original hour"
            previous = batch["sequence"]
            matched_values.append(name)
    for guard in ["readonly", "disabled"]:
        name = "original-" + guard + "-key-refusal"
        assert name in reports, "Missing original guarded-input trial"
        report = reports[name]
        observations = [row for row in report["observations"] if row["field"] == "outer" and row[guard] is True and row["data"]["key"] == "9"]
        assert observations and observations[-1]["data"]["focusedTarget"] == original_hour["target"]
        assert not any(row["kind"] == "value-request" for row in rows if previous < row["sequence"] < batches[report["batch"]]["sequence"]), "Guarded original input changed the owner"
        previous = batches[report["batch"]]["sequence"]
    outcomes = {
        "values": matched_values,
        "descendants": descendants(rows, producer, checkpoints),
        "pointers": pointers(rows, producer, checkpoints),
        "pointerStreams": validate_streams(rows, producer, checkpoints),
        "keyProfiles": key_profiles(rows, producer, checkpoints),
        "mutations": mutations(rows, producer, checkpoints),
        "portals": validate_portals(rows, producer, checkpoints),
        "busyJS": validate_busy(rows, producer, checkpoints),
    }
    assert "unicode-original-setup" in reports and "unicode-original-commit" in reports, "Missing original Unicode insert trial"
    start = batches[reports["unicode-original-setup"]["batch"]]["sequence"]
    end = batches[reports["unicode-original-commit"]["batch"]]["sequence"]
    source = [row for row in rows if start < row["sequence"] < end]
    edits = [row for row in source if row["kind"] == "segment-input" and row["field"] == "outer" and row["data"]["kind"] == "insert" and row["data"]["text"] == "٢"]
    assert len(edits) == 1 and json.loads(edits[0]["data"]["nativeData"])["method"], "Original SDK Unicode insert missing or repeated"
    assert edits[0]["originalTarget"] == edits[0]["data"]["target"]
    unicode_requests = [row for row in source if row["kind"] == "value-request"]
    assert len(unicode_requests) == 1 and unicode_requests[0]["value"] == "2024-10-01T02:45:07-04:00[America/New_York]"
    assert unicode_requests[0]["valueClass"] == "ZonedDateTime" and unicode_requests[0]["echo"] is False
    candidate_cases = [
        ("candidate-owned-entry", "ArrowUp", None),
        ("candidate-original-control", "ArrowRight", "next"),
        ("candidate-rtl-right", "ArrowLeft", "physical-right"),
        ("candidate-rtl-left", "ArrowRight", "physical-left"),
    ]
    for name, key_name, action in candidate_cases:
        assert name in reports and name+"-setup" in reports, "Incomplete actual TimePicker candidate trial"
        start = batches[reports[name+"-setup"]["batch"]]["sequence"]
        batch = batches[reports[name]["batch"]]
        source = [row for row in rows if start < row["sequence"] < batch["sequence"]]
        native = batch["records"]
        frames = [row for row in native if row["kind"] == "key" and row["event"].get("key") == key_name]
        assert [packet(row["event"]["fieldDispatch"])["phase"] for row in frames] == ["down", "up"]
        for frame in frames:
            completed(frame)
            dispatch = packet(frame["event"]["fieldDispatch"])
            callbacks = [row for row in source if row["kind"] == "field-key" and key(packet(row["data"]["fieldDispatch"])) == key(dispatch)]
            groups = dispatch["groups"][:1] if action and dispatch["phase"] == "down" else dispatch["groups"]
            assert [row["receiverTarget"] for row in callbacks] == [group["target"] for group in groups]
            assert all(row["field"] == "candidate" for row in callbacks), "Candidate used the prototype's caller"
        requests = [row for row in source if row["kind"] == "value-request"]
        if action is None:
            assert len(requests) == 1 and all(requests[0][key] == value for key,value in dict(field="candidate", value="14:45:07", held="13:45:07", valueClass="Time", heldClass="Time", echo=False).items())
        else:
            assert not requests
            focuses = [row for row in native if row["kind"] == "focus"]
            assert len(focuses) == 1
            focus = focuses[0]
            assert focus["action"] == action and all(focus[flag] is True for flag in ["requested", "observed", "current"])
            assert focus["token"] == packet(frames[0]["event"]["fieldDispatch"])["token"]
            assert focus["target"] == frames[1]["identity"]["target"]
            if action.startswith("physical-"):
                before = frames[0]["before"]
                origin = next(row["rect"]["x"] for row in before["originals"] if row["target"] == frames[0]["identity"]["target"])
                candidates = [row for row in before["originals"] if row["eligible"] and row["tabStop"] and
                              ((row["rect"]["x"] > origin) if action == "physical-right" else (row["rect"]["x"] < origin))]
                assert candidates and focus["target"] == min(candidates,key=lambda row: abs(row["rect"]["x"]-origin))["target"], "Candidate skipped the current nearest native geometry"
    outcomes["actualTimePickerCandidate"] = [row[0] for row in candidate_cases]
    return {"combinedCheckpointContracts": outcomes, "nativeReceiptIntegrity": True, "originalUnicodeInsert": True,
            "fullInputSurface": False, "fullIME": False, "hardwareBurst": False, "hardwareRepeat": False,
            "fullFamily": False, "fullGoal": False}
