import copy
import json
import unittest

from test_inspect_field_receipts import fixture
from validate_field_mutations import validate_busy, MUTATIONS, validate


def journal():
    rows,reports=[],[]
    token=0
    revision=layout=0
    def add(kind,**values):
        row=dict(kind=kind,probe="codon-owned-time-entry-01",producer="producer",sequence=len(rows)+1,**values);rows.append(row);return row
    def frame(phase,key_name,version="old",remount=False,current=True):
        nonlocal token
        token+=1
        native=copy.deepcopy(fixture()[-1]["records"][0]);packet=json.loads(native["event"]["fieldDispatch"])
        packet.update(token=token,eventId=token,phase=phase)
        packet["groups"]=packet["groups"][-1:]
        packet["identity"]["bindingRevision"]=version;packet["groups"][0]["bindingRevision"]=version
        if remount:
            packet["identity"].update(ownerId="new-owner",bindingId="new-binding",metadataTarget=105,outerTarget=110,inputTarget=111,target=112,outerInstance="new-outer",inputInstance="new-input",nativeInstance="new-component",editorInstance="new-editor")
            packet["groups"]=[dict(target=110,bindingId="new-binding",bindingRevision=version,scopeTarget=110,containsTarget=True)]
        event=dict(key=key_name,target=packet["identity"]["target"],phase=phase,fieldDispatch=json.dumps(packet))
        native.update(event=event,identity=copy.deepcopy(packet["identity"]),scopeCurrent=current,deliveryStarted=True,deliveryReturned=True,renderPhasesComplete=True,error="",decision="allowed" if current else "retired",wait="allowed" if current else "retired",originalDefaultPrevented=key_name=="m")
        for snapshot in [native["before"],native["after"]]:
            snapshot["focusedTarget"]=packet["identity"]["target"]
            for name in ["outerTarget","inputTarget","outerInstance","inputInstance"]:snapshot[name]=packet["identity"][name]
            snapshot["instances"]=[dict(target=packet["identity"]["target"],nativeInstance=packet["identity"]["nativeInstance"],editorInstance=packet["identity"]["editorInstance"])]
            snapshot["originals"]=[dict(target=packet["identity"]["target"],rect=dict(x=10))]
        return native,packet
    def callbacks(native,packet,mutation=None,rev=0):
        add("child-key",field="outer",data=copy.deepcopy(native["event"]),originalPayloadId=packet["token"])
        add("field-key",field="outer",revision=rev,receiverTarget=packet["groups"][0]["target"],data=copy.deepcopy(native["event"]),originalPayloadId=packet["token"])
        if mutation:
            for kind in ["mutation-call","mutation-return"]:add(kind,field="outer",mutation=mutation,revision=rev,data=copy.deepcopy(native["event"]),originalPayloadId=packet["token"])
    for index,mutation in enumerate(MUTATIONS):
        name="mutation-"+mutation
        before=dict(mutation=mutation,revision=revision,layoutRevision=layout,disabled=False,readonly=False,visible=True)
        add("scene-state",**before)
        add("native-receipts",batch=index*4+1,records=[],dropped=0);reports.append(dict(case=name+"-setup",batch=index*4+1,scene=copy.deepcopy(before)))
        native,packet=frame("down","m",current=mutation=="layout")
        callbacks(native,packet,mutation,revision)
        if mutation=="callback":revision+=1
        if mutation=="layout":layout+=1
        after=dict(mutation=mutation,revision=revision,layoutRevision=layout,disabled=mutation=="disabled",readonly=mutation=="readonly",visible=mutation!="unmount")
        add("scene-state",**after)
        records=[native]
        if mutation=="layout":
            native.update(decision="prevented");native["after"]["originals"][0]["rect"]["x"]=26
            up,up_packet=frame("up","m");records.append(up);callbacks(up,up_packet,rev=revision)
        if mutation=="unmount":native["after"]=None
        add("native-receipts",batch=index*4+2,records=records,dropped=0);reports.append(dict(case=name,batch=index*4+2,scene=copy.deepcopy(after)))
        recovered={**after,"disabled":False,"readonly":False,"visible":True};add("scene-state",**recovered)
        add("native-receipts",batch=index*4+3,records=[],dropped=0);reports.append(dict(case=name+"-probe-setup",batch=index*4+3,scene=copy.deepcopy(recovered)))
        records=[]
        for phase in ["down","up"]:
            fresh,fresh_packet=frame(phase,"j",version="old" if mutation=="layout" else "new",remount=mutation=="unmount")
            records.append(fresh);callbacks(fresh,fresh_packet,rev=revision)
        add("native-receipts",batch=index*4+4,records=records,dropped=0);reports.append(dict(case=name+"-probe",batch=index*4+4,scene=copy.deepcopy(recovered)))
    return rows,reports


