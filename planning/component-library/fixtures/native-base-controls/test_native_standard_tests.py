"""Host controls for the real standard SDK command and failure boundaries."""
import hashlib
import copy
import json
import os
from pathlib import Path
import plistlib
import re
import subprocess
import sys
import tempfile
import unittest
import time
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import NativeStandardTests as NATIVE


class StandardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory();self.root = Path(self.temp.name)
    def tearDown(self): self.temp.cleanup()

    def test_popover_settings_handoff_guard_replays_native_transition_and_keeps_strict_motion(self):
        source=(ROOT/"MeterG02TrialTests.swift").read_text().split("final class ClickPopoverTrialTests:",1)[1].split("final class ShowcaseStartupDiagnosticTests:",1)[0]
        helper=source.split("private func motionSwitch",1)[1].split("private func setMotion",1)[0]
        condition=re.search(r'wait\("Native Settings foreground and showcase background"\) \{ ([^\n]+) \}',helper).group(1)
        self.assertLess(helper.index('wait("Native Settings'),helper.index('let toggle = settings.switches["Reduce Motion"]'))
        expression=condition.replace("settings.state","settings_state").replace("self.app.state","showcase_state").replace(".runningBackgroundSuspended","2").replace(".runningBackground","3").replace(".runningForeground","4").replace("&&"," and ").replace("||"," or ")
        ready=lambda settings,showcase:eval(expression,{"__builtins__":{}},{"settings_state":settings,"showcase_state":showcase})
        # Failed r7 synthesized at 13:30:23.534, before showcase background at 24.853.
        self.assertFalse(ready(4,4));self.assertTrue(ready(4,3))
        # Healthy Tooltip r11 backgrounds at 03:07:39.261 before its 41.892 tap.
        self.assertTrue(ready(4,2))
        for settings in [None,0,1,2,3,4]:
            for showcase in [None,0,1,2,3,4]:
                self.assertEqual(ready(settings,showcase),settings==4 and showcase in [2,3])
        mutation=source.split("private func setMotion",1)[1]
        self.assertEqual(mutation.count(".tap()"),1)
        self.assertIn("toggle.coordinate(withNormalizedOffset:CGVector(dx:0.95,dy:0.5)).tap()",mutation)
        self.assertIn('wait("Actual Reduce Motion switch "+expected) { toggle.value as? String == expected }',mutation)
        self.assertIn('XCTAssertEqual(current.value as? String,original)',source)
        self.assertIn('self.setMotion(current,original)',source)
        self.assertNotIn("sleep",helper)


    def test_popover_exact_batches_and_real_missing_admission_boundary(self):
        for suffix,method in [("actions","testPopoverActionsAndOwnership"),("styles","testPopoverStylesAndConstraint"),("lifetime","testPopoverLifetimeAndReduction")]:
            batch="click-popover-"+suffix;plan={"cell":"CAT.click-popover.G08","nativeStandard":{"platform":"ios","batch":batch,"output":str(self.root/"never-created")}}
            NATIVE.validate_standard_scope(plan);self.assertEqual(NATIVE.selection("ios",batch),{"ios":["ClickPopoverTrialTests/"+method],"android":[]})
            path=self.root/(suffix+".json");path.write_text(json.dumps(plan));env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
            result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(path)],env=env,capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((self.root/"never-created").exists())
            with self.assertRaises(ValueError):NATIVE.selection("android",batch)
        with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":"CAT.tooltip.G08","nativeStandard":{"batch":"click-popover-actions"}})

    def test_popover_reader_original_geometry_paint_and_decorative_arrow_controls(self):
        state={"open":True,"mounted":True,"rootTag":81,"case":"baseline","narrow":False,"dialogPadding":0,"layouts":[{"target":81,"currentTarget":81,"width":280,"height":200.0001220703125}],"rendered":{"placement":"top"},"background":"#ffffff","textColor":"#111111","showArrow":False,"arrowLayout":None}
        row={"name":"baseline","state":state,"root":[55,350,280,200],"dialog":[65,360,260,180],"body":[65,390,260,40],"anchor":[120,560,120,44],"arrow":[],"nativeBodyLabel":"Native popover content","window":[0,0,390,844],"scale":3,"imageWidth":1170,"imageHeight":2532,"backgroundRGBA":[255]*4,"textRGBA":[17,17,17,255],"textPixels":14}
        state.update(anchorTag=83,lifetime=0,anchorMeasurement={"sequence":1,"target":83,"rootTag":81,"lifetime":0,"case":"baseline","windowId":"actual-window","rootWindowId":"actual-window","requestedEpochMs":101,"observedEpochMs":102,"frame":row["anchor"]})
        row.update(anchorSource="original-native-measureInWindow",anchorAX=[],captureStartedEpochMs=100,captureEpochMs=103)
        self.assertEqual(NATIVE.validate_popover_rows([row],["baseline"])["observations"],1)
        for kind in ["duplicate","scale","outside","width","layout","parent-pixel","paint","text"]:
            bad=copy.deepcopy(row)
            if kind=="duplicate":
                with self.assertRaises(ValueError):NATIVE.validate_popover_rows([bad,bad],["baseline"])
                continue
            if kind=="scale":bad["scale"]=float("nan")
            elif kind=="outside":bad["root"][0]=-1/3
            elif kind=="width":bad["root"][2]+=1
            elif kind=="layout":bad["state"]["layouts"][-1]["currentTarget"]=82
            elif kind=="parent-pixel":bad["body"][2]=270+1/3
            elif kind=="paint":bad["backgroundRGBA"][0]=254
            else:bad["textPixels"]=0
            with self.subTest(kind=kind),self.assertRaises(ValueError):NATIVE.validate_popover_rows([bad],["baseline"])
        custom=copy.deepcopy(row);custom["name"]="custom";custom["state"].update(case="custom",dialogPadding=4,showArrow=True,arrowLayout={"target":84,"currentTarget":84,"parentTag":81,"x":140,"y":197,"width":18,"height":10});custom["body"][0]=69;custom["body"][2]=252;custom["borderRGBA"]=[[17,119,51,255]]*3;custom["arrow"]=[186,547,18,10]
        custom["state"]["anchorMeasurement"]["case"]="custom"
        custom["arrowSamples"]=[{"point":[186+x,547+y],"rgba":[47,125,24,255] if i<4 else [128,128,128,255]} for i,(x,y) in enumerate([(2.5,1),(5,1),(7.5,1),(5,3.5),(.5,3.5),(9.5,3.5),(5,7.5)])]
        NATIVE.validate_popover_rows([custom],["custom"])
        for kind in ["wrong-parent","inner-edge","wrong-paint","outside-negative"]:
            bad=copy.deepcopy(custom)
            if kind=="wrong-parent":bad["state"]["arrowLayout"]["parentTag"]=82
            elif kind=="inner-edge":bad["state"]["arrowLayout"]["y"]-=7;bad["arrow"][1]-=7
            elif kind=="wrong-paint":bad["arrowSamples"][1]["rgba"]=[128,128,128,255]
            else:bad["arrowSamples"][-1]["rgba"]=[47,125,24,255]
            with self.subTest(arrow=kind),self.assertRaises(ValueError):NATIVE.validate_popover_rows([bad],["custom"])
        retired=copy.deepcopy(row);retired.update(name="normal-retired",root=[],retirementFrame=row["root"],retirementReferenceName="normal-baseline",retirementExact=True);retired["state"].update(mounted=False,rootTag=None)
        NATIVE.validate_popover_rows([retired],["normal-retired"])
        for key,value in [("retirementExact",False),("retirementReferenceName","reduced-baseline"),("retirementFrame",[-1/3,350,280,200])]:
            bad=copy.deepcopy(retired);bad[key]=value
            with self.subTest(retirement=key),self.assertRaises(ValueError):NATIVE.validate_popover_rows([bad],["normal-retired"])
        with self.assertRaises(ValueError):NATIVE.reconcile_popover_ios("",{"batch":"click-popover-actions"})
        self.assertNotEqual(NATIVE.driver_exit_code(1,False,True),0)

    def test_popover_saved_modal_capture_requires_fresh_original_window_measurement(self):
        saved=ROOT.parents[3]/"node_modules/.cache/codon-native-tests/click-popover-after-hover-removal-20261108/ios-styles-run-r1/xctest.stdout"
        raw=[json.loads(x) for x in re.findall(r"POPOVER_NATIVE_CAPTURE (\{[^\n]+\})",saved.read_text())];self.assertEqual(len(raw),1)
        original=raw[0];self.assertEqual(original["anchor"],[]);self.assertTrue(original["root"] and original["body"] and original["dialog"])
        with self.assertRaisesRegex(ValueError,"measurement missing"):NATIVE.validate_popover_anchor(original)
        control=copy.deepcopy(original);control.update(anchor=[55,636,280,44],anchorAX=[],anchorSource="original-native-measureInWindow",captureStartedEpochMs=100,captureEpochMs=103)
        state=control["state"];state["anchorMeasurement"]={"sequence":1,"target":state["anchorTag"],"rootTag":state["rootTag"],"lifetime":state["lifetime"],"case":state["case"],"windowId":"control-window","rootWindowId":"control-window","requestedEpochMs":101,"observedEpochMs":102,"frame":control["anchor"]}
        # Synthetic native-measurement controls over the actual pruned modal metadata; never relabel the failed native method.
        self.assertEqual(NATIVE.validate_popover_anchor(control),control["anchor"])
        for key,value in [("target",-1),("rootTag",-1),("lifetime",-1),("case","wrong"),("windowId","other-window"),("requestedEpochMs",99),("observedEpochMs",104),("sequence",0),("frame",[55,636,280,43])]:
            bad=copy.deepcopy(control);bad["state"]["anchorMeasurement"][key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):NATIVE.validate_popover_anchor(bad)
        bad=copy.deepcopy(control);bad["anchor"][0]=-1/3;bad["state"]["anchorMeasurement"]["frame"]=bad["anchor"]
        with self.assertRaises(ValueError):NATIVE.validate_popover_anchor(bad)
        good=copy.deepcopy(control);good["anchorAX"]=good["anchor"].copy();NATIVE.validate_popover_anchor(good)
        good["anchorAX"][1]+=1
        with self.assertRaises(ValueError):NATIVE.validate_popover_anchor(good)
        with self.assertRaises(ValueError):NATIVE.reconcile_popover_ios(saved.read_text(),{"batch":"click-popover-styles"})

    def test_popover_actions_resolved_trigger_name_and_original_semantics(self):
        opened={"rootTag":81,"entryTag":82,"events":[{"phase":"entry-focus","currentTarget":82,"target":82}],"inspection":{"target":81,"ownerId":"owner","windowId":"window","platform":"ios","label":"Original popover action","description":"Original supplementary popover details"}}
        states={"declined-open":{"open":False,"requests":[{"value":True}]},"opened":opened,"edited":{"rootTag":81,"entryTag":82,"actions":1,"value":"ownerx"},"declined-close":{"open":True,"rootTag":81,"requests":[{"value":False}]},"outside-veto":{"rootTag":81,"open":True,"backgroundActions":0,"outside":[{"kind":"touch","target":83}]},"background-restored":{"backgroundActions":1},"nonmodal-open":{"nonmodal":True},"nonmodal-focus-close":{"backgroundActions":2,"outside":[{"kind":"focus"}],"focusedTag":83,"backgroundTag":83}}
        for name in ["outside-close","inside-close"]:states[name]={"open":False,"focusedTag":84,"anchorTag":84}
        rows=[{"name":name,"state":states.get(name,{}),"editorValue":"ownerx"} for name in NATIVE.POPOVER_ACTIONS]
        identity='NATIVE_LOADED_OBSERVER_EARLY '+json.dumps({"sha256":"a"*64,"expectedSHA256":"a"*64})+'\n'
        def raw(values):return identity+'\n'.join('POPOVER_NATIVE_OBSERVATION '+json.dumps(row) for row in values)
        # Isolate semantic reconciliation; executed geometry/paint controls remain separate.
        with patch.object(NATIVE,"validate_popover_rows",return_value={"observations":len(rows)}):
            self.assertEqual(NATIVE.reconcile_popover_ios(raw(rows),{"batch":"click-popover-actions"})["observations"],11)
            for field,value in [("label","Native popover"),("label",""),("label","Unrelated trigger"),("target",99),("windowId",""),("ownerId",""),("platform","android"),("description","Unrelated details")]:
                bad=copy.deepcopy(rows);next(row for row in bad if row["name"]=="opened")["state"]["inspection"][field]=value
                with self.subTest(field=field,value=value),self.assertRaisesRegex(ValueError,"original root semantics"):
                    NATIVE.reconcile_popover_ios(raw(bad),{"batch":"click-popover-actions"})

    def test_cached_ios_refresh_removed_input_requires_prior_hash_absence_and_owned_typescript(self):
        repo=self.root/"repo";retired=repo/"packages/react-native/src/components/Retired.tsx";retired.parent.mkdir(parents=True)
        base=self.root/"Base.app";base.mkdir();(base/"main.jsbundle").write_text("old bundle");(base/"NativeBinary").write_text("unchanged native")
        identity=self.root/"identity.json";identity.write_text(json.dumps(NATIVE.identity(base)));freeze=self.root/"freeze.json";freeze.write_text(json.dumps({str(retired.relative_to(repo)):"a"*64}))
        config={"baseApplicationIdentity":{"path":str(identity),"sha256":NATIVE.digest(identity)},"baseApplicationSourceFreeze":{"path":str(freeze),"sha256":NATIVE.digest(freeze)},"removedApplicationSources":[{"path":str(retired),"sha256":"a"*64}]}
        class Boundary:
            def __init__(inner,name):inner.output=self.root/name;inner.output.mkdir()
            def run(inner,*args):raise RuntimeError("EXPECTED_PACKAGER_BOUNDARY_NO_SDK")
        with patch.object(NATIVE,"REPO",repo):
            admitted=Boundary("admitted")
            with self.assertRaisesRegex(RuntimeError,"EXPECTED_PACKAGER_BOUNDARY_NO_SDK"):NATIVE.build_ios_application(admitted,config)
            self.assertEqual(json.loads((admitted.output/"source-freeze.json").read_text()),{})
            self.assertEqual((admitted.output/"CodonCircular.app/NativeBinary").read_text(),"unchanged native")
            for kind in ["wrong-hash","still-present","native-file","codegen-spec","unknown","duplicate"]:
                bad=copy.deepcopy(config)
                if kind=="wrong-hash":bad["removedApplicationSources"][0]["sha256"]="b"*64
                elif kind=="still-present":retired.write_text("not actually retired")
                elif kind=="native-file":bad["removedApplicationSources"][0]["path"]=str(repo/"packages/react-native/ios/Retired.mm")
                elif kind=="codegen-spec":bad["removedApplicationSources"][0]["path"]=str(repo/"packages/react-native/src/input/specs/Retired.ts")
                elif kind=="unknown":bad["removedApplicationSources"][0]["path"]=str(retired.parent/"Unknown.tsx")
                else:bad["removedApplicationSources"]*=2
                rejected=Boundary(kind)
                with self.subTest(kind=kind),self.assertRaises(ValueError):NATIVE.build_ios_application(rejected,bad)
                self.assertFalse((rejected.output/"CodonCircular.app").exists())
                if retired.exists():retired.unlink()

    def test_form_field_exact_batches_and_actual_admission_boundary(self):
        for batch,method in [("actions","testFieldActionsAndLifetimes"),("styles","testFieldStylesAndConstraints"),("motion","testFieldMotionAndRetirement"),("marker-diagnostic","testFieldMarkerGapDiagnostic")]:
            full="form-field-"+batch;plan={"cell":"CAT.form-field.G08","nativeStandard":{"platform":"ios","batch":full,"output":str(self.root/"never-created")}}
            NATIVE.validate_standard_scope(plan);self.assertEqual(NATIVE.selection("ios",full),{"ios":["FormFieldTrialTests/"+method],"android":[]})
            path=self.root/(batch+".json");path.write_text(json.dumps(plan));env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
            result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(path)],env=env,capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((self.root/"never-created").exists())
            with self.assertRaises(ValueError):NATIVE.selection("android",full)
        with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":"CAT.toggle-switcher.G08","nativeStandard":{"batch":"form-field-actions"}})


    def test_form_field_reader_preserves_exact_paint_current_refs_and_physical_crop(self):
        row={"name":"fractional","state":{"mode":"styles","visible":True,"rootTag":81,"layouts":[{"target":81,"currentTarget":81,"layout":{"width":213.25,"height":144.0001220703125}}],"zero":False,"narrow":False,"hasMessages":False,"relationships":False},"scale":3,"parent":[15,250,280,224],"referenceParent":[15,482,280,224],"matchedReferenceParent":[15,250,280,224],"root":[27,262,213.25,144],"referenceRoot":[27,494,213.25,144],"targetCount":1,"referenceExact":True,"inkPixels":120,"imageWidth":1170,"imageHeight":2532,"elements":[]}
        self.assertEqual(NATIVE.validate_form_field_rows([row],["fractional"])["observations"],1)
        marker=copy.deepcopy(row);marker["name"]="marker-gap-diagnostic";marker["state"]["case"]="style-baseline"
        marker.update(markerReferenceLabel=[27,494,31.3333333333333,16],markerReferenceIndicator=[60.3333333333333,494,4.6666666666667,16])
        marker["elements"]=[{"id":"form-field-label","label":"Email *","frame":[27,262,38,16]}]
        NATIVE.validate_form_field_rows([marker],["marker-gap-diagnostic"])
        diagnostic=NATIVE.reconcile_form_field_ios("FIELD_NATIVE_OBSERVATION "+json.dumps(marker),{"batch":"form-field-marker-diagnostic"})
        self.assertEqual(diagnostic["status"],"DIAGNOSTIC_ONLY");self.assertFalse(diagnostic["qualification"])
        for offset in [1/3,-1/3,1]:
            wrong=copy.deepcopy(marker);wrong["markerReferenceIndicator"][0]+=offset
            with self.subTest(markerOffset=offset),self.assertRaises(ValueError):NATIVE.validate_form_field_rows([wrong],["marker-gap-diagnostic"])
        missing=copy.deepcopy(marker);missing["markerReferenceIndicator"]=[]
        with self.assertRaises(ValueError):NATIVE.validate_form_field_rows([missing],["marker-gap-diagnostic"])
        with self.assertRaises(ValueError):NATIVE.reconcile_form_field_ios("FIELD_NATIVE_OBSERVATION "+json.dumps(marker),{"batch":"form-field-styles"})
        for kind in ["duplicate","paint","origin","outside","root-ref","size","retired","zero"]:
            bad=copy.deepcopy(row)
            if kind=="duplicate":
                with self.assertRaises(ValueError):NATIVE.validate_form_field_rows([bad,bad],["fractional"])
                continue
            if kind=="paint":bad["referenceExact"]=False
            elif kind=="origin":bad["matchedReferenceParent"][0]+=1/3
            elif kind=="outside":bad["referenceParent"][1]=844
            elif kind=="root-ref":bad["state"]["layouts"][-1]["currentTarget"]=82
            elif kind=="size":bad["root"][2]+=1
            elif kind=="retired":bad["state"]["visible"]=False;bad["state"]["childTag"]=None
            else:bad["state"]["zero"]=True
            with self.subTest(kind=kind),self.assertRaises(ValueError):NATIVE.validate_form_field_rows([bad],["fractional"])


    def test_form_field_saved_failure_remains_rejected_and_early_identity_is_selected(self):
        import ast
        import inspect
        saved=Path("node_modules/.cache/codon-native-tests/form-field-after-switcher-20261107/ios-actions-run-r2/xctest.stdout")
        if not saved.is_file(): saved=ROOT.parents[3]/saved
        self.assertTrue(saved.is_file())
        with self.assertRaises(ValueError): NATIVE.reconcile_form_field_ios(saved.read_text(),{"batch":"form-field-actions"})
        self.assertNotEqual(NATIVE.driver_exit_code(1,False,True),0)
        measured=saved.parent.parent/"ios-styles-run-r5/xctest.stdout"
        self.assertTrue(measured.is_file())
        measured_rows=[json.loads(x) for x in re.findall(r"FIELD_NATIVE_OBSERVATION (\{[^\n]+\})",measured.read_text())]
        self.assertEqual(len(measured_rows),1);self.assertTrue(measured_rows[0]["referenceExact"])
        self.assertEqual(NATIVE.validate_form_field_rows(measured_rows,["style-baseline"])["observations"],1)
        from NativeCellVerification import native_method
        with self.assertRaises(ValueError):native_method({"path":str(measured),"sha256":NATIVE.digest(measured),"method":"testFieldStylesAndConstraints","format":"xctest_log"})
        narrow_log=saved.parent.parent/"ios-styles-run-r6/xctest.stdout"
        narrow_rows=[json.loads(x) for x in re.findall(r"FIELD_NATIVE_OBSERVATION (\{[^\n]+\})",narrow_log.read_text())]
        narrow=next(x for x in narrow_rows if x["name"]=="long-narrow")
        with self.assertRaises(ValueError):NATIVE.validate_form_field_rows([narrow],["long-narrow"])
        corrected=copy.deepcopy(narrow);corrected.update(parent=[26,128,280,261],referenceParent=[26,397,280,261],matchedReferenceParent=[26,128,280,261],root=[38,140,160,236.3333740234375],referenceRoot=[38,409,160,236.3333740234375])
        self.assertEqual(NATIVE.validate_form_field_rows([corrected],["long-narrow"])["observations"],1)
        clipped=copy.deepcopy(corrected);clipped["root"][3]=238
        with self.assertRaises(ValueError):NATIVE.validate_form_field_rows([clipped],["long-narrow"])
        with self.assertRaises(ValueError):native_method({"path":str(narrow_log),"sha256":NATIVE.digest(narrow_log),"method":"testFieldStylesAndConstraints","format":"xctest_log"})
        source=ast.parse(inspect.getsource(NATIVE.run_ios))
        callback=next(node for node in ast.walk(source) if isinstance(node,ast.IfExp) and isinstance(node.body,ast.Call) and isinstance(node.body.func,ast.Name) and node.body.func.id=="early_tooltip_observer")
        code=compile(ast.fix_missing_locations(ast.Expression(callback)),"actual-form-field-identity-callback","eval")
        for batch in ["form-field-actions","form-field-styles","form-field-motion"]:
            identity=MagicMock(return_value="existing identity callback")
            result=eval(code,{"config":{"batch":batch},"session":object(),"observer":{},"early_tooltip_observer":identity})
            self.assertEqual(result,"existing identity callback");self.assertEqual(identity.call_count,1)
        swift=(ROOT/"MeterG02TrialTests.swift").read_text().split("final class FormFieldTrialTests:",1)[1]
        self.assertIn('Bundle(for:FormFieldTrialTests.self)',swift)
        self.assertLess(swift.index('NATIVE_LOADED_OBSERVER_EARLY'),swift.index('app.launch()'))
        motion=swift.split('func testFieldMotionAndRetirement()',1)[1]
        self.assertLess(motion.index('Actual selected Field motion fixture'),motion.index('settings.launch()'))
        self.assertIn('type == .button ? element.label : ""',swift)














    @unittest.skipUnless(Path("/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swift").is_file(), "Actual Foundation predicate controls require Xcode")
    def test_tooltip_actual_identifier_lookup_avoids_scroll_label_and_rejects_aliases(self):
        for class_name in ["TooltipTrialTests","FormFieldTrialTests"]:
            source=(ROOT/"MeterG02TrialTests.swift").read_text().split("final class "+class_name+":",1)[1]
            lookup=next(line for line in source.splitlines() if "private func node(" in line)
            harness=r'''
    import Foundation
    var labelReads=0
    final class XCUIElement:NSObject {
        @objc dynamic var identifier:String
        let text:String
        let exists:Bool
        @objc dynamic var label:String {labelReads += 1;return text}
        init(_ identifier:String,_ label:String="",exists:Bool=true){self.identifier=identifier;self.text=label;self.exists=exists}
    }
    enum Kind {case any}
    struct XCUIElementQuery {
        let elements:[XCUIElement]
        // Replay the label-first alias lookup observed in the saved XCTest trace.
        func matching(identifier:String)->Self {Self(elements:elements.filter{$0.label==identifier || $0.identifier==identifier})}
        func matching(_ predicate:NSPredicate)->Self {Self(elements:elements.filter{predicate.evaluate(with:$0)})}
        var firstMatch:XCUIElement {elements.first ?? XCUIElement("",exists:false)}
    }
    struct XCUIApplication {
        let elements:[XCUIElement]
        func descendants(matching:Kind)->XCUIElementQuery {XCUIElementQuery(elements:elements)}
    }
    final class Harness {
        let app:XCUIApplication
        init(_ elements:[XCUIElement]){app=XCUIApplication(elements:elements)}
    ACTUAL_LOOKUP
        func lookup(_ id:String)->XCUIElement {node(id)}
    }
    let indicator=XCUIElement("","Vertical scroll bar, 3 pages")
    let alias=XCUIElement("unrelated-control","tooltip-native-fixture")
    let actual=XCUIElement("tooltip-native-fixture","caller label")
    let duplicate=XCUIElement("tooltip-native-fixture","another label")
    let quotedID="tooltip-native-'quoted'[*]"
    let quoted=XCUIElement(quotedID,"caller label")
    let exact=Harness([indicator,alias,actual,duplicate,quoted])
    let target=exact.lookup("tooltip-native-fixture")
    let missing=Harness([indicator,alias]).lookup("tooltip-native-fixture")
    let literal=exact.lookup(quotedID)
    let result:[String:Any]=["labelReads":labelReads,"exactOriginalTarget":target===actual,"missingRejected":!missing.exists,"literalIdentifier":literal===quoted]
    print(String(data:try JSONSerialization.data(withJSONObject:result,options:.sortedKeys),encoding:.utf8)!)
    '''.replace("ACTUAL_LOOKUP",lookup)
            path=self.root/"TooltipIdentifierLookup.swift";path.write_text(harness)
            result=subprocess.run(["/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swift","-module-cache-path",str(NATIVE.CACHE/"swift-host-module-cache"),str(path)],capture_output=True,text=True,timeout=60)
            self.assertEqual(result.returncode,0,result.stderr[-5000:]);actual=json.loads(result.stdout)
            for key,expected in {"labelReads":0,"exactOriginalTarget":True,"missingRejected":True,"literalIdentifier":True}.items():
                with self.subTest(control=key):self.assertEqual(actual[key],expected)

    def test_tooltip_selected_methods_and_actual_admission_boundary(self):
        for phase,method in [("all",["testTooltipOwnershipDelayAndLifetime","testTooltipStylesAndConstraint","testTooltipMotionAndRetirement"]),("ownership","testTooltipOwnershipDelayAndLifetime"),("styles","testTooltipStylesAndConstraint"),("motion","testTooltipMotionAndRetirement")]:
            batch="tooltip" if phase=="all" else "tooltip-"+phase;plan={"cell":"CAT.tooltip.G08","nativeStandard":{"platform":"ios","batch":batch,"output":str(self.root/"never-created")}};NATIVE.validate_standard_scope(plan)
            self.assertEqual(NATIVE.selection("ios",batch),{"ios":["TooltipTrialTests/"+name for name in (method if isinstance(method,list) else [method])],"android":[]})
            path=self.root/(phase+".json");path.write_text(json.dumps(plan));env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"};result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(path)],env=env,capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((self.root/"never-created").exists())
            with self.assertRaises(ValueError):NATIVE.selection("android",batch)
        with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":"CAT.combo-box.G08","nativeStandard":{"batch":"tooltip-ownership"}})

    @unittest.skipUnless(Path("/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swift").is_file(),"Actual Swift Tooltip preparation control")
    def test_tooltip_motion_requires_native_mode_acknowledgement_before_settings(self):
        source=(ROOT/"MeterG02TrialTests.swift").read_text().split("final class TooltipTrialTests:",1)[1]
        preparation=source[source.index("    func testTooltipMotionAndRetirement()"):source.index('        let settings=XCUIApplication',source.index("    func testTooltipMotionAndRetirement()"))]
        expression=re.search(r'wait\("Actual Tooltip motion fixture before Settings"\) \{ (.+) \}',preparation).group(1)
        harness=r'''
import Foundation
final class Harness {
    var current:[String:Any];var steps:[String]=[]
    init(_ row:[String:Any]){current=row}
    func state()throws->[String:Any]{current}
    func admitted()->Bool{return ACTUAL_EXPRESSION}
    func tap(_ title:String){precondition(title=="Tooltip motion");steps.append("tap")}
    func wait(_ message:String,_ predicate:()->Bool){
        precondition(message=="Actual Tooltip motion fixture before Settings");steps.append("wait")
        if !predicate(){current=["mode":"motion","mounted":true]}
        precondition(predicate())
    }
    func ready(){precondition(admitted());steps.append("ready")}
ACTUAL_PREPARATION
        precondition(admitted() && steps==["tap","wait","ready"]);steps.append("settings-launch")
    }
}
// The first row is the actual r7 pre-Settings state that failed its setup guard.
let behavior:[String:Any]=["mode":"behavior","mounted":true,"open":false,"rootTag":NSNull()]
for wrong:[String:Any] in [behavior,["mode":"motion","mounted":false],["mounted":true],["mode":"motion"]] {precondition(!Harness(wrong).admitted())}
for row:[String:Any] in [behavior,["mode":"motion","mounted":true]] {
    let h=Harness(row);try h.testTooltipMotionAndRetirement();precondition(h.steps==["tap","wait","ready","settings-launch"])
}
print("PASS actual Tooltip preparation rejects retained behavior state and admits native mode before Settings")
'''.replace("ACTUAL_EXPRESSION",expression).replace("ACTUAL_PREPARATION",preparation)
        path=self.root/"TooltipMotionPreparation.swift";path.write_text(harness)
        result=subprocess.run(["/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swift","-module-cache-path",str(NATIVE.CACHE/"swift-host-module-cache"),str(path)],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr[-5000:]);self.assertIn("PASS actual Tooltip preparation",result.stdout)

    @unittest.skipUnless(Path("/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swift").is_file(),"Actual Swift Tooltip calibration control")
    def test_tooltip_calibration_preserves_candidates_and_waits_for_exact_native_endpoint(self):
        source=(ROOT/"MeterG02TrialTests.swift").read_text().split("final class TooltipTrialTests:",1)[1]
        calibration=source.split('    private func motion(_ name:String,reduced:Bool)throws{',1)[1].split('        let initial=',1)[0]
        self.assertIn('continueAfterFailure=false',source);self.assertNotIn('Thread.sleep',calibration)
        harness=r'''
import Foundation
import CoreGraphics
struct CaptureError:Error{}
enum Feed{static var mode="",title="",attempt=0,failed=false,waitFailed=false;static var rows:[[String:Any]]=[],events:[String]=[]}
func XCTAssertEqual<T:Equatable>(_ a:T,_ b:T){Feed.events.append("assert-"+Feed.title);if a != b{Feed.failed=true}}
func XCTUnwrap<T>(_ value:T?)throws->T{guard let value else{throw CaptureError()};return value}
struct Image{let pixel:[Int];let width=1170,height=2532}
struct Picture{let cgImage:Image?};struct Shot{let image:Picture}
struct XCUIScreen{
    static var main:Self{Self()}
    func screenshot()->Shot{
        Feed.attempt+=1;Feed.events.append("capture-"+Feed.title)
        let green=[17,119,51,255],near=[17,118,50,255]
        let pixel=Feed.title=="First" ? [187,51,34,255] : Feed.mode=="persistent-near" ? near : Feed.mode=="wrong-alpha" ? [17,119,51,254] : Feed.mode=="near-then-exact" && Feed.attempt==1 ? near : green
        return Shot(image:Picture(cgImage:Image(pixel:pixel)))
    }
}
struct Node{let frame:CGRect};struct Windows{var firstMatch:Node{Node(frame:CGRect(x:0,y:0,width:390,height:844))}};struct App{var windows:Windows{Windows()}}
final class Harness{
    let app=App()
    func tap(_ title:String){if title=="First" || title=="Second"{Feed.title=title;Feed.attempt=0}}
    func ready(){}
    func node(_ id:String)->Node{precondition(id=="tooltip-native-surface");return Node(frame:CGRect(x:85,y:576,width:220,height:60))}
    func rect(_ v:CGRect)->[Double]{[v.minX,v.minY,v.width,v.height].map(Double.init)}
    func sample(_ image:Image,_ point:CGPoint,_ window:CGRect,_ scale:CGFloat)throws->[Int]{precondition(point==CGPoint(x:101,y:600) && window==app.windows.firstMatch.frame && scale==3);return image.pixel}
    func mark(_ name:String,_ row:[String:Any],_ shot:Shot?,prefix:String)throws{
        precondition(prefix=="TOOLTIP_NATIVE_CALIBRATION" && row["root"] as? [Double]==[85,576,220,60]);Feed.events.append("mark-"+Feed.title);Feed.rows.append(row)
        if Feed.mode=="capture-error" && Feed.title=="Second"{throw CaptureError()}
    }
    func wait(_ title:String,_ predicate:()->Bool){
        precondition(title=="Exact native Tooltip "+Feed.title+" glyph endpoint")
        // Finite source-control feed; installed code keeps the existing remaining-work wait.
        for _ in 0..<2{if predicate(){return}};Feed.waitFailed=true
    }
    func run(_ name:String)throws{
ACTUAL_CALIBRATION
    }
}
for mode in ["exact","near-then-exact","persistent-near","wrong-alpha","capture-error"]{
    Feed.mode=mode;Feed.title="";Feed.attempt=0;Feed.failed=false;Feed.waitFailed=false;Feed.rows=[];Feed.events=[]
    var threw=false;do{try Harness().run("normal")}catch{threw=true}
    let second=Feed.rows.filter{($0["name"] as? String ?? "").hasPrefix("normal-Second")};precondition(!second.isEmpty)
    for title in ["First","Second"]{if let assertion=Feed.events.firstIndex(of:"assert-"+title){precondition(Feed.events.firstIndex(of:"mark-"+title)!<assertion)}}
    if mode=="exact" || mode=="near-then-exact"{
        precondition(!Feed.failed && !Feed.waitFailed && !threw && second.last?["glyphRGBA"] as? [Int]==[17,119,51,255])
        if mode=="near-then-exact"{precondition(second.count==2 && second[0]["glyphRGBA"] as? [Int]==[17,118,50,255] && second[0]["name"] as? String=="normal-Second-candidate-1")}
    }else if mode=="capture-error"{precondition(threw && second.count==1 && !Feed.events.contains("assert-Second"))}
    else{precondition(!threw && Feed.waitFailed && Feed.failed && second.count==2)}
}
print("PASS actual Tooltip calibration: exact, near-to-exact retained, persistent near, alpha negative, capture-error propagation")
'''.replace('ACTUAL_CALIBRATION',calibration)
        path=self.root/"TooltipCalibration.swift";path.write_text(harness)
        result=subprocess.run(["/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swift","-module-cache-path",str(NATIVE.CACHE/"swift-host-module-cache"),str(path)],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr[-5000:]);self.assertIn("PASS actual Tooltip calibration",result.stdout)

    def test_tooltip_early_identity_reads_actual_loaded_plugin_and_full_host(self):
        app=self.root/"Actual.app";bundle=app/"PlugIns/CodonNativeComponents.xctest";bundle.mkdir(parents=True);exe=bundle/"CodonNativeComponents";exe.write_bytes(b"real loaded corrected plugin");(app/"host").write_bytes(b"correct host");observer=NATIVE.identity(app);expected=NATIVE.digest(exe)
        session=MagicMock();session.output=self.root/"run";session.output.mkdir();log=session.output/"xctest.stdout";row={"path":str(bundle),"executable":str(exe),"sha256":expected,"expectedSHA256":expected,"epochMs":1700000000000};log.write_text("NATIVE_LOADED_OBSERVER_EARLY "+json.dumps(row)+"\n");NATIVE.early_tooltip_observer(session,observer)();out=session.output/"early-loaded-observer.json";self.assertEqual(json.loads(out.read_text())["executableSHA256"],expected)
        for wrong in ["plugin","host","reported"]:
            out.unlink(missing_ok=True);exe.write_bytes(b"real loaded corrected plugin");(app/"host").write_bytes(b"correct host");bad=copy.deepcopy(row)
            if wrong=="plugin":exe.write_bytes(b"wrong loaded plugin")
            elif wrong=="host":(app/"host").write_bytes(b"wrong actual host")
            else:bad["sha256"]="f"*64
            log.write_text("NATIVE_LOADED_OBSERVER_EARLY "+json.dumps(bad)+"\n")
            with self.subTest(wrong=wrong),self.assertRaises(ValueError):NATIVE.early_tooltip_observer(session,observer)()
            self.assertFalse(out.exists())

    def test_tooltip_reader_rejects_wrong_paint_geometry_refs_and_duplicates(self):
        row={"name":"custom","state":{"mode":"styles","case":"custom","open":True,"mounted":True,"rootTag":81,"narrow":False,"background":"#ddeeff","layouts":[{"target":81,"currentTarget":81,"width":220,"height":54}],"rendered":{"placement":"top"}},"root":[70,350,220,54],"anchor":[120,424,120,44],"window":[0,0,390,844],"scale":3,"imageWidth":1170,"imageHeight":2532,"backgroundRGBA":[221,238,255,255],"borderRGBA":[[17,119,51,255]]*3,"arrowRGBA":[47,125,24,255],"arrow":[171,401,18,10],"arrowLayoutSource":"original-native-onLayout","canvasRGBA":[128,128,128,255]}
        row["state"]["arrowLayout"]={"target":82,"currentTarget":82,"parentTag":81,"x":110,"y":51,"width":18,"height":10}
        offsets=[(2.5,1),(5,1),(7.5,1),(5,3.5),(.5,3.5),(9.5,3.5),(5,7.5)]
        row["arrowSamples"]=[{"point":[171+x,401+y],"rgba":[47,125,24,255] if i<4 else [128,128,128,255]} for i,(x,y) in enumerate(offsets)]
        self.assertEqual(NATIVE.validate_tooltip_rows([row],["custom"])["observations"],1)
        for wrong in ["background","border","arrow","outside","ref","width","duplicate","arrow-parent","arrow-ref","arrow-width","arrow-frame","arrow-sample","body-overlap","solid-impostor","canvas"]:
            bad=copy.deepcopy(row)
            if wrong=="duplicate":
                with self.assertRaises(ValueError):NATIVE.validate_tooltip_rows([bad,bad],["custom"])
                continue
            if wrong=="background":bad["backgroundRGBA"][0]+=1
            elif wrong=="border":bad["borderRGBA"]=bad["borderRGBA"][:2]
            elif wrong=="arrow":bad["arrowRGBA"][0]+=1
            elif wrong=="outside":bad["root"][0]=389
            elif wrong=="ref":bad["state"]["layouts"][-1]["currentTarget"]=82
            elif wrong=="arrow-parent":bad["state"]["arrowLayout"]["parentTag"]=83
            elif wrong=="arrow-ref":bad["state"]["arrowLayout"]["currentTarget"]=83
            elif wrong=="arrow-width":bad["state"]["arrowLayout"]["width"]=10
            elif wrong=="arrow-frame":bad["arrow"][0]+=1
            elif wrong=="arrow-sample":bad["arrowSamples"][1]["point"][1]+=4
            elif wrong=="body-overlap":bad["arrow"][1]-=10;bad["state"]["arrowLayout"]["y"]-=10
            elif wrong=="solid-impostor":
                for sample in bad["arrowSamples"]:sample["rgba"]=[47,125,24,255]
            elif wrong=="canvas":bad["canvasRGBA"]=[47,125,24,255]
            else:bad["root"][2]+=1
            with self.subTest(wrong=wrong),self.assertRaises(ValueError):NATIVE.validate_tooltip_rows([bad],["custom"])

    def test_tooltip_retirement_keeps_owner_request_without_requiring_retired_host(self):
        row={"name":"retired","state":{"open":True,"mounted":False,"rootTag":None},"scale":3,"root":[]}
        self.assertEqual(NATIVE.validate_tooltip_rows([row],["retired"])["observations"],1)
        for wrong in ["root","tag"]:
            bad=copy.deepcopy(row)
            if wrong=="root":bad["root"]=[10,10,220,44]
            else:bad["state"]["rootTag"]=81
            with self.subTest(wrong=wrong),self.assertRaises(ValueError):NATIVE.validate_tooltip_rows([bad],["retired"])

    def test_tooltip_combined_batch_retains_each_cohort_and_rejects_incomplete_identity(self):
        names=["closed","cold-open","vetoed-close","echoed-close","delayed-close","retired","fresh-open"]+NATIVE.TOOLTIP_STYLES+["normal-fresh","reduced-fresh"]
        def state(name):
            opened=name in ["cold-open","vetoed-close","fresh-open"]
            return {"anchorTag":84 if name=="fresh-open" else 80,"rootTag":82 if name=="fresh-open" else 81,"actions":1 if name=="vetoed-close" else 2,"open":opened,"requests":[{"value":True,"epochMs":1500},{"value":False,"epochMs":2500}],"commands":[{"epochMs":0},{"epochMs":2000}],"events":[{"target":80,"currentTarget":80}]*2,"inspection":{"target":84 if name=="fresh-open" else 80,"ownerId":"owner","windowId":"window","platform":"ios","descriptionAvailable":opened},"palette":"dark" if name=="dark" else "light"}
        rows=[{"name":name,"state":state(name)} for name in names]
        intervals=[]
        for reduced in [False,True]:
            trace=[{"name":"retarget-"+str(i),"epochMs":i*100} for i in range(40)]+[{"name":"settle","epochMs":7500},{"name":"entry-acknowledged","epochMs":7600,"rootLayout":{"target":87,"currentTarget":87,"width":220,"height":60},"rendered":{"isEntering":True,"placement":"top"}},{"name":"retire","epochMs":9000},{"name":"fresh","epochMs":11000}]
            moving={"captureStartedEpochMs":1000,"captureEpochMs":1100,"glyphRGBA":[187,51,34,255] if reduced else [100,80,40,255],"backgroundRGBA":[34,68,102,255],"scale":3}
            entry={"captureStartedEpochMs":7500,"captureEpochMs":7900,"glyphRGBA":[17,119,51,255] if reduced else [52,139,81,255],"backgroundRGBA":[34,68,102,255] if reduced else [67,96,125,255],"scale":3}
            intervals.append({"name":"reduced" if reduced else "normal","reduced":reduced,"state":{"commands":trace,"motionEvents":[reduced]},"rootTagBefore":87,"rootFrameBefore":[85,576,220,60],"placementBefore":"top","samples":[moving,copy.deepcopy(moving),entry,{"captureStartedEpochMs":9500,"captureEpochMs":9600,"glyphRGBA":[255]*4,"backgroundRGBA":[255]*4}]})
        early={"sha256":"a"*64,"expectedSHA256":"a"*64}
        raw="\n".join(["NATIVE_LOADED_OBSERVER_EARLY "+json.dumps(early)]*3+["TOOLTIP_NATIVE_OBSERVATION "+json.dumps(row) for row in rows]+["TOOLTIP_NATIVE_MOTION "+json.dumps(row) for row in intervals]+["METER_STYLE_MOTION_ORIGINAL 0","METER_STYLE_MOTION_RESTORED 0"])
        def coverage(values,expected):
            self.assertEqual(expected,names)
            if sorted(row["name"] for row in values)!=sorted(expected):raise ValueError("Missing cohort observations")
            return {"status":"PASS","observations":len(values)}
        with patch.object(NATIVE,"validate_tooltip_rows",side_effect=coverage):
            result=NATIVE.reconcile_tooltip_ios(raw,{"batch":"tooltip"});self.assertEqual(result["observations"],16);self.assertEqual(result["motionFrames"],8)
            for bad in [raw.replace("NATIVE_LOADED_OBSERVER_EARLY "+json.dumps(early)+"\n","",1),raw.replace('"name": "fresh-open"','"name": "missing-fresh"'),raw.replace("METER_STYLE_MOTION_RESTORED 0","METER_STYLE_MOTION_RESTORED 1")]:
                with self.assertRaises(ValueError):NATIVE.reconcile_tooltip_ios(bad,{"batch":"tooltip"})
            for wrong in ["root","layout","early","late","not-entering","placement","opaque","unrelated-fresh","before-ack","reduced-interpolation"]:
                bad=copy.deepcopy(intervals);ack=bad[0]["state"]["commands"][-3]
                if wrong=="root":ack["rootLayout"]["currentTarget"]=88
                elif wrong=="layout":ack["rootLayout"]["width"]=221
                elif wrong=="early":ack["epochMs"]=7400
                elif wrong=="late":ack["epochMs"]=9100
                elif wrong=="not-entering":ack["rendered"]["isEntering"]=False
                elif wrong=="placement":ack["rendered"]["placement"]="bottom"
                elif wrong=="opaque":bad[0]["samples"][2]["backgroundRGBA"]=[34,68,102,255]
                elif wrong=="unrelated-fresh":bad[0]["samples"][2].update(captureStartedEpochMs=11272,captureEpochMs=11555)
                elif wrong=="before-ack":bad[0]["samples"][2].update(captureStartedEpochMs=7000,captureEpochMs=7300)
                else:bad[1]["samples"][2]["backgroundRGBA"]=[67,96,125,255]
                changed=raw
                for original,replacement in zip(intervals,bad):changed=changed.replace("TOOLTIP_NATIVE_MOTION "+json.dumps(original),"TOOLTIP_NATIVE_MOTION "+json.dumps(replacement))
                with self.subTest(wrong=wrong),self.assertRaises(ValueError):NATIVE.reconcile_tooltip_ios(changed,{"batch":"tooltip"})

    @unittest.skipUnless(Path("/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swift").is_file(), "Actual Swift capture controls require Xcode; portable reader/identity controls remain active")
    def test_tooltip_actual_capture_preserves_acquired_evidence_when_arrow_is_not_in_ax(self):
        source=(ROOT/"MeterG02TrialTests.swift").read_text().split("final class TooltipTrialTests:",1)[1]
        capture=source[source.index("    private func capture("):source.index("    func testTooltipOwnershipDelayAndLifetime")]
        entire=(ROOT/"MeterG02TrialTests.swift").read_text();predicates=[]
        for signature in ["private func tooltipArrowEdgeMatches(","private func tooltipArrowPaintMatches("]:
            start=entire.index(signature);end=entire.index("\n}",start)+2;predicates.append(entire[start:end])
        harness=r'''
import Foundation
import CoreGraphics
enum Failure: Error { case missingSnapshot }
func XCTUnwrap<T>(_ value:T?,_ message:String="") throws -> T {guard let value else{throw Failure.missingSnapshot};return value}
func XCTAssertTrue(_ value:Bool,_ message:String=""){precondition(value,message)}
func XCTAssertFalse(_ value:Bool){precondition(!value)}
func XCTAssertNotEqual<T:Equatable>(_ a:T,_ b:T){precondition(a != b)}
func XCTAssertNil<T>(_ value:T?){precondition(value==nil)}
func XCTAssertEqual<T:Equatable>(_ a:T,_ b:T){precondition(a==b)}
func XCTAssertEqual(_ a:Double,_ b:Double,accuracy:Double){precondition(abs(a-b)<=accuracy)}
func XCTAssertLessThanOrEqual<T:Comparable>(_ a:T,_ b:T,_ message:String=""){precondition(a<=b)}
func XCTAssertGreaterThan<T:Comparable>(_ a:T,_ b:T){precondition(a>b)}
func XCTAssertGreaterThanOrEqual<T:Comparable>(_ a:T,_ b:T){precondition(a>=b)}
enum Kind {case window,other}
enum Orientation {case up}
struct Image {var width=1170;var height=2532}
struct ShotImage {var cgImage:Image?=Image();var imageOrientation=Orientation.up}
struct XCUIScreenshot {var image=ShotImage()}
struct XCUIScreen {static let main=XCUIScreen();func screenshot()->XCUIScreenshot{XCUIScreenshot()}}
struct XCUIElementSnapshot {var identifier:String;var frame:CGRect;var label="";var elementType=Kind.other;var children:[XCUIElementSnapshot]=[]}
var measuredArrow=false
var mountedHost=true
struct App {
    func snapshot() throws -> XCUIElementSnapshot {
        var row:[String:Any]=["open":true,"mounted":mountedHost,"rootTag":mountedHost ? 81:NSNull(),"narrow":false,"mode":"behavior","case":"behavior","background":"#171717","canvasColor":"#808080","layouts":[["target":81,"currentTarget":81,"width":220,"height":44]],"rendered":["placement":"top"]]
        if measuredArrow{row["arrowLayout"]=["target":82,"currentTarget":82,"parentTag":81,"x":110,"y":44,"width":10,"height":10]}
        var children=[
            XCUIElementSnapshot(identifier:"tooltip-native-state",frame:.zero,label:String(data:try JSONSerialization.data(withJSONObject:row),encoding:.utf8)!),
            XCUIElementSnapshot(identifier:"tooltip-native-surface",frame:CGRect(x:85,y:590,width:220,height:44)),
            XCUIElementSnapshot(identifier:"tooltip-native-anchor",frame:CGRect(x:143,y:644,width:103,height:44)),
            XCUIElementSnapshot(identifier:"tooltip-native-body",frame:CGRect(x:90,y:595,width:210,height:34),label:"Native description / renseignements"),
            XCUIElementSnapshot(identifier:"tooltip-native-canvas",frame:CGRect(x:26,y:444,width:338,height:340))]
        if !mountedHost{children=Array(children.prefix(1))}
        return XCUIElementSnapshot(identifier:"window",frame:CGRect(x:0,y:0,width:390,height:844),elementType:.window,children:children)
    }
}
ACTUAL_ARROW_PREDICATES
final class Harness {
    let app=App();var preserved:[String]=[]
    func rect(_ value:CGRect)->[Double]{[value.minX,value.minY,value.width,value.height].map(Double.init)}
    func number(_ row:[String:Any],_ key:String)throws->Double{try XCTUnwrap(row[key] as? NSNumber).doubleValue}
    func color(_ value:String)throws->[Int]{value=="#808080" ? [128,128,128,255]:[23,23,23,255]}
    func sample(_ image:Image,_ point:CGPoint,_ window:CGRect,_ scale:CGFloat)throws->[Int]{
        if point.x<85{return [128,128,128,255]}
        if point.y>=634{let x=point.x-190,y=point.y-634;return y<=5 && x>=y && x<=10-y ? [23,23,23,255]:[128,128,128,255]}
        return [23,23,23,255]
    }
    func mark(_ name:String,_ row:[String:Any],_ shot:XCUIScreenshot?,prefix:String="TOOLTIP_NATIVE_OBSERVATION")throws{preserved.append(prefix);precondition(row["name"] as? String=="cold-open");if let shot{precondition(shot.image.cgImage?.width==1170)}}
ACTUAL_CAPTURE_METHOD
    func run() throws {try capture("cold-open")}
}
let harness=Harness()
do{try harness.run();fatalError("Missing decorative arrow must still fail validation")}catch Failure.missingSnapshot{}catch{fatalError("Unexpected failure: \(error)")}
precondition(harness.preserved==["TOOLTIP_NATIVE_CAPTURE"],"Acquired screenshot/state were lost before missing-arrow assertion")
measuredArrow=true
let nativeLayout=Harness();try nativeLayout.run()
precondition(nativeLayout.preserved==["TOOLTIP_NATIVE_CAPTURE","TOOLTIP_NATIVE_ARROW_CAPTURE","TOOLTIP_NATIVE_OBSERVATION"],"Measured hidden arrow did not retain its full paint/layout checks")
mountedHost=false
let retired=Harness();try retired.run()
precondition(retired.preserved==["TOOLTIP_NATIVE_CAPTURE","TOOLTIP_NATIVE_OBSERVATION"],"Retired native host incorrectly required for retained owner open request")
precondition(!tooltipArrowEdgeMatches([85,590.3333129882812,220,43.666748046875],[190,623.9999809265137,10,10],"top",0,3),"Retained body-contained arrow must fail")
precondition(!tooltipArrowPaintMatches(Array(repeating:[23,23,23,255],count:7),[23,23,23,255]),"Solid body-colored rectangle must fail")
print("PASS actual capture preserved evidence and retained missing-arrow failure")
'''.replace("ACTUAL_CAPTURE_METHOD",capture).replace("ACTUAL_ARROW_PREDICATES","\n\n".join(predicates))
        path=self.root/"TooltipCaptureFailure.swift";path.write_text(harness)
        result=subprocess.run(["/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swift","-module-cache-path",str(NATIVE.CACHE/"swift-host-module-cache"),str(path)],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr[-5000:]);self.assertIn("PASS actual capture",result.stdout)

    def test_standard_scope_and_actual_linear_progress_entry_fail_before_sdk(self):
        for cell,batch,valid in [("CAT.meter.G04","meter-style",True),("CAT.linear-progress.G04","linear-progress-risk",True),("CAT.linear-progress.G07","linear-progress-risk",True),("CAT.linear-progress.G04","meter-style",False),("CAT.tag.G04","linear-progress-risk",False),("CAT.meter.G04","linear-progress-risk",False)]:
            plan={"cell":cell,"nativeStandard":{"platform":"ios","batch":batch,"output":str(self.root/"never-created")}}
            if valid:NATIVE.validate_standard_scope(plan)
            else:
                with self.assertRaises(ValueError):NATIVE.validate_standard_scope(plan)
        path=self.root/"lp-plan.json";path.write_text(json.dumps({"cell":"CAT.linear-progress.G04","nativeStandard":{"platform":"ios","batch":"linear-progress-risk","output":str(self.root/"never-created")}}))
        env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
        result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(path)],env=env,capture_output=True,text=True,timeout=10)
        self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((self.root/"never-created").exists())

    def test_text_scope_compiled_selection_and_actual_no_admission_entry(self):
        for platform in ["ios", "android"]:
            plan={"cell":"CAT.text.G04","nativeStandard":{"platform":platform,"batch":"text-style","output":str(self.root/"never-created")}}
            NATIVE.validate_standard_scope(plan)
            self.assertEqual(len(NATIVE.selection(platform,"text-style")[platform]),3 if platform=="ios" else 2)
            path=self.root/(platform+"-text-plan.json");path.write_text(json.dumps(plan))
            env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
            result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(path)],env=env,capture_output=True,text=True,timeout=10)
            self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((self.root/"never-created").exists())
        with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":"CAT.text.G04","nativeStandard":{"batch":"meter-style"}})

    def test_text_context_reuses_only_clean_exact_app_typography(self):
        from NativeTextStyleCheck import NAMES
        from test_native_text_style_check import TextStyleTests
        rows=TextStyleTests().rows("ios")
        log=self.root/"retained.log";log.write_text("Test Case '-[C.TextStyleTrialTests testTextTypographyAndClear]' passed (81.499 seconds).\n"+"\n".join("TEXT_STYLE_OBSERVATION "+json.dumps(row) for row in rows))
        loaded=self.root/"loaded.json";loaded.write_text(json.dumps({"status":"PASS","observerManifestSHA256":"b"*64}))
        retained=self.root/"retained.json"
        value={"path":str(log),"sha256":NATIVE.digest(log),"format":"xctest_log","method":"testTextTypographyAndClear","maximumSeconds":180,"appManifestSHA256":"a"*64,"loadedObserver":{"path":str(loaded),"sha256":NATIVE.digest(loaded)},"observerManifestSHA256":"b"*64}
        retained.write_text(json.dumps(value));config={"batch":"text-style-context","retainedTextTypographyMethod":{"path":str(retained),"sha256":NATIVE.digest(retained)}}
        raw="\n".join("TEXT_STYLE_OBSERVATION "+json.dumps(row) for row in rows if row["name"] not in NAMES[:4])
        self.assertEqual(NATIVE.reconcile_text_style_ios(raw,config,{"manifestSHA256":"a"*64})["observations"],8)
        with self.assertRaises(ValueError):NATIVE.reconcile_text_style_ios(raw,config,{"manifestSHA256":"c"*64})
        log.write_text(log.read_text().replace("passed (81.499 seconds)","failed (81.499 seconds)"));value["sha256"]=NATIVE.digest(log);retained.write_text(json.dumps(value));config["retainedTextTypographyMethod"]["sha256"]=NATIVE.digest(retained)
        with self.assertRaises(ValueError):NATIVE.reconcile_text_style_ios(raw,config,{"manifestSHA256":"a"*64})
        self.assertEqual(len(NATIVE.selection("ios","text-style-context")["ios"]),2)
        with self.assertRaises(ValueError):NATIVE.selection("android","text-style-context")

    def test_linear_progress_risk_reader_preserves_semantics_pixels_events_and_geometry_negatives(self):
        rows=[]
        for index,name in enumerate(NATIVE.RISK_NAMES):
            unknown=0<index<7
            rows.append({"name":name,"unknown":unknown,"captureEpochMs":1700000000000+index,"scale":3,"frame":[15,250,350,14],"nativeLabel":"Task progress","nativeValue":None if unknown else "25%","motionEvents":[True] if index>=4 else [],"centerPaintedPixels":20,"samples":[{"rgba":[0,122,255,255],"referenceRGBA":[0,122,255,255]},{"rgba":[255]*4,"referenceRGBA":[255]*4}]})
        self.assertEqual(NATIVE.selection("android","linear-progress-risk"),{"ios":[],"android":["live-motion"]})
        self.assertEqual(NATIVE.selection("ios","linear-progress-risk")["ios"],["MeterStyleTrialTests/testLinearProgressLiveMotion"])
        self.assertEqual(NATIVE.validate_progress_risk_rows(rows,"ios")["observations"],8)
        for kind in ["stale-value","blank-cue","missing-event","wrong-color","wrong-frame","duplicate"]:
            bad=copy.deepcopy(rows)
            if kind=="stale-value":bad[1]["nativeValue"]="25%"
            elif kind=="blank-cue":bad[4]["centerPaintedPixels"]=0
            elif kind=="missing-event":bad[4]["motionEvents"]=[]
            elif kind=="wrong-color":bad[0]["samples"][0]["rgba"][0]=1
            elif kind=="wrong-frame":bad[2]["frame"][1]+=1
            else:bad.append(bad[0])
            with self.subTest(kind=kind),self.assertRaises(ValueError):NATIVE.validate_progress_risk_rows(bad,"ios")
        raw="\n".join("LINEAR_PROGRESS_RISK_OBSERVATION "+json.dumps(row) for row in rows)+"\nMETER_STYLE_MOTION_ORIGINAL 0\nMETER_STYLE_MOTION_RESTORED 0\nLINEAR_PROGRESS_RISK_INTERVALS movingDifferent=true stoppedExact=true\n"
        self.assertEqual(NATIVE.reconcile_linear_progress_risk_ios(raw)["originalAndRestoredMotion"],"0")
        with self.assertRaises(ValueError):NATIVE.reconcile_linear_progress_risk_ios(raw.replace("METER_STYLE_MOTION_RESTORED 0","METER_STYLE_MOTION_RESTORED 1"))
        with self.assertRaises(ValueError):NATIVE.reconcile_linear_progress_risk_ios(raw.replace("movingDifferent=true","movingDifferent=false"))

    def test_android_actual_range_metadata_preserves_unowned_native_type(self):
        rows=[]
        for index,name in enumerate(NATIVE.RISK_NAMES):
            unknown=0<index<7
            rows.append({"name":name,"unknown":unknown,"captureEpochMs":1700000000000+index,"scale":1.75,"frame":[45,1090,674,1114],"nativeTarget":{"className":"android.view.View","roleDescription":"Progress Bar","contentDescription":"Task progress, " if unknown else "Task progress, 25%","rangeInfo":None if unknown else {"min":0,"max":100,"current":25,"type":0},"currentValue":None if unknown else 25},"motionEvents":[True] if index>=4 else [],"centerPaintedPixels":294,"samples":[{"argb":-11628486,"referenceARGB":-11628486},{"argb":-526345,"referenceARGB":-526345}]})
        self.assertEqual(NATIVE.validate_progress_risk_rows(rows,"android")["observations"],8)
        bad=copy.deepcopy(rows);bad[0]["nativeTarget"]["rangeInfo"]["current"]=75
        with self.assertRaises(ValueError):NATIVE.validate_progress_risk_rows(bad,"android")

    def test_android_cleanup_restores_each_captured_motion_key_and_still_stops_guest_on_failure(self):
        for failed in [False,True]:
            session=NATIVE.Session(self.root/("two-keys-"+str(failed)),60,30);session.guest_owned=True;session.emulator=MagicMock(pid=54321,returncode=0);session.emulator.poll.return_value=0;session.motion_setting="0";session.additional_motion_settings={"animator_duration_scale":"0.5"}
            def command(label,argv,*args,**kwargs):
                if label=="restore-animator-setting" and failed:raise ValueError("saved denied restore")
                return "0.5" if label=="verify-animator-setting" else "0" if label=="verify-motion-setting" else ""
            session.run=MagicMock(side_effect=command);probe=MagicMock();probe.__enter__.return_value.connect_ex.return_value=NATIVE.errno.ECONNREFUSED
            with patch.object(NATIVE,"stop_owned_process",return_value=True),patch.object(NATIVE,"host_process_binding",return_value=None),patch.object(NATIVE,"build_process_pids",return_value=[]),patch.object(NATIVE.socket,"socket",return_value=probe):NATIVE.cleanup(session,{"platform":"android","sdk":"/sdk","destination":"emulator-5568"})
            names=[call.args[0] for call in session.run.call_args_list];self.assertIn("restore-motion-setting",names);self.assertIn("emulator-shutdown",names);self.assertEqual(bool(session.cleanup_errors),failed)
            proof=json.loads((session.output/"preference-restoration.json").read_text());self.assertEqual(proof["exactKeySetAndValuesVerified"],not failed)

    def test_standard_application_build_rejects_stale_map_changed_native_and_config_drift(self):
        import zipfile
        for scenario in ['valid','stale-map','changed-native','native-input-drift']:
            root=self.root/scenario;root.mkdir();fixture='apps/native-showcase/src/scenes/MeterStyleFixture.tsx';native='apps/native-showcase/android/app/build.gradle'
            for name,body in [(fixture,'current fixture'),(native,'unchanged Gradle')]:
                path=root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(body)
            source_map=root/'packager.map';source_map.write_text(json.dumps({'sources':[fixture],'sourcesContent':['old fixture']}));base=root/'base.apk'
            def archive(path,changed=False):
                path.parent.mkdir(parents=True,exist_ok=True)
                with zipfile.ZipFile(path,'w') as out:
                    out.writestr('classes.dex',b'changed' if changed else b'original DEX');out.writestr('lib/x86_64/native.so',b'original native');out.writestr('assets/index.android.bundle',b'JS')
            archive(base);freeze=root/'freeze.json';freeze.write_text(json.dumps({fixture:'0'*64,native:'0'*64 if scenario=='native-input-drift' else NATIVE.digest(root/native)}))
            identity=root/'identity.json';identity.write_text(json.dumps({'apk':str(base),'apkSHA256':NATIVE.digest(base),'packagerMap':str(source_map),'packagerMapSHA256':NATIVE.digest(source_map)}))
            session=MagicMock();session.output=root/'output';session.output.mkdir();session.env={}
            def command(name,argv):
                if name=='assemble-release':
                    archive(root/'apps/native-showcase/android/app/build/outputs/apk/release/app-release.apk',scenario=='changed-native')
                    source_map.write_text(json.dumps({'sources':[fixture],'sourcesContent':['stale fixture' if scenario=='stale-map' else 'current fixture']}))
            session.run.side_effect=command
            config={'buildTarget':'application','baseApplicationIdentity':{'path':str(identity),'sha256':NATIVE.digest(identity)},'baseApplicationSourceFreeze':{'path':str(freeze),'sha256':NATIVE.digest(freeze)},'sdk':'/sdk','jdk':'/jdk','gradleUserHome':str(root)}
            with self.subTest(scenario=scenario),patch.object(NATIVE,'REPO',root):
                if scenario=='valid':
                    result=NATIVE.build_android(session,config);self.assertEqual(result['sourceFilesSHA256'][str(root/fixture)],NATIVE.digest(root/fixture));self.assertEqual(len(json.loads((session.output/'map-proof.json').read_text())['nativeLibrariesAndDEXSHA256']),2)
                    self.assertIn('--offline',session.run.call_args_list[0].args[1]);self.assertIn('--max-workers=1',session.run.call_args_list[0].args[1])
                    self.assertEqual(session.env['GRADLE_USER_HOME'],str(root))
                    closed=root/'closed-command.json';closed.write_text(json.dumps({'exitCode':0,'ownedGroupGone':True,'argv':list(map(str,session.run.call_args_list[0].args[1]))}))
                    def bound(path):return {'path':str(path),'sha256':NATIVE.digest(path)}
                    review={**config,'completedApplicationBuild':bound(closed),'completedApplicationSourceFreeze':bound(session.output/'source-freeze.json'),'completedApplicationAPK':bound(Path(result['apk'])),'completedApplicationMap':bound(source_map)}
                    session.output=root/'review';session.output.mkdir();session.run.reset_mock()
                    self.assertEqual(NATIVE.build_android(session,review)['apkSHA256'],result['apkSHA256']);self.assertEqual([call.args[0] for call in session.run.call_args_list],['verify-signature'])
                    closed.write_text(json.dumps({'exitCode':65,'ownedGroupGone':True,'argv':[]}));review['completedApplicationBuild']=bound(closed);session.run.reset_mock()
                    with self.assertRaisesRegex(ValueError,'did not complete'):NATIVE.build_android(session,review)
                    session.run.assert_not_called()
                else:
                    with self.assertRaises(ValueError):NATIVE.build_android(session,config)
            if scenario=='native-input-drift':session.run.assert_not_called()

    def test_conflicting_owned_map_bodies_rejected(self):
        path=self.root/'map.json';path.write_text(json.dumps({'sources':['apps/fixture.tsx','apps/fixture.tsx'],'sourcesContent':['current','stale']}))
        with self.assertRaisesRegex(ValueError,'Conflicting'):NATIVE.mapped_owned_sources(path,['apps/fixture.tsx'])

    def test_startup_diagnostic_uses_only_standard_read_only_captures_and_requires_archive(self):
        import zipfile
        for fail in [False,True]:
            session=MagicMock();session.output=self.root/str(fail);session.output.mkdir()
            def command(name,argv):
                if name=='bugreport' and not fail:
                    with zipfile.ZipFile(session.output/'bugreport.zip','w') as archive:archive.writestr('bugreport.txt','actual guest diagnostic')
            session.run.side_effect=command
            with self.subTest(fail=fail),patch.object(NATIVE,'start_android',return_value=['adb','-s','emulator-5568']):
                if fail:
                    with self.assertRaisesRegex(ValueError,'archive missing'):NATIVE.diagnose_android(session,{})
                else:self.assertEqual(NATIVE.diagnose_android(session,{})['componentMethods'],0)
            names=[call.args[0] for call in session.run.call_args_list];self.assertEqual(names,['system-logcat','cpu-info','last-anr','bugreport'])
            commands=[call.args[1] for call in session.run.call_args_list];self.assertFalse(any(word in ['install','am','instrument'] for argv in commands for word in argv))
        self.assertEqual(NATIVE.selection('android','meter-startup-diagnostic'),{'ios':[],'android':[]})
        with self.assertRaises(ValueError):NATIVE.selection('ios','meter-startup-diagnostic')

    def test_optional_failure_capture_records_its_failure_without_raising_or_installing(self):
        session=MagicMock();session.output=self.root;session.guest_owned=True;session.remaining.return_value=60;session.run.side_effect=ValueError('capture unavailable')
        config={'platform':'android','action':'run','sdk':'/sdk','destination':'emulator-5568'}
        NATIVE.capture_android_failure(session,config);self.assertTrue((self.root/'failure-logcat-warning.json').exists());self.assertEqual(session.run.call_args.args[0],'failure-system-logcat')
        session.run.reset_mock();session.remaining.return_value=0;NATIVE.capture_android_failure(session,config);session.run.assert_not_called()

    def test_compiled_control_extracts_definition_even_when_call_precedes_it(self):
        source=NATIVE.android_style_control_source()
        self.assertIn('public static long meterAttemptDeadline(',source)
        self.assertNotIn('meterStartupSnapshotReady',source)

    def test_guest_cpu_correction_is_explicit_bounded_and_preserves_default(self):
        self.assertEqual(NATIVE.android_cpu_cores({}),2);self.assertEqual(NATIVE.android_cpu_cores({'cores':4}),4)
        for value in [0,1,8,'4',True,None]:
            with self.subTest(value=value),self.assertRaises(ValueError):NATIVE.android_cpu_cores({'cores':value})

    def test_native_build_id_comparison_preserves_every_other_byte(self):
        import struct
        raw=bytearray(340);raw[:6]=b'\x7fELF\x02\x01';struct.pack_into('<H',raw,18,62);struct.pack_into('<Q',raw,40,64);struct.pack_into('<HHH',raw,58,64,3,1)
        names=b'\0.shstrtab\0.note.gnu.build-id\0';raw[256:256+len(names)]=names
        struct.pack_into('<IIQQQQIIQQ',raw,128,1,3,0,0,256,len(names),0,0,1,0)
        struct.pack_into('<IIQQQQIIQQ',raw,192,11,7,2,0,300,36,0,0,4,0)
        struct.pack_into('<III',raw,300,4,20,3);raw[312:316]=b'GNU\0';raw[316:336]=b'a'*20
        baseline,old_id=NATIVE.native_runtime_digest(bytes(raw));changed=bytearray(raw);changed[316:336]=b'b'*20
        digest,new_id=NATIVE.native_runtime_digest(bytes(changed));self.assertEqual(digest,baseline);self.assertNotEqual(old_id,new_id)
        changed[339]=1;self.assertNotEqual(NATIVE.native_runtime_digest(bytes(changed))[0],baseline)
        changed=bytearray(raw);changed[30]=1;self.assertNotEqual(NATIVE.native_runtime_digest(bytes(changed))[0],baseline)
        for offset,value in [(18,0),(304,19),(312,ord('X'))]:
            wrong=bytearray(raw);wrong[offset]=value
            with self.subTest(offset=offset),self.assertRaises(ValueError):NATIVE.native_runtime_digest(bytes(wrong))

    def test_actual_entrypoint_refuses_missing_admission_before_sdk_or_output(self):
        path = self.root / "plan.json";out = self.root / "output"
        path.write_text(json.dumps({"cell": "CAT.meter.G02", "nativeStandard": {"platform": "ios", "output": str(out)}}))
        env = {key: value for key, value in os.environ.items() if key != "CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
        result = subprocess.run([sys.executable, "-B", str(ROOT / "NativeStandardTests.py"), "--plan", str(path)], env=env, capture_output=True, text=True, timeout=10)
        self.assertNotEqual(result.returncode, 0);self.assertIn("Use NativeCellVerification.py", result.stderr);self.assertFalse(out.exists())

    def test_exact_known_method_and_cohort_selection(self):
        self.assertEqual(NATIVE.selection("ios")["android"], [])
        self.assertEqual(NATIVE.selection("android")["ios"], [])
        self.assertEqual(len(NATIVE.selection("ios")["ios"]), 4)
        self.assertEqual(NATIVE.selection("android")["android"], ["values", "format", "motion", "events"])
        self.assertEqual(NATIVE.selection("android", "meter-style")["android"], ["dimensions", "geometry", "slots", "context-motion"])
        self.assertEqual(NATIVE.selection("android", "meter-style-dimensions"), {"ios": [], "android": ["dimensions"]})
        with self.assertRaises(ValueError): NATIVE.selection("ios", "meter-style-dimensions")
        self.assertEqual(NATIVE.selection("ios", "meter-style")["ios"], ["MeterStyleTrialTests/" + name for name in NATIVE.IOS_STYLE_METHODS])
        self.assertEqual(NATIVE.selection("ios", "meter-style-remaining")["ios"], ["MeterStyleTrialTests/" + name for name in NATIVE.IOS_REMAINING_STYLE_METHODS])
        with self.assertRaises(ValueError): NATIVE.selection("android", "meter-style-remaining")
        self.assertEqual(NATIVE.selection("ios", "meter-style-affected")["ios"], ["MeterStyleTrialTests/testMeterStyleConstraint", "MeterStyleTrialTests/testMeterStyleMotionAndReset", "MeterStyleTrialTests/testMeterStyleRaised"])
        with self.assertRaises(ValueError): NATIVE.selection("android", "meter-style-affected")
        self.assertEqual(NATIVE.selection("ios", "meter-events")["ios"], ["MeterG02TrialTests/" + NATIVE.METHODS[-1]])
        with self.assertRaises(ValueError): NATIVE.selection("android", "meter-events")

    def test_sdk_xctestrun_binds_revision_specific_observer_on_supported_simulator_path(self):
        template = self.root / "Build/Products/Tests.xctestrun";template.parent.mkdir(parents=True)
        installed = self.root / "Installed.app";bundle = installed / "PlugIns/CodonNativeComponents.xctest";bundle.mkdir(parents=True)
        (bundle / "CodonNativeComponents").write_bytes(b"corrected actual observer")
        bundle_id = "dev.codonui.lab.components.r123456789abc.xctrunner"
        (installed / "Info.plist").write_bytes(plistlib.dumps({"CFBundleIdentifier": bundle_id}))
        template.write_bytes(plistlib.dumps({"CodonNativeComponents": {"TestHostPath": str(installed), "TestHostBundleIdentifier": bundle_id, "OnlyTestIdentifiers": ["Old/obsolete"]}}))
        app = {"product": "/actual/Product.app", "manifestSHA256": "a" * 64};observer = NATIVE.identity(installed);out = self.root / "Tests.xctestrun"
        NATIVE.bind_xctestrun(template, app, observer, out, installed)
        value = plistlib.loads(out.read_bytes())["CodonNativeComponents"]
        self.assertFalse(value.get("UseDestinationArtifacts", False))
        self.assertEqual(value["TestHostPath"], str(installed))
        self.assertEqual(value["TestHostBundleIdentifier"], bundle_id)
        self.assertEqual(value["UITargetAppBundleIdentifier"], "dev.codonui.showcase")
        self.assertEqual(value["UITargetAppPath"], app["product"])
        self.assertNotIn("OnlyTestIdentifiers", value)
        self.assertFalse(value["TestTimeoutsEnabled"]);self.assertNotIn("MaximumTestExecutionTimeAllowance",value);self.assertNotIn("DefaultTestExecutionTimeAllowance",value)
        self.assertEqual(value["EnvironmentVariables"]["CODON_METER_PRODUCT_SHA256"], "a" * 64)
        self.assertEqual(value["TestingEnvironmentVariables"]["CODON_METER_OBSERVER_MANIFEST_SHA256"], observer["manifestSHA256"])
        value["SkipTestIdentifiers"] = ["Required/testCase"];template.write_bytes(plistlib.dumps({"CodonNativeComponents": value}))
        with self.assertRaisesRegex(ValueError, "Do not exclude"): NATIVE.bind_xctestrun(template, app, observer, out, installed)
        value.pop("SkipTestIdentifiers");value["TestHostBundleIdentifier"] = "dev.codonui.lab.components.xctrunner";template.write_bytes(plistlib.dumps({"CodonNativeComponents": value}))
        NATIVE.bind_xctestrun(template, app, observer, out, installed)
        self.assertEqual(plistlib.loads(out.read_bytes())["CodonNativeComponents"]["TestHostBundleIdentifier"], bundle_id)
        value["TestHostBundleIdentifier"] = bundle_id;value["UseDestinationArtifacts"] = True;template.write_bytes(plistlib.dumps({"CodonNativeComponents": value}))
        with self.assertRaisesRegex(ValueError, "unsupported"): NATIVE.bind_xctestrun(template, app, observer, out, installed)

    def test_runtime_loaded_identity_rejects_retired_bundle_missing_log_and_changed_bytes(self):
        installed = self.root / "Current.app";bundle = installed / "PlugIns/CodonNativeComponents.xctest";bundle.mkdir(parents=True)
        executable = bundle / "CodonNativeComponents";executable.write_bytes(b"corrected executable")
        observer = NATIVE.identity(installed)
        diagnostics = self.root / "diagnostics";diagnostics.mkdir();log = diagnostics / "Session-tests.log"
        log.write_text("Loading test bundle at: " + bundle.as_uri() + "/\n")
        self.assertEqual(NATIVE.verify_loaded_observer(diagnostics, installed, observer)["executableSHA256"], NATIVE.digest(executable))
        log.write_text("Loading test bundle at: file:///Library/Caches/Dead/Old.app/PlugIns/CodonNativeComponents.xctest/\n")
        with self.assertRaisesRegex(ValueError, "Product files differ"): NATIVE.verify_loaded_observer(diagnostics, installed, observer)
        log.write_text("")
        with self.assertRaisesRegex(ValueError, "multiple or unrecorded"): NATIVE.verify_loaded_observer(diagnostics, installed, observer)
        log.write_text("Loading test bundle at: " + bundle.as_uri() + "/\n");executable.write_bytes(b"stale executable")
        with self.assertRaisesRegex(ValueError, "Product files differ"): NATIVE.verify_loaded_observer(diagnostics, installed, observer)

    def test_product_identity_rejects_changed_missing_and_extra_files(self):
        product = self.root / "Product.app";product.mkdir();(product / "binary").write_bytes(b"real bounded control")
        expected = NATIVE.identity(product);self.assertEqual(NATIVE.verify_product(expected), product.resolve())
        for operation in ["change", "extra", "missing"]:
            (product / "binary").write_bytes(b"real bounded control")
            if (product / "extra").exists(): (product / "extra").unlink()
            if operation == "change": (product / "binary").write_bytes(b"wrong")
            elif operation == "extra": (product / "extra").write_bytes(b"wrong")
            else: (product / "binary").unlink()
            with self.subTest(operation=operation), self.assertRaisesRegex(ValueError, "Product files differ"): NATIVE.verify_product(expected)

    def test_ios_installed_identity_is_required_before_xctest(self):
        device = "2244051E-D143-40F5-BEF1-7B4CCFC355A1"
        state = self.root / "Library/Developer/CoreSimulator/Devices" / device / "device.plist"
        state.parent.mkdir(parents=True);state.write_bytes(plistlib.dumps({"state": 1}))
        app_path = self.root / "Product.app";app_path.mkdir();(app_path / "main.jsbundle").write_bytes(b"current")
        observer_path = self.root / "Observer.app";observer_path.mkdir();(observer_path / "binary").write_bytes(b"current observer")
        bundle_id = "dev.codonui.lab.components.r123456789abc.xctrunner"
        (observer_path / "Info.plist").write_bytes(plistlib.dumps({"CFBundleIdentifier": bundle_id}))
        plugin = observer_path / "PlugIns/CodonNativeComponents.xctest";plugin.mkdir(parents=True);(plugin / "CodonNativeComponents").write_bytes(b"current plugin")
        stale = self.root / "Stale.app";stale.mkdir();(stale / "main.jsbundle").write_bytes(b"old installed bundle")
        wrong_observer = self.root / "WrongObserver.app";wrong_observer.mkdir();(wrong_observer / "binary").write_bytes(b"Indicator runner")
        app = NATIVE.identity(app_path);observer = NATIVE.identity(observer_path)
        template = self.root / "Template.xctestrun";template.write_bytes(plistlib.dumps({"CodonNativeComponents": {"TestHostPath": str(observer_path), "TestHostBundleIdentifier": bundle_id}}))
        observer["xctestrun"] = {"path": str(template), "sha256": NATIVE.digest(template)}
        raw = "\n".join("Test Case '-[CodonNativeComponents.MeterG02TrialTests " + name + "]' passed (1.0 seconds)." for name in NATIVE.METHODS)
        summary = {"result": "Passed", "totalTestCount": 4, "passedTests": 4, "failedTests": 0, "skippedTests": 0}
        for scenario in ["matching", "legacy-cutoff", "affected-method", "retired-plugin", "sdk-failed", "stale-app", "wrong-observer", "install-failed", "not-ready", "reuse-matching", "reuse-stale", "reuse-missing"]:
            session = MagicMock();session.work = time.time() + 120;session.output = self.root / scenario;session.output.mkdir()
            def command(name, argv, cap=None):
                if scenario == "not-ready" and name == "boot-readiness": raise ValueError("OS not ready")
                if scenario == "install-failed" and name == "install-app": raise ValueError("SDK install failed")
                if name in ["preflight-installed-app", "installed-app"]:
                    if scenario == "reuse-missing": raise ValueError("No registered application")
                    return str(stale if scenario in ["stale-app", "reuse-stale"] else app_path)
                if name in ["preflight-installed-observer", "installed-observer"]: return str(wrong_observer if scenario == "wrong-observer" else observer_path)
                if name == "xctest":
                    if scenario == "sdk-failed": raise ValueError("SDK65")
                    return raw.splitlines()[-1] if scenario == "affected-method" else raw
                if name == "xctest-runtime-diagnostics":
                    logs = session.output / "runtime-diagnostics";logs.mkdir()
                    loaded = self.root / "Dead/Old.app/PlugIns/CodonNativeComponents.xctest" if scenario == "retired-plugin" else plugin
                    (logs / "Session-tests.log").write_text("Loading test bundle at: " + loaded.as_uri() + "/\n")
                if name == "xctest-summary": return json.dumps({**summary, "totalTestCount": 1, "passedTests": 1} if scenario == "affected-method" else summary)
                return ""
            session.run.side_effect = command
            config = {"destination": device, "batch": "meter-events" if scenario == "affected-method" else "meter-g02"}
            if scenario.startswith("reuse-"): config["reuseInstalledApplication"] = True
            if scenario == "legacy-cutoff": config["installationMaximumSeconds"] = 1
            with self.subTest(scenario=scenario), patch.object(NATIVE.Path, "home", return_value=self.root):
                if scenario in ["matching", "legacy-cutoff", "affected-method", "reuse-matching"]: self.assertEqual(NATIVE.run_ios(session, config, app, observer)["status"], "PASS")
                else:
                    with self.assertRaises(ValueError): NATIVE.run_ios(session, config, app, observer)
            commands = [call.args[0] for call in session.run.call_args_list]
            if scenario in ["matching", "legacy-cutoff", "affected-method", "reuse-matching"]:
                self.assertTrue(all(len(call.args) == 2 for call in session.run.call_args_list))
                selected = next(call.args[1] for call in session.run.call_args_list if call.args[0] == "xctest")
                self.assertEqual(len([arg for arg in selected if str(arg).startswith("-only-testing:")]), 1 if scenario == "affected-method" else 4)
                if scenario == "reuse-matching":
                    self.assertNotIn("install-app", commands)
                    self.assertLess(commands.index("boot-readiness"), commands.index("preflight-installed-app"))
                else: self.assertLess(commands.index("boot-readiness"), commands.index("install-app"))
                self.assertLess(commands.index("preflight-installed-app"), commands.index("install-observer"))
                self.assertLess(commands.index("preflight-installed-observer"), commands.index("xctest"))
            elif scenario in ["retired-plugin", "sdk-failed"]:
                self.assertIn("xctest-runtime-diagnostics", commands);self.assertNotIn("xctest-summary", commands)
            else: self.assertNotIn("xctest", commands)
            if scenario in ["not-ready","reuse-stale","reuse-missing"]: self.assertNotIn("install-app", commands)
            if scenario in ["reuse-stale","reuse-missing"]: self.assertNotIn("install-observer", commands)

    def test_existing_pending_app_observation_never_reissues_install(self):
        current = self.root / "Current.app";current.mkdir();(current / "main.jsbundle").write_bytes(b"selected product")
        old = self.root / "Old.app";old.mkdir();(old / "main.jsbundle").write_bytes(b"stale product")
        app = NATIVE.identity(current)
        for name, responses, passes in [("already-complete", [str(current)], True), ("longer-scoped-budget", [str(current)], True), ("resumes", [str(old), str(current)], True), ("remains-pending", [str(old), str(old)], False)]:
            session = MagicMock();session.output = self.root / name;session.output.mkdir();session.run.side_effect = responses;session.work = 1000
            clock = [0]
            def pause(seconds): clock[0] += seconds
            with self.subTest(name=name), patch.object(NATIVE.time, "time", side_effect=lambda: clock[0]), patch.object(NATIVE.time, "sleep", side_effect=pause):
                if passes: NATIVE.wait_ios_pending_app(session, "EXPLICIT-CONTROL-DEVICE", app, 300 if name == "longer-scoped-budget" else 10)
                else:
                    with self.assertRaisesRegex(ValueError, "no install reissued"): NATIVE.wait_ios_pending_app(session, "EXPLICIT-CONTROL-DEVICE", app, 300 if name == "longer-scoped-budget" else 10)
            observations = json.loads((session.output / "pending-app-observations.json").read_text())
            self.assertEqual(observations[-1]["matched"], passes)
            self.assertTrue(all(call.args[1][1] == "get_app_container" for call in session.run.call_args_list))
        for invalid in [0, -1, True, "180"]:
            with self.assertRaises(ValueError): NATIVE.wait_ios_pending_app(MagicMock(), "CONTROL", app, invalid)

    def test_resume_mode_preserves_identity_gate_and_diagnoses_pending_failure(self):
        device = "2244051E-D143-40F5-BEF1-7B4CCFC355A1"
        state = self.root / "Library/Developer/CoreSimulator/Devices" / device / "device.plist";state.parent.mkdir(parents=True);state.write_bytes(plistlib.dumps({"state": 1}))
        observer = self.root / "Observer.app";observer.mkdir();(observer / "Info.plist").write_bytes(plistlib.dumps({"CFBundleIdentifier": "dev.codonui.lab.components.r123456789abc.xctrunner"}))
        for passes in [True, False]:
            session = MagicMock();session.output = self.root / str(passes);session.output.mkdir()
            config = {"destination": device, "resumePendingApplicationInstall": True, "pendingInstallObservationSeconds": 180}
            session.run.return_value = "/registered-control-app"
            with patch.object(NATIVE.Path, "home", return_value=self.root), patch.object(NATIVE, "wait_ios_pending_app", side_effect=None if passes else ValueError("saved pending failure")), patch.object(NATIVE, "verify_product", side_effect=ValueError("stop at identity control")):
                with self.assertRaises(ValueError): NATIVE.run_ios(session, config, {}, {"product": str(observer)})
            names = [call.args[0] for call in session.run.call_args_list]
            self.assertFalse(any(name.startswith("install-") for name in names));self.assertNotIn("xctest", names)
            self.assertEqual("pending-install-diagnostics" in names, not passes)
            if passes: self.assertIn("preflight-installed-app", names)

    def test_actual_command_runner_fails_closed_on_sdk_exit_timeout_and_group(self):
        session = NATIVE.Session(self.root / "exit", 30, 10)
        with self.assertRaisesRegex(ValueError, "SDK command failed"):
            session.run("sdk", [sys.executable, "-c", "print('preserved stdout',flush=True);raise SystemExit(65)"])
        self.assertEqual(session.rows[0]["exitCode"], 65)
        self.assertIn("preserved stdout", (session.output / "sdk.stdout").read_text())
        session = NATIVE.Session(self.root / "timeout", 30, 10)
        with self.assertRaisesRegex(ValueError, "Command timeout"):
            session.run("sdk", [sys.executable, "-c", "import time;time.sleep(5)"], 0.05)
        self.assertTrue(session.rows[0]["timedOut"]);self.assertTrue(session.rows[0]["ownedGroupGone"])
        session = NATIVE.Session(self.root / "group", 30, 10)
        with patch.object(NATIVE, "stop_owned_process", return_value=False), self.assertRaisesRegex(ValueError, "cleanup failure"):
            session.run("sdk", [sys.executable, "-c", "pass"])

    def test_infrastructure_uses_remaining_owner_budget_and_retains_cleanup_reserve(self):
        session = NATIVE.Session(self.root / "budget", 1800, 120)
        process = MagicMock(pid=54321);process.poll.return_value = 0
        with patch.object(NATIVE.subprocess, "Popen", return_value=process), patch.object(NATIVE, "stop_owned_process", return_value=True):
            session.run("sdk-infrastructure", ["CONTROL_NO_SDK"])
        actual = process.wait.call_args.kwargs["timeout"]
        self.assertGreater(actual, 1600);self.assertLessEqual(actual, session.work - session.start - 8)
        self.assertIsNone(session.rows[0]["explicitCapSeconds"]);self.assertEqual(session.rows[0]["deadlineKind"], "work")
        session.work = NATIVE.time.time() + 7
        with patch.object(NATIVE.subprocess, "Popen") as spawn, self.assertRaisesRegex(ValueError, "No command budget"):
            session.run("exhausted", ["CONTROL_NO_SDK"])
        spawn.assert_not_called()

    def test_swift_geometry_regression_program_uses_actual_observer_predicate(self):
        program = NATIVE.geometry_control_source()
        self.assertIn("9.9998779296875", program);self.assertIn("saved.doubleValue", program)
        self.assertIn("(9, 10, 3, false)", program);self.assertIn("Double.nan", program)
        self.assertIn("abs(delivered - expected) * scale <= 1", program)
        self.assertIn("stylePixelsMatch", program);self.assertIn("wrong[7] = 0", program)
        self.assertIn("shadowFallsDown",program);self.assertIn("[248,248,248,255]",program)

    def test_ios_style_reconciliation_requires_all_observations_and_exact_motion_restoration(self):
        from MeterStyleAndroidCheck import EXPECTED
        rows = [{"name":name,"wholeParentExact":True,"comparedPixels":100,"state":{"rootTag":1},"afterState":{"rootTag":1}} for names in EXPECTED.values() for name in names]
        raised = next(row for row in rows if row["name"]=="raised")
        raised.update(opaqueSamplesExact=True,shadowPresenceDirection=True,opaqueSamples=[{"rgba":rgba,"referenceRGBA":rgba}for rgba in [[37,99,235,255],[255,255,255,255],[158,158,158,255],[158,158,158,255]]],shadowSamples=[{"aboveRGBA":[248,248,248,255],"belowRGBA":[225,225,225,255]},{"aboveRGBA":[248,248,248,255],"belowRGBA":[227,227,227,255]}])
        def logs(values,restored="0"):
            return "\n".join("METER_STYLE_OBSERVATION " + json.dumps(row) for row in values) + "\nMETER_STYLE_MOTION_ORIGINAL 0\nMETER_STYLE_MOTION_RESTORED " + restored + "\n"
        self.assertEqual(len(NATIVE.reconcile_ios_styles(logs(rows))),28)
        raised["wholeParentExact"] = False
        self.assertEqual(len(NATIVE.reconcile_ios_styles(logs(rows))),28)
        wrong_shadow = json.loads(json.dumps(rows));next(row for row in wrong_shadow if row["name"]=="raised")["shadowSamples"][0]["belowRGBA"]=[255,255,255,255]
        with self.assertRaises(ValueError):NATIVE.reconcile_ios_styles(logs(wrong_shadow))
        for values,restored in [(rows[:-1],"0"),(rows+[rows[0]],"0"),(rows,"1"),([{**row,"wholeParentExact":False}for row in rows],"0"),([{**row,"afterState":{"rootTag":2}}for row in rows],"0")]:
            with self.assertRaises(ValueError):NATIVE.reconcile_ios_styles(logs(values,restored))

    def test_actual_execution_exit_rejects_failed_sdk_and_uncertain_cleanup(self):
        for index, failed, clean in [(0, False, True), (1, True, True), (2, False, False)]:
            out = self.root / str(index)
            plan = {"nativeStandard": {"action": "build", "platform": "ios", "batch": "meter-g02", "output": str(out)}, "bindings": {"observer": []}, "attempt": {"maximumSeconds": 30, "cleanupReserveSeconds": 10}}
            with patch.object(NATIVE, "build_ios", side_effect=ValueError("saved SDK65") if failed else None, return_value={"product": "CONTROL_NO_SDK"}), patch.object(NATIVE, "cleanup", side_effect=None if clean else ValueError("unverified shutdown")):
                code = NATIVE.execute(plan, {"result": "PASS", "scope": "host sentinel only"})
            self.assertEqual(code, 0 if not failed and clean else 1)
            record = json.loads((out / "terminal.json").read_text());self.assertEqual(record["cleanupVerified"], clean);self.assertEqual(record["gatePromotions"], 0)

    def test_cached_ios_refresh_requires_exact_bound_changed_library_runtime(self):
        repo=self.root/"repo";runtime=repo/"packages/react-native/src/components/Control.tsx";runtime.parent.mkdir(parents=True);runtime.write_text("current runtime")
        base=self.root/"Base.app";base.mkdir();(base/"main.jsbundle").write_text("old bundle");(base/"NativeBinary").write_text("unchanged native")
        item=self.root/"identity.json";item.write_text(json.dumps(NATIVE.identity(base)))
        freeze=self.root/"freeze.json";freeze.write_text(json.dumps({str(runtime.relative_to(repo)):"0"*64}))
        config={"baseApplicationIdentity":{"path":str(item),"sha256":NATIVE.digest(item)},"baseApplicationSourceFreeze":{"path":str(freeze),"sha256":NATIVE.digest(freeze)}}
        class Boundary:
            def __init__(inner,output):inner.output=output;output.mkdir()
            def run(inner,*args):raise RuntimeError("EXPECTED_PACKAGER_BOUNDARY_NO_SDK")
        with patch.object(NATIVE,"REPO",repo):
            rejected=Boundary(self.root/"rejected")
            with self.assertRaisesRegex(ValueError,"unbound"):NATIVE.build_ios_application(rejected,config)
            self.assertFalse((rejected.output/"CodonCircular.app").exists())
            config["additionalApplicationSources"]=[{"path":str(runtime),"sha256":NATIVE.digest(runtime)}]
            admitted=Boundary(self.root/"admitted")
            with self.assertRaisesRegex(RuntimeError,"EXPECTED_PACKAGER_BOUNDARY_NO_SDK"):NATIVE.build_ios_application(admitted,config)
            self.assertEqual((admitted.output/"CodonCircular.app/NativeBinary").read_text(),"unchanged native")

    def test_gallery_real_entry_refuses_missing_admission_and_wrong_scope(self):
        plan={"cell":"CAT.thumbnail-showcase.G08","nativeStandard":{"platform":"ios","batch":"gallery","output":str(self.root/"gallery-never-created")}}
        NATIVE.validate_standard_scope(plan);self.assertEqual(len(NATIVE.selection("ios","gallery")["ios"]),2)
        self.assertEqual(NATIVE.selection("ios","gallery-styles")["ios"],["GalleryTrialTests/testGalleryStylesWidthsAndProviders"])
        with self.assertRaises(ValueError):NATIVE.selection("android","gallery")
        with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":"CAT.thumbnail-image.G08","nativeStandard":{"batch":"gallery"}})
        path=self.root/"gallery.json";path.write_text(json.dumps(plan));env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
        result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(path)],env=env,capture_output=True,text=True,timeout=10)
        self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((self.root/"gallery-never-created").exists())

    def test_gallery_primitive_requires_text_leaf_instead_of_passive_container_name(self):
        self.assertEqual(NATIVE.selection("ios","gallery-remaining")["ios"],["GalleryTrialTests/testGalleryPrimitiveAndRemainingCounts"])
        NATIVE.validate_standard_scope({"cell":"CAT.thumbnail-showcase.G08","nativeStandard":{"batch":"gallery-remaining"}})
        base={"name":"zero","state":{"scale":3,"mode":"primary","kind":"zero","count":"4","columns":None,"items":[],"overflow":False,"zero":False,"width":280,"custom":False,"customizations":[],"disabled":False,"originalLayouts":{"root":{"target":4,"currentTarget":4,"layout":{"x":12,"y":12,"width":280,"height":280}}},"colors":{"border":"#9e9e9e","selected":"#2563eb","track":"#c6c6c6"}},"host":[20,100,304,600],"root":[32,112,280,280],"primary":[32,112,280,280],"grid":[],"slots":[],"controls":[],"placeholderCount":0,"primaryPlaceholder":False,"primaryLabel":"","primaryTexts":["0"],"inkPixels":100,"scale":3,"imageWidth":1170,"imageHeight":2532,"paintChecks":[]}
        self.assertEqual(NATIVE.validate_gallery_rows([base],["zero"])["status"],"PASS")
        for labels in [[],["O"],["0","0"]]:
            bad=copy.deepcopy(base);bad["primaryLabel"]="0";bad["primaryTexts"]=labels
            with self.subTest(labels=labels),self.assertRaises(ValueError):NATIVE.validate_gallery_rows([bad],["zero"])

    def test_gallery_reader_native_geometry_decode_refs_controls_and_paint(self):
        state={"scale":3,"mode":"all","kind":"image","count":"4","columns":None,"items":["A","B","C","D","E"],"overflow":True,"zero":False,"width":280,"custom":False,"customizations":[],"disabled":False,"primaryTag":7,"expectedURI":"data:gallery","primaryLoads":[{"target":8,"currentTarget":8,"uri":"data:gallery","width":48,"height":24}],"originalLayouts":{"root":{"target":4,"currentTarget":4,"layout":{"x":12,"y":12,"width":280,"height":352.5}},"primary":{"target":7,"currentTarget":7},"image":{"target":8,"currentTarget":8}},"colors":{"border":"#9e9e9e","selected":"#2563eb","track":"#c6c6c6"}}
        slots=[[32+72.5*i,402,62.5,62.5] for i in range(4)]
        row={"name":"baseline","state":state,"host":[20,100,304,600],"root":[32,112,280,352.5],"primary":[32,112,280,280],"grid":[32,402,280,62.5],"slots":slots,"controls":[{"id":"gallery-item-"+name,"label":"Gallery "+name+", count 0","enabled":True,"frame":slots[i]} for i,name in enumerate("ABC")]+[{"id":"gallery-overflow","label":"Gallery overflow 1","enabled":True,"frame":slots[3]}],"placeholderCount":0,"primaryPlaceholder":False,"primaryLabel":"","inkPixels":1000,"scale":3,"imageWidth":1170,"imageHeight":2532,"paintChecks":[]}
        self.assertEqual(NATIVE.validate_gallery_rows([row],["baseline"])["status"],"PASS")
        for kind in ["outside","scale","original-target","outer-width","outer-height","slot-width","track-position","wrong-uri","metadata-only","wrong-image-target","wrong-ref","overflow-count","missing-control","wrong-guard","escaped-control","blank","duplicate"]:
            bad=copy.deepcopy(row)
            if kind=="outside":bad["host"][0]=600
            elif kind=="scale":bad["state"]["scale"]=2
            elif kind=="original-target":bad["state"]["originalLayouts"]["root"]["target"]=9
            elif kind=="outer-width":bad["root"][2]=279
            elif kind=="outer-height":bad["state"]["originalLayouts"]["root"]["layout"]["height"]+=1
            elif kind=="slot-width":bad["slots"][0][2]+=1
            elif kind=="track-position":bad["slots"][1][0]+=1
            elif kind=="wrong-uri":bad["state"]["primaryLoads"][0]["uri"]="data:retired"
            elif kind=="metadata-only":bad["state"]["primaryLoads"]=[]
            elif kind=="wrong-image-target":bad["state"]["primaryLoads"][0]["target"]=9
            elif kind=="wrong-ref":bad["state"]["primaryTag"]=99
            elif kind=="overflow-count":bad["controls"][-1]["label"]="Gallery overflow 2"
            elif kind=="missing-control":bad["controls"].pop()
            elif kind=="wrong-guard":bad["controls"][0]["enabled"]=False
            elif kind=="escaped-control":bad["controls"][0]["frame"][0]+=1
            elif kind=="blank":bad["inkPixels"]=0
            with self.subTest(kind=kind),self.assertRaises((ValueError,IndexError)):NATIVE.validate_gallery_rows([bad,bad] if kind=="duplicate" else [bad],["baseline"])
        zero=copy.deepcopy(row);zero["state"]["zero"]=True;zero["state"]["width"]=0;zero["state"]["originalLayouts"]["root"]["layout"].update(width=0,height=10);zero["inkPixels"]=0;zero["root"]=[];zero["primary"]=[];zero["grid"]=[];zero["slots"]=[];zero["controls"]=[]
        self.assertEqual(NATIVE.validate_gallery_rows([zero],["baseline"])["status"],"PASS")
        zero["inkPixels"]=1
        with self.assertRaises(ValueError):NATIVE.validate_gallery_rows([zero],["baseline"])
        styled=copy.deepcopy(row);styled["state"]["customizations"]=["root","primary","row","secondary"];styled["state"]["originalLayouts"]["root"]["layout"].update(width=280,height=227);styled["root"]=[32,112,280,227];styled["primary"]=[41,121,262,131];styled["grid"]=[49,274,246,48];styled["slots"]=[[49+63.5*i,274,48,48] for i in range(4)]
        for i,c in enumerate(styled["controls"]):c["frame"]=[styled["slots"][i][0]+2,276,44,44]
        styled["paintChecks"]=[{"owner":key,"expectedRGB":color,"exact":True,"pixels":30,"frame":[150,150,6,1]} for key,color in [("root",[8,127,140]),("primary",[190,18,60]),("row",[124,58,237]),("secondary",[22,101,52])]]
        self.assertEqual(NATIVE.validate_gallery_rows([styled],["baseline"])["status"],"PASS")
        for kind in ["paint","color","missing-owner"]:
            bad=copy.deepcopy(styled)
            if kind=="paint":bad["paintChecks"][0]["exact"]=False
            elif kind=="color":bad["paintChecks"][0]["expectedRGB"]=[0,0,0]
            else:bad["paintChecks"].pop()
            with self.subTest(kind=kind),self.assertRaises(ValueError):NATIVE.validate_gallery_rows([bad],["baseline"])

    def test_thumbnail_scope_and_real_no_sdk_admission_boundary(self):
        plan={"cell":"CAT.thumbnail-image.G08","nativeStandard":{"platform":"ios","batch":"thumbnail","output":str(self.root/"thumbnail-never-created")}}
        NATIVE.validate_standard_scope(plan);self.assertEqual(len(NATIVE.selection("ios","thumbnail")["ios"]),2)
        self.assertEqual(NATIVE.selection("ios","thumbnail-geometry")["ios"],["ThumbnailTrialTests/testThumbnailGeometryDensityAndProviders"])
        NATIVE.validate_standard_scope({"cell":"CAT.thumbnail-image.G08","nativeStandard":{"batch":"thumbnail-geometry"}})
        with self.assertRaises(ValueError):NATIVE.selection("android","thumbnail")
        with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":"CAT.counter.G08","nativeStandard":{"batch":"thumbnail"}})
        path=self.root/"thumbnail.json";path.write_text(json.dumps(plan));env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
        result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(path)],env=env,capture_output=True,text=True,timeout=10)
        self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((self.root/"thumbnail-never-created").exists())

    def test_thumbnail_reader_requires_real_decode_uri_original_target_exact_paint_and_geometry(self):
        row={"name":"baseline","scale":3,"imageWidth":1170,"imageHeight":2532,"parent":[20,300,280,180],"referenceParent":[20,488,280,180],"target":[32,312,48,24],"nativeLabel":"Thumbnail preview / aperçu","referenceExact":True,"inkPixels":500,"state":{"scale":3,"visible":True,"callerSelected":False,"mode":0,"zero":False,"adapter":False,"emptyAlt":False,"custom":False,"constrained":False,"densityIndex":0,"dimensionIndex":0,"nativeSourceWidth":48,"nativeSourceHeight":24,"expectedURI":"data:expected","referenceSource":"data:expected","events":[{"kind":"layout","target":51,"currentTarget":51,"layout":{"x":12,"y":12,"width":48,"height":24}},{"kind":"load","target":51,"currentTarget":51,"source":{"uri":"data:expected","width":48,"height":24}}]}}
        self.assertEqual(NATIVE.validate_thumbnail_rows([row],["baseline"])["status"],"PASS")
        for kind in ["wrong-uri","metadata-only","wrong-reference-uri","wrong-target","wrong-width","blank","paint","physical-outside","wrong-scale","duplicate"]:
            bad=copy.deepcopy(row)
            if kind=="wrong-uri":bad["state"]["events"][-1]["source"]["uri"]="data:retired"
            elif kind=="metadata-only":bad["state"]["events"].pop()
            elif kind=="wrong-reference-uri":bad["state"]["referenceSource"]="data:retired"
            elif kind=="wrong-target":bad["state"]["events"][0]["currentTarget"]=52
            elif kind=="wrong-width":bad["target"][2]=47
            elif kind=="blank":bad["inkPixels"]=0
            elif kind=="paint":bad["referenceExact"]=False
            elif kind=="physical-outside":bad["parent"][0]=1000
            elif kind=="wrong-scale":bad["state"]["scale"]=2
            with self.subTest(kind=kind),self.assertRaises(ValueError):NATIVE.validate_thumbnail_rows([bad,bad] if kind=="duplicate" else [bad],["baseline"])
        styled=copy.deepcopy(row);styled["name"]="styled";styled["state"]["custom"]=True;styled["state"]["events"][0]["layout"].update(width=120,height=80);styled["target"]=[34,314,116,76];styled["referenceTarget"]=[34,502,116,76]
        self.assertEqual(NATIVE.validate_thumbnail_rows([styled],["styled"])["status"],"PASS")
        styled["target"][2]=120
        with self.assertRaises(ValueError):NATIVE.validate_thumbnail_rows([styled],["styled"])
        zero=copy.deepcopy(row);zero["name"]="zero-density";zero["state"]["zero"]=True;zero["state"]["events"][0]["layout"]={"width":0,"height":0};zero["inkPixels"]=0;zero["target"]=[]
        self.assertEqual(NATIVE.validate_thumbnail_rows([zero],["zero-density"])["status"],"PASS")
        retired=copy.deepcopy(row);retired["name"]="retired";retired["state"]["visible"]=False;retired["target"]=[];retired["inkPixels"]=0
        self.assertEqual(NATIVE.validate_thumbnail_rows([retired],["retired"])["status"],"PASS")

    def test_counter_scope_selection_and_actual_admission_boundary(self):
        plan={"cell":"CAT.counter.G08","nativeStandard":{"platform":"ios","batch":"counter","output":str(self.root/"counter-never-created")}}
        NATIVE.validate_standard_scope(plan);self.assertEqual(len(NATIVE.selection("ios","counter")["ios"]),2)
        self.assertEqual(NATIVE.selection("ios","counter-values")["ios"],["CounterTrialTests/testCounterValuesStylesAndProviders"])
        NATIVE.validate_standard_scope({"cell":"CAT.counter.G08","nativeStandard":{"batch":"counter-values"}})
        with self.assertRaises(ValueError):NATIVE.selection("android","counter")
        for cell in ["CAT.meter.G08","CAT.circular-progress.G08","CAT.counter.G07"]:
            with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":cell,"nativeStandard":{"batch":"counter"}})
        path=self.root/"counter.json";path.write_text(json.dumps(plan));env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
        result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(path)],env=env,capture_output=True,text=True,timeout=10)
        self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((self.root/"counter-never-created").exists())

    def test_counter_touch_uses_named_baseline_after_motion_fresh_rows(self):
        rows=[{"name":"normal-fresh","state":{"rootTag":72}},{"name":"baseline","state":{"rootTag":51}}]
        NATIVE.validate_counter_touch([{"target":55,"currentTarget":51}],rows)
        for contacts in [[],[{"target":55,"currentTarget":72}],[{"target":0,"currentTarget":51}]]:
            with self.assertRaises(ValueError):NATIVE.validate_counter_touch(contacts,rows)

    def test_counter_reader_uses_native_geometry_and_rejects_paint_value_target_and_slot_errors(self):
        row={"name":"baseline","scale":3,"imageWidth":1170,"imageHeight":2532,"backgroundRGB":[255,255,255],"parent":[20,300,330,72],"referenceParent":[20,380,330,72],"target":[28,308,180,40],"valueLabel":"25","ringLabel":"Native counter Progress","ringValue":"25%","ringFrame":[40,320,12,12],"suffixLabel":"/100","childFrame":[170,318,20,20],"referenceExact":True,"inkPixels":400,"state":{"case":"baseline","mode":"light","rootTag":51,"value":25,"maxValue":100,"layouts":{"target":{"target":51,"currentTarget":51,"layout":{"width":180,"height":40}}}}}
        self.assertEqual(NATIVE.validate_counter_rows([row],["baseline"])["status"],"PASS")
        for kind in ["paint","raw-value","target","height","dimensions","slot","semantics","empty-child","background","physical-outside","duplicate"]:
            bad=copy.deepcopy(row)
            if kind=="paint":bad["referenceExact"]=False
            elif kind=="raw-value":bad["valueLabel"]="normalized"
            elif kind=="target":bad["state"]["layouts"]["target"]["currentTarget"]=52
            elif kind=="height":bad["state"]["layouts"]["target"]["layout"]["height"]=39
            elif kind=="dimensions":bad["target"][2]=179
            elif kind=="slot":bad["ringFrame"][2]=20
            elif kind=="semantics":bad["ringValue"]="99%"
            elif kind=="empty-child":bad["childFrame"]=[]
            elif kind=="background":bad["backgroundRGB"]=[16,16,16]
            elif kind=="physical-outside":bad["parent"][0]=1000
            with self.subTest(kind=kind),self.assertRaises(ValueError):NATIVE.validate_counter_rows([bad,bad] if kind=="duplicate" else [bad],["baseline"])
        fractional=copy.deepcopy(row);fractional["name"]="fractional";fractional["state"]["case"]="fractional";fractional["target"][2]=183.25;fractional["state"]["layouts"]["target"]["layout"]["width"]=183.25
        self.assertEqual(NATIVE.validate_counter_rows([fractional],["fractional"])["status"],"PASS")
        zero=copy.deepcopy(row);zero["name"]="zero-width";zero["state"]["case"]="zero-width";zero["target"]=[];zero["state"]["layouts"]["target"]["layout"]["width"]=0
        self.assertEqual(NATIVE.validate_counter_rows([zero],["zero-width"])["status"],"PASS")

    def test_lagging_scope_selection_and_actual_admission_boundary(self):
        plan={"cell":"CAT.lagging-lines-loader.G08","nativeStandard":{"platform":"ios","batch":"lagging-lines","output":str(self.root/"never-created")}}
        NATIVE.validate_standard_scope(plan);self.assertEqual(len(NATIVE.selection("ios","lagging-lines")["ios"]),2)
        with self.assertRaises(ValueError):NATIVE.selection("android","lagging-lines")
        for cell in ["CAT.meter.G08","CAT.circle-loader.G08","CAT.lagging-lines-loader.G07"]:
            with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":cell,"nativeStandard":{"batch":"lagging-lines"}})
        path=self.root/"lagging.json";path.write_text(json.dumps(plan));env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
        result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(path)],env=env,capture_output=True,text=True,timeout=10)
        self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((self.root/"never-created").exists())

    def test_lagging_reader_rejects_retained_stopped_displacement_and_physical_geometry_negatives(self):
        row={"name":"default","backgroundRGB":[255,255,255],"scale":3,"imageWidth":1170,"imageHeight":2532,"parent":[20,300,330,100],"referenceParent":[20,408,330,100],"host":[28,308,235.5,50],"target":[70,308,150,50],"track":[70,333,150,0],"wrappers":[[70,333,30,5] for _ in range(3)],"visuals":[[67,333,36,5],[68.5,333,33,5],[70,333,30,5]],"referenceExact":True,"inkPixels":400,"nativeLabel":"Fetching lines","nativeValue":"busy","state":{"mode":"light","rootTag":51,"visible":True,"custom":False,"rootWidth":150,"layout":{"eventTarget":51,"currentTarget":51,"layout":{"width":150,"height":50}}}}
        self.assertEqual(NATIVE.validate_lagging_lines_rows([row],["default"])["status"],"PASS")
        for kind in ["retained-displacement","missing-line","wrong-target","wrong-size","wrong-recipe","physical-outside","paint","numeric-value","duplicate"]:
            bad=copy.deepcopy(row)
            if kind=="retained-displacement":bad["wrappers"][0][0]+=63.6
            elif kind=="missing-line":bad["wrappers"].pop()
            elif kind=="wrong-target":bad["state"]["layout"]["eventTarget"]=52
            elif kind=="wrong-size":bad["target"][2]=149
            elif kind=="wrong-recipe":bad["visuals"][0][2]=30
            elif kind=="physical-outside":bad["parent"][0]=1000
            elif kind=="paint":bad["referenceExact"]=False
            elif kind=="numeric-value":bad["nativeValue"]="50%"
            with self.subTest(kind=kind),self.assertRaises(ValueError):NATIVE.validate_lagging_lines_rows([bad,bad] if kind=="duplicate" else [bad],["default"])
        zero=copy.deepcopy(row);zero["name"]="zero";zero["state"]["rootWidth"]=0;zero["state"]["layout"]["layout"]["width"]=0;zero["inkPixels"]=0;zero["target"]=[];zero["track"]=[]
        self.assertEqual(NATIVE.validate_lagging_lines_rows([zero],["zero"])["status"],"PASS")
        zero["inkPixels"]=1
        with self.assertRaises(ValueError):NATIVE.validate_lagging_lines_rows([zero],["zero"])
        dark=copy.deepcopy(row);dark["name"]="dark";dark["state"]["mode"]="dark";dark["backgroundRGB"]=[16,16,16]
        self.assertEqual(NATIVE.validate_lagging_lines_rows([dark],["dark"])["status"],"PASS")
        dark["inkPixels"]=0
        with self.assertRaises(ValueError):NATIVE.validate_lagging_lines_rows([dark],["dark"])
        retired=copy.deepcopy(row);retired["name"]="retired";retired["state"]["visible"]=False;retired["state"]["rootTag"]=None;retired["target"]=[];retired["host"]=[];retired["inkPixels"]=0
        self.assertEqual(NATIVE.validate_lagging_lines_rows([retired],["retired"])["status"],"PASS")


    def test_circle_loader_scope_selection_and_actual_admission_boundary(self):
        plan={"cell":"CAT.circle-loader.G08","nativeStandard":{"platform":"ios","batch":"circle-loader","output":str(self.root/"never-created")}}
        NATIVE.validate_standard_scope(plan)
        self.assertEqual(NATIVE.selection("ios","circle-loader")["ios"],["CircleLoaderTrialTests/testCircleLoaderGeometryAndProviders","CircleLoaderTrialTests/testCircleLoaderMotionAndRetirement"])
        with self.assertRaises(ValueError):NATIVE.selection("android","circle-loader")
        with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":"CAT.meter.G08","nativeStandard":{"batch":"circle-loader"}})
        with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":"CAT.circle-loader.G07","nativeStandard":{"batch":"circle-loader"}})
        path=self.root/"loader-plan.json";path.write_text(json.dumps(plan))
        env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
        result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(path)],env=env,capture_output=True,text=True,timeout=10)
        self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((self.root/"never-created").exists())

    def test_loader_reader_fractional_geometry_targets_zero_and_exact_paint_controls(self):
        row={"name":"fractional","scale":3,"parent":[16,250,104,88],"referenceExact":True,"inkPixels":900,"nativeLabel":"Saving circle","nativeValue":None,"state":{"visible":True,"size":33.25,"rootWidth":33.25,"rootHeight":33.25,"rootTag":691,"layout":{"eventTarget":691,"currentTarget":691,"layout":{"width":33.333333333,"height":33.333333333}}}}
        self.assertEqual(NATIVE.validate_circle_loader_rows([row],["fractional"])["status"],"PASS")
        for kind in ["wrong-target","wrong-size","blank","paint","numeric-value","wrong-parent","duplicate"]:
            value=copy.deepcopy(row)
            if kind=="wrong-target":value["state"]["layout"]["eventTarget"]=692
            elif kind=="wrong-size":value["state"]["layout"]["layout"]["height"]=32.5
            elif kind=="blank":value["inkPixels"]=0
            elif kind=="paint":value["referenceExact"]=False
            elif kind=="numeric-value":value["nativeValue"]="25%"
            elif kind=="wrong-parent":value["parent"][2]=103
            with self.subTest(kind=kind),self.assertRaises(ValueError):NATIVE.validate_circle_loader_rows([value,value] if kind=="duplicate" else [value],["fractional"])
        zero=copy.deepcopy(row);zero["name"]="zero";zero["state"]["size"]=0;zero["inkPixels"]=0
        self.assertEqual(NATIVE.validate_circle_loader_rows([zero],["zero"])["status"],"PASS")
        zero["inkPixels"]=1
        with self.assertRaises(ValueError):NATIVE.validate_circle_loader_rows([zero],["zero"])

    def test_circular_scope_selection_and_real_missing_admission_stop(self):
        for platform in ["ios", "android"]:
            plan={"cell":"CAT.circular-progress.G08" if platform=="ios" else "CAT.circular-progress.G02", "nativeStandard":{"platform":platform,"batch":"circular-progress","output":str(self.root/"never-created")}}
            NATIVE.validate_standard_scope(plan)
            self.assertEqual(len(NATIVE.selection(platform,"circular-progress")[platform]),3)
            path=self.root/(platform+"-circle.json");path.write_text(json.dumps(plan))
            env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
            result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(path)],env=env,capture_output=True,text=True,timeout=10)
            self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((self.root/"never-created").exists())
        for gate in ["G07","G09"]:
            with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":"CAT.circular-progress."+gate,"nativeStandard":{"batch":"circular-progress"}})

    def test_circular_reader_replays_actual_native_row_and_rejects_missing_semantics_paint_and_bindings(self):
        row={"name":"quarter","nativeLabel":"Circular verification","nativeValue":"25%","scale":3,"referenceExact":True,"inkPixels":9615,"state":{"case":"quarter","rootTag":690,"attaches":1,"detaches":0,"width":120,"height":120,"layouts":{"target":{"target":690,"currentTarget":690,"layout":{"width":120,"height":120}}}}}
        self.assertEqual(NATIVE.validate_circular_rows([row],["quarter"])["status"],"PASS")
        for kind in ["missing-label","wrong-value","wrong-target","wrong-size","blank","paint","duplicate"]:
            value=copy.deepcopy(row)
            if kind=="missing-label":value["nativeLabel"]=""
            elif kind=="wrong-value":value["nativeValue"]="75%"
            elif kind=="wrong-target":value["state"]["layouts"]["target"]["target"]=691
            elif kind=="wrong-size":value["state"]["layouts"]["target"]["layout"]["height"]=119
            elif kind=="blank":value["inkPixels"]=0
            elif kind=="paint":value["referenceExact"]=False
            with self.subTest(kind=kind),self.assertRaises(ValueError):NATIVE.validate_circular_rows([value,value] if kind=="duplicate" else [value],["quarter"])
        self.assertEqual(len(NATIVE.selection("ios","circular-progress-affected")["ios"]),2)
        with self.assertRaises(ValueError):NATIVE.selection("android","circular-progress-affected")

    def test_prepared_app_checks_selected_library_and_fixture_sources_before_sdk(self):
        fixture=self.root/"apps/native-showcase/src/fixture.tsx";fixture.parent.mkdir(parents=True);fixture.write_text("current fixture")
        item={"path":str(fixture),"sha256":NATIVE.digest(fixture)};plan={"bindings":{"source":[item,{"path":str(fixture.parent/"__tests__/fixture.test.tsx"),"sha256":"c"*64}],"fixture":[item]}}
        with patch.object(NATIVE,"REPO",self.root):
            self.assertEqual(NATIVE.verify_selected_app_inputs(plan,{"sourceFilesSHA256":{str(fixture):item["sha256"],"unrelated.ts":"old-other-cell"}})["status"],"PASS")
            for inputs in [{str(fixture):"0"*64},{}]:
                with self.assertRaisesRegex(ValueError,"Selected application source differs"):NATIVE.verify_selected_app_inputs(plan,{"sourceFilesSHA256":inputs})
            self.assertEqual(NATIVE.verify_selected_app_inputs(plan,{})["status"],"LEGACY_IDENTITY_REQUIRES_SEPARATE_SOURCE_MAP_REVIEW")

    def test_shared_fixture_waits_use_the_overall_work_deadline(self):
        swift=(ROOT/"MeterG02TrialTests.swift").read_text()
        self.assertIn('CODON_NATIVE_WORK_DEADLINE_UNIX',swift)
        self.assertNotIn('timeout:10',swift);self.assertNotIn('timeout: 10',swift)
        java=(ROOT/"android-native-inspector/Actions.java").read_text()
        for name in ['lpAdmitConnection(', 'msWait(', 'msMotionEvent(', 'tgAwaitSelectedScene(']:
            body=member(java,name)
            self.assertNotIn('+5000',body);self.assertNotIn('+10000',body)
        self.assertIn('timeout: 0.75',swift, 'Actual inverted callback observation remains meaningful')

    def test_no_sdk_build_recreates_or_copies_a_workspace(self):
        source = (ROOT / "NativeStandardTests.py").read_text()
        self.assertEqual(source.count("shutil.copytree("), 1);self.assertIn("shutil.copytree(product, target)",source);self.assertIn("product = verify_product(base)",source);self.assertNotIn("UI_SETUP_COMPLETE", source)
        self.assertNotIn("READY_FOR_UI_SETUP", source)
        self.assertIn('"build-for-testing"', source);self.assertIn('"test-without-building"', source)
        self.assertIn('"instrument"', source)
        project = (ROOT / "ios-native-tests/CodonNativeComponents.xcodeproj/project.pbxproj").read_text()
        self.assertIn("../MeterG02TrialTests.swift", project);self.assertNotIn("/tmp/", project)
        self.assertNotIn("Stepper", project);self.assertNotIn("SortFilter", project)

    def test_meter_assertion_methods_remain_byte_exact(self):
        baseline = json.loads((ROOT / "MeterG02SourceBaseline.json").read_text())
        for filename, rows in baseline.items():
            source = (ROOT / filename).read_text()
            for name, expected in rows.items():
                text = member(source, name)
                self.assertEqual(hashlib.sha256(text.encode()).hexdigest(), expected, name)

    def test_actual_meter_semantic_observer_rejects_wrong_targets_and_values(self):
        import MeterG02AndroidTests as checker
        native = {"id": checker.TARGET, "visible": True, "className": "android.view.View", "roleDescription": "Progress Bar", "windowRoots": 1, "windowNodes": [{"id": checker.TARGET}], "stateDescription": None, "contentDescription": checker.NAME + ", 25%", "rangeInfo": {"min": 0, "max": 100, "current": 25}, "currentValue": 25, "text": None, "textIsNull": True, "nativeUptimeMs": 1, "nativeEpochMs": 1}
        checker.semantic(native, 0, 100, 25, "25%")
        for change in [{"id": "wrong-target"}, {"currentValue": 75}, {"className": "android.widget.SeekBar"}, {"windowNodes": [{"id": checker.TARGET}, {"id": checker.TARGET}]}]:
            with self.subTest(change=change), self.assertRaises(AssertionError): checker.semantic({**native, **change}, 0, 100, 25, "25%")

    def test_failed_android_cohort_cannot_produce_native_success(self):
        source = (ROOT / "android-native-inspector/Actions.java").read_text()
        body = member(source, "private JSONObject meterG02BatchCurrent(")
        expression = re.search(r'result.put\("nativeActionSucceeded",(safe[^;]+)\);', body).group(1)
        expression = expression.replace("cases.length()", "actual").replace("names.length", "expected").replace("&&", " and ").replace("!failed", "not failed")
        for safe, failed, actual, expected, verdict in [(True, False, 4, 4, True), (True, True, 4, 4, False), (False, False, 4, 4, False), (True, False, 3, 4, False)]:
            self.assertEqual(eval(expression, {}, {"safe": safe, "failed": failed, "actual": actual, "expected": expected}), verdict)

    def test_missing_avd_directory_rejects_before_any_sdk_command(self):
        session = MagicMock()
        config = {"sdk": str(self.root), "destination": "emulator-5568", "avdHome": str(self.root), "avd": "missing", "androidUserHome": str(self.root)}
        with self.assertRaisesRegex(ValueError, "Selected AVD is missing"): NATIVE.run_android(session, config, {}, {})
        session.run.assert_not_called()

    def test_actual_emulator_spawn_receives_the_bound_avd_environment(self):
        (self.root / "owned.ini").write_text("path=existing-control\n")
        config = {"sdk": str(self.root), "destination": "emulator-5568", "avdHome": str(self.root), "avd": "owned", "androidUserHome": str(self.root), "gpu": "host"}
        session = NATIVE.Session(self.root / "output", 30, 10)
        session.run = MagicMock(side_effect=["", ValueError("stop before SDK wait")])
        socket_control = MagicMock();socket_control.__enter__.return_value.connect_ex.return_value = NATIVE.errno.ECONNREFUSED
        with patch.object(NATIVE.socket, "socket", return_value=socket_control), patch.object(NATIVE.subprocess, "Popen", return_value=MagicMock(pid=12345)) as spawn:
            with self.assertRaisesRegex(ValueError, "stop before SDK wait"): NATIVE.run_android(session, config, {}, {})
        self.assertIn("-no-window", spawn.call_args.args[0])
        environment = spawn.call_args.kwargs["env"]
        self.assertEqual(environment["ANDROID_AVD_HOME"], str(self.root))
        self.assertEqual(environment["ANDROID_USER_HOME"], str(self.root))
        self.assertEqual(environment["ANDROID_SDK_ROOT"], str(self.root))
        self.assertEqual(json.loads((session.output / "emulator-owner.json").read_text())["pid"], 12345)

    def test_actual_cleanup_waits_for_detachment_and_rejects_remaining_serial_or_port(self):
        config = {"platform": "android", "sdk": str(self.root), "destination": "emulator-5568"}
        for scenario in ["delayed-detachment", "remaining-serial", "remaining-port"]:
            session = NATIVE.Session(self.root / scenario, 60, 30)
            session.guest_owned = True;session.emulator = MagicMock(pid=54321,returncode=0);session.emulator.poll.return_value=0
            responses = ["", "emulator-5568 offline", ""] if scenario == "delayed-detachment" else None
            session.run = MagicMock(side_effect=responses) if responses else MagicMock(return_value="emulator-5568 offline" if scenario == "remaining-serial" else "")
            probe = MagicMock();probe.__enter__.return_value.connect_ex.return_value = 0 if scenario == "remaining-port" else NATIVE.errno.ECONNREFUSED
            with patch.object(NATIVE, "stop_owned_process", return_value=True), patch.object(NATIVE,"host_process_binding",return_value=None), patch.object(NATIVE,"build_process_pids",return_value=[]), patch.object(NATIVE.time, "sleep", side_effect=lambda _: setattr(session, "end", session.end - 60) if scenario=="remaining-serial" else None), patch.object(NATIVE.socket, "socket", return_value=probe):
                NATIVE.cleanup(session, config)
                self.assertEqual(bool(session.cleanup_errors),scenario!="delayed-detachment")
                if scenario == "delayed-detachment":self.assertEqual(session.run.call_count, 3)


    def test_motion_preference_failure_still_stops_owned_guest_and_preserves_error(self):
        config = {"platform": "android", "sdk": str(self.root), "destination": "emulator-5568"}
        for name, original, restored in [("exact-null", "null", "null"), ("exact-value", "0.5", "0.5"), ("mismatch", "1", "0"), ("restore-fails", "1", None)]:
            session = NATIVE.Session(self.root / name, 60, 30);session.guest_owned = True;session.emulator = MagicMock(pid=54321,returncode=0);session.emulator.poll.return_value=0;session.motion_setting = original
            def command(label, argv, *args, **kwargs):
                if label == "restore-motion-setting" and restored is None: raise ValueError("SDK denied restoration")
                return restored if label == "verify-motion-setting" else ""
            session.run = MagicMock(side_effect=command)
            probe = MagicMock();probe.__enter__.return_value.connect_ex.return_value = NATIVE.errno.ECONNREFUSED
            with patch.object(NATIVE, "stop_owned_process", return_value=True) as stopped, patch.object(NATIVE,"host_process_binding",return_value=None), patch.object(NATIVE,"build_process_pids",return_value=[]), patch.object(NATIVE.socket, "socket", return_value=probe):
                NATIVE.cleanup(session, config)
            stopped.assert_called_once();self.assertIs(stopped.call_args.args[0],session.emulator);self.assertTrue(callable(stopped.call_args.args[1]))
            self.assertIn("emulator-shutdown", [call.args[0] for call in session.run.call_args_list])
            self.assertEqual(bool(session.cleanup_errors), name in ["mismatch", "restore-fails"])
            if name == "exact-null": self.assertIn("delete", session.run.call_args_list[0].args[1])


    def test_build_kernel_confirmation_rejects_changed_and_uncertain_reads(self):
        import ctypes,struct
        for kind in ["stable","birth","uid","ppid","pgid","path","traced","denied","short"]:
            info_calls=[];path_calls=[];library=MagicMock()
            def metadata(pid,flavor,arg,target,size):
                info_calls.append(pid)
                if len(info_calls)>1 and kind=="denied":ctypes.set_errno(NATIVE.errno.EPERM);return 0
                if len(info_calls)>1 and kind=="short":return size-1
                data=bytearray(size);values={0:0,4:3,12:pid,16:123,20:os.getuid(),100:pid}
                if len(info_calls)>1:
                    if kind=="uid":values[20]+=1
                    if kind=="ppid":values[16]+=1
                    if kind=="pgid":values[100]+=1
                    if kind=="traced":values[0]=2
                for offset,value in values.items():struct.pack_into("=I",data,offset,value)
                struct.pack_into("=QQ",data,120,1700000000,12346 if len(info_calls)>1 and kind=="birth" else 12345);ctypes.memmove(target,bytes(data),size);return size
            def path(pid,target,size):
                path_calls.append(pid);data=b"/owned/cat\0" if len(path_calls)>1 and kind=="path" else b"/owned/python\0";ctypes.memmove(target,data,len(data));return len(data)-1
            library.proc_pidinfo.side_effect=metadata;library.proc_pidpath.side_effect=path
            with patch.object(NATIVE.ctypes,"CDLL",return_value=library):
                if kind=="stable":self.assertTrue(NATIVE.host_process_binding(54321)["coherent"])
                else:
                    with self.subTest(kind=kind),self.assertRaises((ValueError,OSError)):NATIVE.host_process_binding(54321,absent_ok=True)


    def test_build_kernel_inventory_refuses_denial_truncation_and_invalid_pid(self):
        import ctypes
        for kind in ["empty","valid","denied","truncated","invalid"]:
            library=MagicMock()
            def inventory(pid,target,size):
                if kind=="denied":ctypes.set_errno(NATIVE.errno.EPERM);return 0
                if target is None:return 0 if kind=="empty" else 1
                target[0]=54321 if kind!="invalid" else os.getpid()
                return 2 if kind=="truncated" else 1
            library.proc_listchildpids.side_effect=inventory;library.proc_listpgrppids.side_effect=inventory
            with patch.object(NATIVE.ctypes,"CDLL",return_value=library):
                for group in [False,True]:
                    if kind in ["empty","valid"]:self.assertEqual(NATIVE.build_process_pids(12345,group=group),[] if kind=="empty" else [54321])
                    else:
                        with self.assertRaises(ValueError):NATIVE.build_process_pids(12345,group=group)


    def test_build_kernel_binding_distinguishes_absence_from_unknown_metadata(self):
        import ctypes
        for number in [NATIVE.errno.ESRCH,NATIVE.errno.ENOENT,NATIVE.errno.EPERM,0]:
            library=MagicMock()
            def metadata(*args):ctypes.set_errno(number);return 0
            library.proc_pidinfo.side_effect=metadata
            with patch.object(NATIVE.ctypes,"CDLL",return_value=library):
                if number==NATIVE.errno.ESRCH:self.assertIsNone(NATIVE.host_process_binding(12345,absent_ok=True))
                else:
                    with self.assertRaises(OSError):NATIVE.host_process_binding(12345,absent_ok=True)
                with self.assertRaises(OSError):NATIVE.host_process_binding(12345)


    def test_build_kernel_missing_path_requires_fresh_pid_absence(self):
        import ctypes,struct
        for disappeared in [False,True]:
            calls=[];library=MagicMock()
            def metadata(pid,flavor,arg,target,size):
                calls.append(pid)
                if disappeared and len(calls)>1:ctypes.set_errno(NATIVE.errno.ESRCH);return 0
                data=bytearray(size)
                for offset,value in [(4,3),(12,pid),(20,os.getuid())]:struct.pack_into("=I",data,offset,value)
                struct.pack_into("=QQ",data,120,1700000000,12345);ctypes.memmove(target,bytes(data),size);return size
            def path(*args):ctypes.set_errno(NATIVE.errno.ENOENT);return 0
            library.proc_pidinfo.side_effect=metadata;library.proc_pidpath.side_effect=path
            with patch.object(NATIVE.ctypes,"CDLL",return_value=library):
                if disappeared:self.assertIsNone(NATIVE.host_process_binding(12345,absent_ok=True))
                else:
                    with self.assertRaises(OSError):NATIVE.host_process_binding(12345,absent_ok=True)
            self.assertEqual(len(calls),2)






