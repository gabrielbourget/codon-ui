"""Maintained Indicator G04 lifecycle driver; argument1 is the verified prepared packet."""
import pathlib,json,subprocess,datetime,time,os,signal,hashlib,shutil,sys,re
prepared=pathlib.Path(sys.argv[1]).resolve();batch='P01';selection=json.loads((prepared/'profile-batches.json').read_text())[batch];root=prepared/'installed-P01-attempt-1';device='2244051E-D143-40F5-BEF1-7B4CCFC355A1';cli='/Applications/Xcode.app/Contents/Developer/usr/bin/simctl';now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from NativeCellVerification import load_admission
cellPreflight=load_admission(__file__,'CAT.indicator.G04',{'ios':selection['selectedMethods'],'android':[]})
sourceProofPath=prepared/'prepared/production-source-proof.json';sourceProofSHA=hashlib.sha256(sourceProofPath.read_bytes()).hexdigest();sourceProof=json.loads(sourceProofPath.read_text());assert sourceProof['currentNativeRuntimeFilesVerified']==704 and sourceProof['currentFixtureFilesVerified']==9 and sourceProof['drift']==[]
sourceRepo=pathlib.Path(__file__).resolve().parents[4]
for relative,digest in sourceProof['sourceSHA256'].items():assert hashlib.sha256((sourceRepo/relative).read_bytes()).hexdigest()==digest,relative
bindings=json.loads((prepared/'execution-bindings.json').read_text());assert bindings['status']=='ROOT_BOUND_ACTUAL_OBSERVER_BUILD','Actual compiled observer binding remains unbound'
assert hashlib.sha256((prepared/'observer-identity.json').read_bytes()).hexdigest()==bindings['observerIdentitySHA256']
assert hashlib.sha256((prepared/'observer-build-request.json').read_bytes()).hexdigest()==bindings['observerBuildRequestSHA256']
assert sourceProof['sourceRevision']==bindings['witnessProductSourceRevision']=='199492e878712c5fe22ec07ad758b901fdd8245f'
assert len([k for k in sourceProof['sourceSHA256'] if k.startswith('packages/')])==704 and len([k for k in sourceProof['sourceSHA256'] if k.startswith('apps/')])==9
assert selection['selectedMethods']==['IndicatorG04TrialTests/testI10ShapeGeometry','IndicatorG04TrialTests/testI11CallbackFinalStyle']
applicationInstallRequested=False
preflightStarted=time.time();preflightWork=preflightStarted+cellPreflight['attempt']['maximumSeconds']-cellPreflight['attempt']['cleanupReserveSeconds'];assert not root.exists();assert not subprocess.check_output(['git','status','--porcelain'],text=True,timeout=max(.01,preflightWork-time.time()-8)).strip();assert subprocess.run(['pgrep','-x','launchd_sim'],capture_output=True,timeout=max(.01,preflightWork-time.time()-8)).returncode==1
root.mkdir();start=preflightStarted;end=start+cellPreflight['attempt']['maximumSeconds'];work=end-cellPreflight['attempt']['cleanupReserveSeconds'];rows=[];children=[];cleanupErrors=[];outcome='ADMITTED';selectedMethods=[];cleaning=False;cleanupDeadline=end
admission={'cellPreflight':cellPreflight,'startedUTC':now(),'startedEpochSeconds':start,'workDeadlineEpochSeconds':work,'deadlineEpochSeconds':end,'maximumSeconds':cellPreflight['attempt']['maximumSeconds'],'cleanupReserveSeconds':cellPreflight['attempt']['cleanupReserveSeconds'],'device':device,'cell':'CAT.indicator.G04','profileBatch':batch,'executionBinding':bindings,'executionHEADScope':'Actual coordinator HEAD may advance through docs-only commits; all current704+9 product input hashes are checked before execution; witness producer stays199','requestedMethods':selection['selectedMethods'],'currentSourceProofPath':str(sourceProofPath),'currentSourceProofSHA256':sourceProofSHA,'witnessProductSourceRevision':sourceProof['sourceRevision'],'fullCurrent704ByteIdentityClaim':True,'sourceHEAD':subprocess.check_output(['git','rev-parse','HEAD'],text=True,timeout=max(.01,preflightWork-time.time()-8)).strip(),'appInstallPolicy':'Reuse verified installed product; standard XCTest scene selection; no install retry','offlineDiagnosisPath':'/tmp/codon-line-segment-g04-ios-install-diagnosis-20261105/evidence.json','offlineDiagnosisSHA256':'e58b00518b71145deb128e3cf01210912dc0c8b405477893fbcd9b4ed7007d18','scope':'Matched current Indicator G04 JS app and standard observer; finite selected profile batch sharing the admitted overall work deadline; actual native layout/color/window/ref/end observations; boot/install/identity/UI setup/test/cleanup, no build','otherOwnedOperation':'Root schedules sequential guests; no Android guest is admitted concurrently'}
(root/'admission.json').write_text(json.dumps(admission,indent=2));print('ADMISSION '+json.dumps(admission),flush=True)
for name in ['observer-identity.json','product-identity.json']:shutil.copy2(prepared/name,root/name)
import sys
sys.dont_write_bytecode=True
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
helper=pathlib.Path(sys.path[0])/'NativeAndroidTestSupport.py'
expected=json.loads((prepared/'preparation-inputs.json').read_text())['repositoryFilesSHA256']
assert hashlib.sha256(helper.read_bytes()).hexdigest()==expected['planning/component-library/fixtures/native-base-controls/NativeAndroidTestSupport.py']
from NativeAndroidTestSupport import stop_owned_process
def stop(process,name):
 try:
  gone=stop_owned_process(process)
  if not gone:cleanupErrors.append({'name':name,'pid':process.pid,'state':'Owned process group remains after TERM/KILL'})
  return gone
 except BaseException as error:
  cleanupErrors.append({'name':name,'pid':process.pid,'error':repr(error)})
  return False