class Mutations(unittest.TestCase):
    def test_five_mutations_and_fresh_probes_keep_adoption_open(self):
        rows,reports=journal();result=validate(rows,"producer",reports)
        self.assertEqual(result["mutationContracts"],list(MUTATIONS))
        for flag in ["fullInputSurface","fullFamily","fullGoal"]:self.assertFalse(result[flag])

    def test_rejects_invented_retirement_and_unknown_failure(self):
        for values in [dict(scopeCurrent=True),dict(decision="failed"),dict(error="unknown"),dict(wait="timed-out"),dict(renderPhasesComplete=False),dict(deliveryReturned=False)]:
            rows,reports=journal();next(row for row in rows if row.get("batch")==2)["records"][0].update(values)
            with self.assertRaises(AssertionError):validate(rows,"producer",reports)

    def test_accepts_only_the_named_retired_notification_guard(self):
        rows,reports=journal();next(row for row in rows if row.get("batch")==2)["records"][0].update(error="field-input-original-mount-event-retired")
        self.assertEqual(validate(rows,"producer",reports)["mutationContracts"],list(MUTATIONS))

    def test_rejects_stale_callback_or_original_replacement_after_retirement(self):
        rows,reports=journal()
        position=next(i for i,row in enumerate(rows) if row.get("batch")==3)
        next(row for row in rows[position:] if row["kind"]=="field-key")["revision"]=0
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)
        rows,reports=journal();next(row for row in rows if row.get("batch")==4)["records"][0]["identity"]["nativeInstance"]="replacement"
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)

    def test_rejects_missing_layout_actual_scene_and_profile(self):
        rows,reports=journal();next(row for row in rows if row.get("batch")==14)["records"][0]["after"]["originals"][0]["rect"]["x"]=10
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)
        rows,reports=journal();reports[1]["scene"]["revision"]=0
        with self.assertRaises(AssertionError):validate(rows,"producer",reports)
        rows,reports=journal()
        with self.assertRaises(AssertionError):validate(rows,"producer",reports[:-1])


if __name__=="__main__":unittest.main()


def busy_journal():
    rows,reports=[],[]
    def add(kind,**values):
        row=dict(kind=kind,probe="codon-owned-time-entry-01",producer="producer",sequence=len(rows)+1,**values)
        rows.append(row);return row
    add("native-receipts",batch=1,records=[],dropped=0)
    reports.append(dict(case="busy-original-setup",batch=1))
    add("busy-start",started=1)
    add("busy-end",elapsedMilliseconds=10000)
    for batch,letter in [(2,"q"),(3,"j")]:
        records=[]
        for index,phase in enumerate(["down","up"]):
            frame=copy.deepcopy(fixture()[-1]["records"][0])
            dispatch=json.loads(frame["event"]["fieldDispatch"])
            dispatch.update(token=batch*10+index,eventId=batch*10+index,phase=phase)
            frame["event"].update(key=letter,phase=phase,fieldDispatch=json.dumps(dispatch))
            frame.update(deliveryStarted=letter=="j",deliveryReturned=letter=="j",renderPhasesComplete=letter=="j",scopeCurrent=True,error="",wait="allowed" if letter=="j" else "timed-out",decision="allowed" if letter=="j" else "timed-out",originalDefaultPrevented=False)
            records.append(frame)
            if letter=="j":
                for group in dispatch["groups"]:add("field-key",data=copy.deepcopy(frame["event"]),receiverTarget=group["target"],originalPayloadId=dispatch["token"])
        add("native-receipts",batch=batch,records=records,dropped=0)
        reports.append(dict(case="busy-original-expiry" if letter=="q" else "busy-original-followup",batch=batch,nativeActionElapsedSeconds=2.2))
    return rows,reports


class BusyContracts(unittest.TestCase):
    def test_expiry_then_current_original_recovery(self):
        rows,reports=busy_journal()
        self.assertTrue(validate_busy(rows,"producer",reports)["busyJSContract"])

    def test_rejects_late_delivery_missing_occupation_and_unbounded_action(self):
        for change in [
            lambda rows,reports: reports[1].update(nativeActionElapsedSeconds=6),
            lambda rows,reports: rows[2].update(elapsedMilliseconds=500),
            lambda rows,reports: next(row for row in rows if row.get("batch")==2)["records"][0].update(deliveryStarted=True),
            lambda rows,reports: next(row for row in rows if row["kind"]=="field-key")["data"].update(key="q"),
        ]:
            rows,reports=busy_journal();change(rows,reports)
            with self.assertRaises(AssertionError):validate_busy(rows,"producer",reports)