def member(source, signature):
    start = source.index(signature);opening = source.index("{", start);depth = 1;end = opening + 1
    # These preserved test/helper bodies contain balanced interpolation braces.
    while depth:
        depth += (source[end] == "{") - (source[end] == "}");end += 1
    return source[start:end]



class CheckboxGroupControls(unittest.TestCase):
    def rows(self):
        rows=[]
        phases=sum((["group:root","member:"+id,"press:"+id] for id in ["alpha","alpha","beta","alpha","beta"]),[])+["nested:nested","member:nested","press:nested","member:loose","press:loose"]+sum((["group:root","member:"+id,"press:"+id] for id in ["beta","alpha"]),[])
        for name in NATIVE.CHECKBOX_GROUP_BEHAVIOR+NATIVE.CHECKBOX_GROUP_STYLES:
            nested=name in ["nested","nested-changed","loose-changed"];visible=name!="retired";zero=name=="zero";narrow=name=="long-narrow"
            selected=["alpha"] if name in ["echo-remove-beta","disabled","readonly","renderer","nested","nested-changed","loose-changed","replacement","fresh","local-add-alpha","default-changed"] else ["beta"] if name in ["echo-beta","local"] else ["beta","alpha"] if name=="echo-alpha" else []
            tag=None if not visible else 82 if name=="replacement" else 83 if name=="fresh" else 84 if name.startswith("local") or name=="default-changed" else 81
            width,height=(0,0) if zero else (140,140) if narrow else (200,100)
            labels={"alpha":"Alpha","beta":"Beta","nested":"Nested","loose":"Loose"};nested_value=[] if name in ["nested-changed","loose-changed"] else ["nested"];loose=name!="loose-changed"
            state={"scale":3,"rootTag":tag,"layouts":[{"target":tag,"currentTarget":tag,"layout":{"width":width,"height":height}}],"visible":visible,"zero":zero,"narrow":narrow,"nested":nested,"disabled":name=="disabled","readonly":name=="readonly","width":width,"value":selected,"nestedValue":nested_value,"looseValue":loose,"labels":labels,"requests":[["alpha"],["alpha"],["beta"],["beta","alpha"],["alpha"],[],["alpha"]],"phases":phases,"events":[{"phase":"press","target":90,"currentTarget":91} for _ in range(9)],"themeMode":"dark" if name=="dark" else "light"}
            members=[]
            if visible:
                for id in (["alpha","nested","loose"] if nested else ["alpha","beta"]):
                    checked=loose if id=="loose" else id in (nested_value if id=="nested" else selected);frame=[12.0,12.0,106.0,80.0 if narrow and id=="alpha" else 44.0]
                    members.append({"id":id,"label":labels[id],"value":"checkbox, "+("checked" if checked else "unchecked"),"enabled":not state["disabled"] or id=="nested","relativeFrame":frame,"referenceRelativeFrame":frame[:]})
            rows.append({"name":name,"state":state,"parent":[20,100,280,224],"referenceParent":[20,332,280,224],"root":[32,112,width,height] if visible else [],"referenceRoot":[32,344,width,height] if visible else [],"members":members,"referenceExact":True,"inkPixels":0 if zero or not visible else 1000,"scale":3,"imageWidth":1170,"imageHeight":2532})
        return rows

    def test_group_reader_complete_positive_and_actual_risk_negatives(self):
        rows=self.rows();encode=lambda values:"\n".join("CHECKBOX_GROUP_NATIVE_OBSERVATION "+json.dumps(row) for row in values)
        self.assertEqual(NATIVE.reconcile_checkbox_group_ios(encode(rows))["observations"],32)
        for kind in ["missing","duplicate","paint","wrong-label","wrong-value","wrong-enabled","missing-member","duplicate-member","outside","fractional-physical-pixel","wrong-root-ref","retired-ref","retired-paint","zero-paint","veto","order","callback","provider"]:
            bad=copy.deepcopy(rows);named={x["name"]:x for x in bad};row=named["baseline"]
            if kind=="missing":bad.pop()
            elif kind=="duplicate":bad.append(copy.deepcopy(row))
            elif kind=="paint":row["referenceExact"]=False
            elif kind=="wrong-label":row["members"][0]["label"]="Wrong"
            elif kind=="wrong-value":row["members"][0]["value"]="checkbox, checked"
            elif kind=="wrong-enabled":row["members"][0]["enabled"]=False
            elif kind=="missing-member":row["members"].pop()
            elif kind=="duplicate-member":row["members"][1]=copy.deepcopy(row["members"][0])
            elif kind=="outside":row["parent"][1]=900
            elif kind=="fractional-physical-pixel":row["members"][0]["relativeFrame"][0]+=1/3
            elif kind=="wrong-root-ref":named["renderer"]["state"]["rootTag"]=88
            elif kind=="retired-ref":named["retired"]["state"]["rootTag"]=81
            elif kind=="retired-paint":named["retired"]["inkPixels"]=1
            elif kind=="zero-paint":named["zero"]["inkPixels"]=1
            elif kind=="veto":named["veto-1"]["state"]["value"]=["alpha"]
            elif kind=="order":named["default-changed"]["state"]["phases"].reverse()
            elif kind=="callback":named["default-changed"]["state"]["events"][0]["currentTarget"]=None
            elif kind=="provider":named["dark"]["state"]["themeMode"]="light"
            with self.subTest(kind=kind),self.assertRaises((ValueError,TypeError)):NATIVE.reconcile_checkbox_group_ios(encode(bad))
        positive=copy.deepcopy(rows);positive[0]["members"][0]["relativeFrame"][2]+=0.0001220703125
        NATIVE.reconcile_checkbox_group_ios(encode(positive))

    def test_group_scope_actual_no_admission_and_compiled_controls(self):
        self.assertEqual(NATIVE.selection("ios","checkbox-group")["ios"],["CheckboxGroupTrialTests/testCheckboxGroupActionsAndLifetimes","CheckboxGroupTrialTests/testCheckboxGroupStylesAndConstraints"])
        NATIVE.validate_standard_scope({"cell":"CAT.checkbox-group.G08","nativeStandard":{"batch":"checkbox-group"}})
        for cell in ["CAT.combo-box.G08","CAT.checkbox-group.G07","CAT.checkbox.G08"]:
            with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":cell,"nativeStandard":{"batch":"checkbox-group"}})
        with self.assertRaises(ValueError):NATIVE.selection("android","checkbox-group")
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);p=root/"plan.json";p.write_text(json.dumps({"cell":"CAT.checkbox-group.G08","nativeStandard":{"platform":"ios","batch":"checkbox-group","output":str(root/"never-created")}}));env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
            result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(p)],env=env,capture_output=True,text=True,timeout=10)
            self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((root/"never-created").exists())
        controls=NATIVE.geometry_control_source();self.assertIn('"checkboxGroupCases":14',controls);self.assertIn("func checkboxGroupMembersMatch",controls)

    def test_group_zero_native_ax_absence_keeps_live_ref_and_blank_paint(self):
        observer=(ROOT/"MeterG02TrialTests.swift").read_text().split("final class CheckboxGroupTrialTests:",1)[1]
        capture=member(observer,"private func capture(")
        self.assertLess(capture.index('if row["zero"]'),capture.index("let target=try XCTUnwrap(root)"))
        rows=self.rows();zero=next(row for row in rows if row["name"]=="zero")
        zero["root"]=[];zero["referenceRoot"]=[];zero["members"]=[]
        raw="\n".join("CHECKBOX_GROUP_NATIVE_OBSERVATION "+json.dumps(row) for row in rows)
        self.assertEqual(NATIVE.reconcile_checkbox_group_ios(raw)["observations"],32)

    def test_group_actions_reuses_only_bound_clean_style_method(self):
        rows=self.rows();encode=lambda values:"\n".join("CHECKBOX_GROUP_NATIVE_OBSERVATION "+json.dumps(row) for row in values)
        actions=encode([row for row in rows if row["name"] in NATIVE.CHECKBOX_GROUP_BEHAVIOR])
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);source=root/"source.ts";source.write_text("unchanged group")
            raw=root/"styles.log";raw.write_text("Test Case '-[C.CheckboxGroupTrialTests testCheckboxGroupStylesAndConstraints]' passed (326.055 seconds).\n"+encode([row for row in rows if row["name"] in NATIVE.CHECKBOX_GROUP_STYLES]))
            cleanup=root/"cleanup.json";cleanup.write_text(json.dumps({"cleanupVerified":True,"cleanupErrors":[],"elapsedSeconds":770}))
            sdk=root/"sdk.json";sdk.write_text(json.dumps({"ownedGroupGone":True,"exitCode":65}))
            loaded=root/"loaded.json";loaded.write_text(json.dumps({"status":"PASS","observerManifestSHA256":"b"*64}))
            bind=lambda p:{"path":str(p),"sha256":NATIVE.digest(p)}
            method={**bind(raw),"kind":"native_method","format":"xctest_log","method":"testCheckboxGroupStylesAndConstraints","claim":"Only clean styles from mixed-outcome batch","appManifestSHA256":"a"*64,"observerManifestSHA256":"b"*64}
            proof={"status":"PASS","appManifestSHA256":"a"*64,"observerManifestSHA256":"b"*64,"sources":[bind(source)],"raw":bind(raw),"cleanup":bind(cleanup),"sdkCommand":bind(sdk),"loadedObserver":bind(loaded),"nativeMethod":method}
            path=root/"proof.json"
            def config(value):
                path.write_text(json.dumps(value));return {"batch":"checkbox-group-actions","retainedGroupStyles":bind(path)}
            self.assertEqual(NATIVE.reconcile_checkbox_group_ios(actions,config(proof),{"manifestSHA256":"a"*64})["observations"],32)
            with self.assertRaises(ValueError):NATIVE.reconcile_checkbox_group_ios(actions,config(proof),{"manifestSHA256":"c"*64})
            bad=copy.deepcopy(proof);bad["nativeMethod"]["method"]="testCheckboxGroupActionsAndLifetimes"
            with self.assertRaises(ValueError):NATIVE.reconcile_checkbox_group_ios(actions,config(bad),{"manifestSHA256":"a"*64})
            for name,p,value in [("cleanup",cleanup,{"cleanupVerified":False,"cleanupErrors":[],"elapsedSeconds":770}),("sdkCommand",sdk,{"ownedGroupGone":True,"timedOut":True}),("loadedObserver",loaded,{"status":"PASS","observerManifestSHA256":"c"*64})]:
                original=p.read_bytes();p.write_text(json.dumps(value));bad=copy.deepcopy(proof);bad[name]=bind(p)
                with self.subTest(name=name),self.assertRaises(ValueError):NATIVE.reconcile_checkbox_group_ios(actions,config(bad),{"manifestSHA256":"a"*64})
                p.write_bytes(original)
            source.write_text("changed source")
            with self.assertRaises(ValueError):NATIVE.reconcile_checkbox_group_ios(actions,config(proof),{"manifestSHA256":"a"*64})
        self.assertEqual(NATIVE.selection("ios","checkbox-group-actions")["ios"],["CheckboxGroupTrialTests/testCheckboxGroupActionsAndLifetimes"])
        self.assertIn('"checkboxGroupTagCases":8',NATIVE.geometry_control_source())


