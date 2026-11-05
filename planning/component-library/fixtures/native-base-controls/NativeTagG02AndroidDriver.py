import datetime,hashlib,json,os,pathlib,re,signal,socket,struct,subprocess,time,sys,xml.etree.ElementTree as ET
start=time.time()
fixture=pathlib.Path(__file__).resolve().parent
if not (fixture/"NativeAndroidTestSupport.py").is_file(): fixture=pathlib.Path("/Users/gabrielbourget/Desktop/Dev/wavemap/tendril-systems/codon-ui/planning/component-library/fixtures/native-base-controls")
repo=fixture.parents[3]
sys.path.insert(0,str(fixture))
sys.dont_write_bytecode=True
from NativeAndroidTestSupport import focused_logcat_command, group_present as owned_group_present, recorded_command, stop_owned_process
from NativeCellVerification import load_admission
import argparse,shlex
parser=argparse.ArgumentParser();parser.add_argument('--prepared',type=pathlib.Path,required=True);parser.add_argument('--boot-diagnostic',action='store_true');parser.add_argument('--cell',choices=['CAT.tag.G02','CAT.placeholder-text.G04'],default='CAT.tag.G02');args=parser.parse_args()
boot_diagnostic=args.boot_diagnostic
placeholder=args.cell=='CAT.placeholder-text.G04'
assert not (placeholder and boot_diagnostic),'Placeholder uses the complete bounded batch only'
profile='PlaceholderG04' if placeholder else 'TagG02'
native_operation='placeholder-g04-batch' if placeholder else 'tag-g02-batch'
cohort_names=['light-style','dark-and-reset','narrow-pane'] if placeholder else ['baseline-actions','guard-cancel-lifetime','long-label-wrap']
passed_status='AUTOMATED_PLACEHOLDER_G04_PENDING_VISUAL_REVIEW' if placeholder else 'AUTOMATED_TAG_G02_PENDING_VISUAL_AND_SOURCE_JOIN'
passed_outcome='PLACEHOLDER_G04_BATCH_PENDING_ROOT_REVIEW' if placeholder else 'TAG_G02_BATCH_PENDING_ROOT_REVIEW'
admission=load_admission(__file__,args.cell,{'ios':[],'android':[] if boot_diagnostic else cohort_names})
class BootDiagnosticFinished(Exception):pass
prepared=json.loads(args.prepared.read_text());assert prepared['status']==('ROOT_REVIEWED_BOUND_PLACEHOLDER_G04' if placeholder else 'ROOT_REVIEWED_BOUND_TAG_G02'),'Root must bind current committed source and compiled observer before execution'
remote_name=prepared['nativeOutputName'];assert re.fullmatch(('placeholder-g04-native-' if placeholder else 'tag-g02-native-')+r'[A-Za-z0-9-]{1,80}',remote_name),'A fresh owned output name must be bound before SDK work'
sdk=pathlib.Path('/Users/gabrielbourget/.local/share/codon-native-lab/sdk');adb=str(sdk/'platform-tools/adb');serial='emulator-5568';now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
root=pathlib.Path(prepared['output']);assert not root.exists();inspector=pathlib.Path(prepared['inspector']);checker=pathlib.Path(prepared['hostChecker'])
assert re.fullmatch(r'[0-9a-f]{40}',prepared.get('expectedHEAD') or '') and subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True,timeout=5).strip()==prepared['expectedHEAD']
assert all(sha(path)==digest for path,digest in prepared['filesSHA256'].items());assert sha(checker)==prepared['expectedHostCheckerSHA256'];assert sha(inspector)==prepared['expectedInspectorSHA256']
product_identity=pathlib.Path(prepared['productIdentity']);assert sha(product_identity)==prepared['expectedProductIdentitySHA256'];proof=json.loads(product_identity.read_text());assert proof['status']=='PASS_BUILT_PRODUCT_IDENTITY_ONLY';assert sha(proof['apk'])==proof['apkSHA256']==prepared['expectedApkSHA256']
reuse_path=pathlib.Path(prepared['cachedSceneReuse']);assert sha(reuse_path)==prepared['expectedCachedSceneReuseSHA256'];reuse=json.loads(reuse_path.read_text());assert reuse['status']==('EXACT_PLACEHOLDER_RELEVANT_MODULES_WITH_EXPLICIT_RETAINED_HARNESS_SCOPE' if placeholder else 'EXACT_TAG_RELEVANT_MODULES_WITH_EXPLICIT_RETAINED_HARNESS_SCOPE')
for item in reuse['platforms']['android']['modules']:
 assert item['exactCurrentSource'] is True and sha(repo/item['currentPath'])==item['currentSourceSHA256'],'Current Tag/harness source differs from cached admitted product: '+item['currentPath']
