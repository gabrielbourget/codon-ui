import unittest
from validate_sdk import EXPECTED, PROBE, validate


def fixture():
    rows = []
    def add(kind, **data): rows.append(dict(kind=kind, probe=PROBE, producer="producer", sequence=len(rows)+1, **data))
    for index, segment in enumerate(["hour", "minute", "second"]):
        add("native", readonly=False, disabled=False, originalRef=True, originalTarget=index+1, data=dict(kind="focus" if segment == "hour" else "status", ownerId="owner", segmentId=segment, bindingRevision="binding", windowId="window", target=index+1, surfaceId=1, nativeInstance="native-"+segment, epoch=1, sequence=1, active=True, focused=segment == "hour", text="", nativeData="{}"))
    add("native", readonly=False, disabled=False, originalRef=True, originalTarget=1, data=dict(kind="insert", ownerId="owner", segmentId="hour", bindingRevision="binding", windowId="window", target=1, surfaceId=1, nativeInstance="native-hour", epoch=1, sequence=2, active=True, focused=True, text="٢", nativeData='{"method":"insertText"}'))
    for index, (value, cls) in enumerate(EXPECTED):
        held = "13:45:07" if index < 3 else "2024-10-01T13:45:07" if index == 3 else "2024-10-01T13:45:07-04:00[America/New_York]"
        add("request", value=value, valueClass=cls, held=held, echo=index == 2)
    for _ in range(4): add("key", data=dict(phase="down", key="ArrowUp", nativeDefaultHandled=True))
    add("observation", readonly=True, data=dict(key="9", focusedTarget=1))
    requests = [row for row in rows if row["kind"] == "request"]
    add("snapshot", data=dict(readonly=True, disabled=False, focused="hour", requests=requests[:2], value="13:45:07", valueClass="Time", coreTarget=99))
    add("snapshot", data=dict(readonly=False, disabled=False, focused="minute", requests=requests[:3], value="08:45:07", valueClass="Time", coreTarget=99))
    add("snapshot", data=dict(readonly=False, disabled=False, hidden=True, focused=None, requests=requests, value="held", valueClass="ZonedDateTime", coreTarget=99))
    add("snapshot", data=dict(readonly=False, disabled=False, hidden=False, focused="hour", requests=requests, value="held", valueClass="ZonedDateTime", coreTarget=99))
    add("snapshot", data=dict(readonly=False, disabled=True, focused=None, requests=requests, value="2024-10-01T13:45:07-04:00[America/New_York]", valueClass="ZonedDateTime", coreTarget=99, scopeReady=True))
    return rows


class Integrity(unittest.TestCase):
    def test_scope_is_explicit(self):
        result = validate(fixture(), "producer")
        self.assertTrue(result["sdkInputPrerequisite"])
        self.assertFalse(result["fullIME"])
        self.assertFalse(result["fullFamily"])

    def test_rejects_source_only_or_foreign_native_instance(self):
        for mutate in [lambda rows: rows[3]["data"].update(nativeInstance="replacement"), lambda rows: rows[3].update(originalRef=False), lambda rows: rows[3]["data"].update(nativeData="{}")]:
            rows = fixture(); mutate(rows)
            with self.assertRaises((AssertionError, KeyError)): validate(rows, "producer")

    def test_rejects_wrong_class_missing_physical_key_and_duplicate_commit(self):
        for mutate in [lambda rows: rows[4].update(valueClass="foreign"), lambda rows: rows[10]["data"].update(key="fake"), lambda rows: rows[9].update(value="duplicate")]:
            rows = fixture(); mutate(rows)
            with self.assertRaises(AssertionError): validate(rows, "producer")

    def test_rejects_independent_editor_changes(self):
        rows = fixture(); rows[-1]["data"]["coreTarget"] = 100
        with self.assertRaises(AssertionError): validate(rows, "producer")


if __name__ == "__main__": unittest.main()
