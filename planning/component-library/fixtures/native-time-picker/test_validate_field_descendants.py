import copy
import json
import unittest
from test_inspect_field_receipts import fixture
from validate_field_descendants import CASES, SETUPS, validate, validate_portals


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
        if index in {6,7}:
            target=44 if index==6 else 45
            dispatch["identity"].update(ownerId="inner",bindingId="inner-binding",bindingRevision="inner-revision",outerTarget=50,inputTarget=51,outerInstance="inner-outer",inputInstance="inner-input",target=target,nativeInstance=str(target),editorInstance=str(target))
            dispatch["groups"]=[dict(target=t,bindingId="inner-binding" if t!=10 else "binding",bindingRevision="inner-revision" if t!=10 else "revision",scopeTarget=50 if t!=10 else 10, containsTarget=True) for t in [51,50,10]]
        event=dict(key="ArrowRight" if index in {0,1,2,5,6} else "7" if index==3 else "9" if index==4 else "ArrowUp" if index==7 else "f",target=dispatch["identity"]["target"],phase="down",fieldDispatch=json.dumps(dispatch))
        native.update(event=event,identity=copy.deepcopy(dispatch["identity"]),deliveryStarted=True,deliveryReturned=True,renderPhasesComplete=True,error="",decision="prevented" if index in {1,2,4,5,6,7,8,9} else "allowed",originalDefaultPrevented=index in {1,2,4,5,6,7,8,9})
        for snapshot in [native["before"],native["after"]]:
            snapshot["instances"]=[dict(target=dispatch["identity"]["target"],nativeInstance=dispatch["identity"]["nativeInstance"],editorInstance=dispatch["identity"]["editorInstance"])]
            snapshot["focusedTarget"]=dispatch["identity"]["target"]
            snapshot["originals"]=[dict(target=target,eligible=True,tabStop=target!=22) for target in ([44,45] if index in {6,7} else [12,22,33,44,45])]
            if index>=8:snapshot["instances"].append(dict(target=33,nativeInstance="core",editorInstance="core-editor"))
            for field in ["outerTarget","inputTarget","outerInstance","inputInstance"]:snapshot[field]=dispatch["identity"][field]
        add("native-receipts",batch=index*2+1,records=[],dropped=0)
        reports.append(dict(case=SETUPS[index],batch=index*2+1,nativeValues={}))
        owner_state=dict(field="outer",outerTarget=10,disabled=False,readonly=False,stop=index==0,veto=index==4,direction="ltr",echo=False,value=None,valueClass=None,commandMode="original-only" if index==8 else "mixed" if index==9 else "none",commandTransactions=0,coreTarget=33,buttonTarget=12)
        add("field-state",**owner_state)
        add("field-state",field="inner",outerTarget=50,disabled=False,readonly=False,stop=False,veto=False,direction="ltr",echo=False,value="08:15:00",valueClass="Time")
        if index<2:add("child-key",field="outer",data=copy.deepcopy(event),originalPayloadId=index+1)
        if index==7:
            add("segment-key",field="inner",data=copy.deepcopy(event),originalPayloadId=index+1)
            add("value-request",field="inner",value="08:16:00",valueClass="Time",held="08:15:00",heldClass="Time",echo=False)
        if index>0:
            for group in (dispatch["groups"][:1] if index in {1,2,5,6} else dispatch["groups"]):add("field-key",field="inner" if group["scopeTarget"]==50 else "outer",receiverTarget=group["target"],data=copy.deepcopy(event),originalPayloadId=index+1)
        records=[native]
        if index>=8:
            command_event={**copy.deepcopy(event),"returnValue":False}
            common=dict(field="outer",mode=owner_state["commandMode"],target=33,command="focus",data=command_event,originalPayloadId=index+1)
            add("original-command-call",**common)
            add("core-focus",field="outer",data=dict(target=33))
            add("original-command-return",sameRef=True,sameMethod=True,**common)
            before=copy.deepcopy(native["before"]);after=copy.deepcopy(native["after"]);after["focusedTarget"]=33
            native["after"]["focusedTarget"]=33
            records.extend([dict(kind="command-native",token=dispatch["token"],target=33,command="focus",callbackCompleted=True,current=True,error="",before=before,after=after),dict(kind="command",token=dispatch["token"],target=33,command="focus",arguments=[],callbackCompleted=True,error="")])
            add("field-state",**{**owner_state,"commandTransactions":1 if index==9 else 0})
        if index in {1,2,5,6,8,9}:
            target={1:22,2:33,5:44,6:45,8:33,9:33}[index]
            if index<8:records.append(dict(kind="focus",target=target,requested=True,observed=True,current=True,token=dispatch["token"],eventId=dispatch["eventId"],action="next",groupTarget=dispatch["identity"]["outerTarget"],after=dict(focusedTarget=target)))
            up=copy.deepcopy(dispatch);up.update(token=100+index,eventId=100+index,phase="up")
            up["identity"].update(target=target,nativeInstance="core" if index>=8 else str(target),editorInstance="core-editor" if index>=8 else str(target))
            if index==5:
                up["identity"].update(ownerId="inner",bindingId="inner-binding",bindingRevision="inner-revision",outerTarget=50,inputTarget=51,outerInstance="inner-outer",inputInstance="inner-input")
                up["groups"]=[dict(target=t,bindingId="inner-binding" if t!=10 else "binding",bindingRevision="inner-revision" if t!=10 else "revision",scopeTarget=50 if t!=10 else 10, containsTarget=True) for t in [51,50,10]]
            up_event=dict(key=event["key"],target=target,phase="up",fieldDispatch=json.dumps(up))
            up_frame=copy.deepcopy(native);up_frame.update(event=up_event,identity=copy.deepcopy(up["identity"]))
            for snapshot in [up_frame["before"],up_frame["after"]]:
                snapshot["instances"]=[dict(target=target,nativeInstance=up["identity"]["nativeInstance"],editorInstance=up["identity"]["editorInstance"])]
                snapshot["focusedTarget"]=target
                for field in ["outerTarget","inputTarget","outerInstance","inputInstance"]:snapshot[field]=up["identity"][field]
            records.append(up_frame)
            for group in up["groups"]:add("field-key",field="inner" if group["scopeTarget"]==50 else "outer",receiverTarget=group["target"],data=copy.deepcopy(up_event),originalPayloadId=100+index)
        if index==3:
            add("core-native-change",field="outer",data=dict(text="7",target=33,eventCount=1))
            add("core-change",field="outer",text="7")
        add("native-receipts",batch=index*2+2,records=records,dropped=0)
        reports.append(dict(case=name,batch=index*2+2,nativeValues={"outer-core-editor":"7", "outer-command-transactions":"1" if index==9 else "0"}if index>=3 else{}))
    return rows,reports


