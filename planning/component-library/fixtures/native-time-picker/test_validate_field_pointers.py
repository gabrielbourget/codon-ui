import copy
import json
import unittest

from test_inspect_field_receipts import fixture
from validate_field_pointers import CASES, SETUPS, validate


def journal():
    rows, reports = [], []
    token = 0
    def add(kind, **values):
        row = dict(kind=kind, probe="codon-owned-time-entry-01", producer="producer", sequence=len(rows) + 1, **values)
        rows.append(row)
        return row
    for index, name in enumerate(CASES):
        add("field-state", field="outer", value=None, valueClass=None, disabled=False, readonly=False, veto=False, stop=index == 2)
        add("native-receipts", batch=index * 2 + 1, records=[], dropped=0)
        reports.append(dict(case=SETUPS[index], batch=index * 2 + 1))
        records = []
        phases = ["pointer-start", "pointer-end", "pointer-click"] if index != 1 else ["pointer-start", "pointer-cancel"]
        for phase in phases:
            token += 1
            frame = copy.deepcopy(fixture()[-1]["records"][0])
            dispatch = json.loads(frame["event"]["fieldDispatch"])
            dispatch.update(token=token, eventId=token, phase=phase)
            dispatch["identity"].update(target=99, nativeInstance="tail", editorInstance="tail")
            for snapshot in [frame["before"], frame["after"]]:
                snapshot["instances"] = [dict(target=t, nativeInstance="tail" if t == 99 else str(t), editorInstance="tail" if t == 99 else str(t)) for t in [12, 13, 99, 22]]
                snapshot["originals"] = [dict(target=t, eligible=True, tabStop=True, placeholder=t != 22) for t in [12, 13, 22]]
            encoded = json.dumps(dispatch)
            frame.update(kind="pointer", event=dict(fieldDispatch=encoded), identity=copy.deepcopy(dispatch["identity"]), deliveryStarted=True, deliveryReturned=True, renderPhasesComplete=True, error="", decision="allowed")
            payload = dict(target=99, pointerId=index + 1, pointerType="touch", isPrimary=True, button=0, clientX=20, clientY=30)
            records.extend([dict(kind="original-pointer", token=token, eventId=token, payload=payload), frame])
            event = {**payload, "fieldDispatch":encoded}
            if index == 2 and phase == "pointer-start":
                add("child-pointer", field="outer", data={**event,"cancelBubble":True}, originalPayloadId=token, stopped=True)
            else:
                groups = dispatch["groups"][:1] if phase in {"pointer-start", "pointer-click"} else dispatch["groups"]
                for group in groups:add("group-pointer", field="outer", receiverTarget=group["target"], data=copy.deepcopy(event), originalPayloadId=token)
        if index == 0:
            records.append(dict(kind="focus", token=token, eventId=token, action="press", groupTarget=10, target=12, requested=True, observed=True, current=True, after=dict(focusedTarget=12)))
        if index == 2:add("child-press", field="outer", data=dict(target=99))
        add("native-receipts", batch=index * 2 + 2, records=records, dropped=0)
        reports.append(dict(case=name, batch=index * 2 + 2))
    return rows, reports


class PointerContracts(unittest.TestCase):
    def test_placeholder_release_and_scroll_do_not_close_adoption(self):
        rows, reports = journal()
        result = validate(rows, "producer", reports)
        self.assertEqual(result["pointerCheckpointContracts"], list(CASES))
        for flag in ["fullInputSurface", "fullFamily", "fullGoal"]: self.assertFalse(result[flag])

    def test_rejects_focus_before_click_wrong_placeholder_or_unobserved_focus(self):
        for values in [dict(token=1), dict(target=13, after=dict(focusedTarget=13)), dict(observed=False), dict(action="next")]:
            rows, reports = journal()
            batch = next(row for row in rows if row.get("batch") == 2)
            batch["records"][-1].update(values)
            with self.assertRaises(AssertionError): validate(rows, "producer", reports)

    def test_rejects_missing_contact_changed_owner_and_scroll_focus(self):
        for change in [lambda rows: rows[0].update(value="13:45:00"), lambda rows: rows[-1]["records"].append(dict(kind="focus")), lambda rows: next(row for row in rows[-1]["records"] if row["kind"] == "original-pointer")["payload"].update(pointerType="mouse")]:
            rows, reports = journal(); change(rows)
            with self.assertRaises(AssertionError): validate(rows, "producer", reports)
        rows, reports = journal()
        with self.assertRaises(AssertionError): validate(rows, "producer", reports[:-1])

    def test_rejects_noncontiguous_placeholders_and_reordered_native_candidates(self):
        for change in [lambda snapshot: snapshot["originals"][0].update(placeholder=False), lambda snapshot: snapshot["originals"].reverse()]:
            rows, reports = journal()
            batch = next(row for row in rows if row.get("batch") == 2)
            frames = [row for row in batch["records"] if row["kind"] == "pointer"]
            change(frames[-1]["before"])
            with self.assertRaises(AssertionError): validate(rows, "producer", reports)

    def test_rejects_missing_authored_action_and_changed_pointer_receiver(self):
        rows,reports=journal()
        next(row for row in rows if row["kind"]=="child-press")["field"]="inner"
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)
        rows,reports=journal()
        next(row for row in rows if row["kind"]=="group-pointer")["receiverTarget"]=99
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)


if __name__ == "__main__": unittest.main()
