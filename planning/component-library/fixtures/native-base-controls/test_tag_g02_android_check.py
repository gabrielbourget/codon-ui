"""Offline schema/adversarial controls only; no guest or fabricated native evidence."""
import copy,importlib.util,sys,unittest
from pathlib import Path
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('tag_check',Path(__file__).with_name('TagG02AndroidCheck.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def sample():
 cohorts=[]
 for name,expected in m.EXPECTED.items():
  rows=[]
  for label,requests,owner,echo,exposed,enabled in expected:
   long=label.startswith('long-');selected_long=label=='long-first-action';frame=('10 20 290 132' if selected_long else '10 20 290 140') if long else '10 20 170 60'
   state={'requests':requests,'owner':owner,'echo':echo,'exposed':exposed,'id':'number 0','last':'none' if requests==0 else 'number 0','armed':False,'rawText':'Synthetic schema control only','nativeUptimeMs':10,'size':'140' if long else 'automatic','frameWidth':140 if long else 80,'frameHeight':(56 if selected_long else 60) if long else 20}
   node={'id':'tag-example','className':'android.widget.Button','contentDescription':'Controlled tag','enabled':enabled,'checkable':True,'checked':False if exposed=='false' else owner,'visible':True,'bounds':frame,'nativeEpochMs':15}
   rows.append({'name':label,'state':state,'target':node,'sameNativeAXSource':True,'scroll':{'bounds':'0 0 400 800'},'captureStartedEpochMs':10,'captureFinishedEpochMs':20,'windows':{'windowNodes':[{'id':'tag-example'}]},'png':label+'.png'})
  row={'name':name,'status':'NATIVE_ASSERTIONS_PASSED_PENDING_HOST_REVIEW','elapsedMs':20000,'observations':rows}
  if name=='baseline-actions':row['staticNode']={'id':'tag-status','contentDescription':'Tag status inactive','clickable':False,'actions':[]}
  if name=='guard-cancel-lifetime':
   contacts=[]
   for takeover in [True,False]:
    c={'takeover':takeover,'downAccepted':True,'releaseAccepted':True,'toolType':1,'source':4098,'pointerId':0,'releaseAction':1 if takeover else 3,'downUptimeMs':1,'heldSnapshotFinishedUptimeMs':20,'releaseUptimeMs':25,'finishedUptimeMs':30,'before':{'requests':0,'owner':False},'after':{'requests':0,'owner':False},'heldState':{'requests':0,'owner':False,'armed':False,'nativeUptimeMs':15},'heldTarget':{'enabled':False}}
    contacts.append(c)
   row['contacts']=contacts;row['retirement']={'absent':True,'quietAbsent':True,'windows':{'windowNodes':[]},'quietWindows':{'windowNodes':[]}}
  cohorts.append(row)
 return {'operation':'tag-g02-batch','connectionAdmission':'READY_FROM_ACTUAL_NEW_CONNECTION','methodLimitMs':180000,'batchLimitMs':560000,'elapsedMs':65000,'cohorts':cohorts,'nativeActionSucceeded':True,'hasFailedCohorts':False,'status':'NATIVE_COMPLETE_PENDING_HOST_VISUAL_AND_SOURCE_JOIN'}

import time
CONTROL_WORK_DEADLINE = time.time() + 1800 - 120

class Controls(unittest.TestCase):
 def test_positive(self):self.assertEqual(m.reconcile(sample(),2)['status'],'AUTOMATED_TAG_G02_PENDING_VISUAL_AND_SOURCE_JOIN')
 def changed(self,change):
  raw=sample();change(raw)
  try:self.assertNotEqual(m.reconcile(raw,2)['status'],'AUTOMATED_TAG_G02_PENDING_VISUAL_AND_SOURCE_JOIN')
  except (ValueError,KeyError):pass
 def test_owner_veto_negative(self):self.changed(lambda r:r['cohorts'][0]['observations'][4]['state'].update(owner=True))
 def test_typed_callback_negative(self):self.changed(lambda r:r['cohorts'][0]['observations'][2]['state'].update(last='string "0"'))
 def test_alias_native_negative(self):self.changed(lambda r:r['cohorts'][0]['observations'][6]['target'].update(checked=True))
 def test_static_click_negative(self):self.changed(lambda r:r['cohorts'][0]['staticNode'].update(actions=[16]))
 def test_released_only_negative(self):self.changed(lambda r:r['cohorts'][1]['contacts'][0].update(heldSnapshotFinishedUptimeMs=26))
 def test_disabled_before_up_negative(self):self.changed(lambda r:r['cohorts'][1]['contacts'][0]['heldTarget'].update(enabled=True))
 def test_cancel_business_negative(self):self.changed(lambda r:r['cohorts'][1]['contacts'][1]['after'].update(requests=1))
 def test_retired_native_negative(self):self.changed(lambda r:r['cohorts'][1]['retirement']['quietWindows']['windowNodes'].append({'id':'tag-example'}))
 def test_same_node_negative(self):self.changed(lambda r:r['cohorts'][2]['observations'][0].update(sameNativeAXSource=False))
 def test_width_negative(self):self.changed(lambda r:r['cohorts'][2]['observations'][1]['target'].update(bounds='10 20 280 140'))
 def test_selected_long_width_negative(self):self.changed(lambda r:r['cohorts'][2]['observations'][2]['target'].update(bounds='10 20 280 132'))
 def test_selected_long_layout_negative(self):self.changed(lambda r:r['cohorts'][2]['observations'][2]['state'].update(frameHeight=60))
 def test_selected_long_no_wrap_negative(self):
  def change(r):
   row=r['cohorts'][2]['observations'][2];row['target']['bounds']='10 20 290 60';row['state']['frameHeight']=20
  self.changed(change)
 def test_stale_mixed_description_after_reset_remains_failure(self):self.changed(lambda r:r['cohorts'][0]['observations'][-1]['target'].update(contentDescription='Controlled tag, mixed'))
 def test_overall_limit_negative(self):self.changed(lambda r:r['cohorts'][0].update(elapsedMs=1800001))
 def test_missing_cohort_negative(self):self.changed(lambda r:r['cohorts'].pop())
 def test_duplicate_native_negative(self):self.changed(lambda r:r['cohorts'][0]['observations'][0]['windows']['windowNodes'].append({'id':'tag-example'}))
def setup_sample():
 node=lambda key,**rest:dict({'id':key,'packageName':'dev.codonui.showcase','enabled':True,'visible':True,'bounds':'0 0 400 800'},**rest)
 observation={'windows':{'windowRoots':1,'windowNodes':[{'id':'tag-example'},{'id':'showcase-scroll'}]},'scene':node(None,contentDescription='Tag scene',selected=True),'target':node('tag-example',className='android.widget.Button',contentDescription='Controlled tag',bounds='10 20 170 60'),'marker':node('tag-state',text='Actual refresh synthetic control',visible=False),'viewport':node('showcase-scroll'),'state':{'requests':0,'owner':False,'echo':True,'exposed':'default','id':'number 0','last':'none','armed':False,'rawText':'Synthetic schema control only'},'nativeUptimeMs':1000}
 last=copy.deepcopy(observation);last['nativeUptimeMs']=31000
 return {'status':'READY_FROM_ACTUAL_SINGLE_CONNECTION','connectionCount':1,'maximumMs':90000,'elapsedMs':32000,'startedUptimeMs':0,'finishedUptimeMs':32000,'componentInputBeforeAdmission':False,'clearQueries':2,'clearObservedMs':30000,'nativeInputCounts':{'sceneSelections':1,'componentContacts':0,'systemUIWait':0},'systemUIWaitUsed':False,'actions':[{'action':'ACTION_CLICK','label':'Tag scene','accepted':True}],'firstClearObservation':observation,'lastClearObservation':last}

original_sample=sample
def sample():
 raw=original_sample();raw['setup']=setup_sample();return raw

class SetupControls(unittest.TestCase):
 def rejects(self,change):
  row=setup_sample();change(row)
  with self.assertRaises((ValueError,KeyError)):m.verify_setup(row)
 def test_actual_same_connection_positive(self):self.assertEqual(m.verify_setup(setup_sample())['status'],'PASS_ACTUAL_SINGLE_CONNECTION_ADMISSION')
 def test_wrong_root_package(self):self.rejects(lambda r:r['lastClearObservation']['viewport'].update(packageName='com.android.launcher3'))
 def test_wrong_scene(self):self.rejects(lambda r:r['lastClearObservation']['scene'].update(selected=False))
 def test_missing_actual_target(self):self.rejects(lambda r:r['lastClearObservation'].pop('target'))
 def test_missing_native_counts(self):self.rejects(lambda r:r.pop('nativeInputCounts'))
 def test_setup_timeout(self):self.rejects(lambda r:r.update(elapsedMs=90001,finishedUptimeMs=90001))
 def test_short_actual_interval(self):self.rejects(lambda r:r['lastClearObservation'].update(nativeUptimeMs=30999))
 def test_native_anr(self):self.rejects(lambda r:r['lastClearObservation']['windows']['windowNodes'].append({'text':"System UI isn't responding"}))
 def test_component_input_before_admission(self):self.rejects(lambda r:r.update(componentInputBeforeAdmission=True))
 def test_duplicate_scene_selection(self):self.rejects(lambda r:r['actions'].append({'action':'ACTION_CLICK','label':'Tag scene','accepted':True}))
 def test_offscreen_retained_marker_positive(self):self.assertEqual(m.verify_setup(setup_sample())['status'],'PASS_ACTUAL_SINGLE_CONNECTION_ADMISSION')
 def test_exact_saved_wait_positive(self):
  import xml.etree.ElementTree as ET
  fixture=__import__('json').loads(Path(__file__).with_name('TagG02AndroidFailureControls.json').read_text())
  recovery=fixture['systemUIRecovery']['record'];row=setup_sample();row['systemUIWaitUsed']=True;row['nativeInputCounts']['systemUIWait']=1;row['actions'].append({'label':'one startup SystemUI Wait','exitCode':0})
  convert=lambda d:{'id':d['resource-id'],'text':d['text'],'enabled':d['enabled']=='true','windowId':1}
  row['systemUIRecovery']={'accepted':True,'png':'setup-systemui-before-wait.png','title':convert(recovery['alert']),'wait':convert(recovery['action']),'beforeWindows':{'windowRoots':1},'lastWindows':{'windowRoots':1,'windowNodes':[]},'clearedUptimeMs':500}
  self.assertEqual(m.verify_setup(row)['status'],'PASS_ACTUAL_SINGLE_CONNECTION_ADMISSION')
  row['systemUIRecovery']['title']['text']="Phone isn't responding"
  with self.assertRaises(ValueError):m.verify_setup(row)
 def test_saved_uncertain_sequence_stops(self):
  import ast,json
  fixture=json.loads(Path(__file__).with_name('TagG02AndroidFailureControls.json').read_text());first,second,third=[row['record'] for row in fixture['uncertainSequence']]
  self.assertTrue(first['timedOut']);self.assertGreater(second['startedEpoch'],first['endedEpoch']);self.assertTrue(third['timedOut'])
  tree=ast.parse(Path(__file__).with_name('NativeTagG02AndroidDriver.py').read_text());function=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='run')
  class FakePath:
   def __truediv__(self,name):return self
  ns={'print':lambda *a,**k:None,'json':json,'now':lambda:'offline','recorded_command':lambda *a,**k:dict(first),'root':FakePath(),'work':100,'cleanup_deadline':120,'env':{},'rows':[],'write':lambda *a:None}
  exec(compile(ast.Module(body=[function],type_ignores=[]),'actual-run-control','exec'),ns)
  with self.assertRaisesRegex(AssertionError,'Uncertain SDK command outcome'):ns['run']('saved-failure',['adb','shell','historical-query'])


class SourceClockControls(unittest.TestCase):
 def test_executed_actual_scene_wait_handles_delay_wrong_scene_and_uncertainty(self):
  import subprocess,tempfile
  source=(Path(__file__).with_name('android-native-inspector')/'Actions.java').read_text()
  actual=source[source.index('  private static String tagOutputName'):source.index('  private void tgAwaitSelectedScene')]
  controls='''
  static long clock; static int queries;
  static void check(boolean value){if(!value)throw new AssertionError();}
  static void reset(){clock=0;queries=0;}
  public static void main(String[] args) throws Exception {
    String prefix="/sdcard/Android/data/dev.codonui.lab.number/files/";
    check(tagOutputName(prefix+"tag-g02-native-scene-ack-1").equals("tag-g02-native-scene-ack-1"));
    for(String path:new String[]{prefix+"../tag-g02-native-other",prefix+"tag-g02-native-a/child","/unowned/tag-g02-native-a",prefix+"tag-g02-native-",prefix+"tag-g02-native-a.b"}){try{tagOutputName(path);throw new AssertionError();}catch(IllegalArgumentException expected){}}
    reset();awaitSceneSelection(()->++queries==5,()->clock,n->clock+=n,5000);check(queries==5&&clock==400);
    reset();try{awaitSceneSelection(()->{queries++;return false;},()->clock,n->clock+=n,5000);throw new AssertionError();}catch(IllegalStateException expected){check(clock==5000&&queries==50);}
    reset();try{awaitSceneSelection(()->{queries++;throw new Exception("uncertain native query");},()->clock,n->clock+=n,5000);throw new AssertionError();}catch(Exception expected){check(expected.getMessage().equals("uncertain native query")&&queries==1&&clock==0);}
    reset();try{awaitSceneSelection(()->{queries++;clock=5001;return true;},()->clock,n->clock+=n,5000);throw new AssertionError();}catch(IllegalStateException expected){check(queries==1&&clock==5001);}
    reset();clock=5000;try{awaitSceneSelection(()->{queries++;return true;},()->clock,n->clock+=n,5000);throw new AssertionError();}catch(IllegalStateException expected){check(queries==0);}
    System.out.println("PASS actual scene acknowledgement: delayed success, permanent wrong scene, uncertain query, late query, exhausted deadline");
  }
'''
  jdk=Path.home()/'.local/share/codon-native-lab/jdk/Contents/Home/bin'
  with tempfile.TemporaryDirectory() as temporary:
   root=Path(temporary);java=root/'SceneWaitControls.java';java.write_text('class SceneWaitControls {\n'+actual+controls+'\n}\n')
   compiled=subprocess.run([str(jdk/'javac'),str(java)],capture_output=True,text=True,timeout=CONTROL_WORK_DEADLINE - time.time() - 8);self.assertEqual(compiled.returncode,0,compiled.stderr)
   executed=subprocess.run([str(jdk/'java'),'-cp',str(root),'SceneWaitControls'],capture_output=True,text=True,timeout=CONTROL_WORK_DEADLINE - time.time() - 8);self.assertEqual(executed.returncode,0,executed.stderr);self.assertIn('PASS actual scene acknowledgement',executed.stdout)
  helper=source[source.index('  private void tgAwaitSelectedScene'):source.index('  private JSONObject tgSetupNode')]
  self.assertNotIn('performAction',helper);self.assertIn('return actual&&selected',helper)
 def test_java_observation_and_finish_clocks_are_coupled(self):
  source=Path(__file__).with_name("android-native-inspector")/"Actions.java"
  text=source.read_text()
  self.assertIn('long observedElapsed=observation.getLong("nativeUptimeMs")-clearSince;',text)
  self.assertIn('setup.put("clearObservedMs",observedElapsed)',text)
  self.assertIn('if(observedElapsed>=30000)',text)
  pair='long finishedUptimeMs=SystemClock.uptimeMillis();setup.put("finishedUptimeMs",finishedUptimeMs);setup.put("elapsedMs",finishedUptimeMs-setup.getLong("startedUptimeMs"));'
  self.assertEqual(text.count(pair),2)

class BootDiagnosticControls(unittest.TestCase):
 def execute_readiness(self,completed):
  import ast,tempfile
  tree=ast.parse(Path(__file__).with_name('NativeTagG02AndroidDriver.py').read_text());body=next(n for n in tree.body if isinstance(n,ast.Try)).body
  start=next(i for i,n in enumerate(body) if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name) and n.targets[0].id=='boot_until')
  end=next(i for i,n in enumerate(body[start:],start) if isinstance(n,ast.While))
  class Clock:
   value=0
   def time(self):return self.value
   def sleep(self,seconds):self.value+=seconds
  clock=Clock();commands=[]
  with tempfile.TemporaryDirectory() as temporary:
   root=Path(temporary)
   def run(name,argv,cap=None):
    commands.append(name)
    if name=='wait-for-device':clock.value=76.541
    else:(root/(name+'.stdout')).write_text('1' if clock.value>=completed else '')
    return {'exitCode':0}
   ns={'time':clock,'work':1680,'run':run,'A':lambda *args:args,'boot_diagnostic':False,'root':root}
   exec(compile(ast.Module(body=body[start:end+1],type_ignores=[]),'actual-boot-readiness-control','exec'),ns)
  return clock.value,commands
 def test_saved_late_boot_reaches_component_admission(self):
  elapsed,commands=self.execute_readiness(185.592)
  self.assertGreaterEqual(elapsed,185.592);self.assertLess(elapsed,240)
  self.assertEqual(commands[0],'wait-for-device');self.assertTrue(all(n.startswith('boot-completed-') for n in commands[1:]))
 def test_not_ready_at_bound_still_stops(self):
  with self.assertRaisesRegex(RuntimeError,'owner work deadline'):self.execute_readiness(1681)
 def test_saved_failure_final_exit_is_nonzero(self):
  import ast
  tree=ast.parse(Path(__file__).with_name('NativeTagG02AndroidDriver.py').read_text());branch=tree.body[-1]
  class Clock:
   def time(self):return 198.373
  ns={'passed_outcome':'TAG_G02_BATCH_PENDING_ROOT_REVIEW','outcome':'STOP_RuntimeError','guest_verified':False,'profile_settings':None,'serial_absent':True,'ports_free':True,'group_present':False,'cleanup_errors':[{'phase':'emulator-process','error':"PermissionError(1, 'Operation not permitted')"}],'time':Clock(),'end':1800}
  with self.assertRaises(SystemExit) as result:exec(compile(ast.Module(body=[branch],type_ignores=[]),'actual-final-exit-control','exec'),ns)
  self.assertEqual(result.exception.code,1)
 def test_actual_boot_diagnostic_stops_before_install_or_instrumentation(self):
  import ast,json,tempfile,time
  tree=ast.parse(Path(__file__).with_name('NativeTagG02AndroidDriver.py').read_text());body=next(n for n in tree.body if isinstance(n,ast.Try))
  class Finished(Exception):pass
  commands=[];launched=[]
  class Process:
   pid=123
  class Subprocess:
   PIPE=-1;STDOUT=-2
   def Popen(self,argv,**kwargs):launched.append(argv);return Process()
  with tempfile.TemporaryDirectory() as temporary:
   root=Path(temporary);(root/'devices-before.stdout').write_text('List of devices attached\n')
   ns={'free_ports':lambda:True,'run':lambda name,argv,cap=None:commands.append((name,argv,cap)) or {'exitCode':0},'adb':'/offline/adb','root':root,'sdk':Path('/offline/sdk'),'boot_diagnostic':True,'subprocess':Subprocess(),'env':{},'children':[],'write':lambda *a:None,'now':lambda:'offline','print':lambda *a,**k:None,'time':time,'work':time.time()+120,'A':lambda *args:list(args),'BootDiagnosticFinished':Finished}
   try:
    with self.assertRaises(Finished):exec(compile(ast.Module(body=body.body,type_ignores=[]),'actual-boot-diagnostic-control','exec'),ns)
   finally:
    if 'log' in ns:ns['log'].close()
  self.assertEqual([row[0] for row in commands],['devices-before','wait-for-device'])
  self.assertIsNone(commands[-1][2])
  self.assertEqual(launched[0][-1],'-show-kernel')
 def test_actual_diagnostic_deadlines_reserve_cleanup(self):
  import ast
  tree=ast.parse(Path(__file__).with_name('NativeTagG02AndroidDriver.py').read_text())
  expressions={n.targets[0].id:n.value for n in tree.body if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name) and n.targets[0].id in ['work','end']}
  for diagnostic,expected in [(True,(220,340)),(False,(1780,1900))]:
   ns={'start':100,'admission':{'attempt':{'maximumSeconds':240 if diagnostic else 1800,'cleanupReserveSeconds':120}}}
   ns['end']=eval(compile(ast.Expression(expressions['end']),'actual-deadline-control','eval'),ns)
   values=(eval(compile(ast.Expression(expressions['work']),'actual-deadline-control','eval'),ns),ns['end'])
   self.assertEqual(values,expected);self.assertEqual(values[1]-values[0],120)

if __name__=='__main__':unittest.main()
