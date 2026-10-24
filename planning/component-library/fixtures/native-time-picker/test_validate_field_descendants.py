import copy
import json
import unittest
from test_inspect_field_receipts import fixture
from validate_field_descendants import CASES, SETUPS, validate


def journal():
    rows=[];reports=[]
    def add(kind, **values):
        row=dict(kind=kind,probe="codon-owned-time-entry-01",producer="producer",sequence=len(rows)+1,**values)
        rows.append(row)
        return row
    for index,name in enumerate(CASES):
        template=fixture();native=copy.deepcopy(template[-1]["records"][0])
        dispatch=json.loads(template[0]["data"]["fieldDispatch"])
        dispatch.update(token=index+1,eventId=index+1)
        if index==2:
            dispatch["identity"].update(target=22,nativeInstance="negative-component",editorInstance="negative-editor")
        if 3<=index<=5:
            dispatch["identity"].update(target=33,nativeInstance="core-component",editorInstance="core-editor")
        dispatch["groups"]=dispatch["groups"][-1:]
        if index>=6:
            target=44 if index==6 else 45
            dispatch["identity"].update(ownerId="inner",bindingId="inner-binding",bindingRevision="inner-revision",outerTarget=50,inputTarget=51,outerInstance="inner-outer",inputInstance="inner-input",target=target,nativeInstance=str(target),editorInstance=str(target))
            dispatch["groups"]=[dict(target=t,bindingId="inner-binding" if t!=10 else "binding",bindingRevision="inner-revision" if t!=10 else "revision",scopeTarget=50 if t!=10 else 10) for t in [51,50,10]]
        event=dict(key="ArrowRight" if index in {0,1,2,5,6} else "7" if index==3 else "9" if index==4 else "ArrowUp",target=dispatch["identity"]["target"],phase="down",fieldDispatch=json.dumps(dispatch))
        native.update(event=event,identity=copy.deepcopy(dispatch["identity"]),deliveryStarted=True,deliveryReturned=True,renderPhasesComplete=True,error="",decision="prevented" if index in {1,2,4,5,6,7} else "allowed",originalDefaultPrevented=index in {1,2,4,5,6,7})
        for snapshot in [native["before"],native["after"]]:
            snapshot["instances"]=[dict(target=dispatch["identity"]["target"],nativeInstance=dispatch["identity"]["nativeInstance"],editorInstance=dispatch["identity"]["editorInstance"])]
            snapshot["focusedTarget"]=dispatch["identity"]["target"]
            snapshot["originals"]=[dict(target=target,eligible=True,tabStop=target!=22) for target in ([44,45] if index>=6 else [12,22,33,44,45])]
            for field in ["outerTarget","inputTarget","outerInstance","inputInstance"]:snapshot[field]=dispatch["identity"][field]
        add("native-receipts",batch=index*2+1,records=[],dropped=0)
        reports.append(dict(case=SETUPS[index],batch=index*2+1,nativeValues={}))
        add("field-state",field="outer",outerTarget=10,disabled=False,readonly=False,stop=index==0,veto=index==4,direction="ltr",echo=False,value=None,valueClass=None)
        add("field-state",field="inner",outerTarget=50,disabled=False,readonly=False,stop=False,veto=False,direction="ltr",echo=False,value="08:15:00",valueClass="Time")
        if index<2:add("child-key",field="outer",data=copy.deepcopy(event),originalPayloadId=index+1)
        if index==7:
            add("segment-key",field="inner",data=copy.deepcopy(event),originalPayloadId=index+1)
            add("value-request",field="inner",value="08:16:00",valueClass="Time",held="08:15:00",heldClass="Time",echo=False)
        if index>0:
            for group in (dispatch["groups"][:1] if index in {1,2,5,6} else dispatch["groups"]):add("field-key",field="inner" if group["scopeTarget"]==50 else "outer",receiverTarget=group["target"],data=copy.deepcopy(event),originalPayloadId=index+1)
        records=[native]
        if index in {1,2,5,6}:
            target={1:22,2:33,5:44,6:45}[index]
            records.append(dict(kind="focus",target=target,requested=True,observed=True,current=True,token=dispatch["token"],eventId=dispatch["eventId"],action="next",groupTarget=dispatch["identity"]["outerTarget"],after=dict(focusedTarget=target)))
            up=copy.deepcopy(dispatch);up.update(token=100+index,eventId=100+index,phase="up")
            up["identity"].update(target=target,nativeInstance=str(target),editorInstance=str(target))
            if index==5:
                up["identity"].update(ownerId="inner",bindingId="inner-binding",bindingRevision="inner-revision",outerTarget=50,inputTarget=51,outerInstance="inner-outer",inputInstance="inner-input")
                up["groups"]=[dict(target=t,bindingId="inner-binding" if t!=10 else "binding",bindingRevision="inner-revision" if t!=10 else "revision",scopeTarget=50 if t!=10 else 10) for t in [51,50,10]]
            up_event=dict(key="ArrowRight",target=target,phase="up",fieldDispatch=json.dumps(up))
            up_frame=copy.deepcopy(native);up_frame.update(event=up_event,identity=copy.deepcopy(up["identity"]))
            for snapshot in [up_frame["before"],up_frame["after"]]:
                snapshot["instances"]=[dict(target=target,nativeInstance=str(target),editorInstance=str(target))]
                snapshot["focusedTarget"]=target
                for field in ["outerTarget","inputTarget","outerInstance","inputInstance"]:snapshot[field]=up["identity"][field]
            records.append(up_frame)
            for group in up["groups"]:add("field-key",field="inner" if group["scopeTarget"]==50 else "outer",receiverTarget=group["target"],data=copy.deepcopy(up_event),originalPayloadId=100+index)
        if index==3:
            add("core-native-change",field="outer",data=dict(text="7",target=33,eventCount=1))
            add("core-change",field="outer",text="7")
        add("native-receipts",batch=index*2+2,records=records,dropped=0)
        reports.append(dict(case=name,batch=index*2+2,nativeValues={"outer-core-editor":"7"}if index>=3 else{}))
    return rows,reports