assert subprocess.run(['pgrep','-x','launchd_sim'],capture_output=True,timeout=5).returncode==1,'Existing iOS guest blocks Android lifecycle'
selected_profiles=[] if boot_diagnostic else [profile];assert sha(prepared['previousTerminal'])==prepared['expectedPreviousTerminalSHA256'],'Previous closed cleanup receipt changed'
previous=json.loads(pathlib.Path(prepared['previousTerminal']).read_text());assert previous['serialAbsent'] and previous['portsFree'] and previous['emulatorGroupPresent'] is False and not previous['cleanupErrors'] and previous.get('profilePreferencesRestored') is True,'Previous attempt cleanup or preference restoration is unresolved';root.mkdir();work=start+(120 if boot_diagnostic else 1680);end=start+(240 if boot_diagnostic else 1800);cleanup_deadline=end-15;children=[];rows=[];emu=None;guest_verified=False;cleanup_errors=[];outcome='ADMITTED';cohorts=[{'profile':name,'status':'NOT_RUN'} for name in selected_profiles];env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1','ANDROID_AVD_HOME':'/Users/gabrielbourget/.local/share/codon-native-lab/avd','ANDROID_USER_HOME':'/Users/gabrielbourget/.local/share/codon-native-lab/android-user','ANDROID_HOME':str(sdk),'ANDROID_SDK_ROOT':str(sdk)}
write=lambda p,d:pathlib.Path(p).write_text(json.dumps(d,indent=2)+'\n')
write(root/'admission.json',{'startedUTC':now(),'workDeadlineUnix':work,'cleanupDeadlineUnix':end,'sourceHEAD':prepared['expectedHEAD'],'cell':args.cell,'apkSHA256':proof['apkSHA256'],'inspectorSHA256':sha(inspector),'hostCheckerSHA256':sha(checker),'sharedHelperSHA256':sha(fixture/'NativeAndroidTestSupport.py'),'serial':serial,'avd':'codon_components_recovery_20261013','scope':'Boot-only kernel trace; no install, app launch, instrumentation or component verdict' if boot_diagnostic else ('Three Placeholder style/provider/narrow native cohorts; actual glyph pixel/frame/ref/event assertions; independent PNG review and other-OS evidence remain required' if placeholder else 'Three risk-selected cohorts; no font/theme/rotation/typed-ID matrix; no decoder; explicit source join for unexposed ref/callback retirement'),'productIdentitySHA256':sha(product_identity),('cachedComponentReuseSHA256' if placeholder else 'cachedTagReuseSHA256'):sha(reuse_path),'nativeCellAdmission':admission,'terminalReserveSeconds':15,'bootDiagnosticOnly':boot_diagnostic})
print('ADMISSION '+(root/'admission.json').read_text(),flush=True)
stop=stop_owned_process
def run(name,argv,cap,clean=False):
 limit=cleanup_deadline if clean else work
 print('START '+json.dumps({'name':name,'argv':list(map(str,argv)),'atUTC':now()}),flush=True)
 try:
  row=recorded_command(argv,root/name,cap,limit,env=env)
 except BaseException:
  receipt=root/(name+'.json')
  if receipt.exists():
   row=json.loads(receipt.read_text());row['name']=name;rows.append(row);write(root/'steps.json',rows)
  raise
 row['name']=name;rows.append(row);write(root/'steps.json',rows)
 print('RESULT '+json.dumps(row),flush=True)
 assert row.get('ownedGroupGone') is True,'Owned command group unresolved: '+name
 if not clean: assert not row.get('timedOut') and row.get('status')!='HOST_TIMEOUT_GUEST_OUTCOME_UNCERTAIN','Uncertain SDK command outcome; cleanup only: '+name
 return row
def A(*args):
 values=list(map(str,args));return [adb,'-s',serial,'shell',shlex.join(values[1:])] if values and values[0]=='shell' else [adb,'-s',serial,*values]
def free_ports():
 for port in [5568,5569]:
  with socket.socket() as s:
   s.settimeout(.5)
   if s.connect_ex(('127.0.0.1',port))==0:return False
 return True