def run(name,args,*,clean=False):
 t=time.time();deadline=cleanupDeadline-8 if clean else work-8;assert deadline>t;row={'name':name,'argv':args,'startedUTC':now()};print('START '+json.dumps(row),flush=True);p=None
 try:
  with (root/(name+'.log')).open('xb') as log:
   p=subprocess.Popen(args,env={**os.environ,'DEVELOPER_DIR':'/Applications/Xcode.app/Contents/Developer'},stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);children.append((p,name));row.update(pid=p.pid,pgid=p.pid,ownerPID=os.getpid())
   while p.poll() is None:
    if time.time()>=deadline:row['timedOut']=True;stop(p,name);break
    time.sleep(.2)
 finally:
  signal.setitimer(signal.ITIMER_REAL,0)
  row['ownedGroupGone']=stop(p,name) if p is not None else True
  row.update(exitCode=p.poll() if p is not None else None,endedUTC=now(),seconds=time.time()-t);rows.append(row);(root/'steps.json').write_text(json.dumps(rows,indent=2));print('RESULT '+json.dumps(row),flush=True)
  if cleaning and time.time()<cleanupDeadline-8:signal.setitimer(signal.ITIMER_REAL,max(.01,cleanupDeadline-time.time()-8))
  elif not clean and time.time()<work:signal.setitimer(signal.ITIMER_REAL,max(.01,work-time.time()))
 assert row['ownedGroupGone'],row
 return row