class Descendants(unittest.TestCase):
    def test_ten_contracts_do_not_close_full_adoption(self):
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
        rows,reports=journal();next(row for row in rows if row.get("batch")==10)["records"][0]["originalDefaultPrevented"]=False
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
        for change in [lambda rows: next(row for row in rows if row["kind"]=="value-request").update(field="outer"), lambda rows: next(row for row in rows if row.get("batch")==16)["records"][0].update(originalDefaultPrevented=False), lambda rows: next(row for row in rows if row["kind"]=="field-key" and row["field"]=="inner").update(field="outer")]:
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

    def test_rejects_replaced_original_ref_or_method_and_repeated_command_call(self):
        for flag in ["sameRef","sameMethod"]:
            rows,reports=journal()
            next(row for row in rows if row["kind"]=="original-command-return")[flag]=False
            with self.assertRaises(AssertionError):validate(rows,"producer",reports)
        rows,reports=journal()
        position=next(i for i,row in enumerate(rows) if row["kind"]=="original-command-call")
        rows.insert(position,copy.deepcopy(rows[position]))
        for i,row in enumerate(rows):row["sequence"]=i+1
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)

    def test_rejects_command_substitution_foreign_token_arguments_and_missing_completion(self):
        for change in [lambda records: next(row for row in records if row["kind"]=="command-native").update(token=7), lambda records: next(row for row in records if row["kind"]=="command").update(arguments=["replacement"]), lambda records: next(row for row in records if row["kind"]=="command-native").update(callbackCompleted=False), lambda records: records.append(dict(kind="focus"))]:
            rows,reports=journal()
            change(next(row for row in rows if row.get("batch")==18)["records"])
            with self.assertRaises(AssertionError):validate(rows,"producer",reports)

    def test_rejects_original_core_replacement_and_late_focus_callback(self):
        rows,reports=journal()
        command=next(row for row in next(item for item in rows if item.get("batch")==18)["records"] if row["kind"]=="command-native")
        command["after"]["instances"][1]["editorInstance"]="replacement"
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)
        rows,reports=journal()
        position=next(i for i,row in enumerate(rows) if row["kind"]=="core-focus")
        rows[position],rows[position+1]=rows[position+1],rows[position]
        for i,row in enumerate(rows):row["sequence"]=i+1
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)

    def test_rejects_unobserved_renderer_transaction(self):
        rows,reports=journal()
        next(row for row in reports if row["case"]=="original-ref-mixed-transaction")["nativeValues"]["outer-command-transactions"]="0"
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)


