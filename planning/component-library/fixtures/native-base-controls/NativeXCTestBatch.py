"""Finite packet-bound XCTest lifecycle. No preference mutation or installation fallback."""
import pathlib,json,subprocess,datetime,time,os,signal,hashlib,shutil,sys,re,plistlib
sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()

def read_bound(item):
 p=pathlib.Path(item['path']).resolve()
 assert re.fullmatch(r'[0-9a-f]{64}',item['sha256']) and p.is_file() and sha(p)==item['sha256'],'Missing/changed/unbound input: '+str(p)
 assert 'codon-native-matrix' not in str(p),'Sealed cache is data, never an executable packet input'
 return p

def validate_selection(selected,compiled):
 assert selected and len(selected)==len(set(selected)) and len(compiled)==len(set(compiled))
 assert all(re.fullmatch(r'[A-Za-z_]\w*/test\w+',m) and m in compiled for m in selected),'Changed/invalid selected methods'
 return True

def validate_packet(packet):
 assert packet['schemaVersion']==1 and re.fullmatch(r'CAT\.[a-z0-9-]+\.G0[1-9]',packet['cell'])
 validate_selection(packet['selectedMethods'],packet['compiledMethods'])
 assert packet['methodMaximumSeconds']==180
 assert packet['preferencePolicy']=='unchanged-no-preference-commands'
 assert packet['sourceScope'] and packet['retainedHarnessScope']['claim']
 read_bound(packet['retainedHarnessScope'])
 assert packet['relevantSourceBindings']
 for item in packet['relevantSourceBindings']:read_bound(item)
 for item in packet['supportBindings']:read_bound(item)
 app=json.loads(read_bound(packet['appIdentity']).read_text())
 assert len(app['filesSHA256'])==packet['appFileCount']
 return app

def verify_identity(identity,count):
 p=pathlib.Path(identity['product'])
 actual={str(f.relative_to(p)):sha(f) for f in sorted(p.rglob('*')) if f.is_file()}
 assert len(actual)==count and actual==identity['filesSHA256']
 assert hashlib.sha256(json.dumps(actual,sort_keys=True,separators=(',',':')).encode()).hexdigest()==identity['manifestSHA256']
 return True

def reconcile_selected_results(native_summary,raw_log,selected_methods):
 expected=sorted(selected_methods)
 records=[{'method':owner.rsplit('.',1)[-1]+'/'+name,'result':verdict,'durationSeconds':float(seconds)} for owner,name,verdict,seconds in re.findall(r"Test Case '-\[([^ ]+) (test\w+)\]' (passed|failed|skipped) \(([0-9.]+) seconds?\)\.",raw_log)]
 diagnostics=[line for line in raw_log.splitlines() if re.search(r'exceeded execution time allowance|timed out|Test (?:Case|Suite).*timeout',line,re.I)]
 summary_timeout=bool(re.search(r'exceeded execution time allowance|timed out|executionTimeAllowanceExceeded|testTimeout',json.dumps(native_summary),re.I))
 failures=[]
 if diagnostics or summary_timeout:failures.append('Native timeout remains failure')
 if len(expected)!=len(set(expected)) or sorted(r['method'] for r in records)!=expected:failures.append('Each selected class/method requires exactly one terminal raw record')
 if any(r['result']!='passed' or not 0<r['durationSeconds']<=180 for r in records):failures.append('Selected method failed/skipped/over180seconds')
 if not(native_summary.get('result')=='Passed' and native_summary.get('totalTestCount')==len(expected)==native_summary.get('passedTests') and native_summary.get('failedTests')==0 and native_summary.get('skippedTests')==0 and native_summary.get('expectedFailures',0)==0 and not native_summary.get('testFailures')):failures.append('Structured selected-test result is not clean PASS')
 return {'status':'PASS' if not failures else 'FAIL','selectedMethods':selected_methods,'rawMethodResults':records,'timeoutDiagnostics':diagnostics,'structuredTimeoutEvent':summary_timeout,'nativeSummary':native_summary,'failureReasons':failures}