class LinkControls(unittest.TestCase):
    def row(self):
        row=ListItemControls().row();row["state"].update(case="baseline",height=44,related=False,targetsVisible=True,targetText=["First","Second"]);row.update(nativeLink=True,nativeLabel="Read settings",nativeValue="Link value",matchedReferenceParent=row["parent"][:]);return row
    def test_link_original_native_fields_physical_frames_and_real_relationships(self):
        row=self.row();NATIVE.validate_link_rows([row],["baseline"])
        fractional=copy.deepcopy(row);fractional["root"][2]+=0.0001220703125;NATIVE.validate_link_rows([fractional],["baseline"])
        for key,value in [("nativeLink",False),("nativeLabel","wrong"),("nativeValue","wrong"),("targetCount",2),("referenceExact",False),("root",[32,112,200,43]),("matchedReferenceParent",[20.34,100,280,224]),("parent",[20,850,280,224])]:
            bad=copy.deepcopy(row);bad[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):NATIVE.validate_link_rows([bad],["baseline"])
        for name,label,visible,available in [("alias-relationships","First Second",True,True),("attribute-relationships","Second First",True,True),("removed-targets","Read settings",False,False),("empty-relationships","Read settings",True,False)]:
            native={"case":name,"target":row["state"]["rootTag"],"ownerId":"actual-owner","windowId":"actual-window","platform":"ios","observedAt":17000,"label":label,"hint":"Open the destination","value":"Link value","descriptionAvailable":available,"detailsAvailable":available,"description":"Guide" if available else "","details":"Detail" if available else ""}
            value=copy.deepcopy(row);value["state"].update(case=name,related=True,targetsVisible=visible,inspection=native);value["nativeLabel"]=label;NATIVE.validate_link_rows([value],["baseline"])
            for field,wrong in [("target",0),("label","wrong"),("windowId",""),("hint","wrong"),("descriptionAvailable",not available),("description","wrong"),("details","wrong")]:
                bad=copy.deepcopy(value);bad["state"]["inspection"][field]=wrong
                with self.subTest(case=name,field=field),self.assertRaises(ValueError):NATIVE.validate_link_rows([bad],["baseline"])
        with self.assertRaises(ValueError):NATIVE.validate_link_rows([row,row],["baseline"])
        with self.assertRaises(ValueError):NATIVE.reconcile_link_ios("")
    def test_link_selected_standard_entry_fails_before_sdk_without_admission(self):
        NATIVE.validate_standard_scope({"cell":"CAT.link.G08","nativeStandard":{"batch":"link"}});self.assertEqual(len(NATIVE.selection("ios","link")["ios"]),3)
        for cell in ["CAT.combo-box.G08","CAT.link.G07","CAT.button.G08"]:
            with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":cell,"nativeStandard":{"batch":"link"}})
        with self.assertRaises(ValueError):NATIVE.selection("android","link")
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);p=root/"plan.json";p.write_text(json.dumps({"cell":"CAT.link.G08","nativeStandard":{"platform":"ios","batch":"link","output":str(root/"never-created")}}));env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
            result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(p)],env=env,capture_output=True,text=True,timeout=10);self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((root/"never-created").exists())
        source=NATIVE.geometry_control_source();self.assertIn('"linkGlyphCases":5',source);self.assertIn('"linkReferenceCases":8',source)
        self.assertEqual(len(NATIVE.selection("ios","link-static")["ios"]),2)
        self.assertEqual(NATIVE.selection("ios","link-actions")["ios"],["LinkTrialTests/testLinkActionsAndLifetimes"])
        NATIVE.validate_standard_scope({"cell":"CAT.link.G08","nativeStandard":{"batch":"link-actions"}})
        NATIVE.validate_standard_scope({"cell":"CAT.link.G08","nativeStandard":{"batch":"link-static"}})
        with self.assertRaises(ValueError):NATIVE.reconcile_link_ios("",{"batch":"link-static","retainedLinkMotion":{"path":"/missing/retained/proof","sha256":"0"*64}})