def exact_installed(label,bundle,identity):
 item=run('registered-'+label,[cli,'get_app_container',device,bundle,'app']);assert item['exitCode']==0
 raw=(root/('registered-'+label+'.log')).read_text().strip()
 assert raw and '\n' not in raw,'Registration response must be one actual absolute container path'
 path=pathlib.Path(raw)
 containers=pathlib.Path.home()/'Library/Developer/CoreSimulator/Devices'/device/'data/Containers/Bundle/Application'
 assert path.is_absolute() and path.is_dir() and path.resolve().is_relative_to(containers.resolve()),'Registered path is not an actual selected-device app container'
 expected=json.loads((root/identity).read_text())
 if label=='observer':assert len(expected['filesSHA256'])==37 and expected['manifestSHA256']==bindings['expectedObserverManifestSHA256']
 if label=='app':
  assert len(expected['filesSHA256'])==59 and expected['manifestSHA256']=='159a94427078deb9cbe31310a5636b9d100a10c77dc8e828e6b3948135e87e57'
 actual={str(p.relative_to(path)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(path.rglob('*')) if p.is_file()}
 differences=sorted(k for k in set(actual)|set(expected['filesSHA256']) if actual.get(k)!=expected['filesSHA256'].get(k))
 receipt={'checkedUTC':now(),'path':str(path),'files':len(actual),'manifestSHA256':hashlib.sha256(json.dumps(actual,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'expectedManifestSHA256':expected['manifestSHA256'],'differences':differences,'lookupCommand':item['argv'],'lookupExitCode':item['exitCode'],'applicationInstallRequestedByController':applicationInstallRequested}
 (root/('installed-'+label+'.json')).write_text(json.dumps(receipt,indent=2))
 assert not differences and len(actual)==len(expected['filesSHA256']),'Registered container does not exactly match; stop without reinstall fallback'

def reconcile_selected_results(native_summary, raw_log, selected_methods):
 expected=[name.rsplit('/',1)[-1] for name in selected_methods]
 records=[{'method':name,'result':verdict,'durationSeconds':float(seconds)} for name,verdict,seconds in re.findall(r"Test Case '-\[[^ ]+ (testI\w+)\]' (passed|failed|skipped) \(([0-9.]+) seconds?\)\.",raw_log)]
 diagnostics=[line for line in raw_log.splitlines() if re.search(r'exceeded execution time allowance|timed out|Test (?:Case|Suite).*timeout',line,re.I)]
 summary_text=json.dumps(native_summary,sort_keys=True)
 summary_timeout=bool(re.search(r'exceeded execution time allowance|timed out|executionTimeAllowanceExceeded|testTimeout',summary_text,re.I))
 failures=[]
 if diagnostics or summary_timeout:failures.append('Native timeout event remains disqualifying despite any RawPassed label')
 if len(expected)!=len(set(expected)) or sorted(r['method'] for r in records)!=sorted(expected):failures.append('Expected selected methods must each have exactly one terminal raw record')
 if any(r['result']!='passed' or not (0 < r['durationSeconds'] <= 1800) for r in records):failures.append('Each selected method must pass within the overall attempt')
 if not (native_summary.get('result')=='Passed' and native_summary.get('totalTestCount')==len(expected)==native_summary.get('passedTests') and native_summary.get('failedTests')==0 and native_summary.get('skippedTests')==0 and native_summary.get('expectedFailures',0)==0 and not native_summary.get('testFailures')):failures.append('Structured SDK selected-test summary must pass with no failed/skipped/expected failures')
 return {'schemaVersion':1,'status':'PASS' if not failures else 'FAIL','selectedMethods':selected_methods,'methodAllowanceSeconds':None,'rawMethodResults':records,'timeoutDiagnostics':diagnostics,'structuredTimeoutEvent':summary_timeout,'nativeSummary':native_summary,'failureReasons':failures}

def tests(label,methods):
 assert time.time()<work-8
 case=root/label;case.mkdir();args=['/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild','test-without-building','-jobs','1','-xctestrun',str(prepared/('Indicator-'+batch+'-bound.xctestrun')),'-destination','platform=iOS Simulator,id='+device,'-destination-timeout',str(max(1,int(work-time.time()-8))),'-parallel-testing-enabled','NO','-maximum-concurrent-test-simulator-destinations','1','-test-timeouts-enabled','NO']+['-only-testing:CodonNativeComponents/'+m for m in methods]+['-resultBundlePath',str(case/'Indicator.xcresult')];selectedMethods.extend(methods);(case/'command.json').write_text(json.dumps({'argv':args,'startedUTC':now(),'methods':methods,'workDeadlineEpochSeconds':work},indent=2));return run(label,args)
def work_cutoff(_signal,_frame):raise TimeoutError('Mechanical1680s work cutoff;120s cleanup remains reserved')
def interrupted(signum,_frame):raise InterruptedError('Received signal '+str(signum))
signal.signal(signal.SIGALRM,work_cutoff);signal.signal(signal.SIGTERM,interrupted);signal.signal(signal.SIGINT,interrupted)
signal.setitimer(signal.ITIMER_REAL,max(.01,work-time.time()))
try:
 appIdentity=json.loads((root/'product-identity.json').read_text());observerIdentity=json.loads((root/'observer-identity.json').read_text())
 assert appIdentity['indicatorFixtureSHA256']=='d21361d591953b8cb25c4369b895ee715ae0e56fd70d23ebe086595872199cdb' and appIdentity['displaySceneSHA256']=='3f4e930ad46e86d82f28a491fe7c0675a2ffd5d31d916c10066dc516aa2b67ed'
 assert appIdentity['manifestSHA256']=='159a94427078deb9cbe31310a5636b9d100a10c77dc8e828e6b3948135e87e57' and len(appIdentity['filesSHA256'])==59
 assert observerIdentity['manifestSHA256']==bindings['expectedObserverManifestSHA256'] and observerIdentity['observerSourceSHA256']==bindings['sourceSHA256'] and len(observerIdentity['filesSHA256'])==37
 assert observerIdentity['witnessProductSourceRevision']==appIdentity['sourceRevision']==bindings['witnessProductSourceRevision']
 assert run('boot',[cli,'boot',device])['exitCode']==0
 assert run('boot-readiness',[cli,'bootstatus',device,'-b'])['exitCode']==0
 pending=pathlib.Path.home()/'Library/Developer/CoreSimulator/Devices'/device/'data/Containers/Shared/SystemGroup/systemgroup.com.apple.installcoordinationd/Library/InstallCoordination/PendingWork.plist'
 assert not pending.exists(),'Pending installer transaction; no install admitted'
 # One current-product install after confirmed boot readiness; no unchanged fallback.
 # Reuse the exact installed311e16 product after the closed attempt; no reinstall.
 exact_installed('app','dev.codonui.showcase','product-identity.json')
 # Ordinary OS launch, bounded separately from test assertions; no relaunch rescue.
 launch=run('launch-app',[cli,'launch',device,'dev.codonui.showcase'])
 assert launch['exitCode']==0,'Launch RPC failed/timed out; no automatic retry'
 # Standard XCTest setup selects and verifies the actual Display scene; no manual handoff.
 binding=json.loads((prepared/('xctestrun-binding-'+batch+'.json')).read_text());assert binding['sha256']==hashlib.sha256((prepared/('Indicator-'+batch+'-bound.xctestrun')).read_bytes()).hexdigest()
 assert binding['appManifestSHA256']==appIdentity['manifestSHA256'] and binding['observerManifestSHA256']==observerIdentity['manifestSHA256']
 assert binding['selectedMethods']==selection['selectedMethods'] and binding['batch']==batch
 shutil.copy2(prepared/('xctestrun-binding-'+batch+'.json'),root/'xctestrun-binding.json')
 result=tests('indicator',selection['selectedMethods']);outcome='INDICATOR_'+batch+'_EXIT_'+str(result['exitCode'])
 exact_installed('observer','dev.codonui.lab.components.xctrunner','observer-identity.json')
 if result['exitCode']==0:
  summaryStep=run('test-result-summary',['/Applications/Xcode.app/Contents/Developer/usr/bin/xcresulttool','get','test-results','summary','--path',str(root/'indicator/Indicator.xcresult')]);assert summaryStep['exitCode']==0
  nativeSummary=json.loads((root/'test-result-summary.log').read_text());reconciliation=reconcile_selected_results(nativeSummary,(root/'indicator.log').read_text(),selectedMethods);(root/'selected-results-reconciliation.json').write_text(json.dumps(reconciliation,indent=2));assert reconciliation['status']=='PASS',reconciliation
  outcome='INDICATOR_SELECTED_PROFILE_BATCH_PASS_PENDING_RECONCILIATION'

except BaseException as error:
 outcome='STOP_'+type(error).__name__
 (root/'exception.json').write_text(json.dumps({'type':type(error).__name__,'message':str(error),'atUTC':now()},indent=2));print('STOP '+repr(error),flush=True)
finally:
 cleaning=True;cleanupStarted=time.time();cleanupDeadline=min(end,cleanupStarted+cellPreflight['attempt']['cleanupReserveSeconds']);signal.setitimer(signal.ITIMER_REAL,0);print('CLEANUP_START '+now(),flush=True)
 selected=[];holders=[];state='UNVERIFIED';shutdown={}
 def cleanup_cutoff(_signal,_frame):raise TimeoutError('Mechanical cleanup cutoff; terminal receipt remains reserved')
 signal.signal(signal.SIGALRM,cleanup_cutoff)
 signal.setitimer(signal.ITIMER_REAL,max(.01,cleanupDeadline-time.time()-8))
 try:
  for p,name in reversed(children):stop(p,name)
  for label,bundle in [('app','dev.codonui.showcase'),('runner','dev.codonui.lab.components.xctrunner')]:
   try:run('terminate-'+label,[cli,'terminate',device,bundle],clean=True)
   except BaseException as error:cleanupErrors.append({'phase':'terminate-'+label,'error':str(error)})
  try:shutdown=run('shutdown',[cli,'shutdown',device],clean=True)
  except BaseException as error:shutdown={};cleanupErrors.append({'phase':'shutdown','error':str(error)})
  selected=[];holders=[];state='UNVERIFIED'
  try:
   proc=run('processes-after',['ps','-axo','pid,ppid,command'],clean=True);text=(root/'processes-after.log').read_text();selected=[line for line in text.splitlines() if device in line and any(x in line for x in ['launchd_sim ','/CodonLibraryAcceptance.app/','/CodonNativeComponents-Runner.app/'])];orphans=[line.split()[0] for line in text.splitlines() if '/RuntimeRoot/' in line and len(line.split())>1 and line.split()[1]=='1'];assert proc['exitCode']==0
   if orphans:
    item=run('orphan-open-files',['/usr/sbin/lsof','-nP','-Fpcn','-p',','.join(orphans)],clean=True);pid=None;assert item['exitCode'] in [0,1]
    for line in (root/'orphan-open-files.log').read_text().splitlines():
     if line.startswith('p'):pid=line[1:]
     elif line.startswith('n') and device in line:holders.append({'pid':pid,'path':line[1:]})
   item=run('device-state',['plutil','-extract','state','raw',str(pathlib.Path.home()/'Library/Developer/CoreSimulator/Devices'/device/'device.plist')],clean=True);state=(root/'device-state.log').read_text().strip()
  except BaseException as error:cleanupErrors.append({'phase':'verification','error':str(error)})
 except BaseException as error:cleanupErrors.append({'phase':'cleanup-cutoff','error':repr(error)})
 finally:
  signal.setitimer(signal.ITIMER_REAL,0)
  summary={'finishedUTC':now(),'elapsedSeconds':time.time()-start,'withinAttemptBoundary':time.time()<end,'outcome':outcome,'selectedMethods':selectedMethods,'selectedDeviceState':state,'selectedGuestProcesses':selected,'selectedGuestOrphanFileHolders':holders,'cleanupErrors':cleanupErrors,'shutdownExitCode':shutdown.get('exitCode'),'ledgerChanged':False,'cleanupSeconds':time.time()-cleanupStarted,'cleanupWithin120Seconds':time.time()-cleanupStarted<120,'currentSourceProofSHA256':sourceProofSHA,'witnessProductSourceRevision':sourceProof['sourceRevision'],'applicationInstallRequestedByController':applicationInstallRequested,'applicationReuseRegistrationGate':'Reuse only: live get_app_container and exact59 current files before launch'};(root/'terminal-summary.json').write_text(json.dumps(summary,indent=2));print('SUMMARY '+json.dumps(summary),flush=True)

from NativeCellVerification import driver_exit_code
sdk_row=next((row for row in rows if row.get('name')=='indicator'),{})
coverage_complete=outcome=='INDICATOR_SELECTED_PROFILE_BATCH_PASS_PENDING_RECONCILIATION' and not sdk_row.get('timedOut',False)
cleanup_complete=summary.get('selectedDeviceState')=='1' and summary.get('selectedGuestProcesses')==[] and summary.get('selectedGuestOrphanFileHolders')==[] and summary.get('cleanupErrors')==[] and summary.get('shutdownExitCode')==0 and summary.get('withinAttemptBoundary') is True and summary.get('cleanupWithin120Seconds') is True
raise SystemExit(driver_exit_code(sdk_row.get('exitCode'),coverage_complete,cleanup_complete))