def destination_artifacts_enabled(packet):
 enabled=packet.get('useDestinationArtifacts',False)
 assert type(enabled) is bool,'useDestinationArtifacts must be an actual boolean'
 return enabled

def explicit_observer_install_enabled(packet):
 enabled=packet.get('installPreparedObserver',False)
 assert type(enabled) is bool,'installPreparedObserver must be an actual boolean'
 assert not enabled or destination_artifacts_enabled(packet),'Explicit observer installation requires destination mode'
 return enabled

def validate_destination_artifacts(target,packet):
 if destination_artifacts_enabled(packet):
  assert target.get('UseDestinationArtifacts') is True,'Destination artifact mode missing from bound xctestrun'
  assert target.get('TestHostBundleIdentifier')==packet['observerBundleID'],'Wrong destination observer bundle'
  assert target.get('TestBundleDestinationRelativePath')=='__TESTHOST__/PlugIns/CodonNativeComponents.xctest','Wrong destination test bundle'
  assert target.get('UITargetAppBundleIdentifier')==packet['appBundleID'],'Wrong destination UI app bundle'
  assert not any(key in target for key in ['TestHostPath','TestBundlePath','UITargetAppPath']),'Prepared artifact paths forbidden in destination mode'
 else:
  assert target.get('UseDestinationArtifacts',False) is False,'Destination artifacts require explicit packet opt-in'
 return True

def apply_destination_artifacts(target,packet):
 explicit_observer_install_enabled(packet)
 if destination_artifacts_enabled(packet):
  target.update(UseDestinationArtifacts=True,TestHostBundleIdentifier=packet['observerBundleID'],TestBundleDestinationRelativePath='__TESTHOST__/PlugIns/CodonNativeComponents.xctest',UITargetAppBundleIdentifier=packet['appBundleID'])
  for key in ['TestHostPath','TestBundlePath','UITargetAppPath']:target.pop(key,None)
 validate_destination_artifacts(target,packet)
 return target

def bind_xctestrun(packet_path):
 packet=json.loads(packet_path.read_text());app=validate_packet(packet)
 observer=json.loads(read_bound(packet['observerIdentity']).read_text());request=json.loads(read_bound(packet['buildRequest']).read_text());result=json.loads(read_bound(packet['buildResult']).read_text())
 assert result['exitCode']==0 and result['groupGone'] is True and result['withinBoundary'] is True and result['failure'] is None and result['cleanupError'] is None and result['timedOut'] is False
 assert request['selectedMethods']==packet['selectedMethods'] and request['compiledMethods']==packet['compiledMethods']
 assert request['sourceSHA256']==observer['observerSourceSHA256']==packet['observerSourceSHA256']
 verify_identity(app,packet['appFileCount']);verify_identity(observer,packet['observerFileCount'])
 products=pathlib.Path(packet['buildRoot'])/'observer-derived-data/Build/Products';templates=list(products.glob('*.xctestrun'));assert len(templates)==1
 def resolve(value):
  if isinstance(value,str):return value.replace('__TESTROOT__',str(products))
  if isinstance(value,list):return [resolve(v) for v in value]
  if isinstance(value,dict):return {k:resolve(v) for k,v in value.items()}
  return value
 data=resolve(plistlib.loads(templates[0].read_bytes()));target=data['CodonNativeComponents'];assert not target.get('SkipTestIdentifiers')
 apply_destination_artifacts(target,packet)
 target.update(OnlyTestIdentifiers=packet['selectedMethods'],UserAttachmentLifetime='keepAlways',SystemAttachmentLifetime='keepAlways',TestLanguage=packet['testLanguage'])
 environment={k:(observer['manifestSHA256'] if v=='__OBSERVER_MANIFEST_SHA256__' else v) for k,v in packet['testEnvironmentVariables'].items()}
 assert all(re.fullmatch(r'[0-9a-f]{64}',v) for v in environment.values())
 for field in ['EnvironmentVariables','TestingEnvironmentVariables']:target.setdefault(field,{}).update(environment)
 output=pathlib.Path(packet['xctestrun']['path']);receipt_path=pathlib.Path(packet['xctestrunBinding']['path']);assert not output.exists() and not receipt_path.exists(),'Never overwrite an uncertain bound invocation'
 output.write_bytes(plistlib.dumps(data));receipt={'xctestrun':str(output),'sha256':sha(output),'selectedMethods':packet['selectedMethods'],'environment':environment,'testLanguage':packet['testLanguage'],'appManifestSHA256':app['manifestSHA256'],'observerManifestSHA256':observer['manifestSHA256'],'useDestinationArtifacts':destination_artifacts_enabled(packet),'installPreparedObserver':explicit_observer_install_enabled(packet),'sdkCommands':0,'guestCommands':0}
 receipt_path.write_text(json.dumps(receipt,indent=2)+'\n');packet['xctestrun']['sha256']=sha(output);packet['xctestrunBinding']['sha256']=sha(receipt_path);packet_path.write_text(json.dumps(packet,indent=2)+'\n');print(json.dumps(receipt))