class ButtonControls(unittest.TestCase):
    def test_button_original_native_phase_orders_accept_delayed_pressout_and_reject_missing_phases(self):
        first=["start","change:true","up","end","change:false","press"];delayed=["start","change:true","up","press","end","change:false"]
        self.assertTrue(NATIVE.button_press_prefix(first));self.assertTrue(NATIVE.button_press_prefix(delayed))
        for values in [delayed[:-1],list(reversed(delayed)),["start","change:true","press","up","end","change:false"],["start","change:true","up","press","press","change:false"]]:self.assertFalse(NATIVE.button_press_prefix(values))
        self.assertEqual(NATIVE.selection("ios","button-motion")["ios"],["ButtonTrialTests/testButtonMotionAndRetirement"])
    def test_button_reader_busy_null_guard_geometry_and_reference_failures(self):
        row=ListItemControls().row();row["state"].update(label="Save settings",pending=False,raised=False);row.update(nativeLabel="Save settings",nativeValue=None,nativeButton=True)
        NATIVE.validate_button_rows([row],["baseline"])
        busy=copy.deepcopy(row);busy["state"]["pending"]=True;busy["nativeValue"]="busy";NATIVE.validate_button_rows([busy],["baseline"])
        for key,value in [("nativeButton",False),("nativeValue","checked"),("nativeValue","busy"),("nativeLabel","wrong"),("referenceExact",False),("root",[32,112,200,43]),("parent",[20,850,280,224]),("targetCount",2)]:
            bad=copy.deepcopy(row);bad[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):NATIVE.validate_button_rows([bad],["baseline"])
        bad=copy.deepcopy(busy);bad["nativeValue"]=None
        with self.assertRaises(ValueError):NATIVE.validate_button_rows([bad],["baseline"])
        raised=copy.deepcopy(row);raised["state"]["raised"]=True;raised["matchedReferenceParent"]=row["parent"][:];NATIVE.validate_button_rows([raised],["baseline"]);raised["matchedReferenceParent"][1]+=1/3
        with self.assertRaises(ValueError):NATIVE.validate_button_rows([raised],["baseline"])
        fractional=copy.deepcopy(row);fractional["root"][2]+=0.0001220703125;NATIVE.validate_button_rows([fractional],["baseline"])
        self.assertEqual(len(NATIVE.selection("ios","button")["ios"]),3)
        with self.assertRaises(ValueError):NATIVE.selection("android","button")
    def test_button_actual_entry_refuses_without_admission_and_shadow_controls_are_compiled(self):
        NATIVE.validate_standard_scope({"cell":"CAT.button.G08","nativeStandard":{"batch":"button"}})
        for cell in ["CAT.combo-box.G08","CAT.button.G07","CAT.toggle-button.G08"]:
            with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":cell,"nativeStandard":{"batch":"button"}})
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);p=root/"plan.json";p.write_text(json.dumps({"cell":"CAT.button.G08","nativeStandard":{"platform":"ios","batch":"button","output":str(root/"never-created")}}));env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
            result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(p)],env=env,capture_output=True,text=True,timeout=10);self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((root/"never-created").exists())
        source=NATIVE.geometry_control_source();self.assertIn('"buttonShadowCases":6',source);self.assertIn('func buttonShadowIntermediate',source)