def inspect_install(label,bundle,expected):
 assert run('path-'+label,A('shell','pm','path',bundle),10)['exitCode']==0
 paths=(root/('path-'+label+'.stdout')).read_text().strip().splitlines();assert len(paths)==1 and paths[0].startswith('package:');remote=paths[0].split(':',1)[1]
 destination=root/('installed-'+label+'.apk');assert run('pull-'+label,A('pull',remote,str(destination)),45)['exitCode']==0;actual=sha(destination);write(root/('installed-'+label+'.json'),{'package':bundle,'actualPath':remote,'sha256':actual,'expectedSHA256':expected,'exact':actual==expected,'checkedUTC':now()});assert actual==expected
def work_cutoff(_signal,_frame):raise TimeoutError('Mechanical work cutoff;120s cleanup remains reserved')
def interrupted(signum,_frame):raise InterruptedError('Received signal '+str(signum))
signal.signal(signal.SIGALRM,work_cutoff);signal.signal(signal.SIGTERM,interrupted);signal.signal(signal.SIGINT,interrupted)
signal.setitimer(signal.ITIMER_REAL,max(.01,work-time.time()))
import re
component_started=False
profile_settings=None
profile_preferences_restored=False
profiles_attempted=[]
def original_profile_settings():
 values={}
 for key in ['accelerometer_rotation','user_rotation']:
  name='original-setting-'+key;assert run(name,A('shell','settings','get','system',key),10)['exitCode']==0
  raw=(root/(name+'.stdout')).read_text().strip();values[key]=None if raw=='null' else raw
  if raw!='null':
   assert re.fullmatch(r'[0-9]+(?:\.[0-9]+)?',raw),'Only actual numeric original profile preferences may be restored'
 write(root/'profile-settings-original.json',{'atUTC':now(),'values':values,'scope':'Owned qualification AVD only; restore exact original value or original absent setting in finally'})
 return values

def portrait_setup(label):
 for key,value in [('accelerometer_rotation','0'),('user_rotation','0')]:
  assert run(label+'-setup-'+key,A('shell','settings','put','system',key,value),10)['exitCode']==0

def restore_profile_preferences():
 global profile_preferences_restored
 result={'atUTC':now(),'original':profile_settings,'restored':{},'errors':[]}
 if profile_settings is None:
  result['scope']='No preferences mutated before originals were captured';profile_preferences_restored=True;write(root/'profile-preferences-restoration.json',result);return
 for key,value in profile_settings.items():
  try:
   argv=A('shell','settings','delete','system',key) if value is None else A('shell','settings','put','system',key,value)
   assert run('restore-setting-'+key,argv,8,True)['exitCode']==0
   assert run('verify-restored-setting-'+key,A('shell','settings','get','system',key),8,True)['exitCode']==0
   actual=(root/('verify-restored-setting-'+key+'.stdout')).read_text().strip();expected='null' if value is None else value
   result['restored'][key]={'expected':expected,'actual':actual,'equal':actual==expected};assert actual==expected,'Actual preference restoration differs: '+key
  except BaseException as error:result['errors'].append({'key':key,'error':repr(error)})
 profile_preferences_restored=not result['errors'] and set(result['restored'])==set(profile_settings) and all(row['equal'] for row in result['restored'].values())
 write(root/'profile-preferences-restoration.json',result)
 if not profile_preferences_restored:raise RuntimeError('Profile preference restoration incomplete; exact evidence preserved')