def main():
 packetPath=pathlib.Path(sys.argv[1]).resolve();packet=json.loads(packetPath.read_text());app=validate_packet(packet)
 sys.dont_write_bytecode=True;sys.path.insert(0,packet['supportRoot'])
 from NativeCellVerification import load_admission
 cellPreflight=load_admission(__file__,packet['cell'],{'ios':packet['selectedMethods'],'android':[]})
 observer=json.loads(read_bound(packet['observerIdentity']).read_text());request=json.loads(read_bound(packet['buildRequest']).read_text());build=json.loads(read_bound(packet['buildResult']).read_text())
 assert build['exitCode']==0 and build['groupGone'] is True and build['withinBoundary'] is True and not build['timedOut'] and build['failure'] is None and build['cleanupError'] is None
 assert request['selectedMethods']==packet['selectedMethods'] and request['compiledMethods']==packet['compiledMethods']
 assert request['sourceSHA256']==observer['observerSourceSHA256']==packet['observerSourceSHA256']
 verify_identity(app,packet['appFileCount']);verify_identity(observer,packet['observerFileCount'])
 xrun=plistlib.loads(read_bound(packet['xctestrun']).read_bytes());assert xrun['CodonNativeComponents']['OnlyTestIdentifiers']==packet['selectedMethods']
 validate_destination_artifacts(xrun['CodonNativeComponents'],packet)
 binding=json.loads(read_bound(packet['xctestrunBinding']).read_text());assert binding['selectedMethods']==packet['selectedMethods'] and binding['sha256']==packet['xctestrun']['sha256'] and binding['appManifestSHA256']==app['manifestSHA256'] and binding['observerManifestSHA256']==observer['manifestSHA256']
 assert binding.get('useDestinationArtifacts',False) is destination_artifacts_enabled(packet),'Execution packet/binding mode mismatch'
 assert binding.get('installPreparedObserver',False) is explicit_observer_install_enabled(packet),'Execution packet/binding install opt-in mismatch'
 prepared=packetPath.parent;selection={'selectedMethods':packet['selectedMethods']};root=pathlib.Path(packet['attemptRoot']);device=packet['device'];cli='/Applications/Xcode.app/Contents/Developer/usr/bin/simctl';now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
 bindings={'expectedProductManifestSHA256':app['manifestSHA256'],'expectedObserverManifestSHA256':observer['manifestSHA256']}
 applicationInstallRequested=False
 preflightStarted=time.time();preflightWork=preflightStarted+cellPreflight['attempt']['maximumSeconds']-cellPreflight['attempt']['cleanupReserveSeconds'];assert not root.exists();workspaceStatus=subprocess.check_output(['git','status','--porcelain'],cwd=packet['repoRoot'],text=True,timeout=max(.01,preflightWork-time.time()-8));assert subprocess.run(['pgrep','-x','launchd_sim'],capture_output=True,timeout=max(.01,preflightWork-time.time()-8)).returncode==1
 root.mkdir();start=preflightStarted;end=start+cellPreflight['attempt']['maximumSeconds'];work=end-cellPreflight['attempt']['cleanupReserveSeconds'];rows=[];children=[];cleanupErrors=[];outcome='ADMITTED';selectedMethods=[];cleaning=False;cleanupDeadline=end
 admission={'cellPreflight':cellPreflight,'startedUTC':now(),'startedEpochSeconds':start,'workDeadlineEpochSeconds':work,'deadlineEpochSeconds':end,'maximumSeconds':cellPreflight['attempt']['maximumSeconds'],'cleanupReserveSeconds':cellPreflight['attempt']['cleanupReserveSeconds'],'device':device,'cell':packet['cell'],'requestedMethods':selection['selectedMethods'],'sourceScope':packet['sourceScope'],'retainedHarnessScope':packet['retainedHarnessScope'],'packetSHA256':sha(packetPath),'preferencePolicy':'unchanged-no-preference-commands','sourceHEAD':subprocess.check_output(['git','rev-parse','HEAD'],cwd=packet['repoRoot'],text=True,timeout=max(.01,preflightWork-time.time()-8)).strip(),'appInstallPolicy':'Reuse exact registered app; no install/retry','scope':'Finite selected XCTest batch only; no whole-current-app or automatic gate verdict'}
 admission['useDestinationArtifacts']=destination_artifacts_enabled(packet)
 admission['installPreparedObserver']=explicit_observer_install_enabled(packet)
 admission['workspaceStatus']=workspaceStatus
 admission['workspacePolicy']='Relevant source/support/observer/product bytes are verified individually; unrelated or uncommitted files do not certify or invalidate the cached product'
 (root/'admission.json').write_text(json.dumps(admission,indent=2));print('ADMISSION '+json.dumps(admission),flush=True)
 for name in ['observer-identity.json','product-identity.json']:shutil.copy2(read_bound(packet['appIdentity' if name=='product-identity.json' else 'observerIdentity']),root/name)
 sys.dont_write_bytecode=True
 sys.path.insert(0,packet['supportRoot'])
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

 def exact_installed(label,bundle,identity,suffix=''):
  item=run('registered-'+label+suffix,[cli,'get_app_container',device,bundle,'app']);assert item['exitCode']==0
  raw=(root/('registered-'+label+suffix+'.log')).read_text().strip()
  assert raw and '\n' not in raw,'Registration response must be one actual absolute container path'
  path=pathlib.Path(raw)
  containers=pathlib.Path.home()/'Library/Developer/CoreSimulator/Devices'/device/'data/Containers/Bundle/Application'
  assert path.is_absolute() and path.is_dir() and path.resolve().is_relative_to(containers.resolve()),'Registered path is not an actual selected-device app container'
  expected=json.loads((root/identity).read_text())
  if label=='observer':assert len(expected['filesSHA256'])==packet['observerFileCount'] and expected['manifestSHA256']==bindings['expectedObserverManifestSHA256']
  if label=='app':
   assert len(expected['filesSHA256'])==packet['appFileCount'] and expected['manifestSHA256']==bindings['expectedProductManifestSHA256']
  actual={str(p.relative_to(path)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(path.rglob('*')) if p.is_file()}
  differences=sorted(k for k in set(actual)|set(expected['filesSHA256']) if actual.get(k)!=expected['filesSHA256'].get(k))
  receipt={'checkedUTC':now(),'path':str(path),'files':len(actual),'manifestSHA256':hashlib.sha256(json.dumps(actual,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'expectedManifestSHA256':expected['manifestSHA256'],'differences':differences,'lookupCommand':item['argv'],'lookupExitCode':item['exitCode'],'applicationInstallRequestedByController':applicationInstallRequested}
  (root/('installed-'+label+suffix+'.json')).write_text(json.dumps(receipt,indent=2))
  assert not differences and len(actual)==len(expected['filesSHA256']),'Registered container does not exactly match; stop without reinstall fallback'

 def tests(label,methods):
  assert time.time()<work-8
  case=root/label;case.mkdir();args=['/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild','test-without-building','-jobs','1','-xctestrun',str(read_bound(packet['xctestrun'])),'-destination','platform=iOS Simulator,id='+device,'-destination-timeout',str(max(1,int(work-time.time()-8))),'-parallel-testing-enabled','NO','-maximum-concurrent-test-simulator-destinations','1','-test-timeouts-enabled','YES','-maximum-test-execution-time-allowance','180']+['-only-testing:CodonNativeComponents/'+m for m in methods]+['-resultBundlePath',str(case/'Batch.xcresult')];selectedMethods.extend(methods);(case/'command.json').write_text(json.dumps({'argv':args,'startedUTC':now(),'methods':methods,'workDeadlineEpochSeconds':work},indent=2));return run(label,args)
 def work_cutoff(_signal,_frame):raise TimeoutError('Mechanical1680s work cutoff;120s cleanup remains reserved')
 def interrupted(signum,_frame):raise InterruptedError('Received signal '+str(signum))
 signal.signal(signal.SIGALRM,work_cutoff);signal.signal(signal.SIGTERM,interrupted);signal.signal(signal.SIGINT,interrupted)
 signal.setitimer(signal.ITIMER_REAL,max(.01,work-time.time()))
 try:
  appIdentity=json.loads((root/'product-identity.json').read_text());observerIdentity=json.loads((root/'observer-identity.json').read_text())
  assert appIdentity['manifestSHA256']==bindings['expectedProductManifestSHA256'] and len(appIdentity['filesSHA256'])==packet['appFileCount']
  assert observerIdentity['manifestSHA256']==bindings['expectedObserverManifestSHA256'] and len(observerIdentity['filesSHA256'])==packet['observerFileCount']
  assert observerIdentity['observerSourceSHA256']==packet['observerSourceSHA256']
  assert run('boot',[cli,'boot',device])['exitCode']==0
  assert run('boot-readiness',[cli,'bootstatus',device,'-b'])['exitCode']==0
  pending=pathlib.Path.home()/'Library/Developer/CoreSimulator/Devices'/device/'data/Containers/Shared/SystemGroup/systemgroup.com.apple.installcoordinationd/Library/InstallCoordination/PendingWork.plist'
  if destination_artifacts_enabled(packet):
   pendingStarted=time.time();pendingDeadline=min(pendingStarted+60,work);pendingInitiallyPresent=pending.exists()
   try:
    while pending.exists():
     if time.time()>=pendingDeadline:raise TimeoutError('Pending installer transaction remains after60s; no XCTest admitted')
     time.sleep(min(.25,max(.01,pendingDeadline-time.time())))
   finally:
    (root/'destination-pending-gate.json').write_text(json.dumps({'startedEpochSeconds':pendingStarted,'endedEpochSeconds':time.time(),'maximumSeconds':60,'initiallyPresent':pendingInitiallyPresent,'stillPresent':pending.exists(),'elapsedSeconds':time.time()-pendingStarted,'installOrDeleteOrResetCommands':0},indent=2))
   if explicit_observer_install_enabled(packet):
    install=run('install-observer-direct',[cli,'install',device,observerIdentity['product']])
    assert install['exitCode']==0 and not install.get('timedOut'),'Explicit observer installation did not finish; no XCTest or installation retry admitted'
   # Only the actual registered new observer is eligible; staged/prepared files are not a fallback.
   exact_installed('observer',packet['observerBundleID'],'observer-identity.json',suffix='-before')
  else:
   assert not pending.exists(),'Pending installer transaction; no install admitted'
  # Exact registered cached app only; no installation fallback.
  exact_installed('app',packet['appBundleID'],'product-identity.json')
  # Ordinary OS launch, bounded separately from test assertions; no relaunch rescue.
  launch=run('launch-app',[cli,'launch',device,packet['appBundleID']])
  assert launch['exitCode']==0,'Launch RPC failed/timed out; no automatic retry'
  # The frozen Swift observer owns ordinary scene selection and all component assertions.
  shutil.copy2(read_bound(packet['xctestrun']),root/'bound.xctestrun')
  result=tests('xctest',selection['selectedMethods']);outcome='XCTEST_EXIT_'+str(result['exitCode'])
  exact_installed('observer',packet['observerBundleID'],'observer-identity.json')
  nativeSummary={}
  if (root/'xctest/Batch.xcresult').exists():
   summaryStep=run('test-result-summary',['/Applications/Xcode.app/Contents/Developer/usr/bin/xcresulttool','get','test-results','summary','--path',str(root/'xctest/Batch.xcresult')])
   if summaryStep['exitCode']==0:nativeSummary=json.loads((root/'test-result-summary.log').read_text())
  reconciliation=reconcile_selected_results(nativeSummary,(root/'xctest.log').read_text(),selectedMethods);(root/'selected-results-reconciliation.json').write_text(json.dumps(reconciliation,indent=2))
  if result['exitCode']==0:
   assert reconciliation['status']=='PASS',reconciliation
   outcome='SELECTED_BATCH_PASS_PENDING_RECONCILIATION'

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
   for label,bundle in [('app',packet['appBundleID']),('runner',packet['observerBundleID'])]:
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
   summary={'finishedUTC':now(),'elapsedSeconds':time.time()-start,'withinAttemptBoundary':time.time()<end,'outcome':outcome,'selectedMethods':selectedMethods,'selectedDeviceState':state,'selectedGuestProcesses':selected,'selectedGuestOrphanFileHolders':holders,'cleanupErrors':cleanupErrors,'shutdownExitCode':shutdown.get('exitCode'),'ledgerChanged':False,'cleanupSeconds':time.time()-cleanupStarted,'cleanupWithin120Seconds':time.time()-cleanupStarted<120,'packetSHA256':sha(packetPath),'sourceScope':packet['sourceScope'],'retainedHarnessScope':packet['retainedHarnessScope'],'preferencePolicy':'unchanged-no-preference-commands','applicationInstallRequestedByController':applicationInstallRequested,'observerInstallRequestedByController':explicit_observer_install_enabled(packet),'applicationReuseRegistrationGate':'Reuse only: live registration and exact packet-bound app files before launch'};(root/'terminal-summary.json').write_text(json.dumps(summary,indent=2));print('SUMMARY '+json.dumps(summary),flush=True)

 from NativeCellVerification import driver_exit_code
 sdk_row=next((row for row in rows if row.get('name')=='xctest'),{})
 coverage_complete=outcome=='SELECTED_BATCH_PASS_PENDING_RECONCILIATION' and not sdk_row.get('timedOut',False)
 cleanup_complete=summary.get('selectedDeviceState')=='1' and summary.get('selectedGuestProcesses')==[] and summary.get('selectedGuestOrphanFileHolders')==[] and summary.get('cleanupErrors')==[] and summary.get('shutdownExitCode')==0 and summary.get('withinAttemptBoundary') is True and summary.get('cleanupWithin120Seconds') is True
 raise SystemExit(driver_exit_code(sdk_row.get('exitCode'),coverage_complete,cleanup_complete))

if __name__=='__main__':
 if len(sys.argv)==3 and sys.argv[1]=='--bind':bind_xctestrun(pathlib.Path(sys.argv[2]).resolve())
 else:main()
