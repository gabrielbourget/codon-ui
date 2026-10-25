import copy
import json
import unittest

from test_inspect_field_receipts import fixture
from validate_field_key_profiles import CASES, MODIFIERS, validate


def journal():
    rows, reports = [], []
    token = 0
    def add(kind, **values):
        row = dict(kind=kind, probe="codon-owned-time-entry-01", producer="producer", sequence=len(rows) + 1, **values)
        rows.append(row)
        return row
    def frame(target, phase, mask):
        nonlocal token
        token += 1
        native = copy.deepcopy(fixture()[-1]["records"][0])
        dispatch = json.loads(native["event"]["fieldDispatch"])
        inner = target in {44, 45}
        dispatch.update(token=token, eventId=token, phase=phase)
        dispatch["identity"].update(target=target, nativeInstance="component:"+str(target), editorInstance="editor:"+str(target))
        dispatch["groups"] = dispatch["groups"][-1:]
        if inner:
            dispatch["identity"].update(ownerId="inner",bindingId="inner-binding",bindingRevision="inner-revision",metadataTarget=55,outerTarget=50,inputTarget=51,outerInstance="inner-outer",inputInstance="inner-input")
            dispatch["groups"] = [dict(target=t,bindingId="inner-binding" if t!=10 else "binding",bindingRevision="inner-revision" if t!=10 else "revision",scopeTarget=50 if t!=10 else 10,containsTarget=True) for t in [51,50,10]]
        event = dict(key="ArrowRight", phase=phase, target=target, repeat=False, capsLock=False, nativeCode=79, nativeModifierData=str(mask), fieldDispatch=json.dumps(dispatch), **{name:bool(mask & (1<<bit)) for bit,name in enumerate(MODIFIERS)})
        native.update(event=event, identity=copy.deepcopy(dispatch["identity"]), deliveryStarted=True,deliveryReturned=True,renderPhasesComplete=True,error="",decision="prevented" if phase=="down" else "allowed",originalDefaultPrevented=phase=="down")
        for snapshot in [native["before"], native["after"]]:
            for name in ["outerTarget","inputTarget","outerInstance","inputInstance"]:snapshot[name]=dispatch["identity"][name]
            snapshot["focusedTarget"]=target
            snapshot["instances"]=[dict(target=t,nativeInstance="component:"+str(t),editorInstance="editor:"+str(t)) for t in [12,22,33,44,45]]
            snapshot["originals"]=[dict(target=t,eligible=True,tabStop=t!=22) for t in ([44,45] if inner else [12,22,33,44,45])]
        return native,dispatch
    for profile,name in enumerate(CASES):
        for field,root,value,value_class in [("outer",10,None,None),("inner",50,"08:15:00","Time")]:
            add("field-state",field=field,outerTarget=root,buttonTarget=12,disabled=False,readonly=False,direction="ltr",value=value,valueClass=value_class)
        add("native-receipts",batch=profile*2+1,records=[],dropped=0)
        reports.append(dict(case=name+"-setup",batch=profile*2+1))
        records=[]
        targets=[12,22] if profile<16 else [12,22,33,44,45]
        mask=profile if profile<16 else 0
        for current,next_target in zip(targets,targets[1:]):
            down,dispatch=frame(current,"down",mask)
            down["after"]["focusedTarget"]=next_target
            up,up_dispatch=frame(next_target,"up",mask)
            focus=dict(kind="focus",token=dispatch["token"],eventId=dispatch["eventId"],action="next",groupTarget=dispatch["identity"]["outerTarget"],target=next_target,requested=True,observed=True,current=True,after=copy.deepcopy(down["after"]))
            records.extend([focus,down,up])
            for native,packet,groups in [(down,dispatch,dispatch["groups"][:1]),(up,up_dispatch,up_dispatch["groups"])]:
                for group in groups:add("field-key",field="inner" if group["scopeTarget"]==50 else "outer",receiverTarget=group["target"],data=copy.deepcopy(native["event"]),originalPayloadId=packet["token"])
        add("native-receipts",batch=profile*2+2,records=records,dropped=0)
        reports.append(dict(case=name,batch=profile*2+2))
    return rows,reports


class KeyProfiles(unittest.TestCase):
    def change_event(self, rows, batch, name, value):
        event=next(row for row in rows if row.get("batch")==batch)["records"][1]["event"]
        event[name]=value
        for row in rows:
            if row["kind"]=="field-key" and row["data"]["fieldDispatch"]==event["fieldDispatch"]:row["data"][name]=value

    def test_complete_modifier_and_consecutive_matrix_keeps_unpaced_repeat_and_adoption_open(self):
        rows,reports=journal();result=validate(rows,"producer",reports)
        self.assertEqual(result["keyProfileContracts"],list(CASES))
        for flag in ["unpacedHardwareBurst","hardwareRepeat","fullInputSurface","fullFamily","fullGoal"]:self.assertFalse(result[flag])

    def test_rejects_missing_profile_or_changed_native_modifier(self):
        rows,reports=journal()
        with self.assertRaises(AssertionError):validate(rows,"producer",reports[:-1])
        rows,reports=journal()
        self.change_event(rows,32,"metaKey",False)
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)

    def test_rejects_stale_next_key_target_and_skipped_negative_stop(self):
        for profile in [0,16]:
            rows,reports=journal()
            batch=next(row for row in rows if row.get("batch")==profile*2+2)
            next(row for row in batch["records"] if row["kind"]=="focus")["target"]=33
            with self.assertRaises(AssertionError):validate(rows,"producer",reports)
        rows,reports=journal()
        next(row for row in rows if row.get("batch")==34)["records"][4]["before"]["focusedTarget"]=12
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)

    def test_rejects_wrong_focus_token_lost_key_up_or_replaced_editor(self):
        for change in [lambda records: records[0].update(token=99), lambda records: records.pop(), lambda records: records[0]["after"]["instances"][1].update(editorInstance="replacement")]:
            rows,reports=journal()
            change(next(row for row in rows if row.get("batch")==2)["records"])
            with self.assertRaises(AssertionError):validate(rows,"producer",reports)

    def test_rejects_reordered_group_owner_and_unexpected_repeat(self):
        rows,reports=journal()
        next(row for row in rows if row["kind"]=="field-key" and row["field"]=="inner")["field"]="outer"
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)
        rows,reports=journal()
        self.change_event(rows,2,"repeat",True)
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)


if __name__=="__main__":unittest.main()