try:
 assert free_ports(),'AVD ports are in use'
 assert run('devices-before',[adb,'devices','-l'],10)['exitCode']==0
 assert not any(line.startswith('emulator-') for line in (root/'devices-before.stdout').read_text().splitlines()),'Another emulator exists; no competing guest'
 args=[str(sdk/'emulator/emulator'),'-avd','codon_components_recovery_20261013','-port','5568','-cores','2','-memory','2048','-no-window','-no-audio','-no-snapshot-load','-no-snapshot-save','-no-boot-anim','-gpu','software']
 if boot_diagnostic or prepared.get('captureBootKernel') is True:args.append('-show-kernel')
 log=(root/'emulator.log').open('wb');emu=subprocess.Popen(args,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);children.append(emu);write(root/'emulator-command.json',{'argv':args,'pid':emu.pid,'startedUTC':now()});print('EMULATOR_START '+now()+' pid='+str(emu.pid),flush=True)
 # Saved kernel evidence completed at185.592s, after the former180s cutoff.
 boot_until=min(time.time()+240,work)
 assert run('wait-for-device',A('wait-for-device'),90)['exitCode']==0
 if boot_diagnostic:raise BootDiagnosticFinished('ADB admission completed; stop boot diagnostic before any installation or component action')
 i=0
 while time.time()<boot_until:
  i+=1;name='boot-completed-'+str(i);item=run(name,A('shell','getprop','sys.boot_completed'),8)
  if item['exitCode']==0 and (root/(name+'.stdout')).read_text().strip()=='1':break
  time.sleep(1)
 else:raise RuntimeError('Boot readiness not established within240s')
 assert run('actual-avd',A('emu','avd','name'),8)['exitCode']==0;assert (root/'actual-avd.stdout').read_text().splitlines()[0]=='codon_components_recovery_20261013'
 for name,args,expected in [('api',['shell','getprop','ro.build.version.sdk'],'36'),('abi',['shell','getprop','ro.product.cpu.abi'],'x86_64')]:
  assert run(name,A(*args),8)['exitCode']==0;assert (root/(name+'.stdout')).read_text().strip()==expected
 assert run('actual-gles-version',A('shell','getprop','ro.opengles.version'),8)['exitCode']==0
 assert re.fullmatch(r'[0-9]+',(root/'actual-gles-version.stdout').read_text().strip()),'Record actual renderer capability before any component work'
 assert run('package-ready',A('shell','pm','path','android'),10)['exitCode']==0;guest_verified=True
 profile_settings=original_profile_settings();portrait_setup('initial')
 for name,args in [('size',['shell','wm','size']),('density',['shell','wm','density']),('font',['shell','settings','get','system','font_scale']),('locale',['shell','getprop','persist.sys.locale']),('window-before',['shell','dumpsys','window','windows'])]:assert run(name,A(*args),10)['exitCode']==0
 inspect_install('app','dev.codonui.showcase',proof['apkSHA256'])
 assert run('install-inspector',A('install','-r',str(inspector)),60)['exitCode']==0
 inspect_install('inspector','dev.codonui.lab.number',sha(inspector))
 live_argv=focused_logcat_command(adb,serial);live_file=(root/'live-logcat.log').open('wb');live=subprocess.Popen(live_argv,env=env,stdout=live_file,stderr=subprocess.STDOUT,start_new_session=True);children.append(live);write(root/'live-logcat-command.json',{'argv':live_argv,'pid':live.pid,'startedUTC':now()});assert live.poll() is None
 assert run('launch-app',A('shell','am','start','-W','-n','dev.codonui.showcase/.MainActivity'),30)['exitCode']==0
 assert 'Status: ok' in (root/'launch-app.stdout').read_text()
 assert run('launched-screen',A('exec-out','screencap','-p'),10)['exitCode']==0
 assert run('launched-errors',A('logcat','-d','-t','150','AndroidRuntime:E','ReactNativeJS:E','*:S'),10)['exitCode']==0
 # One instrumentation connection owns actual scene selection and native30s admission.
 # Launch status/screenshot are diagnostic only. No CLI UiAutomator or retry of an uncertain query.
 assert time.time()+600+60+60+30<work,'Insufficient safe native/pull/check budget after setup'
 component_started=True;profiles_attempted.append(profile);remote='/sdcard/Android/data/dev.codonui.lab.number/files/'+remote_name
 native_item=run('native-'+profile,A('shell','am','instrument','-w','-e','op',native_operation,'-e','outputDir',remote,'dev.codonui.lab.number/.Actions'),600)
 assert not native_item.get('timedOut') and native_item.get('status')!='HOST_TIMEOUT_GUEST_OUTCOME_UNCERTAIN','Native guest outcome uncertain; stop without another guest query'
 native_dir=root/('native-'+profile);pull_item=run('pull-native-'+profile,A('pull',remote+'/.',str(native_dir)),60);assert pull_item['exitCode']==0,'Missing actual native receipt/images'
 checked_item=run('host-'+profile,[sys.executable,str(checker),'--input',str(native_dir),'--out',str(root/('host-'+profile)),'--density',str(root/'density.stdout')],60)
 checked=json.loads((root/('host-'+profile)/'terminal.json').read_text());raw=json.loads((native_dir/'receipt.json').read_text())
 complete=native_item['exitCode']==0 and checked_item['exitCode']==0 and checked['status']==passed_status and raw.get('nativeActionSucceeded') is True
 cohorts=[{'profile':profile,'status':'AUTOMATED_PENDING_ROOT_VISUAL_AND_SOURCE_JOIN' if complete else 'FAILED_OR_INCOMPLETE','nativeExitCode':native_item['exitCode'],'hostExitCode':checked_item['exitCode'],'cohorts':checked.get('cohorts',[]),'remaining':checked.get('remaining',[])}];write(root/'profile-verdicts.json',cohorts)
 outcome=passed_outcome if complete else profile+'_BATCH_FAILED_OR_INCOMPLETE'