if __name__=="__main__":unittest.main()


def portal_journal():
    rows, reports = [], []
    token = 0
    def add(kind, **values):
        row = dict(kind=kind, probe="codon-owned-time-entry-01", producer="producer", sequence=len(rows)+1, **values)
        rows.append(row)
        return row
    for index, kind in enumerate(["key", "pointer"]):
        add("field-state", field="outer", portaled=True, buttonTarget=12, disabled=False, readonly=False, veto=False, stop=False)
        add("native-receipts", batch=index*2+1, records=[], dropped=0)
        reports.append(dict(case="portal-original-setup" if kind=="key" else "portal-original-press-setup", batch=index*2+1))
        records=[]
        for phase in (["down", "up"] if kind=="key" else ["pointer-start", "pointer-end", "pointer-click"]):
            token += 1
            frame=copy.deepcopy(fixture()[-1]["records"][0])
            dispatch=json.loads(frame["event"]["fieldDispatch"])
            target=12 if kind=="key" else 13
            dispatch.update(token=token,eventId=token,phase=phase)
            dispatch["identity"].update(target=target,nativeInstance="component:"+str(target),editorInstance="editor:"+str(target))
            dispatch["groups"]=[dict(target=10,bindingId="binding",bindingRevision="revision",scopeTarget=10,containsTarget=False)]
            encoded=json.dumps(dispatch)
            payload=dict(target=target,key="ArrowRight",phase=phase) if kind=="key" else dict(target=target,pointerId=1,pointerType="touch",isPrimary=True,button=0)
            event={**payload,"fieldDispatch":encoded}
            frame.update(kind=kind,event=copy.deepcopy(event),identity=copy.deepcopy(dispatch["identity"]),deliveryStarted=True,deliveryReturned=True,renderPhasesComplete=True,scopeCurrent=True,error="",decision="allowed",originalDefaultPrevented=False)
            for snapshot in [frame["before"],frame["after"]]:
                snapshot.update(eventFocusedTarget=12,nativeHierarchy=[dict(target=t,parent=parent,order=order) for t,parent,order in [(1,0,[]),(10,1,[0]),(11,10,[0,0]),(60,1,[1]),(12,60,[1,0]),(13,12,[1,0,0])]],instances=[dict(target=t,nativeTarget=t,nativeInstance="component:"+str(t),editorInstance="editor:"+str(t)) for t in [10,11,12,13]])
            records.append(frame)
            if kind=="pointer": records.append(dict(kind="original-pointer",token=token,eventId=token,payload=payload))
            add("field-key" if kind=="key" else "group-pointer",field="outer",receiverTarget=10,data=event,originalPayloadId=token,prevented=False,stopped=False)
        if kind=="pointer":add("child-press",field="outer",data=dict(target=12))
        add("native-receipts",batch=index*2+2,records=records,dropped=0)
        reports.append(dict(case="portal-original-keys" if kind=="key" else "portal-original-press",batch=index*2+2))
    return rows,reports


class PortalContracts(unittest.TestCase):
    def test_joins_logical_callers_to_actual_outside_native_tree(self):
        rows,reports=portal_journal()
        result=validate_portals(rows,"producer",reports)
        self.assertEqual(result["portalCheckpointContracts"],["portal-original-keys","portal-original-press"])
        self.assertFalse(result["fullInputSurface"])

    def test_rejects_changed_containment_missing_callbacks_focus_and_action(self):
        changes=[
            lambda rows: next(row for row in rows if row["kind"]=="field-state").update(portaled=False),
            lambda rows: next(row for row in rows if row.get("batch")==2)["records"][0]["before"]["nativeHierarchy"][4].update(parent=10),
            lambda rows: next(row for row in rows if row["kind"]=="field-key").update(kind="unrelated"),
            lambda rows: next(row for row in rows if row.get("batch")==4)["records"].append(dict(kind="focus")),
            lambda rows: next(row for row in rows if row["kind"]=="child-press").update(field="inner"),
            lambda rows: next(row for row in rows if row.get("batch")==2)["records"][0]["after"].update(eventFocusedTarget=13),
        ]
        for change in changes:
            rows,reports=portal_journal();change(rows)
            with self.assertRaises(AssertionError):validate_portals(rows,"producer",reports)