class RadioGroupControls(unittest.TestCase):
    def rows(self):
        seed=CheckboxGroupControls().rows()[0];rows=[]
        phases=["group:root","press:alpha","group:root","press:alpha","group:root","press:beta","group:root","press:alpha","press:alpha","nested:other","press:other","group:root","press:alpha","group:root","press:alpha","press:alpha"]
        for name in NATIVE.RADIO_GROUP_BEHAVIOR+NATIVE.RADIO_GROUP_STYLES:
            row=copy.deepcopy(seed);state=row["state"];nested=name in ["nested","nested-other"];zero=name=="zero";visible=name!="retired";narrow=name=="long-narrow"
            value="" if name in ["empty-selected","empty-reselected"] else "beta" if name in ["echo-beta","local"] else "alpha" if name in ["echo-alpha","reselected","reselected-alpha","disabled","readonly","renderer","nested","nested-other","replacement","fresh","default-changed","local-alpha","empty-value"] else None
            tag=None if not visible else 82 if name=="replacement" else 83 if name=="fresh" else 84 if name in ["local","local-alpha","default-changed"] else 85 if name.startswith("empty") else 81
            width,height=(0,0) if zero else (140,140) if narrow else (200,100)
            state.update(value=value,rootTag=tag,layouts=[{"target":tag,"currentTarget":tag,"layout":{"width":width,"height":height}}],nested=nested,nestedValue="other" if name=="nested-other" else "nested",visible=visible,zero=zero,narrow=narrow,width=width,disabled=name=="disabled",readonly=name=="readonly",values={"alpha":"" if name.startswith("empty") else "alpha","beta":"beta","nested":"nested","other":"other"},labels={"alpha":"Alpha","beta":"Beta","nested":"Nested","other":"Other"},requests=["alpha","alpha","beta","alpha","alpha",""] if name=="empty-reselected" else ["alpha","alpha","beta","alpha"],phases=phases,events=[{"phase":"press","target":90,"currentTarget":91} for _ in range(9)],themeMode="dark" if name=="dark" else "light")
            members=[]
            if visible and not zero:
                for id in (["alpha","nested","other"] if nested else ["alpha","beta"]):
                    selected=state["nestedValue"]==state["values"][id] if id in ["nested","other"] else value is not None and value==state["values"][id];frame=[12.0,12.0,106.0,80.0 if narrow and id=="alpha" else 44.0]
                    members.append({"id":id,"label":state["labels"][id],"value":"radio button, "+("checked" if selected else "unchecked"),"enabled":not state["disabled"] or id in ["nested","other"],"relativeFrame":frame,"referenceRelativeFrame":frame[:]})
            row.update(name=name,state=state,nativeRootLabel="Notification options",nativeRootValue=None,members=members,root=[32,112,width,height] if visible and not zero else [],referenceRoot=[32,344,width,height] if visible and not zero else [],inkPixels=1000 if visible and not zero else 0);rows.append(row)
        return rows

    def test_radio_group_reader_nullable_empty_quiet_and_physical_failures(self):
        rows=self.rows();encode=lambda values:"\n".join("RADIO_GROUP_NATIVE_OBSERVATION "+json.dumps(row) for row in values)
        self.assertEqual(NATIVE.reconcile_radio_group_ios(encode(rows))["observations"],34)
        for kind in ["missing","duplicate","paint","role","label","value","enabled","member","pixel","layout-ref","retired-ref","retired-paint","zero-paint","veto","quiet","nested","default","empty","order","callback","provider"]:
            bad=copy.deepcopy(rows);named={row["name"]:row for row in bad};row=named["baseline"]
            if kind=="missing":bad.pop()
            elif kind=="duplicate":bad.append(copy.deepcopy(row))
            elif kind=="paint":row["referenceExact"]=False
            elif kind=="role":row["members"][0]["value"]="checkbox, unchecked"
            elif kind=="label":row["nativeRootLabel"]="Wrong"
            elif kind=="value":row["state"]["value"]=["alpha"]
            elif kind=="enabled":row["members"][0]["enabled"]=False
            elif kind=="member":row["members"].pop()
            elif kind=="pixel":row["members"][0]["relativeFrame"][0]+=1/3
            elif kind=="layout-ref":row["state"]["layouts"][0]["currentTarget"]=82
            elif kind=="retired-ref":named["retired"]["state"]["rootTag"]=81
            elif kind=="retired-paint":named["retired"]["inkPixels"]=1
            elif kind=="zero-paint":named["zero"]["inkPixels"]=1
            elif kind=="veto":named["veto-1"]["state"]["value"]="alpha"
            elif kind=="quiet":named["reselected-alpha"]["state"]["requests"].append("alpha")
            elif kind=="nested":named["nested-other"]["state"]["value"]="other"
            elif kind=="default":named["default-changed"]["state"]["value"]="beta"
            elif kind=="empty":named["empty-reselected"]["state"]["value"]=None
            elif kind=="order":named["empty-reselected"]["state"]["phases"].reverse()
            elif kind=="callback":named["empty-reselected"]["state"]["events"][0]["currentTarget"]=None
            elif kind=="provider":named["dark"]["state"]["themeMode"]="light"
            with self.subTest(kind=kind),self.assertRaises((ValueError,TypeError)):NATIVE.reconcile_radio_group_ios(encode(bad))
        positive=copy.deepcopy(rows);positive[0]["members"][0]["relativeFrame"][2]+=0.0001220703125;NATIVE.reconcile_radio_group_ios(encode(positive))

    def test_radio_group_actual_no_admission_scope_and_compiled_predicates(self):
        self.assertEqual(NATIVE.selection("ios","radio-group")["ios"],["RadioGroupTrialTests/testRadioGroupActionsAndLifetimes","RadioGroupTrialTests/testRadioGroupStylesAndConstraints"])
        NATIVE.validate_standard_scope({"cell":"CAT.radio-group.G08","nativeStandard":{"batch":"radio-group"}})
        for cell in ["CAT.combo-box.G08","CAT.radio-group.G07","CAT.checkbox-group.G08"]:
            with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":cell,"nativeStandard":{"batch":"radio-group"}})
        with self.assertRaises(ValueError):NATIVE.selection("android","radio-group")
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);p=root/"plan.json";p.write_text(json.dumps({"cell":"CAT.radio-group.G08","nativeStandard":{"platform":"ios","batch":"radio-group","output":str(root/"never-created")}}));env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
            result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(p)],env=env,capture_output=True,text=True,timeout=10);self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((root/"never-created").exists())
        source=NATIVE.geometry_control_source();self.assertIn('"radioGroupCases":14',source);self.assertIn("func radioGroupMembersMatch",source)


class AvatarControls(unittest.TestCase):
    def row(self):
        return {"name":"baseline","state":{"scale":3,"visible":True,"size":30,"rootTag":81,"layouts":[{"target":81,"currentTarget":81,"layout":{"width":30,"height":30}}],"interactive":True,"disabled":False,"label":"Alice Smith","imageMode":"none","delayed":False},"scale":3,"parent":[20,100,280,128],"referenceParent":[20,236,280,128],"root":[32,112,30,30],"referenceRoot":[32,248,30,30],"nativeType":9,"nativeLabel":"Alice Smith","nativeEnabled":True,"targetCount":1,"referenceExact":True,"inkPixels":1000,"imageWidth":1170,"imageHeight":2532,"early":False,"captureEpochMs":9000}
    def test_avatar_pixel_native_ref_guard_and_temporal_failures(self):
        row=self.row();self.assertEqual(NATIVE.validate_avatar_rows([row],["baseline"])["observations"],1)
        for field,value in [("referenceExact",False),("targetCount",2),("nativeLabel","wrong"),("nativeType",40),("nativeEnabled",False),("scale",float("nan")),("root",[32,112,30,31])]:
            bad=copy.deepcopy(row);bad[field]=value
            with self.subTest(field=field),self.assertRaises(ValueError):NATIVE.validate_avatar_rows([bad],["baseline"])
        passive=copy.deepcopy(row);passive["state"]["interactive"]=False;passive["nativeType"]=43
        NATIVE.validate_avatar_rows([passive],["baseline"])
        bad=copy.deepcopy(row);bad["state"]["layouts"][0]["currentTarget"]=82
        with self.assertRaises(ValueError):NATIVE.validate_avatar_rows([bad],["baseline"])
        bad=copy.deepcopy(row);bad["parent"][1]=900
        with self.assertRaises(ValueError):NATIVE.validate_avatar_rows([bad],["baseline"])
        delayed=copy.deepcopy(row);delayed["state"].update(delayed=True,delay=8000,mountedEpochMs=2000);delayed["early"]=True
        NATIVE.validate_avatar_rows([delayed],["baseline"])
        delayed["captureEpochMs"]=10000
        with self.assertRaises(ValueError):NATIVE.validate_avatar_rows([delayed],["baseline"])
        zero=copy.deepcopy(row);zero["state"]["size"]=0;zero["state"]["layouts"][0]["layout"]={"width":0,"height":0};zero["inkPixels"]=0
        NATIVE.validate_avatar_rows([zero],["baseline"]);zero["inkPixels"]=1
        with self.assertRaises(ValueError):NATIVE.validate_avatar_rows([zero],["baseline"])
        retired=copy.deepcopy(row);retired["state"].update(visible=False,rootTag=None);retired["root"]=[];retired["inkPixels"]=0
        NATIVE.validate_avatar_rows([retired],["baseline"]);retired["state"]["rootTag"]=81
        with self.assertRaises(ValueError):NATIVE.validate_avatar_rows([retired],["baseline"])
    def test_avatar_actual_entry_no_admission_wrong_scope_and_platform(self):
        for gate in ["G04","G08"]:NATIVE.validate_standard_scope({"cell":"CAT.avatar."+gate,"nativeStandard":{"batch":"avatar"}})
        for cell in ["CAT.tag.G08","CAT.avatar.G07"]:
            with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":cell,"nativeStandard":{"batch":"avatar"}})
        with self.assertRaises(ValueError):NATIVE.selection("android","avatar")
        self.assertEqual(len(NATIVE.selection("ios","avatar")["ios"]),2)
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);plan=root/"plan.json";plan.write_text(json.dumps({"cell":"CAT.avatar.G08","nativeStandard":{"platform":"ios","batch":"avatar","output":str(root/"never-created")}}));env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
            result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(plan)],env=env,capture_output=True,text=True,timeout=10)
            self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((root/"never-created").exists())


class ListItemControls(unittest.TestCase):
    def row(self):
        return {"name":"baseline","state":{"scale":3,"visible":True,"rootTag":81,"layouts":[{"target":81,"currentTarget":81,"layout":{"width":200,"height":44}}],"zero":False,"disabled":False,"selected":False,"textValue":"Choice number:0","width":200,"small":False,"narrow":False},"scale":3,"parent":[20,100,280,224],"referenceParent":[20,332,280,224],"root":[32,112,200,44],"referenceRoot":[32,344,200,44],"targetCount":1,"nativeLabel":"Choice number:0","nativeValue":"radio button, unchecked","nativeEnabled":True,"referenceExact":True,"inkPixels":1000,"imageWidth":1170,"imageHeight":2532,"heldContactIntervals":[]}
    def test_list_item_native_controls_fail_for_wrong_semantics_frames_refs_pixels_and_held_phase(self):
        row=self.row();self.assertEqual(NATIVE.validate_list_item_rows([row],["baseline"])["observations"],1)
        for field,value in [("nativeValue","radio button, checked"),("nativeValue","checkbox, unchecked"),("nativeValue","radio button, mixed"),("referenceExact",False),("nativeLabel","wrong"),("nativeEnabled",False),("targetCount",2),("root",[33,112,200,44]),("scale",float("nan"))]:
            bad=copy.deepcopy(row);bad[field]=value
            with self.subTest(field=field,value=value),self.assertRaises(ValueError):NATIVE.validate_list_item_rows([bad],["baseline"])
        bad=copy.deepcopy(row);bad["state"]["layouts"][0]["currentTarget"]=82
        with self.assertRaises(ValueError):NATIVE.validate_list_item_rows([bad],["baseline"])
        held=copy.deepcopy(row);held["heldContactIntervals"]=[{"beganEpochMs":1000,"endedEpochMs":2000,"disabledOnPressInEpochMs":1100}];NATIVE.validate_list_item_rows([held],["baseline"]);held["heldContactIntervals"][0]["disabledOnPressInEpochMs"]=1800
        with self.assertRaises(ValueError):NATIVE.validate_list_item_rows([held],["baseline"])
        bad=copy.deepcopy(row);bad["parent"][1]=900
        with self.assertRaises(ValueError):NATIVE.validate_list_item_rows([bad],["baseline"])
    def test_list_item_focused_motion_refuses_wrong_app_or_failed_retained_method(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);loaded=root/"loaded.json";loaded.write_text(json.dumps({"status":"PASS","observerManifestSHA256":"c"*64}));cleanup=root/"cleanup.json";cleanup.write_text(json.dumps({"cleanupVerified":True}));proof=root/"proof.json"
            value={"appManifestSHA256":"a"*64,"observerManifestSHA256":"c"*64,"librarySources":[],"loadedObserver":{"path":str(loaded),"sha256":NATIVE.digest(loaded)},"cleanup":{"path":str(cleanup),"sha256":NATIVE.digest(cleanup)},"nativeMethods":[{"method":"testListBoxItemMotionAndRetirement"}]};proof.write_text(json.dumps(value));config={"batch":"list-box-item-motion","retainedListItemMethods":{"path":str(proof),"sha256":NATIVE.digest(proof)}}
            with self.assertRaisesRegex(ValueError,"app differs"):NATIVE.reconcile_list_item_ios("",config,{"manifestSHA256":"b"*64})
            with self.assertRaisesRegex(ValueError,"Only clean"):NATIVE.reconcile_list_item_ios("",config,{"manifestSHA256":"a"*64})
        self.assertEqual(NATIVE.selection("ios","list-box-item-motion")["ios"],["ListBoxItemTrialTests/testListBoxItemMotionAndRetirement"])
        with self.assertRaises(ValueError):NATIVE.selection("android","list-box-item-motion")

    def test_list_item_scope_actual_entry_and_motion_source_controls(self):
        for gate in ["G04","G08"]:NATIVE.validate_standard_scope({"cell":"CAT.list-box-item."+gate,"nativeStandard":{"batch":"list-box-item"}})
        for cell in ["CAT.list-box-item.G07","CAT.combo-box.G08"]:
            with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":cell,"nativeStandard":{"batch":"list-box-item"}})
        with self.assertRaises(ValueError):NATIVE.selection("android","list-box-item")
        self.assertEqual(len(NATIVE.selection("ios","list-box-item")["ios"]),3)
        controls=NATIVE.geometry_control_source();self.assertIn("listItemValueMatches",controls);self.assertIn("listItemIntermediate",controls);self.assertIn('listItemCases',controls)
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);plan=root/"plan.json";plan.write_text(json.dumps({"cell":"CAT.list-box-item.G08","nativeStandard":{"platform":"ios","batch":"list-box-item","output":str(root/"never-created")}}));env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"};result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(plan)],env=env,capture_output=True,text=True,timeout=10);self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((root/"never-created").exists())

class ToggleButtonControls(unittest.TestCase):
    def test_toggle_button_fixture_copies_event_fields_before_deferred_update(self):
        repository=ROOT.parents[3]
        script=r"""
const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict")
const source=fs.readFileSync("apps/native-showcase/src/scenes/ToggleButtonG08Fixture.tsx","utf8")
const start=source.indexOf("  const record ="),end=source.indexOf("  const changeMode =",start)
assert(start>=0 && end>start)
const compiled=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const pending=[]
const record=new Function("setEvents","tag",compiled+";return record")(updater=>pending.push(updater),value=>value)
const original={target:79,currentTarget:81}
record("press",original)
original.target=null;original.currentTarget=null
const saved=pending.shift()([])
assert.equal(saved[0].target,79)
assert.equal(saved[0].currentTarget,81,"Deferred updater lost original currentTarget")
record("out",{target:79,currentTarget:null})
const next=pending.shift()(saved)
assert.equal(next[1].currentTarget,null,"An originally null native field must stay null")
process.stdout.write("PASS original delivered fields retained before deferred updater\n")
"""
        for fixture in ["ToggleButtonG08Fixture.tsx","RadioG08Fixture.tsx"]:
            result=subprocess.run(["node","-e",script.replace("ToggleButtonG08Fixture.tsx",fixture)],cwd=repository,capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertIn("PASS original delivered",result.stdout)

    def test_toggle_button_real_metadata_and_geometry_reader(self):
        row=ListItemControls().row();row["state"].update(label="Flag settings",radio=False);row.update(nativeLabel="Flag settings",nativeValue="unchecked",nativeButton=True)
        self.assertEqual(NATIVE.validate_toggle_button_rows([row],["baseline"])["observations"],1)
        for key,value in [("nativeButton",False),("nativeValue","checked"),("nativeValue","radio button, unchecked"),("nativeLabel","wrong"),("referenceExact",False),("root",[32,112,200,43])]:
            bad=copy.deepcopy(row);bad[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):NATIVE.validate_toggle_button_rows([bad],["baseline"])
        raised=copy.deepcopy(row);raised["state"]["raised"]=True;raised["matchedReferenceParent"]=list(row["parent"]);NATIVE.validate_toggle_button_rows([raised],["baseline"]);raised["matchedReferenceParent"][1]+=1/3
        with self.assertRaisesRegex(ValueError,"physical origin"):NATIVE.validate_toggle_button_rows([raised],["baseline"])
        radio=copy.deepcopy(row);radio["state"]["radio"]=True;radio.update(nativeButton=False,nativeValue="radio button, unchecked");NATIVE.validate_toggle_button_rows([radio],["baseline"])
        radio["nativeValue"]="unchecked"
        with self.assertRaises(ValueError):NATIVE.validate_toggle_button_rows([radio],["baseline"])
    def test_toggle_button_actual_entry_refuses_unadmitted_and_wrong_platform(self):
        NATIVE.validate_standard_scope({"cell":"CAT.toggle-button.G08","nativeStandard":{"batch":"toggle-button"}})
        with self.assertRaises(ValueError):NATIVE.selection("android","toggle-button")
        with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":"CAT.combo-box.G08","nativeStandard":{"batch":"toggle-button"}})
        self.assertEqual(len(NATIVE.selection("ios","toggle-button")["ios"]),3)
        self.assertEqual(len(NATIVE.selection("ios","toggle-button-affected")["ios"]),2)
        self.assertEqual(NATIVE.selection("ios","toggle-button-style")["ios"],["ToggleButtonTrialTests/testToggleButtonStylesAndConstraints"])
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);plan=root/"plan.json";plan.write_text(json.dumps({"cell":"CAT.toggle-button.G08","nativeStandard":{"platform":"ios","batch":"toggle-button","output":str(root/"never-created")}}));env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"};result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(plan)],env=env,capture_output=True,text=True,timeout=10);self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((root/"never-created").exists())