class Descendants(unittest.TestCase):
    def test_eight_contracts_do_not_close_full_adoption(self):
        rows,reports=journal();result=validate(rows,"producer",reports)
        self.assertEqual(result["descendantCheckpointContracts"],list(CASES))
        self.assertFalse(result["fullInputSurface"])
        self.assertFalse(result["fullFamily"])
        self.assertFalse(result["fullGoal"])

    def test_rejects_missing_case_or_invented_editor_value(self):
        rows,reports=journal()
        with self.assertRaises(AssertionError):validate(rows,"producer",reports[:-1])
        next(row for row in reports if row["case"]=="group-veto-before-core-editor-default")["nativeValues"]["outer-core-editor"]="79"
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)

    def test_rejects_guard_mismatch_or_duplicate_core_change(self):
        for change in [lambda rows: next(row for row in rows if row["kind"]=="field-state").update(stop=False), lambda rows: next(row for row in rows if row["kind"]=="core-change").update(text="wrong")]:
            rows,reports=journal();change(rows)
            with self.assertRaises(AssertionError):validate(rows,"producer",reports)
        rows,reports=journal()
        index=next(i for i,row in enumerate(rows)if row["kind"]=="core-change")
        rows.insert(index+1,copy.deepcopy(rows[index]))
        for i,row in enumerate(rows):row["sequence"]=i+1
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)

    def test_rejects_unobserved_navigation_or_unprevented_editor(self):
        rows,reports=journal();next(row for row in [item for item in rows if item["kind"]=="native-receipts"][3]["records"] if row["kind"]=="focus")["observed"]=False
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)
        rows,reports=journal();rows[-1]["records"][0]["originalDefaultPrevented"]=False
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)

    def test_rejects_wrong_navigation_target_or_another_editors_payload(self):
        rows,reports=journal()
        record=next(row for row in [item for item in rows if item["kind"]=="native-receipts"][3]["records"] if row["kind"]=="focus")
        record.update(target=99,after=dict(focusedTarget=99))
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)
        rows,reports=journal()
        next(row for row in rows if row["kind"]=="core-native-change")["data"]["target"]=99
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)

    def test_rejects_skipping_negative_tab_or_wrong_tab_policy(self):
        for skipped in [True,False]:
            rows,reports=journal()
            records=[row for row in rows if row["kind"]=="native-receipts"][3]["records"]
            if skipped:next(row for row in records if row["kind"]=="focus").update(target=33,after=dict(focusedTarget=33))
            else:records[0]["before"]["originals"][1]["tabStop"]=True
            with self.assertRaises(AssertionError):validate(rows,"producer",reports)

    def test_rejects_nested_owner_request_scope_and_ancestor_leak(self):
        for change in [lambda rows: next(row for row in rows if row["kind"]=="value-request").update(field="outer"), lambda rows: rows[-1]["records"][0].update(originalDefaultPrevented=False), lambda rows: next(row for row in rows if row["kind"]=="field-key" and row["field"]=="inner").update(field="outer")]:
            rows,reports=journal();change(rows)
            with self.assertRaises(AssertionError):validate(rows,"producer",reports)
        rows,reports=journal()
        next(row for row in next(item for item in rows if item.get("batch")==14)["records"] if row["kind"]=="focus")["groupTarget"]=10
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)

    def test_rejects_old_key_up_target_missing_path_and_foreign_focus_token(self):
        for change in [lambda records: records[-1]["identity"].update(target=33), lambda records: records.pop(), lambda records: next(row for row in records if row["kind"]=="focus").update(token=99)]:
            rows,reports=journal()
            change(next(row for row in rows if row.get("batch")==12)["records"])
            with self.assertRaises(AssertionError):validate(rows,"producer",reports)


if __name__=="__main__":unittest.main()
