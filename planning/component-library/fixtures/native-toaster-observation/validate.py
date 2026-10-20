"""Validate original Android callback records and independently read native editor nodes."""
import json

PROBE = "codon-native-toaster-observation-v1"
PRODUCER = "c2e4fded89f666f2b4097fa7a82f545487841f72"


def parse_records(text):
    records = []
    seen = {}
    marker = "CUI_TOASTER_OBSERVATION "
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if marker not in line:
            continue
        try:
            record, _ = json.JSONDecoder().raw_decode(line.split(marker, 1)[1])
        except json.JSONDecodeError:
            if index == len(lines) - 1 and not text.endswith("\n"):
                continue
            raise
        if record.get("probe") != PROBE:
            continue
        ordinal = record["sequence"]
        if ordinal in seen:
            assert seen[ordinal] == record, "conflicting transport sequence"
            continue
        seen[ordinal] = record
        records.append(record)
    return records


def validate(records, editor_nodes):
    assert records and [row["sequence"] for row in records] == list(range(1, len(records) + 1)), "complete ordered journal"
    assert all(row.get("probe") == PROBE for row in records), "probe identity"
    begin = [row for row in records if row.get("kind") == "begin"]
    assert len(begin) == 1 and begin[0]["libraryProducer"] == PRODUCER, "exact library/session identity"
    assert not any(row.get("kind") == "failure" for row in records), "native fixture failure"
    complete = [row for row in records if row.get("kind") == "complete"]
    assert len(complete) == 1 and complete[0]["ownerValue"] == "eeeee", "terminal receipt and exact owner"
    focused = [row for row in records if row.get("kind") == "editor-focus"]
    assert focused and isinstance(focused[0]["editorTag"], int), "original native editor focus"
    target = focused[0]["editorTag"]
    assert focused[0]["actual"]["target"] == target, "actual ref matches original native focus"
    callbacks = [row for row in records if row.get("kind") == "observed-key"]
    b = [row for row in callbacks if row["observer"] == "B"]
    assert b and len({(row["actual"]["ownerId"], row["actual"]["windowId"], row["actual"]["epoch"], row["actual"]["eventId"]) for row in b}) == len(b), "at-most-once live listener delivery"
    for row in b:
        actual = row["actual"]
        assert actual["ownerId"] and actual["windowId"] and actual["epoch"] > 0, "actual native window/epoch"
        assert actual["timestamp"] > 0 and actual["eventId"] > 0, "native clock/event identity"
        assert actual["focusedTarget"] == target, "actual editor target retained"
        assert not actual["defaultCaptured"] and not actual["cancelled"], "passive unconsumed packet"
    e = [row for row in b if row["actual"]["code"] == "KeyE"]
    a = [row for row in callbacks if row["observer"] == "A" and row["actual"]["code"] == "KeyE"]
    assert len(e) == 5 and len(a) == 1, "five genuine E inputs and one retired A callback"
    assert all(row["actual"]["nativeCode"] == 33 and row["actual"]["key"] == "e" for row in e), "physical/logical native identity"
    assert a[0]["sequence"] < e[0]["sequence"] and a[0]["packetToken"] == e[0]["packetToken"], "original shared event and listener order"
    assert a[0]["actual"] == e[0]["actual"] and len(e[0]["actual"]["observerIds"]) == 4, "two probes and two actual empty Toasters"
    retired = [row for row in records if row.get("kind") == "observer-A-commit" and row["mounted"] is False]
    assert len(retired) == 1 and e[0]["sequence"] < retired[0]["sequence"] < e[1]["sequence"], "committed retirement before next input"
    changes = [row for row in records if row.get("kind") == "editor-change"]
    assert [row["actual"]["text"] for row in changes] == ["e", "ee", "eee", "eeee", "eeeee"], "native downstream editor changes"
    for change in changes:
        prior = [row for row in records if row.get("kind") == "owner-commit" and row["sequence"] < change["sequence"]]
        assert prior and prior[-1]["value"] == change["ownerBefore"], "confirmed owner progression"
    counts = [row["actual"]["eventCount"] for row in changes]
    assert all(isinstance(value, int) for value in counts) and counts == sorted(set(counts)), "original native editor event counters"
    for name, expected in [("first-e", "e"), ("second-e", "ee"), ("burst", "eeee"), ("repeat", "eeee"), ("resumed-e", "eeeee")]:
        node = editor_nodes[name]
        assert node["text"] == expected and node["focused"] == "true", "independent native editor value/focus: " + name
    rights = [row for row in b if row["actual"]["code"] == "ArrowRight"]
    assert len(rights) == 2 and [row["actual"]["repeat"] for row in rights] == [False, True], "original native key repeat"
    assert all(row["actual"]["nativeCode"] == 22 for row in rights), "native repeat key identity"
    selection = [row for row in records if row.get("kind") == "editor-selection"]
    home = [row for row in selection if row["actual"]["selection"] == {"start": 0, "end": 0} and e[3]["sequence"] < row["sequence"] < e[-1]["sequence"]]
    assert home, "native Home moves selection to zero"
    assert any(row["actual"]["selection"] == {"start": 2, "end": 2} and home[-1]["sequence"] < row["sequence"] < e[-1]["sequence"] for row in selection), "native repeated Right advances selection"
    inactive = [row for row in records if row.get("kind") == "scope" and row.get("active") is False and rights[-1]["sequence"] < row["sequence"] < e[-1]["sequence"]]
    assert inactive, "actual window deactivation"
    assert any(row.get("kind") == "scope" and row.get("active") is True and inactive[-1]["sequence"] < row["sequence"] < e[-1]["sequence"] for row in records), "actual window reactivation"
    assert e[-1]["actual"]["observationRevision"] > rights[-1]["actual"]["observationRevision"], "current observer generation after window loss"
    assert not set(e[-1]["actual"]["observerIds"]).intersection(rights[-1]["actual"]["observerIds"]), "retired window observer identities cannot reappear"
    return {"scope": "Android original callbacks/native editor nodes; two empty Toasters; no full Toaster acceptance", "fontScale": begin[0]["fontScale"], "assertions": ["passive-native-key-and-editor-default", "physical-key-identity", "ordered-shared-event-listeners", "retirement-preserves-live-listener", "native-repeat-and-default-selection", "window-retirement-and-resume"], "nativeKeyPackets": len(b), "originalEditorChanges": len(changes), "inspector": "Android UiAutomator native editor nodes", "fullAcceptance": False}
