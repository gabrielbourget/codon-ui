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
        if index>=3:
            dispatch["identity"].update(target=33,nativeInstance="core-component",editorInstance="core-editor")
        event=dict(key="ArrowRight" if index<3 else "7" if index==3 else "9",target=dispatch["identity"]["target"],phase="down",fieldDispatch=json.dumps(dispatch))
        native.update(event=event,identity=copy.deepcopy(dispatch["identity"]),deliveryStarted=True,deliveryReturned=True,renderPhasesComplete=True,error="",decision="prevented" if index==4 else "allowed",originalDefaultPrevented=index==4)
        for snapshot in [native["before"],native["after"]]:
            snapshot["instances"]=[dict(target=dispatch["identity"]["target"],nativeInstance=dispatch["identity"]["nativeInstance"],editorInstance=dispatch["identity"]["editorInstance"])]
            snapshot["focusedTarget"]=dispatch["identity"]["target"]
            snapshot["originals"]=[dict(target=target,eligible=True,tabStop=target!=22) for target in [12,22,33]]
        add("native-receipts",batch=index*2+1,records=[],dropped=0)
        reports.append(dict(case=SETUPS[index],batch=index*2+1,nativeValues={}))
        add("field-state",field="outer",disabled=False,readonly=False,stop=index==0,veto=index==4,direction="ltr")
        if index<2:add("child-key",field="outer",data=copy.deepcopy(event),originalPayloadId=index+1)
        if index>0:
            for group in dispatch["groups"]:add("field-key",field="outer",receiverTarget=group["target"],data=copy.deepcopy(event),originalPayloadId=index+1)
        records=[native]
        if index in {1,2}:
            target=22 if index==1 else 33
            records.append(dict(kind="focus",target=target,requested=True,observed=True,current=True,after=dict(focusedTarget=target)))
        if index==3:
            add("core-native-change",field="outer",data=dict(text="7",target=33,eventCount=1))
            add("core-change",field="outer",text="7")
        add("native-receipts",batch=index*2+2,records=records,dropped=0)
        reports.append(dict(case=name,batch=index*2+2,nativeValues={"outer-core-editor":"7"}if index>=3 else{}))
    return rows,reports


class Descendants(unittest.TestCase):
    def test_five_contracts_do_not_close_full_adoption(self):
        rows,reports=journal();result=validate(rows,"producer",reports)
        self.assertEqual(result["descendantCheckpointContracts"],list(CASES))
        self.assertFalse(result["fullInputSurface"])
        self.assertFalse(result["fullFamily"])
        self.assertFalse(result["fullGoal"])

    def test_rejects_missing_case_or_invented_editor_value(self):
        rows,reports=journal()
        with self.assertRaises(AssertionError):validate(rows,"producer",reports[:-1])
        reports[-1]["nativeValues"]["outer-core-editor"]="79"
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
        rows,reports=journal();rows[[i for i,row in enumerate(rows)if row["kind"]=="native-receipts"][3]]["records"][-1]["observed"]=False
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)
        rows,reports=journal();rows[-1]["records"][0]["originalDefaultPrevented"]=False
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)

    def test_rejects_wrong_navigation_target_or_another_editors_payload(self):
        rows,reports=journal()
        record=[row for row in rows if row["kind"]=="native-receipts"][3]["records"][-1]
        record.update(target=99,after=dict(focusedTarget=99))
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)
        rows,reports=journal()
        next(row for row in rows if row["kind"]=="core-native-change")["data"]["target"]=99
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)

    def test_rejects_skipping_negative_tab_or_wrong_tab_policy(self):
        for skipped in [True,False]:
            rows,reports=journal()
            records=[row for row in rows if row["kind"]=="native-receipts"][3]["records"]
            if skipped:records[-1].update(target=33,after=dict(focusedTarget=33))
            else:records[0]["before"]["originals"][1]["tabStop"]=True
            with self.assertRaises(AssertionError):validate(rows,"producer",reports)


if __name__=="__main__":unittest.main()