class RadioControls(unittest.TestCase):
    def test_radio_schedule_snapshots_timer_epoch_before_deferred_update(self):
        script=r"""
const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict")
const source=fs.readFileSync("apps/native-showcase/src/scenes/RadioG08Fixture.tsx","utf8")
const start=source.indexOf("    const schedule ="),end=source.indexOf("    timers.current =",start)
assert(start>=0 && end>start)
const compiled=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const pending=[],timers=[];let clock=0,actions=0
const schedule=new Function("setTimeout","setMotionTrace","Date",compiled+";return schedule")((callback,delay)=>{timers.push({callback,delay});return timers.length},updater=>pending.push(updater),{now:()=>clock})
schedule(3000,"select",()=>actions++);clock=3000;timers[0].callback();clock=9999
assert.equal(actions,1);assert.equal(pending[0]([])[0].epochMs,3000)
process.stdout.write("PASS actual timer epoch retained before deferred updater\n")
"""
        result=subprocess.run(["node","-e",script],cwd=ROOT.parents[3],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn("PASS actual timer epoch",result.stdout)

    def test_radio_actual_metadata_and_geometry_refusals(self):
        row=ListItemControls().row();row["state"]["label"]="Keep settings";row["nativeLabel"]="Keep settings"
        self.assertEqual(NATIVE.validate_radio_rows([row],["baseline"])["observations"],1)
        for field,value in [("nativeValue","checked"),("nativeValue","radio button, mixed"),("nativeLabel","wrong"),("nativeEnabled",False),("targetCount",2),("referenceExact",False),("root",[32,112,200,43]),("scale",float("nan"))]:
            bad=copy.deepcopy(row);bad[field]=value
            with self.subTest(field=field),self.assertRaises(ValueError):NATIVE.validate_radio_rows([bad],["baseline"])
        bad=copy.deepcopy(row);bad["state"]["layouts"][0]["currentTarget"]=82
        with self.assertRaises(ValueError):NATIVE.validate_radio_rows([bad],["baseline"])
        with self.assertRaises(ValueError):NATIVE.validate_radio_rows([row,row],["baseline"])
        held=copy.deepcopy(row);held["heldContactIntervals"]=[{"beganEpochMs":1000,"endedEpochMs":2000,"disabledOnPressInEpochMs":1100}];NATIVE.validate_radio_rows([held],["baseline"]);held["heldContactIntervals"][0]["disabledOnPressInEpochMs"]=1800
        with self.assertRaises(ValueError):NATIVE.validate_radio_rows([held],["baseline"])
        with self.assertRaises(ValueError):NATIVE.reconcile_radio_ios("")

    def test_radio_scope_actual_entry_and_existing_compiled_predicates(self):
        NATIVE.validate_standard_scope({"cell":"CAT.radio.G08","nativeStandard":{"batch":"radio"}})
        self.assertEqual(len(NATIVE.selection("ios","radio")["ios"]),3)
        self.assertEqual(NATIVE.selection("ios","radio-motion")["ios"],["RadioTrialTests/testRadioMotionAndRetirement"])
        with self.assertRaises(ValueError):NATIVE.reconcile_radio_ios("",{"batch":"radio-motion","retainedRadioStaticMethods":{"path":"/not/a/proof","sha256":"0"*64}})
        for cell in ["CAT.combo-box.G08","CAT.radio.G07","CAT.radio-group.G08"]:
            with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":cell,"nativeStandard":{"batch":"radio"}})
        with self.assertRaises(ValueError):NATIVE.selection("android","radio")
        controls=NATIVE.geometry_control_source();self.assertIn("listItemValueMatches",controls);self.assertIn("listItemIntermediate",controls)
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);plan=root/"plan.json";plan.write_text(json.dumps({"cell":"CAT.radio.G08","nativeStandard":{"platform":"ios","batch":"radio","output":str(root/"never-created")}}));env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
            result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(plan)],env=env,capture_output=True,text=True,timeout=10)
            self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((root/"never-created").exists())


class AndroidCleanupEvidenceControls(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory();self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def session(self, name):
        session = NATIVE.Session(self.root / name, 60, 30)
        session.guest_owned = True
        session.emulator = MagicMock(pid=5286, returncode=None)
        session.run = MagicMock(return_value="")
        return session

    def test_systemui_boundary_diagnostic_preserves_one_stock_dump_and_stops(self):
        for name, raw in [("complete", "ServiceRecord{current com.android.systemui/.SystemUIService}\napp=ProcessRecord{current 926:com.android.systemui}\nlastStartId=1 startCommandResult=1\n"), ("executing", "ServiceRecord{current com.android.systemui/.SystemUIService}\nexecuteNesting=1 executingStart=now\n"), ("unknown", "ACTIVITY MANAGER SERVICES\n(no matching services)\n")]:
            with self.subTest(name=name):
                session = self.session("service-" + name)
                def command(label, argv):
                    self.assertEqual(label, "systemui-service-at-boot")
                    self.assertEqual(argv, ["adb", "-s", "emulator-5568", "shell", "dumpsys", "activity", "services", "com.android.systemui/.SystemUIService"])
                    (session.output / (label + ".stdout")).write_text(raw)
                    return raw
                session.run.side_effect = command
                with patch.object(NATIVE, "start_android", return_value=["adb", "-s", "emulator-5568"]) as boot, patch.object(NATIVE.time, "sleep", side_effect=AssertionError("No diagnostic delay")):
                    result = NATIVE.diagnose_android(session, {"systemUIServiceAtBootOnly":True})
                boot.assert_called_once();session.run.assert_called_once()
                self.assertEqual(result["status"], "SYSTEMUI_SERVICE_STATE_CAPTURED_PENDING_REVIEW")
                self.assertEqual((result["componentMethods"], result["installRequests"], result["inputRequests"], result["gatePromotions"]), (0, 0, 0, 0))
                self.assertNotIn("ready", result)
                self.assertEqual(Path(result["serviceState"]["path"]).read_text(), raw)
                self.assertEqual(result["serviceState"]["sha256"], NATIVE.digest(result["serviceState"]["path"]))

    def test_denied_group_operations_keep_trace_and_continue_read_only_verification_without_retry(self):
        import errno
        import signal
        config = {"platform":"android", "sdk":"/sdk", "destination":"emulator-5568"}
        for denied_at in [1, 2, 3, 4, 5]:
            with self.subTest(denied_at=denied_at):
                session = self.session("denied-" + str(denied_at))
                calls = []
                def denied(pid, number):
                    calls.append((pid, number))
                    self.assertLessEqual(len(calls), denied_at, "Denied operation retried")
                    if len(calls) == denied_at:
                        raise PermissionError(errno.EPERM, "denied operation " + str(denied_at))
                probe = MagicMock();probe.__enter__.return_value.connect_ex.return_value = NATIVE.errno.ECONNREFUSED
                with patch.object(NATIVE.os, "killpg", side_effect=denied), patch.object(NATIVE.socket, "socket", return_value=probe):
                    NATIVE.cleanup(session, config)
                self.assertEqual(calls, [(5286, 0), (5286, signal.SIGTERM), (5286, 0), (5286, signal.SIGKILL), (5286, 0)][:denied_at])
                self.assertEqual([call.args[0] for call in session.run.call_args_list], ["emulator-shutdown", "devices-after-0"])
                self.assertTrue(session.run.call_args_list[-1].kwargs["cleanup"])
                self.assertEqual(probe.__enter__.return_value.connect_ex.call_count, 2)
                self.assertEqual(len(session.cleanup_errors), 1)
                receipt = json.loads((session.output / "emulator-group-cleanup-failure.json").read_text())
                self.assertEqual((receipt["pid"], receipt["processGroup"], receipt["errno"]), (5286, 5286, errno.EPERM))
                self.assertIsNone(receipt["leaderReturnCode"])
                self.assertIn("stop_owned_process", receipt["traceback"])
                self.assertIn("denied operation " + str(denied_at), receipt["error"])

    def test_verification_failure_or_expired_deadline_never_erases_group_denial(self):
        config = {"platform":"android", "sdk":"/sdk", "destination":"emulator-5568"}
        for scenario in ["query-fails", "remaining-serial", "remaining-port", "deadline"]:
            with self.subTest(scenario=scenario):
                session = self.session(scenario)
                def command(name, argv, *args, **kwargs):
                    if name.startswith("devices-after"):
                        self.assertTrue(kwargs["cleanup"])
                        if scenario == "query-fails":raise ValueError("saved verification query failed")
                        if scenario == "deadline":raise ValueError("No command budget remains")
                        if scenario == "remaining-serial":return "emulator-5568 offline"
                    return ""
                session.run.side_effect = command
                session.remaining = MagicMock(return_value=0 if scenario in ["remaining-serial", "deadline"] else 30)
                probe = MagicMock();probe.__enter__.return_value.connect_ex.return_value = 0 if scenario == "remaining-port" else NATIVE.errno.ECONNREFUSED
                with patch.object(NATIVE, "stop_owned_process", side_effect=PermissionError(1, "saved group probe denied")) as stop, patch.object(NATIVE.socket, "socket", return_value=probe):
                    with self.assertRaisesRegex(ValueError, "query failed|budget remains|detachment not verified|port remains open"):
                        NATIVE.cleanup(session, config)
                stop.assert_called_once();self.assertIs(stop.call_args.args[0],session.emulator);self.assertTrue(callable(stop.call_args.args[1]))
                self.assertEqual(session.cleanup_errors, ["Owned emulator group cleanup: PermissionError(1, 'saved group probe denied')"])
                self.assertTrue((session.output / "emulator-group-cleanup-failure.json").is_file())
                self.assertEqual(session.run.call_count, 1 if scenario in ["remaining-serial","deadline"] else 2)

    def test_denied_cleanup_keeps_actual_driver_failed_even_when_serial_and_ports_clear(self):
        output = self.root / "execute"
        plan = {"cell":"CAT.meter.G07", "nativeStandard":{"platform":"android", "action":"diagnose", "batch":"meter-startup-diagnostic", "output":str(output), "sdk":"/sdk", "destination":"emulator-5568"}, "attempt":{"maximumSeconds":60, "cleanupReserveSeconds":30}}
        def diagnostic(session, config):
            session.guest_owned = True;session.emulator = MagicMock(pid=5286, returncode=0)
            return {"status":"OS_DIAGNOSTIC_CAPTURED_PENDING_REVIEW", "componentMethods":0}
        probe = MagicMock();probe.__enter__.return_value.connect_ex.return_value = NATIVE.errno.ECONNREFUSED
        with patch.object(NATIVE, "diagnose_android", side_effect=diagnostic), patch.object(NATIVE.Session, "run", return_value=""), patch.object(NATIVE, "stop_owned_process", side_effect=PermissionError(1, "saved group probe denied")) as stop, patch.object(NATIVE.socket, "socket", return_value=probe):
            code = NATIVE.execute(plan, {"result":"PASS", "scope":"host control, no SDK"})
        self.assertEqual(code, 1);stop.assert_called_once()
        terminal = json.loads((output / "terminal.json").read_text())
        self.assertEqual(terminal["status"], "FAILED")
        self.assertFalse(terminal["cleanupVerified"])
        self.assertTrue(terminal["cleanupErrors"])
        self.assertIsNotNone(terminal["result"])
        self.assertTrue((output / "emulator-group-cleanup-failure.json").is_file())

    def test_remaining_group_cannot_be_relabelled_after_clear_serial_and_ports(self):
        session = self.session("remaining-group")
        probe = MagicMock();probe.__enter__.return_value.connect_ex.return_value = NATIVE.errno.ECONNREFUSED
        with patch.object(NATIVE, "stop_owned_process", return_value=False) as stop, patch.object(NATIVE.socket, "socket", return_value=probe):
            NATIVE.cleanup(session, {"platform":"android", "sdk":"/sdk", "destination":"emulator-5568"})
        stop.assert_called_once();self.assertIs(stop.call_args.args[0],session.emulator);self.assertTrue(callable(stop.call_args.args[1]))
        self.assertEqual(len(session.cleanup_errors), 1)
        self.assertIn("Owned emulator group remains", session.cleanup_errors[0])
        self.assertTrue((session.output / "emulator-group-cleanup-failure.json").is_file())



class AndroidPositiveAbsenceControls(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory();self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def session(self, name):
        session = NATIVE.Session(self.root / name, 60, 30)
        session.guest_owned = True
        session.emulator = MagicMock(pid=54321, returncode=0)
        session.emulator.poll.return_value = 0
        session.run = MagicMock(return_value="")
        return session

    def test_complete_positive_absence_avoids_every_group_signal_probe(self):
        session = self.session("positive")
        probe = MagicMock();probe.__enter__.return_value.connect_ex.return_value = NATIVE.errno.ECONNREFUSED
        with patch.object(NATIVE, "host_process_binding", return_value=None) as pid, patch.object(NATIVE, "build_process_pids", return_value=[]) as group, patch.object(NATIVE.os, "killpg", side_effect=AssertionError("No signal/probe permitted")) as signal, patch.object(NATIVE.socket, "socket", return_value=probe):
            NATIVE.cleanup(session, {"platform":"android", "sdk":"/sdk", "destination":"emulator-5568"})
        signal.assert_not_called()
        self.assertTrue(all(call.args == (54321,) and call.kwargs == {"absent_ok":True} for call in pid.call_args_list))
        self.assertTrue(all(call.args == (54321,) and call.kwargs == {"group":True} for call in group.call_args_list))
        self.assertEqual([call.args[0] for call in session.run.call_args_list], ["emulator-shutdown", "devices-after-0"])
        self.assertEqual(session.cleanup_errors, [])
        record = json.loads((session.output / "android-cleanup-verification.json").read_text())
        self.assertTrue(record["verified"] and record["kernelPIDAbsent"])
        self.assertEqual(record["kernelGroupMembers"], [])
        self.assertTrue(record["endpoints"]["serialAbsent"])
        self.assertEqual(record["endpoints"]["portsClosed"], {"5568":True, "5569":True})

    def test_live_reused_denied_or_incomplete_kernel_evidence_never_means_absence(self):
        for scenario in ["live-pid", "reused-pid", "unknown-pid", "denied-pid", "nonempty-group", "unknown-group", "denied-group", "partial-group", "deadline"]:
            with self.subTest(scenario=scenario):
                session = self.session(scenario)
                pid = PermissionError(1, "PID denied") if scenario == "denied-pid" else False if scenario == "unknown-pid" else {"pid":54321,"uid":501,"start":[1,0]} if scenario in ["live-pid","reused-pid"] else None
                group = PermissionError(1, "group denied") if scenario == "denied-group" else ValueError("incomplete group inventory") if scenario == "partial-group" else [65432] if scenario == "nonempty-group" else None if scenario == "unknown-group" else []
                probe = MagicMock();probe.__enter__.return_value.connect_ex.return_value = NATIVE.errno.ECONNREFUSED
                if scenario == "deadline":session.remaining = MagicMock(return_value=0)
                with patch.object(NATIVE, "host_process_binding", **({"side_effect":pid} if isinstance(pid,Exception) else {"return_value":pid})), patch.object(NATIVE, "build_process_pids", **({"side_effect":group} if isinstance(group,Exception) else {"return_value":group})), patch.object(NATIVE.os, "killpg", side_effect=AssertionError("Unknown must not signal")) as signal, patch.object(NATIVE.socket, "socket", return_value=probe):
                    try:NATIVE.cleanup(session, {"platform":"android", "sdk":"/sdk", "destination":"emulator-5568"})
                    except ValueError:
                        self.assertEqual(scenario, "deadline")
                signal.assert_not_called()
                self.assertTrue(session.cleanup_errors)
                receipt = json.loads((session.output / "android-cleanup-verification.json").read_text())
                self.assertFalse(receipt["verified"])
                if scenario == "nonempty-group": self.assertEqual(receipt["kernelGroupMembers"], [65432])
                self.assertTrue((session.output / "emulator-group-cleanup-failure.json").exists())

    def test_serial_port_query_and_final_deadline_fail_without_retry_or_probe(self):
        for scenario in ["serial", "port", "query", "final-deadline"]:
            with self.subTest(scenario=scenario):
                session = self.session(scenario);expired = {"value":False}
                def command(name, argv, *args, **kwargs):
                    if name.startswith("devices-after"):
                        if scenario == "query":raise ValueError("saved query failure")
                        if scenario == "serial":expired["value"]=True;return "emulator-5568 offline"
                    return ""
                session.run.side_effect = command
                session.remaining = MagicMock(side_effect=lambda *args:0 if expired["value"] else 30)
                probe = MagicMock();connections = []
                def connect(address):
                    connections.append(address)
                    if scenario == "final-deadline" and len(connections)==2:expired["value"]=True
                    return 0 if scenario == "port" else NATIVE.errno.ECONNREFUSED
                probe.__enter__.return_value.connect_ex.side_effect = connect
                with patch.object(NATIVE, "host_process_binding", return_value=None), patch.object(NATIVE, "build_process_pids", return_value=[]), patch.object(NATIVE.os, "killpg", side_effect=AssertionError("No group probe")) as signal, patch.object(NATIVE.socket, "socket", return_value=probe):
                    NATIVE.cleanup(session, {"platform":"android", "sdk":"/sdk", "destination":"emulator-5568"})
                signal.assert_not_called();self.assertTrue(session.cleanup_errors)
                self.assertEqual(session.run.call_count, 2)
                self.assertFalse(json.loads((session.output / "android-cleanup-verification.json").read_text())["verified"])

    def test_actual_driver_accepts_only_complete_proof_and_keeps_unknown_nonzero(self):
        for known in [True,False]:
            output = self.root / ("execute-" + str(known))
            plan = {"cell":"CAT.meter.G07", "nativeStandard":{"platform":"android", "action":"diagnose", "batch":"meter-startup-diagnostic", "output":str(output), "sdk":"/sdk", "destination":"emulator-5568"}, "attempt":{"maximumSeconds":60,"cleanupReserveSeconds":30}}
            def diagnostic(session, config):
                session.guest_owned=True;session.emulator=MagicMock(pid=54321,returncode=0);session.emulator.poll.return_value=0
                return {"status":"HOST_CONTROL_NO_SDK", "componentMethods":0}
            probe=MagicMock();probe.__enter__.return_value.connect_ex.return_value=NATIVE.errno.ECONNREFUSED
            with patch.object(NATIVE,"diagnose_android",side_effect=diagnostic),patch.object(NATIVE.Session,"run",return_value=""),patch.object(NATIVE,"host_process_binding",return_value=None),patch.object(NATIVE,"build_process_pids",return_value=[] if known else None),patch.object(NATIVE.os,"killpg",side_effect=AssertionError("No signal/probe")) as signal,patch.object(NATIVE.socket,"socket",return_value=probe):
                code=NATIVE.execute(plan,{"result":"HOST_CONTROL_ONLY"})
            signal.assert_not_called();self.assertEqual(code,0 if known else 1)
            terminal=json.loads((output/"terminal.json").read_text());self.assertEqual(terminal["cleanupVerified"],known)

    def test_later_pid_reuse_cannot_leave_an_earlier_positive_receipt(self):
        session=self.session("late-reuse")
        probe=MagicMock();probe.__enter__.return_value.connect_ex.return_value=NATIVE.errno.ECONNREFUSED
        with patch.object(NATIVE,"host_process_binding",side_effect=[None,{"pid":54321,"uid":501,"start":[2,0]}]),patch.object(NATIVE,"build_process_pids",return_value=[]),patch.object(NATIVE.os,"killpg",side_effect=AssertionError("No signal/probe")) as signal,patch.object(NATIVE.socket,"socket",return_value=probe):
            NATIVE.cleanup(session,{"platform":"android","sdk":"/sdk","destination":"emulator-5568"})
        signal.assert_not_called();self.assertTrue(session.cleanup_errors)
        proof=json.loads((session.output/"android-cleanup-verification.json").read_text())
        self.assertFalse(proof["verified"]);self.assertNotIn("kernelPIDAbsent",proof)
        self.assertEqual(session.run.call_count,2)

    def test_port_absence_requires_platform_refusal_and_preserves_returned_errors(self):
        for result in [NATIVE.errno.ECONNREFUSED, 0, NATIVE.errno.EACCES, NATIVE.errno.EPERM, NATIVE.errno.ETIMEDOUT, NATIVE.errno.EIO, -4096, None, True]:
            with self.subTest(result=result):
                session = self.session("port-result-" + str(result))
                probe = MagicMock();probe.__enter__.return_value.connect_ex.return_value = result
                with patch.object(NATIVE, "host_process_binding", return_value=None), patch.object(NATIVE, "build_process_pids", return_value=[]), patch.object(NATIVE.os, "killpg", side_effect=AssertionError("No signal/probe")) as signal, patch.object(NATIVE.socket, "socket", return_value=probe):
                    NATIVE.cleanup(session, {"platform":"android", "sdk":"/sdk", "destination":"emulator-5568"})
                signal.assert_not_called()
                expected = type(result) is int and result == NATIVE.errno.ECONNREFUSED
                receipt = json.loads((session.output / "android-cleanup-verification.json").read_text())
                self.assertEqual(receipt["verified"], expected)
                self.assertEqual(bool(session.cleanup_errors), not expected)
                self.assertEqual(receipt["endpoints"]["portChecks"]["5568"], {"errno":result if type(result) is int else None, "returned":repr(result)})
                self.assertEqual(probe.__enter__.return_value.connect_ex.call_count, 2 if expected else 1)
                self.assertEqual(session.run.call_count, 2)

    def test_port_query_exceptions_preserve_errno_and_keep_actual_driver_nonzero(self):
        for label, error in [("denied", PermissionError(NATIVE.errno.EACCES, "saved port denial")), ("timeout", TimeoutError(NATIVE.errno.ETIMEDOUT, "saved port timeout")), ("unexpected", OSError(NATIVE.errno.EIO, "saved port error"))]:
            with self.subTest(label=label):
                output = self.root / ("port-exception-" + label)
                plan = {"cell":"CAT.meter.G07", "nativeStandard":{"platform":"android", "action":"diagnose", "batch":"meter-startup-diagnostic", "output":str(output), "sdk":"/sdk", "destination":"emulator-5568"}, "attempt":{"maximumSeconds":60,"cleanupReserveSeconds":30}}
                def diagnostic(session, config):
                    session.guest_owned = True;session.emulator = MagicMock(pid=54321, returncode=0);session.emulator.poll.return_value = 0
                    return {"status":"HOST_CONTROL_NO_SDK", "componentMethods":0}
                probe = MagicMock();probe.__enter__.return_value.connect_ex.side_effect = error
                with patch.object(NATIVE, "diagnose_android", side_effect=diagnostic), patch.object(NATIVE.Session, "run", return_value=""), patch.object(NATIVE, "host_process_binding", return_value=None), patch.object(NATIVE, "build_process_pids", return_value=[]), patch.object(NATIVE.os, "killpg", side_effect=AssertionError("No signal/probe")) as signal, patch.object(NATIVE.socket, "socket", return_value=probe):
                    code = NATIVE.execute(plan, {"result":"HOST_CONTROL_ONLY"})
                signal.assert_not_called();self.assertEqual(code, 1)
                terminal = json.loads((output / "terminal.json").read_text())
                receipt = json.loads((output / "android-cleanup-verification.json").read_text())
                self.assertEqual(terminal["status"], "FAILED");self.assertFalse(terminal["cleanupVerified"])
                self.assertEqual(receipt["endpoints"]["portChecks"]["5568"], {"errno":error.errno, "error":repr(error)})
                failure = json.loads((output / "emulator-group-cleanup-failure.json").read_text())
                self.assertEqual(failure["errno"], error.errno);self.assertIn(repr(error), failure["error"])
                probe.__enter__.return_value.connect_ex.assert_called_once()

    def test_optional_reaped_verifier_never_accepts_unknown_or_checks_a_live_leader(self):
        from NativeAndroidTestSupport import group_present
        for result in [False,None,1,[]]:
            process=MagicMock(returncode=0);process.poll.return_value=0
            verify=MagicMock(return_value=result)
            with patch.object(NATIVE.os,"killpg",side_effect=AssertionError("No signal/probe")) as signal:
                with self.assertRaisesRegex(ValueError,"absence is not verified"):group_present(process,verify)
            signal.assert_not_called();verify.assert_called_once_with(process)
        process=MagicMock(pid=54321,returncode=None);process.poll.return_value=None
        verify=MagicMock(side_effect=AssertionError("Cannot verify live leader as exited"))
        with patch.object(NATIVE.os,"killpg",side_effect=PermissionError(1,"host mock only")):
            with self.assertRaises(PermissionError):group_present(process,verify)
        verify.assert_not_called()



class PlaceholderControls(unittest.TestCase):
    def row(self):
        return {"name":"light-default","state":{"rootTag":81,"refIdentity":1,"dropped":0,"attaches":1,"detaches":0,"actions":0,"receipts":[]},"scale":3,"frame":[26,327.99995803833008,280,17],"screen":[0,0,390,844],"imageWidth":1170,"imageHeight":2532,"expectedRGBA":[112,112,112,255],"opaquePixels":5,"nativeLabel":"Choose an item","text":"Choose an item","targetCount":1}
    def test_placeholder_actual_pixel_geometry_name_ref_and_count_refusals(self):
        row=self.row();self.assertEqual(NATIVE.validate_placeholder_rows([row],["light-default"])["observations"],1)
        for key,value in [("frame",[26,850,280,17]),("scale",float("nan")),("opaquePixels",4),("expectedRGBA",[112,112,113,255]),("nativeLabel","wrong")]:
            bad=copy.deepcopy(row);bad[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):NATIVE.validate_placeholder_rows([bad],["light-default"])
        for key,value in [("rootTag",0),("refIdentity",0),("dropped",1)]:
            bad=copy.deepcopy(row);bad["state"][key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):NATIVE.validate_placeholder_rows([bad],["light-default"])
        with self.assertRaises(ValueError):NATIVE.validate_placeholder_rows([row,row],["light-default"])
    def test_placeholder_scope_exact_methods_actual_entry_and_launch_reset_order(self):
        NATIVE.validate_standard_scope({"cell":"CAT.placeholder-text.G08","nativeStandard":{"batch":"placeholder-g08"}})
        self.assertEqual(len(NATIVE.selection("ios","placeholder-g08")["ios"]),3)
        for cell in ["CAT.combo-box.G08","CAT.placeholder-text.G07","CAT.slider.G01"]:
            with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":cell,"nativeStandard":{"batch":"placeholder-g08"}})
        with self.assertRaises(ValueError):NATIVE.selection("android","placeholder-g08")
        source=(ROOT/"MeterG02TrialTests.swift").read_text().split("final class PlaceholderTrialTests:",1)[1]
        setup=source.split("private func node",1)[0];self.assertLess(setup.index("app.launch()"),setup.index("XCTAssertEqual(app.state"));self.assertLess(setup.index('tap("Reset scene")'),setup.index('tap("Text/Button scene")'))
        reset=source.split('try tap("Live window")')[-1];self.assertLess(reset.index('tap("Reset scene")'),reset.index('tap("Text/Button scene")'));self.assertLess(reset.index('tap("Text/Button scene")'),reset.index('tap("G02 prepare placeholder")'))
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);plan=root/"plan.json";plan.write_text(json.dumps({"cell":"CAT.placeholder-text.G08","nativeStandard":{"platform":"ios","batch":"placeholder-g08","output":str(root/"never-created")}}));env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"};result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(plan)],env=env,capture_output=True,text=True,timeout=10);self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((root/"never-created").exists())


    def test_android_g07_exact_scope_adapter_and_original_packet(self):
        NATIVE.validate_standard_scope({"cell":"CAT.placeholder-text.G07","nativeStandard":{"batch":"placeholder-g07"}})
        self.assertEqual(NATIVE.selection("android","placeholder-g07"), {"ios":[],"android":["light-style","dark-and-reset","narrow-pane"]})
        with self.assertRaises(ValueError):NATIVE.selection("ios","placeholder-g07")
        for cell in ["CAT.tag.G02","CAT.placeholder-text.G04","CAT.placeholder-text.G08"]:
            with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":cell,"nativeStandard":{"batch":"placeholder-g07"}})
        from test_placeholder_g04 import Controls
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);session=NATIVE.Session(root/"run",60,30)
            def command(name,argv,*args,**kwargs):
                if name.startswith("package-"):return "package:/installed/base.apk\n"
                if name=="pull-results":
                    directory=session.output/"native";directory.mkdir()
                    (directory/"receipt.json").write_text(json.dumps(Controls().packet(directory)))
                return ""
            session.run=MagicMock(side_effect=command)
            config={"platform":"android","batch":"placeholder-g07","sdk":"/sdk","destination":"emulator-5568"}
            with patch.object(NATIVE,"start_android",return_value=["/sdk/platform-tools/adb","-s","emulator-5568"]),patch.object(NATIVE,"verify_product",return_value=root/"app.apk"):
                result=NATIVE.run_android(session,config,{}, {})
            self.assertEqual([row["method"] for row in result["methods"]],["light-style","dark-and-reset","narrow-pane"])
            invocation=next(call.args[1] for call in session.run.call_args_list if call.args[0]=="instrumentation")
            self.assertIn("placeholder-g04-batch",invocation)
            self.assertTrue(any(str(value).startswith("/sdcard/Android/data/dev.codonui.lab.number/files/placeholder-g04-native-") for value in invocation))
            self.assertNotIn("motion-setting-before",[call.args[0] for call in session.run.call_args_list])
            self.assertTrue((session.output/"placeholder-review.json").exists())


    def test_android_prelaunch_refuses_open_denied_and_unknown_ports_before_spawn(self):
        for result in [0,NATIVE.errno.EACCES,NATIVE.errno.EPERM,NATIVE.errno.ETIMEDOUT,NATIVE.errno.EIO,None,True]:
            with self.subTest(result=result),tempfile.TemporaryDirectory() as temp:
                root=Path(temp);(root/"owned.ini").write_text("path=existing-control\n")
                session=NATIVE.Session(root/"run",60,30);session.run=MagicMock(return_value="List of devices attached\n\n")
                probe=MagicMock();probe.__enter__.return_value.connect_ex.return_value=result
                with patch.object(NATIVE.socket,"socket",return_value=probe),patch.object(NATIVE.subprocess,"Popen",side_effect=AssertionError("Uncertain port must not spawn")) as spawn:
                    with self.assertRaises(ValueError):NATIVE.start_android(session,{"sdk":"/sdk","destination":"emulator-5568","avdHome":str(root),"avd":"owned","androidUserHome":str(root),"gpu":"host"})
                spawn.assert_not_called();self.assertFalse(session.guest_owned)


    def test_android_observer_preserves_capture_stops_anr_and_resets_before_selection(self):
        source=(ROOT/"android-native-inspector/Actions.java").read_text()
        observe=member(source,"  private JSONObject phtObserve(")
        self.assertLess(observe.index("savePng("),observe.index('"Actual visible portrait crop required"'))
        self.assertLess(observe.index('lpCase.getJSONArray("observations").put(row)'),observe.index('"Expected opaque glyph paint absent"'))
        self.assertLess(observe.index("tgPersist()"),observe.index('"Expected opaque glyph paint absent"'))
        anr=member(source,"  private boolean tgStartupAnr(")
        self.assertLess(anr.index('if(placeholderGuardActive)throw'),anr.index('physicalSwipe('))
        prepare=member(source,"  private JSONObject phtPrepare(")
        self.assertLess(prepare.index('lpClick(automation,"Reset scene")'),prepare.index('lpClick(automation,"Text/Button scene")'))
        narrow=member(source,"  private void phtNarrow(")
        self.assertIn("JSONObject reset=phtPrepare(automation)",narrow)
        self.assertNotIn('lpClick(automation,"Reset scene")',narrow)