except BootDiagnosticFinished as diagnostic:
 outcome='BOOT_DIAGNOSTIC_ADB_READY';print(str(diagnostic),flush=True)
except BaseException as error:
 if outcome=='ADMITTED':outcome='STOP_'+type(error).__name__
 write(root/'exception.json',{'atUTC':now(),'type':type(error).__name__,'message':str(error)});print('STOP '+repr(error),flush=True)
finally:
 signal.setitimer(signal.ITIMER_REAL,0)
 serial_absent=False;ports_free=False;group_present=True
 class CleanupDeadline(BaseException):pass
 def cleanup_cutoff(_signal,_frame):raise CleanupDeadline('Mechanical cleanup cutoff;15s terminal reserve remains')
 signal.signal(signal.SIGALRM,cleanup_cutoff)
 signal.signal(signal.SIGTERM,signal.SIG_IGN);signal.signal(signal.SIGINT,signal.SIG_IGN)
 signal.setitimer(signal.ITIMER_REAL,max(.01,cleanup_deadline-time.time()))
 try:
  print('CLEANUP_START '+now(),flush=True)
  for p in reversed(children):
   if p is not emu:
    try:assert stop(p),'Owned process group did not stop'
    except Exception as e:cleanup_errors.append({'phase':'client-stop','error':repr(e)})
  if guest_verified:
   for label,bundle in [('app','dev.codonui.showcase'),('inspector','dev.codonui.lab.number')]:
    try:run('stop-'+label,A('shell','am','force-stop',bundle),8,True)
    except Exception as e:cleanup_errors.append({'phase':'stop-'+label,'error':repr(e)})
   try:restore_profile_preferences()
   except BaseException as e:cleanup_errors.append({'phase':'profile-preference-restoration','error':repr(e)})
   try:run('kill-emulator',A('emu','kill'),10,True)
   except Exception as e:cleanup_errors.append({'phase':'emu-kill','error':repr(e)})
  if emu is not None:
   try:
    try:emu.wait(timeout=15)
    except subprocess.TimeoutExpired:stop(emu)
   except Exception as e:cleanup_errors.append({'phase':'emulator-process','error':repr(e)})
  settle_until=min(time.time()+20,cleanup_deadline-8);index=0
  while time.time()<settle_until:
   try:
    index+=1;name='devices-after-'+str(index);after=run(name,[adb,'devices','-l'],5,True);serial_absent=after['exitCode']==0 and serial not in (root/(name+'.stdout')).read_text();ports_free=free_ports()
    group_present=False
    if emu is not None:
     group_present=owned_group_present(emu)
    if serial_absent and ports_free and not group_present:break
    time.sleep(.5)
   except Exception as e:cleanup_errors.append({'phase':'verify','error':repr(e)});break
 except BaseException as error:
  cleanup_errors.append({'phase':'cleanup-deadline-or-interruption','error':repr(error)})
 finally:
  signal.setitimer(signal.ITIMER_REAL,0)
  summary={'finishedUTC':now(),'elapsedSeconds':time.time()-start,'withinBoundary':time.time()<end,'workDeadlineUnix':work,'cleanupDeadlineUnix':cleanup_deadline,'hardDeadlineUnix':end,'terminalReserveSeconds':15,'outcome':outcome,'cohorts':cohorts,'emulatorExitCode':emu.poll() if emu else None,'emulatorGroupPresent':group_present,'serialAbsent':serial_absent,'portsFree':ports_free,'cleanupErrors':cleanup_errors,'ledgerChanged':False,'profilesAttempted':profiles_attempted,'profilePreferencesRestored':profile_preferences_restored if guest_verified else profile_settings is None};write(root/'terminal.json',summary);print('TERMINAL '+json.dumps(summary),flush=True)

raise SystemExit(0 if outcome in [passed_outcome,'BOOT_DIAGNOSTIC_ADB_READY'] and (profile_preferences_restored if guest_verified else profile_settings is None) and serial_absent and ports_free and not group_present and not cleanup_errors and time.time()<end else 1)
