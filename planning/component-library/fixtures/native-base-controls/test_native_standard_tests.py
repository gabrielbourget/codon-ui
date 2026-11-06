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
            session=NATIVE.Session(self.root/("two-keys-"+str(failed)),60,30);session.guest_owned=True;session.emulator=MagicMock();session.motion_setting="0";session.additional_motion_settings={"animator_duration_scale":"0.5"}
            def command(label,argv,*args,**kwargs):
                if label=="restore-animator-setting" and failed:raise ValueError("saved denied restore")
                return "0.5" if label=="verify-animator-setting" else "0" if label=="verify-motion-setting" else ""
            session.run=MagicMock(side_effect=command);probe=MagicMock();probe.__enter__.return_value.connect_ex.return_value=111
            with patch.object(NATIVE,"stop_owned_process",return_value=True),patch.object(NATIVE.socket,"socket",return_value=probe):NATIVE.cleanup(session,{"platform":"android","sdk":"/sdk","destination":"emulator-5568"})
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
        socket_control = MagicMock();socket_control.__enter__.return_value.connect_ex.return_value = 111
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
            session.guest_owned = True;session.emulator = MagicMock()
            responses = ["", "emulator-5568 offline", ""] if scenario == "delayed-detachment" else None
            session.run = MagicMock(side_effect=responses) if responses else MagicMock(return_value="emulator-5568 offline" if scenario == "remaining-serial" else "")
            probe = MagicMock();probe.__enter__.return_value.connect_ex.return_value = 0 if scenario == "remaining-port" else 111
            with patch.object(NATIVE, "stop_owned_process", return_value=True), patch.object(NATIVE.time, "sleep", side_effect=lambda _: setattr(session, "end", session.end - 60)), patch.object(NATIVE.socket, "socket", return_value=probe):
                if scenario == "delayed-detachment":
                    NATIVE.cleanup(session, config)
                    self.assertEqual(session.run.call_count, 3)
                else:
                    with self.assertRaisesRegex(ValueError, "detachment not verified|port remains open"):
                        NATIVE.cleanup(session, config)


    def test_motion_preference_failure_still_stops_owned_guest_and_preserves_error(self):
        config = {"platform": "android", "sdk": str(self.root), "destination": "emulator-5568"}
        for name, original, restored in [("exact-null", "null", "null"), ("exact-value", "0.5", "0.5"), ("mismatch", "1", "0"), ("restore-fails", "1", None)]:
            session = NATIVE.Session(self.root / name, 60, 30);session.guest_owned = True;session.emulator = MagicMock();session.motion_setting = original
            def command(label, argv, *args, **kwargs):
                if label == "restore-motion-setting" and restored is None: raise ValueError("SDK denied restoration")
                return restored if label == "verify-motion-setting" else ""
            session.run = MagicMock(side_effect=command)
            probe = MagicMock();probe.__enter__.return_value.connect_ex.return_value = 111
            with patch.object(NATIVE, "stop_owned_process", return_value=True) as stopped, patch.object(NATIVE.socket, "socket", return_value=probe):
                NATIVE.cleanup(session, config)
            stopped.assert_called_once_with(session.emulator)
            self.assertIn("emulator-shutdown", [call.args[0] for call in session.run.call_args_list])
            self.assertEqual(bool(session.cleanup_errors), name in ["mismatch", "restore-fails"])
            if name == "exact-null": self.assertIn("delete", session.run.call_args_list[0].args[1])


def member(source, signature):
    start = source.index(signature);opening = source.index("{", start);depth = 1;end = opening + 1
    # These preserved test/helper bodies contain balanced interpolation braces.
    while depth:
        depth += (source[end] == "{") - (source[end] == "}");end += 1
    return source[start:end]



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

if __name__ == "__main__": unittest.main()