class SliderControls(unittest.TestCase):
    def test_slider_scope_setup_and_actual_entry_refuse_unadmitted_sdk(self):
        NATIVE.validate_standard_scope({"cell":"CAT.slider.G01","nativeStandard":{"batch":"slider-hit-layout"}})
        self.assertEqual(len(NATIVE.selection("ios","slider-hit-layout")["ios"]),4)
        with self.assertRaises(ValueError):NATIVE.selection("android","slider-hit-layout")
        for cell in ["CAT.slider.G07","CAT.combo-box.G08","CAT.radio.G08"]:
            with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":cell,"nativeStandard":{"batch":"slider-hit-layout"}})
        source=(ROOT/"MeterG02TrialTests.swift").read_text().split("final class SliderHitLayoutTrialTests:",1)[1];setup=source.split("override func tearDownWithError",1)[0]
        self.assertLess(setup.index("app.launch()"),setup.index("XCTAssertEqual(app.state"));self.assertLess(setup.index("orientation = .portrait"),setup.index("XCTAssertEqual(XCUIDevice.shared.orientation"));self.assertLess(setup.index('tap("Reset scene")'),setup.index('tap("Slider scene")'));self.assertIn("private let holdSeconds: TimeInterval = 5",source)
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);plan=root/"plan.json";plan.write_text(json.dumps({"cell":"CAT.slider.G01","nativeStandard":{"platform":"ios","batch":"slider-hit-layout","output":str(root/"never-created")}}));env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"};result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(plan)],env=env,capture_output=True,text=True,timeout=10);self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((root/"never-created").exists())

    def test_live_observation_keeps_normal_output_and_cleans_the_parent_on_capture_failure(self):
        with tempfile.TemporaryDirectory() as temp:
            session=NATIVE.Session(Path(temp)/"normal",20,2);ticks=[]
            self.assertEqual(session.run("observed",[sys.executable,"-u","-c","import time;print('real child',flush=True);time.sleep(.15)"],while_running=lambda:ticks.append(True)).strip(),"real child")
            self.assertTrue(ticks);self.assertTrue(session.rows[-1]["ownedGroupGone"])
            session=NATIVE.Session(Path(temp)/"failed",20,2)
            def fail():raise RuntimeError("saved independent capture failure")
            with self.assertRaisesRegex(RuntimeError,"independent capture failure"):session.run("failed",[sys.executable,"-c","import time;time.sleep(5)"],while_running=fail)
            self.assertTrue(session.rows[-1]["ownedGroupGone"]);self.assertIsNotNone(session.rows[-1]["exitCode"])

    def test_independent_capture_arms_only_during_the_live_xctest_gesture(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);calls=[]
            class CaptureSession:
                output=root
                def run(self,name,argv):
                    calls.append(argv);Path(argv[-1]).write_bytes(b"CONTROL_NOT_A_NATIVE_IMAGE")
            callback=NATIVE.slider_hold_capture(CaptureSession(),"2244051E-D143-40F5-BEF1-7B4CCFC355A1")
            raw=root/"xctest.stdout";raw.write_text("Test Case started\n");callback();self.assertFalse(calls)
            begin="CODON_SLIDER_GESTURE_BEGIN "+json.dumps({"epochSeconds":time.time()})+"\n";raw.write_text(begin);callback();self.assertEqual(len(calls),1);self.assertEqual(calls[0][1:4],["io","2244051E-D143-40F5-BEF1-7B4CCFC355A1","screenshot"]);self.assertEqual(len(json.loads((root/"slider-held-captures.json").read_text())),1)
            raw.write_text(begin+"CODON_SLIDER_GESTURE_RETURN {}\n");callback();self.assertEqual(len(calls),1)
            raw.write_text(begin+"Test Case '-[C.SliderHitLayoutTrialTests testP01Probe]' failed (1.0 seconds).\n");callback();self.assertEqual(len(calls),1)

    def test_four_native_classifiers_need_original_contacts_exact_requests_and_pre_move_images(self):
        with tempfile.TemporaryDirectory() as temp:
            output=Path(temp);begins=[];finals=[];captures=[]
            for index,(preset,probe) in enumerate([("translated",None),("repositioned",None),("rotated-scaled","measured-center"),("rotated-scaled","aabb-corner")]):
                thumb=probe!="aabb-corner";value=.7 if thumb else .85;events=[]
                def event(kind,**fields):events.append({"kind":kind,"rootTag":101,"preset":preset,"sequence":len(events)+1,**fields})
                event("touch",phase="start",target=103 if thumb else 102,identifier=7,pageX=220,timestamp=10000)
                if not thumb:event("request",value=.65)
                event("request",value=value);event("touch",phase="move",target=103 if thumb else 102,identifier=7,pageX=271.2,timestamp=15100);event("change-end",value=value);event("touch",phase="end",target=103 if thumb else 102,identifier=7,pageX=271.2,timestamp=15130)
                begins.append({"epochSeconds":1700000000+index*20,"holdSeconds":5,"before":{"preset":preset,"scalar":.5,"requests":0,"ends":0},"geometry":{"tags":[101,102,103,104],"rootWindow":{"x":26},"viewport":{"root":{"x":26}},"window":{"track":{"x":26,"width":300}}}})
                final={"owner":{"preset":preset,"rootTag":101,"dropped":0,"requests":1 if thumb else 2,"ends":1,"scalar":value},"events":events}
                if probe:final["probe"]=probe
                finals.append(final);png=output/(str(index)+".png");png.write_bytes(b"CONTROL_NOT_A_NATIVE_IMAGE");captures.append({"gesture":index,"startedEpochSeconds":begins[-1]["epochSeconds"]+1,"finishedEpochSeconds":begins[-1]["epochSeconds"]+2,"png":str(png),"pngSHA256":NATIVE.digest(png)})
            def run(bs=begins,fs=finals,cs=captures):
                (output/"slider-held-captures.json").write_text(json.dumps(cs));raw="\n".join("CODON_SLIDER_GESTURE_BEGIN "+json.dumps(b)+"\nCODON_SLIDER_FINAL_OUTCOME "+json.dumps(f) for b,f in zip(bs,fs));return NATIVE.reconcile_slider_ios(raw,output)
            result=run();self.assertEqual(result["status"],"NATIVE_PASS_PENDING_INDEPENDENT_HELD_SCREEN_REVIEW");self.assertEqual(result["cases"][-1]["nativeReceiver"],"original-track");self.assertEqual(result["cases"][-1]["expectedHeldScalar"],.65)
            for kind in ["wrong-root","wrong-contact","wrong-end","old-corner-classifier","dropped","late-capture","missing-capture","missing-case"]:
                bs,fs,cs=copy.deepcopy(begins),copy.deepcopy(finals),copy.deepcopy(captures)
                if kind=="wrong-root":fs[0]["owner"]["rootTag"]=999
                elif kind=="wrong-contact":fs[0]["events"][-1]["identifier"]=8
                elif kind=="wrong-end":fs[0]["events"][-2]["value"]=.6
                elif kind=="old-corner-classifier":fs[-1]["events"][1]["value"]=.5
                elif kind=="dropped":fs[0]["owner"]["dropped"]=1
                elif kind=="late-capture":cs[0]["finishedEpochSeconds"]=bs[0]["epochSeconds"]+6
                elif kind=="missing-capture":cs=cs[1:]
                else:bs=bs[:-1];fs=fs[:-1]
                with self.subTest(kind=kind),self.assertRaises(ValueError):run(bs,fs,cs)


class SwitchControls(unittest.TestCase):
    def row(self):
        row=ListItemControls().row();row["state"].update(label="Keep settings",rootWidth=200);row.update(nativeLabel="Keep settings",nativeValue="0",nativeSwitch=True,matchedReferenceParent=row["parent"][:]);return row

    def test_switch_actual_fractional_geometry_semantics_and_reference_failures(self):
        row=self.row();self.assertEqual(NATIVE.validate_switch_rows([row],["baseline"])["observations"],1)
        fractional=copy.deepcopy(row);fractional["root"][3]=43.9998779296875;fractional["referenceRoot"][3]=43.9998779296875;NATIVE.validate_switch_rows([fractional],["baseline"])
        for field,value in [("nativeValue","checked"),("nativeValue","1"),("nativeValue",True),("nativeSwitch",False),("nativeLabel","wrong"),("nativeEnabled",False),("targetCount",2),("referenceExact",False),("root",[33,112,200,44]),("scale",float("nan")),("matchedReferenceParent",[20.34,100,280,224]),("parent",[891/3,100,280,224])]:
            bad=copy.deepcopy(row);bad[field]=value
            with self.subTest(field=field),self.assertRaises(ValueError):NATIVE.validate_switch_rows([bad],["baseline"])
        bad=copy.deepcopy(row);bad["state"]["layouts"][0]["currentTarget"]=82
        with self.assertRaises(ValueError):NATIVE.validate_switch_rows([bad],["baseline"])
        with self.assertRaises(ValueError):NATIVE.validate_switch_rows([row,row],["baseline"])
        held=copy.deepcopy(row);held["heldContactIntervals"]=[{"beganEpochMs":1000,"endedEpochMs":2000,"disabledOnPressInEpochMs":1100}];NATIVE.validate_switch_rows([held],["baseline"]);held["heldContactIntervals"][0]["disabledOnPressInEpochMs"]=1800
        with self.assertRaises(ValueError):NATIVE.validate_switch_rows([held],["baseline"])
        with self.assertRaises(ValueError):NATIVE.reconcile_switch_ios("")

    def motion(self,reduced=False):
        names=["select","interrupt","retarget"]+["retarget-"+str(i) for i in range(3,32)]+["settle","retire","fresh"]
        times=[3000+125*i for i in range(32)]+[7000,8250,10250]
        samples=[]
        for start in [3100,3900,7300,8500,10600]:
            absent=start==8500
            samples.append({"captureStartedEpochMs":start,"captureEpochMs":start+50,"scale":3,"parent":[20,100,280,224],"referenceParent":[20,332,280,224],"sampleFrame":[32,122,30,1/3],"referenceSampleFrame":[32,354,30,1/3],"imageWidth":1170,"imageHeight":2532,"thumbRun":[] if absent else [0,45] if reduced else [20,43],"referenceThumbRun":[0,45],"sampleRGBA":[] if absent else [17,119,51,255] if reduced else [90,90,42,255],"referenceSampleRGBA":[17,119,51,255],"inkPixels":0 if absent else 200,"referenceInkPixels":0 if absent else 200,"referenceExact":reduced or start>=7300})
        return {"name":"reduced" if reduced else "normal","reduced":reduced,"movingRows":3,"originalRootTag":81,"state":{"rootTag":90,"visible":True,"layouts":[{"currentTarget":90}],"motionEvents":[reduced],"motionTrace":[{"name":name,"epochMs":at} for name,at in zip(names,times)]},"samples":samples}

    def test_switch_motion_requires_both_real_clocks_endpoints_retirement_and_preference(self):
        for reduced in [False,True]:self.assertEqual(NATIVE.validate_switch_motion(self.motion(reduced)),5)
        for kind in ["no-color","no-thumb","wrong-pref","retired-ink","retired-work","fresh-inexact","settled-inexact","reduced-interpolation","stale-ref","outside-pixel","missing-capture","missing-trace","reverse-interval"]:
            bad=self.motion(kind=="reduced-interpolation")
            if kind=="no-color":
                for r in bad["samples"][:3]:r["sampleRGBA"]=[17,119,51,255]
            elif kind=="no-thumb":
                for r in bad["samples"][:3]:r["thumbRun"]=[0,45]
            elif kind=="wrong-pref":bad["state"]["motionEvents"]=[True]
            elif kind=="retired-ink":bad["samples"][3]["inkPixels"]=1
            elif kind=="retired-work":bad["samples"][3]["thumbRun"]=[0,45]
            elif kind=="fresh-inexact":bad["samples"][-1]["referenceExact"]=False
            elif kind=="settled-inexact":bad["samples"][2]["referenceExact"]=False
            elif kind=="reduced-interpolation":bad["samples"][0]["referenceExact"]=False
            elif kind=="stale-ref":bad["state"]["rootTag"]=81
            elif kind=="outside-pixel":bad["samples"][0]["parent"][0]=1101/3
            elif kind=="missing-capture":bad["samples"]=bad["samples"][:-1]
            elif kind=="missing-trace":bad["state"]["motionTrace"].pop()
            else:bad["samples"][0]["captureEpochMs"]=3000
            with self.subTest(kind=kind),self.assertRaises(ValueError):NATIVE.validate_switch_motion(bad)

    def test_switch_retirement_waits_for_native_removal_and_rejects_ghosts(self):
        live={"captureStartedEpochMs":10014,"captureEpochMs":10508,"inkPixels":2201,"referenceInkPixels":2201,"thumbRun":[46,43],"sampleRGBA":[17,119,51,255]}
        gone={"captureStartedEpochMs":10633,"captureEpochMs":11075,"inkPixels":0,"referenceInkPixels":0,"thumbRun":[],"sampleRGBA":[]}
        self.assertEqual(NATIVE.validate_switch_retirement([live,gone],10000,13000),{"pendingNativeCommitFrames":1,"verifiedAbsentFrames":1})
        for kind in ["live-only","ghost","reference-reappears","residual-gray","false-thumb","false-color","missing-native-witness"]:
            bad=[copy.deepcopy(live),copy.deepcopy(gone)]
            if kind=="live-only":bad=bad[:1]
            elif kind=="ghost":bad[-1]["inkPixels"]=2201
            elif kind=="reference-reappears":bad.append(dict(gone,captureStartedEpochMs=11200,captureEpochMs=11700,referenceInkPixels=2201))
            elif kind=="residual-gray":bad[-1]["inkPixels"]=1
            elif kind=="false-thumb":bad[-1]["thumbRun"]=[1,43]
            elif kind=="false-color":bad[-1]["sampleRGBA"]=[17,119,51,255]
            else:bad[-1].pop("referenceInkPixels")
            with self.subTest(kind=kind),self.assertRaises(ValueError):NATIVE.validate_switch_retirement(bad,10000,13000)

    def test_source_check_reuses_overall_owner_and_propagates_exit_timeout_cleanup(self):
        from NativeCellVerification import execute_source_check
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            for name,code,expected in [("normal","print('source-ok')",0),("failed","raise SystemExit(7)",7),("timeout","import time; time.sleep(30)",1)]:
                output=root/name
                result=execute_source_check([sys.executable,"-c",code],output,12,3)
                self.assertEqual(result,expected)
                report=json.loads((output/"terminal.json").read_text());self.assertTrue(report["cleanupVerified"]);self.assertLess(report["elapsedSeconds"],12)
                self.assertEqual(report["commands"][0]["explicitCapSeconds"],None)
                self.assertGreater(int(report["argv"][-1]),0);self.assertLessEqual(int(report["argv"][-1]),1000)
                self.assertEqual(report["status"]=="PASS",expected==0)
                if name=="timeout":self.assertTrue(report["commands"][0]["timedOut"])

    def test_source_selection_uses_only_literal_titles_and_rejects_stopped_cells(self):
        from NativeCellVerification import source_test_selection
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)/"__tests__";root.mkdir();file=root/"Shared.test.tsx";file.write_text("CONTROL")
            plan={"files":[{"path":str(file),"sha256":NATIVE.digest(file)}],"workspace":"@codon-ui/native-showcase","titles":["Switch (a|b) checks","basic controls"],"stoppedTitleFragments":["ComboBox"]}
            argv=source_test_selection(plan);pattern=argv[argv.index("--testNamePattern")+1]
            self.assertIsNotNone(re.fullmatch(pattern,"Switch (a|b) checks"));self.assertIsNone(re.search(pattern,"opens ComboBox and basic controls"));self.assertIsNone(re.search(pattern,"prefix basic controls"))
            for titles in [[],["opens the public ComboBox scene"],["basic controls","basic controls"]]:
                with self.subTest(titles=titles),self.assertRaises(ValueError):source_test_selection(dict(plan,titles=titles))
            with self.assertRaises(ValueError):source_test_selection(dict(plan,titles=["opens ComboBox"],stoppedTitleFragments=["other stopped cell"]))
            refused=root/"refused.json";refused.write_text(json.dumps(dict(plan,titles=["opens ComboBox"])));receipt=root/"rejected.json"
            result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeCellVerification.py"),"--source-selection",str(refused),"--receipt",str(receipt),"--run"],capture_output=True,text=True,timeout=10)
            self.assertEqual(result.returncode,2);self.assertEqual(json.loads(receipt.read_text())["status"],"REJECTED");self.assertNotIn("jest --config",result.stdout)
            file.write_text("CHANGED")
            with self.assertRaises(ValueError):source_test_selection(plan)

    def test_source_selection_wrapper_identity_collisions(self):
        from NativeCellVerification import source_test_selection
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            compact=["preserves custom-query commit policy with allowsCustomValue=false on the original editor","preserves custom-query commit policy with allowsCustomValue=true on the original editor","opens on original focus only when the compact menuTrigger is manual","opens on original focus only when the compact menuTrigger is focus"]
            cases=[("src/components/CompactTypeaheadSearch/__tests__/composition.test.tsx",compact),("src/components/TagComboBox/__tests__/TagComboBox.test.tsx",["CAP.tag-combobox.001 forwards actual root/editor refs and composes the two native controls","CAP.tag-combobox.015 merges nested ComboBox labels"]),("src/components/TagGroup/__tests__/TagGroup.test.tsx",["removes the current tag without selecting another group item"]),("apps/native-showcase/src/scenes/__tests__/TagComboBoxScene.test.tsx",["keeps popup requests subject to owner veto and opens only after an owner echo"])]
            for path,titles in cases:
                file=root/path;file.parent.mkdir(parents=True,exist_ok=True);file.write_text("CONTROL")
                plan={"files":[{"path":str(file),"sha256":NATIVE.digest(file)}],"workspace":"@codon-ui/react-native","titles":titles,"stoppedTitleFragments":["Menu","ComboBox","combo-box","Slider","standalone Tag"]}
                with self.subTest(path=path):
                    argv=source_test_selection(plan);pattern=argv[argv.index("--testNamePattern")+1]
                    for title in titles:self.assertIsNotNone(re.fullmatch(pattern,title))
                    self.assertIsNone(re.fullmatch(pattern,"prefix "+titles[0]))

    def test_source_selection_stopped_identity_paths_titles_and_actual_run_refusal(self):
        from NativeCellVerification import source_test_selection
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            paths=[f"src/components/{owner}/__tests__/innocent.test.tsx" for owner in ["Menu","mEnU","ComboBox","comboBox","Slider","slider","Tag","tAg"]]
            paths += [f"apps/native-showcase/src/scenes/__tests__/{name}.test.tsx" for name in ["MenuScene","ComboBoxScene","ComboBoxFixtureComposition","SliderScene","SliderLayoutWitness","TagScene","tagscene"]]
            paths += [f"fixtures/native-{name}/__tests__/shared.test.tsx" for name in ["menu","combo-box","slider","tag"]]
            for path in paths:
                file=root/path;file.parent.mkdir(parents=True,exist_ok=True);file.write_text("CONTROL")
                plan={"files":[{"path":str(file),"sha256":NATIVE.digest(file)}],"workspace":"@codon-ui/native-showcase","titles":["innocent exact title"],"stoppedTitleFragments":["other stopped phrase"]}
                with self.subTest(path=path),self.assertRaisesRegex(ValueError,"Source selection includes a stopped cell"):source_test_selection(plan)
            file=root/"__tests__/Shared.test.tsx";file.parent.mkdir();file.write_text("CONTROL");plan["files"]=[{"path":str(file),"sha256":NATIVE.digest(file)}]
            for title in ["opens the public ComboBox scene","opens MENU G08","CAT.menu.G08","cAt.MeNu.G08","CAP.combo-box.001 renders","CAT.slider.G08","CAT.tag.G08","CAP.tag.001 renders","opens standalone tAg","renders Tag","tag scene G08","OTHER STOPPED PHRASE remains stopped","CAP.tag-combobox.001 opens Menu","CAP.tag-group.001 opens standalone Tag","CAP.compact-typeahead.001 opens public ComboBox scene","CAP.unrelated.001 references ComboBox"]:
                with self.subTest(title=title),self.assertRaisesRegex(ValueError,"Source selection includes a stopped cell"):source_test_selection(dict(plan,titles=[title]))
            file=root/paths[0];plan.update(files=[{"path":str(file),"sha256":NATIVE.digest(file)}],titles=["innocent exact title"])
            payload=root/"selection.json";payload.write_text(json.dumps(plan));receipt=root/"receipt.json"
            sentinel=root/"jest-spawned";executable=root/"pnpm";executable.write_text("#!/bin/sh\ntouch '"+str(sentinel)+"'\nexit 0\n");executable.chmod(0o755)
            result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeCellVerification.py"),"--source-selection",str(payload),"--receipt",str(receipt),"--run"],env={**os.environ,"PATH":str(root)+os.pathsep+os.environ["PATH"]},capture_output=True,text=True,timeout=10)
            self.assertEqual(result.returncode,2);report=json.loads(receipt.read_text());self.assertEqual(report["status"],"REJECTED");self.assertEqual(report["error"],"Source selection includes a stopped cell");self.assertFalse(sentinel.exists());self.assertFalse(receipt.with_suffix(".run").exists())
            print(json.dumps({"stoppedSourceRunControl":report,"exitCode":result.returncode,"jestSpawned":sentinel.exists(),"runDirectoryCreated":receipt.with_suffix(".run").exists()}))

    def test_source_selection_retains_hash_type_workspace_cache_and_literal_checks(self):
        from NativeCellVerification import source_test_selection
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)/"__tests__";root.mkdir();file=root/"Shared.test.tsx";file.write_text("CONTROL")
            plan={"files":[{"path":str(file),"sha256":NATIVE.digest(file)}],"workspace":"@codon-ui/react-native","titles":["literal (a|b)"],"stoppedTitleFragments":["custom closed campaign"]}
            pattern=source_test_selection(plan);pattern=pattern[pattern.index("--testNamePattern")+1]
            self.assertIsNotNone(re.fullmatch(pattern,"literal (a|b)"));self.assertIsNone(re.fullmatch(pattern,"literal a"))
            for changed in [dict(plan,workspace="other"),dict(plan,files=plan["files"]*2),dict(plan,titles=[]),dict(plan,titles=["same","same"]),dict(plan,jsonResult=str(root/"outside.json"))]:
                with self.subTest(changed=changed),self.assertRaises(ValueError):source_test_selection(changed)
            wrong=root/"wrong.js";wrong.write_text("CONTROL")
            with self.assertRaises(ValueError):source_test_selection(dict(plan,files=[{"path":str(wrong),"sha256":NATIVE.digest(wrong)}]))
            cache=Path.cwd()/"node_modules/.cache";cache.mkdir(parents=True,exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=cache,suffix=".json") as existing:
                with self.assertRaises(ValueError):source_test_selection(dict(plan,jsonResult=existing.name))
            file.write_text("CHANGED")
            with self.assertRaises(ValueError):source_test_selection(plan)

    def test_switch_scope_compiled_selection_and_no_admission_entry(self):
        NATIVE.validate_standard_scope({"cell":"CAT.switch.G08","nativeStandard":{"batch":"switch"}})
        self.assertEqual(NATIVE.selection("ios","switch")["ios"],["SwitchTrialTests/testSwitchActionsAndLifetimes","SwitchTrialTests/testSwitchStylesAndConstraints","SwitchTrialTests/testSwitchMotionAndRetirement"])
        with self.assertRaises(ValueError):NATIVE.selection("android","switch")
        with self.assertRaises(ValueError):NATIVE.reconcile_switch_ios("",{"batch":"switch-motion","retainedSwitchStaticMethods":{"path":"/not/a/proof","sha256":"0"*64}})
        for cell in ["CAT.combo-box.G08","CAT.switch.G07","CAT.radio.G08"]:
            with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":cell,"nativeStandard":{"batch":"switch"}})
        controls=NATIVE.geometry_control_source();self.assertIn("switchNativeValueMatches",controls);self.assertIn("switchTrackSamples",controls);self.assertIn("switchThumbIntermediate",controls);self.assertIn('"switchThumbCases":11',controls);self.assertIn("switchEndpointCoverage",controls);self.assertIn('"switchEndpointCases":10',controls);self.assertIn("switchRetirementCoverage",controls);self.assertIn('"switchRetirementCases":14',controls)
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);plan=root/"plan.json";plan.write_text(json.dumps({"cell":"CAT.switch.G08","nativeStandard":{"platform":"ios","batch":"switch","output":str(root/"never-created")}}));env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
            result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(plan)],env=env,capture_output=True,text=True,timeout=10)
            self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((root/"never-created").exists())

class CheckboxControls(unittest.TestCase):
    def test_checkbox_native_mixed_semantics_and_real_reference_failures(self):
        row=SwitchControls().row();row["state"]["mixed"]=False;row.update(nativeCheckbox=True,nativeValue="checkbox, unchecked")
        NATIVE.validate_checkbox_rows([row],["baseline"])
        mixed=copy.deepcopy(row);mixed["state"]["mixed"]=True;mixed["nativeValue"]="checkbox, mixed";NATIVE.validate_checkbox_rows([mixed],["baseline"])
        for field,value in [("nativeValue","checkbox, checked"),("nativeValue","radio button, unchecked"),("nativeValue","checkbox, unchecked, busy"),("nativeCheckbox",False),("nativeLabel","wrong"),("targetCount",2),("referenceExact",False),("matchedReferenceParent",[20.34,100,280,224])]:
            bad=copy.deepcopy(row);bad[field]=value
            with self.subTest(field=field),self.assertRaises(ValueError):NATIVE.validate_checkbox_rows([bad],["baseline"])
        with self.assertRaises(ValueError):NATIVE.validate_checkbox_rows([row,row],["baseline"])
        with self.assertRaises(ValueError):NATIVE.reconcile_checkbox_ios("")

    def interval(self,reduced=False):
        trace=[{"name":name,"epochMs":3000+i*125} for i,name in enumerate(["select","interrupt","retarget"]+["retarget-"+str(i) for i in range(3,32)])]+[{"name":"settle","epochMs":7000},{"name":"retire","epochMs":10000},{"name":"fresh","epochMs":13000}]
        state={"motionEvents":[reduced],"motionTrace":trace,"rootTag":42,"visible":True,"layouts":[{"currentTarget":42}]};samples=[]
        for start,end,ink,ref,glyph,full,exact,color,raw in [(1000,1100,2201,2201,0,0,True,[238,240,242,255],[238,240,242,255]),(3100,3200,2201,2201,12,24,False,[102,136,153,255],[17,119,51,255]),(3400,3500,2201,2201,8,0,False,[102,136,153,255],[238,240,242,255]),(7400,7800,2201,2201,24,24,True,[17,119,51,255],[17,119,51,255]),(10014,10508,2201,2201,24,24,True,[17,119,51,255],[17,119,51,255]),(10633,11075,0,0,0,0,True,[],[]),(13400,13800,2201,2201,24,24,True,[17,119,51,255],[17,119,51,255])]:
            samples.append({"captureStartedEpochMs":start,"captureEpochMs":end,"parent":[20,100,280,224],"referenceParent":[20,332,280,224],"sampleFrame":[35,115,1/3,1/3],"referenceSampleFrame":[35,347,1/3,1/3],"glyphFrame":[34,114,16,16],"referenceGlyphFrame":[34,346,16,16],"referenceExact":True if reduced else exact,"inkPixels":ink,"referenceInkPixels":ref,"glyphPixels":glyph,"referenceGlyphPixels":full,"sampleRGBA":color,"referenceSampleRGBA":raw,"scale":3,"imageWidth":1170,"imageHeight":2532})
        return {"name":"reduced" if reduced else "normal","reduced":reduced,"state":state,"originalRootTag":41,"movingRows":3,"samples":samples}

    def test_checkbox_two_actual_clocks_both_endpoints_native_removal_and_preference(self):
        for reduced in [False,True]:self.assertEqual(NATIVE.validate_checkbox_motion(self.interval(reduced)),7)
        for kind in ["no-shape-motion","no-glyph-motion","missing-settled","missing-fresh","ghost","reference-repaint","wrong-preference","unchanged-ref","out-of-bounds","false-reduced"]:
            value=copy.deepcopy(self.interval(kind=="false-reduced"))
            if kind=="no-shape-motion":
                for row in value["samples"]:row["sampleRGBA"]=row["referenceSampleRGBA"]
            elif kind=="no-glyph-motion":
                for row in value["samples"]:row["glyphPixels"]=row["referenceGlyphPixels"]
            elif kind=="missing-settled":value["samples"].pop(3);value["movingRows"]-=1
            elif kind=="missing-fresh":value["samples"].pop()
            elif kind=="ghost":value["samples"][5]["inkPixels"]=1
            elif kind=="reference-repaint":value["samples"][5]["referenceInkPixels"]=1
            elif kind=="wrong-preference":value["state"]["motionEvents"]=[True]
            elif kind=="unchanged-ref":value["state"]["rootTag"]=41
            elif kind=="out-of-bounds":value["samples"][0]["glyphFrame"]=[390,114,16,16]
            else:value["samples"][1]["referenceExact"]=False
            with self.subTest(kind=kind),self.assertRaises(ValueError):NATIVE.validate_checkbox_motion(value)

    def test_checkbox_white_background_cannot_supply_glyph_interpolation(self):
        value=self.interval();value["samples"][0]["referenceSampleRGBA"]=[255]*4;value["samples"][0]["referenceGlyphPixels"]=2196
        for row in value["samples"]:
            if row["referenceSampleRGBA"]==[238,240,242,255]:row["referenceSampleRGBA"]=[255]*4;row["referenceGlyphPixels"]=2196
        for row in value["samples"]:row["glyphPixels"]=24 if row["inkPixels"] else 0
        with self.assertRaisesRegex(ValueError,"glyph interpolation"):NATIVE.validate_checkbox_motion(value)
        value=self.interval();value["samples"][1]["referenceGlyphPixels"]=25
        with self.assertRaisesRegex(ValueError,"missing/inconsistent"):NATIVE.validate_checkbox_motion(value)

    def test_checkbox_scope_and_actual_compiled_predicates(self):
        NATIVE.validate_standard_scope({"cell":"CAT.checkbox.G08","nativeStandard":{"batch":"checkbox"}})
        self.assertEqual(len(NATIVE.selection("ios","checkbox")["ios"]),3)
        for cell in ["CAT.combo-box.G08","CAT.checkbox.G07","CAT.switch.G08"]:
            with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":cell,"nativeStandard":{"batch":"checkbox"}})
        with self.assertRaises(ValueError):NATIVE.selection("android","checkbox")
        self.assertEqual(len(NATIVE.selection("ios","checkbox-static")["ios"]),2)
        self.assertEqual(NATIVE.selection("ios","checkbox-motion")["ios"],["CheckboxTrialTests/testCheckboxMotionAndRetirement"])
        for batch in ["checkbox-static","checkbox-motion"]:NATIVE.validate_standard_scope({"cell":"CAT.checkbox.G08","nativeStandard":{"batch":batch}})
        controls=NATIVE.geometry_control_source()
        for name in ["checkboxNativeValueMatches","checkboxColorIntermediate","checkboxGlyphIntermediate","checkboxEndpointCoverage","checkboxRetirementCoverage"]:self.assertIn(name,controls)
        self.assertIn('"checkboxCases":47',controls)

class SwitcherControls(unittest.TestCase):
    def row(self):
        return {"name":"baseline","state":{"scale":3,"visible":True,"zero":False,"rootTag":81,"layouts":[{"target":81,"currentTarget":81,"layout":{"width":240,"height":50}}],"items":[{"id":"a","label":"First choice","disabled":False}],"selected":"a","disabled":False,"rootWidth":240},"scale":3,"parent":[20,100,280,224],"referenceParent":[20,332,280,224],"matchedReferenceParent":[20,100,280,224],"imageWidth":1170,"imageHeight":2532,"referenceExact":True,"root":[32,112,240,50],"referenceRoot":[32,344,240,50],"rootCount":1,"rootIsButton":False,"members":[{"key":"a","label":"First choice","button":True,"enabled":True,"value":"checked","frame":[35,115,234,44],"referenceFrame":[35,347,234,44]}],"targetCount":1,"heldContactIntervals":[],"inkPixels":500}

    def test_actual_switcher_reader_native_metadata_geometry_and_risks(self):
        row=self.row();self.assertEqual(NATIVE.validate_switcher_rows([row],["baseline"])["status"],"PASS")
        positive=copy.deepcopy(row);positive["root"][2]+=0.0001220703125;NATIVE.validate_switcher_rows([positive],["baseline"])
        for kind in ["missing","duplicate","paint","outside","physical-pixel","wrong-label","wrong-value","busy","wrong-guard","wrong-ref","root-button","missing-member","width","bad-held"]:
            bad=copy.deepcopy(row);rows=[bad]
            if kind=="missing":rows=[]
            elif kind=="duplicate":rows.append(copy.deepcopy(bad))
            elif kind=="paint":bad["referenceExact"]=False
            elif kind=="outside":bad["parent"][1]=900
            elif kind=="physical-pixel":bad["matchedReferenceParent"][0]+=1/3
            elif kind=="wrong-label":bad["members"][0]["label"]="Wrong"
            elif kind=="wrong-value":bad["members"][0]["value"]="unchecked"
            elif kind=="busy":bad["members"][0]["value"]="checked, busy"
            elif kind=="wrong-guard":bad["members"][0]["enabled"]=False
            elif kind=="wrong-ref":bad["state"]["layouts"][0]["currentTarget"]=82
            elif kind=="root-button":bad["rootIsButton"]=True
            elif kind=="missing-member":bad["members"]=[]
            elif kind=="width":bad["root"][2]+=1
            elif kind=="bad-held":bad["heldContactIntervals"]=[{"beganEpochMs":0,"disabledOnPressInEpochMs":700,"endedEpochMs":1000}]
            with self.subTest(kind=kind),self.assertRaises(ValueError):NATIVE.validate_switcher_rows(rows,["baseline"])
        gone=copy.deepcopy(row);gone["state"].update(visible=False,rootTag=None);gone.update(root=[],inkPixels=0,members=[],targetCount=0,selectedSurfaceFrames=[]);NATIVE.validate_switcher_rows([gone],["baseline"])
        for field,value in [("targetCount",1),("members",[self.row()["members"][0]]),("selectedSurfaceFrames",[[32,112,44,44]])]:
            ghost=copy.deepcopy(gone);ghost[field]=value
            with self.subTest(retiredField=field),self.assertRaises(ValueError):NATIVE.validate_switcher_rows([ghost],["baseline"])
        gone["inkPixels"]=1
        with self.assertRaises(ValueError):NATIVE.validate_switcher_rows([gone],["baseline"])
        zero=copy.deepcopy(row);zero["state"].update(zero=True,padding=2,border=1);zero["state"]["layouts"][0]["layout"]={"width":6,"height":6};zero["root"][2:]=[6,6];zero["referenceRoot"][2:]=[6,6];NATIVE.validate_switcher_rows([zero],["baseline"])
        zero["root"][2]=0
        with self.assertRaises(ValueError):NATIVE.validate_switcher_rows([zero],["baseline"])

    def test_switcher_selection_scope_and_actual_no_admission_boundary(self):
        self.assertEqual(NATIVE.selection("ios","switcher")["ios"],["SwitcherTrialTests/testSwitcherActionsAndLifetimes","SwitcherTrialTests/testSwitcherStylesAndConstraints"])
        self.assertEqual(NATIVE.selection("ios","switcher-actions")["ios"],["SwitcherTrialTests/testSwitcherActionsAndLifetimes"])
        self.assertEqual(NATIVE.selection("ios","switcher-styles")["ios"],["SwitcherTrialTests/testSwitcherStylesAndConstraints"])
        NATIVE.validate_standard_scope({"cell":"CAT.toggle-switcher.G08","nativeStandard":{"batch":"switcher-styles"}})
        with self.assertRaises(ValueError):NATIVE.reconcile_switcher_ios("",{"batch":"switcher-styles"})
        with self.assertRaises(ValueError):NATIVE.reconcile_switcher_ios("",{"batch":"switcher-actions"})
        self.assertEqual(NATIVE.selection("ios","switcher-motion")["ios"],["SwitcherTrialTests/testSwitcherMotionAndRetirement"])
        NATIVE.validate_standard_scope({"cell":"CAT.toggle-switcher.G08","nativeStandard":{"batch":"switcher"}})
        NATIVE.validate_standard_scope({"cell":"CAT.toggle-switcher.G08","nativeStandard":{"batch":"switcher-actions"}})
        for cell in ["CAT.combo-box.G08","CAT.toggle-switcher.G07","CAT.toggle-button.G08"]:
            with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":cell,"nativeStandard":{"batch":"switcher"}})
        with self.assertRaises(ValueError):NATIVE.selection("android","switcher")
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);p=root/"plan.json";p.write_text(json.dumps({"cell":"CAT.toggle-switcher.G08","nativeStandard":{"platform":"ios","batch":"switcher","output":str(root/"never-created")}}));env={k:v for k,v in os.environ.items() if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
            result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(p)],env=env,capture_output=True,text=True,timeout=10)
            self.assertNotEqual(result.returncode,0);self.assertIn("Use NativeCellVerification.py",result.stderr);self.assertFalse((root/"never-created").exists())
        with self.assertRaises(KeyError):NATIVE.reconcile_switcher_ios("",{"batch":"switcher-motion"})
        source=NATIVE.geometry_control_source();self.assertIn('"switcherCases":29',source)
        for name in ["switcherReferenceIndex","switcherRootIntermediate","switcherPhraseCounts","switcherSurfaceIntermediate"]:self.assertIn("func "+name,source)


    def test_switcher_uses_existing_early_identity_and_its_own_reader(self):
        import ast
        import inspect
        source=ast.parse(inspect.getsource(NATIVE.run_ios))
        dispatch=next(node for node in source.body[0].body if isinstance(node,ast.If) and isinstance(node.body[0],ast.Assign) and isinstance(node.body[0].targets[0],ast.Subscript) and isinstance(node.body[0].targets[0].slice,ast.Constant) and node.body[0].targets[0].slice.value in ["settingsDiagnostic","tooltip"])
        code=compile(ast.fix_missing_locations(ast.Module(body=[dispatch],type_ignores=[])),"actual-native-reader-dispatch","exec")
        for batch,key in [("switcher-actions","switcher"),("switcher-styles","switcher"),("switcher-motion","switcher"),("tooltip-styles","tooltip")]:
            readers={name:MagicMock(return_value=name) for name in ["reconcile_switcher_ios","reconcile_tooltip_ios","reconcile_settings_startup"]}
            namespace={"config":{"batch":batch},"raw":"native records","result":{},**readers}
            exec(code,namespace)
            self.assertEqual(namespace["result"],{key:"reconcile_"+key+"_ios"})
            readers["reconcile_"+key+"_ios"].assert_called_once_with("native records",{"batch":batch})
            readers["reconcile_tooltip_ios" if key=="switcher" else "reconcile_switcher_ios"].assert_not_called()
        callback=next(node for node in ast.walk(source) if isinstance(node,ast.IfExp) and isinstance(node.body,ast.Call) and isinstance(node.body.func,ast.Name) and node.body.func.id=="early_tooltip_observer")
        code=compile(ast.fix_missing_locations(ast.Expression(callback)),"actual-native-identity-callback","eval")
        for batch,expected in [("switcher-actions",True),("switcher-styles",True),("switcher-motion",True),("tooltip-styles",True),("link",False)]:
            identity=MagicMock(return_value="existing identity callback")
            result=eval(code,{"config":{"batch":batch},"session":object(),"observer":{},"early_tooltip_observer":identity})
            self.assertEqual(result,"existing identity callback" if expected else None)
            self.assertEqual(identity.call_count,1 if expected else 0)


class InputG08Controls(unittest.TestCase):
    def test_input_selection_records_fresh_delivery_before_strict_value_and_cursor_assertions(self):
        observer=(ROOT/"MeterG02TrialTests.swift").read_text().split("final class InputG08TrialTests: XCTestCase {",1)[1]
        action=observer.split("func testInputActionsAndEditorOwnership()throws {",1)[1].split("func testInputStylesAndConstraint()throws {",1)[0]
        def check(source):
            stages=['let beforeFocus=try state()', 'tap("Focus Input")', 'wait("Fresh original focus and public Input range request")', 'let beforeEdit=try state()', '.typeText("Z")', 'wait("Fresh original Input selection edit delivery")', '_ = try rawCapture("selection-edit")', 'XCTAssertEqual(app.textFields["input-native-editor"].firstMatch.value as? String,"SeZtable")', 'wait("User edit native selection acknowledgement")', 'try capture("selection")']
            offsets=[source.index(value) for value in stages];self.assertEqual(offsets,sorted(offsets))
            self.assertNotIn('text("SeZtable")',source)
            for value in ['row["selectionArmed"] as? Bool==true','events.dropFirst(focusStart)','events.dropFirst(self.selectionStartEventCount)','changes.count==requestCount+1','native["text"] as? String==requested','(event["target"] as? NSNumber)?.doubleValue==original','(event["currentTarget"] as? NSNumber)?.doubleValue==original','(selection["start"] as? Int)==3 && (selection["end"] as? Int)==3']:self.assertIn(value,source)
        check(action)
        for bad in [action.replace('_ = try rawCapture("selection-edit")',''),action.replace('changes.count==requestCount+1','changes.count==requestCount'),action.replace('events.dropFirst(focusStart)','events'),action.replace('(selection["end"] as? Int)==3','(selection["end"] as? Int)==4'),action.replace('native["text"] as? String==requested','native["text"] as? String=="SeZtable"')]:
            with self.assertRaises((AssertionError,ValueError)):check(bad)
        raw=observer.split('private func rawCapture(',1)[1].split('private func capture(',1)[0]
        self.assertLess(raw.index('rawShot.lifetime = .keepAlways;add(rawShot)'),raw.index('return (all,shot)'))
        self.assertIn('INPUT_NATIVE_RAW ',raw)
        capture=observer.split('private func capture(',1)[1].split('private func text(',1)[0]
        self.assertLess(capture.index('try rawCapture(name)'),capture.index('try pixels('))

    def test_input_geometry_program_selects_only_current_used_helpers_and_twenty_cases(self):
        source=(ROOT/"MeterG02TrialTests.swift").read_text()
        for batch in ["input-actions","input-styles","input-lifetime","input-remaining"]:
            program=NATIVE.geometry_control_source(batch)
            self.assertNotIn("menu",program.casefold())
            self.assertEqual(set(re.findall(r"func (\w+)\(",program)),{"circularPixelsMatch","toggleButtonMatchedFrame","galleryScrollFraction"})
            self.assertEqual(program.count("precondition("),20)
            self.assertIn('"inputFrameCases":6,"inputPixelCases":6,"inputScrollCases":8',program)
            for name in ["circularPixelsMatch","toggleButtonMatchedFrame","galleryScrollFraction"]:
                start=source.index("private func "+name+"(");end=source.index("\n}",source.index("{",start))+2
                self.assertIn(source[start:end].replace("private ","",1),program)

    def test_input_scroll_scope_replays_saved_native_wrapper_and_excludes_keyboard_siblings(self):
        observer=(ROOT/"MeterG02TrialTests.swift").read_text().split("final class InputG08TrialTests: XCTestCase {",1)[1]
        self.assertIn('let wrapper=node("showcase-scroll")',observer)
        self.assertIn('let scroll=wrapper.descendants(matching:.scrollView).firstMatch',observer)
        self.assertIn('toggleButtonMatchedFrame(rect(wrapper.frame),rect(scroll.frame),Double(UIScreen.main.scale))',observer)
        self.assertNotIn('XCTAssertEqual(wrapper.frame,scroll.frame',observer)
        self.assertNotIn('app.scrollViews.firstMatch',observer)
        # Exact native hierarchy fragments retained from Fieldr7 and Popoverr3 at unchanged host source.
        samples=[[
            "                      Other, 0x10c540070, {{0.0, 47.0}, {390.0, 763.0}}, identifier: 'showcase-scroll'",
            "                        ScrollView, 0x10c40cc60, {{0.0, 47.0}, {390.0, 763.0}}",
        ],[
            "                      Other, 0x10cd285b0, {{0.0, 47.0}, {390.0, 763.0}}, identifier: 'showcase-scroll'",
            "                        ScrollView, 0x10cd286d0, {{0.0, 47.0}, {390.0, 763.0}}",
        ]]
        keyboard="                      ScrollView, 0x999, {{0.0, 509.0}, {390.0, 44.0}}"
        def frame(line):return tuple(float(x) for x in re.search(r"\{\{([^,]+), ([^}]+)\}, \{([^,]+), ([^}]+)\}\}",line).groups())
        def scoped(lines):
            matches=[i for i,line in enumerate(lines)if "Other," in line and "identifier: 'showcase-scroll'" in line]
            if len(matches)!=1:raise ValueError("Missing or duplicate native host wrapper")
            index=matches[0];depth=len(lines[index])-len(lines[index].lstrip());children=[]
            for line in lines[index+1:]:
                if len(line)-len(line.lstrip())<=depth:break
                if line.lstrip().startswith("ScrollView,"):children.append(line)
            physical=lambda values:tuple(NATIVE.math.floor(value*3+.5) for value in values)
            if not children or physical(frame(children[0]))!=physical(frame(lines[index])):raise ValueError("Missing or wrong native owned scroll viewport")
            return frame(children[0])
        for sample in samples:
            fractional=[sample[0],sample[1].replace("763.0","762.9999999999999")]
            self.assertNotEqual(frame(fractional[0]),frame(fractional[1]))
            self.assertEqual(scoped(fractional),(0,47,390,762.9999999999999))
            for index in range(4):
                values=list(frame(fractional[1]));values[index]+=1/3
                wrongLine="                        ScrollView, 0x123, {{%s, %s}, {%s, %s}}"%tuple(values)
                with self.assertRaises(ValueError):scoped([sample[0],wrongLine])
            for lines in [sample,[keyboard,*sample],[*sample,keyboard]]:
                self.assertEqual(scoped(lines),(0,47,390,763))
                self.assertFalse(any(line.lstrip().startswith("ScrollView,")and"identifier: 'showcase-scroll'"in line for line in lines))
            wrong=[keyboard,*sample];self.assertEqual(frame(next(line for line in wrong if line.lstrip().startswith("ScrollView,"))),(0,509,390,44))
            for bad in [[sample[0]], [sample[0],keyboard.replace("                      ","                        ",1)], [line.replace("showcase-scroll","foreign")for line in sample]]:
                with self.assertRaises(ValueError):scoped(bad)

    def test_input_remaining_selects_two_methods_and_rejects_unadmitted_real_entry(self):
        expected={"ios":["InputG08TrialTests/testInputActionsAndEditorOwnership","InputG08TrialTests/testInputStylesAndConstraint"],"android":[]}
        self.assertEqual(NATIVE.selection("ios","input-remaining"),expected)
        NATIVE.validate_standard_scope({"cell":"CAT.input.G08","nativeStandard":{"batch":"input-remaining"}})
        with self.assertRaises(ValueError):NATIVE.selection("android","input-remaining")
        with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":"CAT.text-area.G08","nativeStandard":{"batch":"input-remaining"}})
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/"plan.json";path.write_text(json.dumps({"cell":"CAT.input.G08","nativeStandard":{"platform":"ios","batch":"input-remaining","output":str(Path(temp)/"never-created")}}))
            env={k:v for k,v in os.environ.items()if k!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
            with patch.dict(os.environ,env,clear=True),patch.object(sys,"argv",[str(ROOT/"NativeStandardTests.py"),"--plan",str(path)]),patch.object(NATIVE,"execute")as sdk:
                with self.assertRaisesRegex(ValueError,"Use NativeCellVerification.py"):NATIVE.main()
                sdk.assert_not_called()
            self.assertFalse((Path(temp)/"never-created").exists())

    def test_input_remaining_preserves_independent_modes_counts_and_two_identity_markers(self):
        rows=self.action_rows()+[self.row(name,"styles")for name in NATIVE.INPUT_STYLE_NAMES]
        raw='NATIVE_LOADED_OBSERVER_EARLY {"scope":"source control marker1"}\n'+self.raw(rows)+'\nNATIVE_LOADED_OBSERVER_EARLY {"scope":"source control marker2"}\n'
        result=NATIVE.reconcile_input_ios(raw,{"batch":"input-remaining"})
        self.assertEqual(result["status"],"PASS");self.assertEqual(set(result["methods"]),{"input-actions","input-styles"});self.assertTrue(all(x["observations"]==10 for x in result["methods"].values()))
        for kind in ["missing-method","missing-row","duplicate","foreign-mode","foreign-case"]:
            bad=copy.deepcopy(rows)
            if kind=="missing-method":bad=[row for row in bad if row["state"]["mode"]=="actions"]
            elif kind=="missing-row":bad.pop()
            elif kind=="duplicate":bad.append(copy.deepcopy(bad[-1]))
            elif kind=="foreign-mode":bad[-1]["state"]["mode"]="lifetime"
            else:bad[-1]["name"]="unselected"
            with self.subTest(kind=kind),self.assertRaises(ValueError):NATIVE.reconcile_input_ios(self.raw(bad),{"batch":"input-remaining"})

    def test_input_remaining_actual_driver_exit_keeps_sdk_failure_and_uncertain_cleanup_nonzero(self):
        for failed,clean in [(False,True),(True,True),(False,False)]:
            with tempfile.TemporaryDirectory()as temp:
                out=Path(temp)/"out";plan={"nativeStandard":{"action":"build","platform":"ios","batch":"input-remaining","output":str(out)},"bindings":{"observer":[]},"attempt":{"maximumSeconds":30,"cleanupReserveSeconds":10}}
                with patch.object(NATIVE,"build_ios",side_effect=ValueError("saved SDK65")if failed else None,return_value={"product":"CONTROL_NO_SDK"}),patch.object(NATIVE,"cleanup",side_effect=None if clean else ValueError("unverified shutdown")):
                    code=NATIVE.execute(plan,{"result":"PASS","scope":"Input remaining host sentinel only, no SDK"})
                self.assertEqual(code,0 if not failed and clean else 1)
                record=json.loads((out/"terminal.json").read_text());self.assertEqual(record["cleanupVerified"],clean);self.assertEqual(record["gatePromotions"],0)

    def row(self,name,mode="actions"):
        retired=name.endswith("retired") or name=="retired";fresh=name.endswith("fresh") or name=="fresh";narrow=name.startswith("long-narrow")
        case=name if mode!="lifetime" else ("first" if name.endswith("first") else "second")
        state={"mode":mode,"case":case,"value":"fresh" if fresh and mode=="actions" else "owner" if name in ["declined-x","declined-y","disabled","readonly"] else "SeZtable" if name=="selection" else "ab" if name=="first-input" else "Long English / Renseignements français détaillés" if narrow else "Input" if mode=="styles" else "", "visible":not retired,"rootTag":None if retired else 31 if fresh else 17,"generation":1 if fresh else 0,"disabled":name=="disabled","readOnly":name=="readonly","narrow":narrow,"invalid":name=="error","changes":[],"events":[],"refs":[17],"layouts":[{"target":31 if fresh else 17,"currentTarget":31 if fresh else 17,"layout":{"x":12,"y":12,"width":190 if narrow else 240,"height":64 if narrow else 48}}],"themeMode":"dark" if name=="dark" else "light","fontSize":24 if narrow else 14,"expectedBorder":"#bb3322" if name.endswith("first") else "#117733","motionEvents":[name.startswith("reduced")]}
        state["expectedBorderNativeColor"]=1
        return {"name":name,"state":state,"paintedState":{"generation":state["generation"],"borderColor":1,"isFocused":False},"parent":[0,0,272,88],"root":[] if retired else [13,13,188 if narrow else 238,62 if narrow else 46],"window":[0,0,400,800],"keyboard":[0,500,400,300] if name in ["first-input","selection","long-narrow-keyboard"] else [],"targetCount":0 if retired else 1,"rootIsTextField":not retired,"rootLabel":"" if retired else "Public Input editor","rootValue":"Seed" if name=="default" else state["value"],"rootEnabled":not (state["disabled"] or state["readOnly"]),"referenceExact":mode!="actions","referenceParent":[0,0,272,88],"inkPixels":0 if retired else 300,"scale":2,"imageWidth":800,"imageHeight":1600}

    def event(self,phase,text=None,selection=None):
        native={"target":17}
        if text is not None:native["text"]=text
        if selection is not None:native["selection"]=selection
        return {"phase":phase,"generation":0,"target":17,"currentTarget":17,"nativeEvent":native}

    def action_rows(self):
        rows=[self.row(name) for name in NATIVE.INPUT_ACTION_NAMES]
        first_events=[self.event("focus"),self.event("change","a"),self.event("change","ab")]
        final_events=first_events+[self.event("submit","ab"),self.event("blur"),self.event("change","ownerx"),self.event("change","ownery"),self.event("change","SeZtable"),self.event("selection",selection={"start":3,"end":3})]
        for row in rows:
            first=row["name"]=="first-input";final=row["name"]=="fresh"
            if first or final or row["name"]=="selection":
                row["state"]["changes"]=[{"value":value,"generation":0} for value in (["a","ab"] if first else ["a","ab","ownerx","ownery","SeZtable"])]
                row["state"]["events"]=copy.deepcopy(first_events if first else final_events)
        selected=next(row for row in rows if row["name"]=="selection");selected["selectionStartEventCount"]=len(final_events)-2
        return rows

    def raw(self,rows,restoration=False):
        value="\n".join("INPUT_NATIVE_OBSERVATION "+json.dumps(row) for row in rows)
        return value+("\nMETER_STYLE_MOTION_ORIGINAL 0\nMETER_STYLE_MOTION_RESTORED 0\n" if restoration else "")

    def test_input_saved_native_default_backing_geometry_and_discriminating_negatives(self):
        saved={"name":"default","state":{"mode":"actions","case":"default","value":"","visible":True,"rootTag":694,"disabled":False,"readOnly":False,"narrow":False,"layouts":[{"target":694,"currentTarget":694,"layout":{"x":12,"y":12,"width":240,"height":48}}]},"parent":[26,539.99995803833008,272,88],"root":[39,552.99995803833008,238,46],"window":[0,0,390,844],"keyboard":[],"targetCount":1,"rootIsTextField":True,"rootLabel":"Public Input editor","rootValue":"Seed","rootEnabled":True,"inkPixels":6453,"scale":3,"imageWidth":1170,"imageHeight":2532}
        self.assertEqual(NATIVE.validate_input_rows([saved],["default"])["status"],"PASS")
        for kind in ["x","y","width","height","target","outer"]:
            bad=copy.deepcopy(saved)
            if kind in ["x","y","width","height"]:bad["root"][["x","y","width","height"].index(kind)]+=1/3
            elif kind=="target":bad["state"]["layouts"][-1]["target"]=999
            else:bad["root"]=[38,551.99995803833008,240,48]
            with self.subTest(kind=kind),self.assertRaises(ValueError):NATIVE.validate_input_rows([bad],["default"])

    def test_input_prepared_selection_and_scope(self):
        for batch,method in [("input-actions","testInputActionsAndEditorOwnership"),("input-styles","testInputStylesAndConstraint"),("input-lifetime","testInputBorderLifetimeAndReduction")]:
            self.assertEqual(NATIVE.selection("ios",batch),{"ios":["InputG08TrialTests/"+method],"android":[]})
            NATIVE.validate_standard_scope({"cell":"CAT.input.G08","nativeStandard":{"batch":batch}})
            with self.assertRaises(ValueError):NATIVE.selection("android",batch)
            with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":"CAT.text-area.G08","nativeStandard":{"batch":batch}})

    def test_input_action_payload_ref_guard_and_selection_positive(self):
        self.assertEqual(NATIVE.reconcile_input_ios(self.raw(self.action_rows()),{"batch":"input-actions"})["observations"],10)

    def test_input_action_reader_rejects_wrong_target_payload_count_selection_and_stale_ref(self):
        for kind in ["target","role","name","callback","native-text","count","selection","old-selection","ref","guard","stale-event","missing","duplicate"]:
            rows=self.action_rows();named={row["name"]:row for row in rows};final=named["fresh"]["state"]
            if kind=="target":named["first-input"]["targetCount"]=2
            elif kind=="role":named["first-input"]["rootIsTextField"]=False
            elif kind=="name":named["default"]["rootLabel"]="Core comparison"
            elif kind=="callback":final["changes"][-1]["value"]="ownerz"
            elif kind=="native-text":named["first-input"]["rootValue"]="a"
            elif kind=="count":final["changes"].pop()
            elif kind=="selection":named["selection"]["state"]["events"][-1]["nativeEvent"]["selection"]["end"]=6
            elif kind=="old-selection":named["selection"]["selectionStartEventCount"]=len(named["selection"]["state"]["events"])
            elif kind=="ref":final["rootTag"]=17
            elif kind=="guard":named["readonly"]["rootEnabled"]=True
            elif kind=="stale-event":final["events"][-1]["currentTarget"]=999
            elif kind=="missing":rows.pop()
            else:rows.append(copy.deepcopy(rows[0]))
            with self.subTest(kind=kind),self.assertRaises(ValueError):NATIVE.reconcile_input_ios(self.raw(rows),{"batch":"input-actions"})

    def test_input_style_reference_and_fractional_geometry_positive(self):
        rows=[self.row(name,"styles") for name in NATIVE.INPUT_STYLE_NAMES]
        for row in rows:row["root"][2]+=0.0001220703125
        self.assertEqual(NATIVE.reconcile_input_ios(self.raw(rows),{"batch":"input-styles"})["observations"],10)

    def test_input_style_reader_rejects_physical_bleed_wrong_dimensions_reference_and_keyboard(self):
        for kind in ["bleed","dimension","reference","reference-frame","keyboard","raster","theme","unsettled-paint","replaced-root"]:
            rows=[self.row(name,"styles") for name in NATIVE.INPUT_STYLE_NAMES];named={row["name"]:row for row in rows};row=named["baseline"]
            if kind=="bleed":row["root"][0]=32.5
            elif kind=="dimension":row["root"][2]+=0.5
            elif kind=="reference":row["referenceExact"]=False
            elif kind=="reference-frame":row["referenceParent"][0]=0.5
            elif kind=="keyboard":named["long-narrow-keyboard"]["keyboard"][1]=30
            elif kind=="raster":row["imageHeight"]-=1
            elif kind=="theme":named["dark"]["state"]["themeMode"]="light"
            elif kind=="unsettled-paint":row["paintedState"]["borderColor"]=2
            else:
                row["state"]["rootTag"]=33;row["state"]["layouts"][-1]["target"]=33;row["state"]["layouts"][-1]["currentTarget"]=33
            with self.subTest(kind=kind),self.assertRaises(ValueError):NATIVE.reconcile_input_ios(self.raw(rows),{"batch":"input-styles"})

    def test_input_lifetime_reduction_restoration_positive(self):
        rows=[self.row(name,"lifetime") for name in NATIVE.INPUT_LIFETIME_NAMES]
        self.assertEqual(NATIVE.reconcile_input_ios(self.raw(rows,True),{"batch":"input-lifetime"})["observations"],10)

    def test_input_lifetime_reader_rejects_stale_callback_paint_ref_reduction_and_restoration(self):
        for kind in ["stale","paint","ref","reduction","restore"]:
            rows=[self.row(name,"lifetime") for name in NATIVE.INPUT_LIFETIME_NAMES];named={row["name"]:row for row in rows}
            if kind=="stale":named["normal-fresh"]["state"]["events"].append(self.event("change","late"))
            elif kind=="paint":named["normal-retired"]["inkPixels"]=1
            elif kind=="ref":named["normal-fresh"]["state"]["generation"]=0
            elif kind=="reduction":named["reduced-first"]["state"]["motionEvents"]=[False]
            raw=self.raw(rows,kind!="restore")
            with self.subTest(kind=kind),self.assertRaises(ValueError):NATIVE.reconcile_input_ios(raw,{"batch":"input-lifetime"})


class NumberLoadedHostTimingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory();self.root = Path(self.temp.name)
        self.host = self.root / "Loaded.app";self.bundle = self.host / "PlugIns/CodonNativeComponents.xctest"
        self.bundle.mkdir(parents=True);self.executable = self.bundle / "CodonNativeComponents"
        self.executable.write_bytes(b"synthetic observer executable")
        (self.host / "Runner").write_bytes(b"synthetic runner")
        for index in range(35): (self.host / ("member-" + str(index))).write_bytes(str(index).encode())
        self.observer = NATIVE.identity(self.host)
        self.session = MagicMock();self.session.output = self.root / "run";self.session.output.mkdir()
        now = time.time()
        self.row = {"path":str(self.bundle),"executable":str(self.executable),"sha256":NATIVE.digest(self.executable),"expectedSHA256":NATIVE.digest(self.executable),"epochMs":(now-1)*1000}
        self.raw = "NATIVE_LOADED_OBSERVER_EARLY " + json.dumps(self.row) + "\n"
        (self.session.output / "xctest.stdout").write_text(self.raw)
        NATIVE.early_tooltip_observer(self.session,self.observer)()
        self.receipt = self.session.output / "early-loaded-observer.json"
        self.diagnostics = self.root / "diagnostics";self.diagnostics.mkdir()
        (self.diagnostics / "Session-test.log").write_text("Loading test bundle at: " + self.bundle.as_uri() + "/\n")
        stamp = lambda value:NATIVE.datetime.datetime.fromtimestamp(value,NATIVE.datetime.timezone.utc).isoformat()
        self.execution = {"ownerPID":os.getpid(),"pid":12345,"processGroup":12345,"startedUTC":stamp(now-2),"endedUTC":stamp(now+2)}
        self.observation = {"receipt":self.receipt,"raw":self.raw,"execution":self.execution}

    def tearDown(self): self.temp.cleanup()

    def retire(self):
        import shutil
        shutil.rmtree(self.host)

    def verify(self):
        return NATIVE.verify_loaded_observer(self.diagnostics,self.root/"DifferentPreflight.app",self.observer,self.observation)

    def test_complete_one_shot_host_proof_survives_confirmed_postrun_absence(self):
        self.assertEqual(len(self.observer["filesSHA256"]),37)
        self.retire();result = self.verify()
        self.assertEqual(result["status"],"PASS")
        self.assertEqual(result["observerManifestSHA256"],self.observer["manifestSHA256"])
        self.assertEqual(result["earlyObservation"]["sha256"],NATIVE.digest(self.receipt))

    def test_missing_or_incomplete_early_proof_never_rescues_absence(self):
        original = json.loads(self.receipt.read_text());self.retire()
        for key,value in [("status","FAIL"),("observerManifestSHA256","f"*64),("executableSHA256","f"*64),("loadedTestBundle",str(self.root/"Other.xctest")),("nativeBeforeAppLaunch",[])]:
            bad=copy.deepcopy(original);bad[key]=value;self.receipt.write_text(json.dumps(bad))
            with self.subTest(key=key),self.assertRaises(ValueError):self.verify()
        self.receipt.unlink()
        with self.assertRaises((ValueError,FileNotFoundError)):self.verify()

    def test_stale_future_or_foreign_owner_proof_rejects(self):
        original=json.loads(self.receipt.read_text());self.retire()
        for value in ["2000-01-01T00:00:00+00:00","2100-01-01T00:00:00+00:00","2026-11-09T00:00:00"]:
            bad=copy.deepcopy(original);bad["verifiedUTC"]=value;self.receipt.write_text(json.dumps(bad))
            with self.subTest(timestamp=value),self.assertRaises(ValueError):self.verify()
        self.receipt.write_text(json.dumps(original));self.execution["ownerPID"]+=1
        with self.assertRaises(ValueError):self.verify()

    def test_current_native_marker_and_runtime_root_must_match_complete_proof(self):
        self.retire()
        for key,value in [("path",str(self.root/"Other.xctest")),("sha256","f"*64),("expectedSHA256","f"*64),("epochMs",0)]:
            bad=copy.deepcopy(self.row);bad[key]=value;self.observation["raw"]="NATIVE_LOADED_OBSERVER_EARLY "+json.dumps(bad)+"\n"
            with self.subTest(key=key),self.assertRaises(ValueError):self.verify()
        self.observation["raw"]=""
        with self.assertRaises(ValueError):self.verify()
        self.observation["raw"]=self.raw
        other=self.root/"Other.app/PlugIns/CodonNativeComponents.xctest"
        (self.diagnostics/"Session-test.log").write_text("Loading test bundle at: "+other.as_uri()+"/\n")
        with self.assertRaises(ValueError):self.verify()
        (self.diagnostics/"Session-test.log").write_text("Loading test bundle at: "+self.bundle.as_uri()+"/\n")
        bad=copy.deepcopy(self.row);bad["path"]=str(other)
        self.observation["raw"]=self.raw+"NATIVE_LOADED_OBSERVER_EARLY "+json.dumps(bad)+"\n"
        with self.assertRaises(ValueError):self.verify()

    def test_present_changed_partial_or_extra_host_still_fails(self):
        self.executable.write_bytes(b"changed")
        with self.assertRaises(ValueError):self.verify()
        self.executable.write_bytes(b"synthetic observer executable")
        extra=self.host/"unexpected";extra.write_text("extra")
        with self.assertRaises(ValueError):self.verify()
        extra.unlink();(self.host/"member-0").unlink()
        with self.assertRaises(ValueError):self.verify()

    def test_denied_or_unknown_host_stat_is_never_absence(self):
        original=Path.stat
        for exception in [PermissionError("denied"),OSError("unknown")]:
            def probe(path,*args,**kwargs):
                if path==self.host:raise exception
                return original(path,*args,**kwargs)
            with self.subTest(error=type(exception).__name__),patch.object(Path,"stat",probe),self.assertRaises(OSError):self.verify()

    def test_existing_postrun_rule_is_unchanged_without_early_observation(self):
        self.assertEqual(NATIVE.verify_loaded_observer(self.diagnostics,self.host,self.observer)["status"],"PASS")
        self.retire()
        with self.assertRaisesRegex(ValueError,"Product files differ"):
            NATIVE.verify_loaded_observer(self.diagnostics,self.host,self.observer)


class SelectG08ScopeTests(unittest.TestCase):
    def test_select_batch_maps_three_qualification_methods_and_isolated_diagnostic_and_rejects_foreign_scope(self):
        expected={"ownership":"testSelectOwnershipCollectionAndFocus","styles":"testSelectStylesConstraintsAndKeyboard","lifetime":"testSelectLifetimeContextAndReduction","focus-diagnostic":"testSelectPublicRefFocusDiagnostic"}
        self.assertEqual(NATIVE.SELECT_BATCHES["select"],["ownership","styles","lifetime"])
        self.assertEqual(NATIVE.SELECT_BATCHES["select-focus-diagnostic"],["focus-diagnostic"])
        for batch,modes in NATIVE.SELECT_BATCHES.items():
            plan={"cell":"CAT.select.G08","nativeStandard":{"platform":"ios","batch":batch}}
            NATIVE.validate_standard_scope(plan)
            self.assertEqual(NATIVE.selection("ios",batch),{"ios":["SelectG08TrialTests/"+expected[mode] for mode in modes],"android":[]})
            with self.assertRaises(ValueError):NATIVE.selection("android",batch)
            for cell in ["CAT.select.G07","CAT.menu.G08","CAT.combo-box.G08"]:
                with self.assertRaises(ValueError):NATIVE.validate_standard_scope({"cell":cell,"nativeStandard":plan["nativeStandard"]})

    def test_select_focus_diagnostic_captures_before_assertion_without_post_focus_action_or_wait(self):
        source=(ROOT/"MeterG02TrialTests.swift").read_text()
        method=source.split("func testSelectPublicRefFocusDiagnostic() throws {",1)[1].split("func testSelectOwnershipCollectionAndFocus()",1)[0]
        after=method.split('tap("Focus Select trigger")',1)[1]
        self.assertLess(after.index('observed["state"]=try state()'),after.index('SELECT_PUBLIC_REF_FOCUS_DIAGNOSTIC'))
        self.assertLess(after.index('SELECT_PUBLIC_REF_FOCUS_DIAGNOSTIC'),after.index('let actual='))
        for forbidden in ['tap(', 'reveal(', 'wait(', 'capture(']:self.assertNotIn(forbidden,after)
        self.assertIn('stateReadError',after)
        self.assertIn('screenshot:XCUIScreen.main.screenshot()',after)
        self.assertIn('app.debugDescription',after)

    def test_select_reuses_narrow_geometry_controls_without_stopped_component_cases(self):
        expected=NATIVE.geometry_control_source("number-input")
        for batch in NATIVE.SELECT_BATCHES:
            self.assertEqual(NATIVE.geometry_control_source(batch),expected)
            self.assertNotIn("menu",expected.lower())
            self.assertIn("numberPhysicalCrop",expected)

    def test_select_cli_rejects_missing_admission_before_creating_sdk_output(self):
        with tempfile.TemporaryDirectory() as directory:
            output=Path(directory)/"sdk-must-not-exist"
            plan=Path(directory)/"select.json"
            plan.write_text(json.dumps({"cell":"CAT.select.G08","nativeStandard":{"platform":"ios","batch":"select","output":str(output)}}))
            env={key:value for key,value in os.environ.items() if key!="CODON_NATIVE_CELL_PREFLIGHT_RECEIPT"}
            result=subprocess.run([sys.executable,"-B",str(ROOT/"NativeStandardTests.py"),"--plan",str(plan)],env=env,capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0)
            self.assertIn("Use NativeCellVerification.py",result.stderr)
            self.assertFalse(output.exists())


if __name__ == "__main__": unittest.main()
