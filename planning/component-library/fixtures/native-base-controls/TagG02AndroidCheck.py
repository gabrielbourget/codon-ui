"""Independent Tag G02 receipt checks; raw long-label PNG review remains explicit."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct

COHORTS = ['baseline-actions', 'guard-cancel-lifetime', 'long-label-wrap']
EXPECTED = {
 'baseline-actions': [('initial',0,False,True,'default',True),('static-quiet',0,False,True,'default',True),('first-action',1,True,True,'default',True),('veto-owner-false',1,False,False,'default',True),('veto-first',2,False,False,'default',True),('veto-second',3,False,False,'default',True),('alias-false',3,True,False,'false',True),('alias-request',4,True,False,'false',True),('alias-default',4,True,False,'default',True)],
 'guard-cancel-lifetime': [('initial',0,False,True,'default',True),('disabled-contact',0,False,True,'default',False),('disabled-programmatic-owner',0,True,True,'default',False),('takeover-released',0,False,True,'default',False),('canceled',0,False,True,'default',True),('fresh-action',1,True,True,'default',True),('reentry-quiet',0,False,True,'default',True),('reentry-first-action',1,True,True,'default',True)],
 'long-label-wrap': [('short-baseline',0,False,True,'default',True),('long-before-first-action',0,False,True,'default',True),('long-first-action',1,True,True,'default',True)],
}

def require(value,message):
 if not value: raise ValueError(message)

def rect(value):
 values=list(map(int,re.findall(r'-?\d+',value)))
 require(len(values)==4 and values[2]>values[0] and values[3]>values[1],'Actual positive native bounds required')
 return values

def verify_state(state,requests,owner,echo,exposed):
 for key,value in {'requests':requests,'owner':owner,'echo':echo,'exposed':exposed,'id':'number 0','last':'none' if requests==0 else 'number 0','armed':False}.items():
  require(state.get(key)==value,'Actual Tag state mismatch '+key+': '+str(state.get(key)))
 require(isinstance(state.get('rawText'),str) and state['rawText'],'Actual readout text missing')

def verify_contact(row,takeover):
 require(row.get('takeover') is takeover and row.get('downAccepted') is True and row.get('releaseAccepted') is True,'Real accepted held finger contact required')
 require(row.get('toolType')==1 and row.get('source')==4098 and row.get('pointerId')==0,'Actual touchscreen finger identity required')
 require(row.get('releaseAction')==(1 if takeover else 3),'Actual UP/CANCEL route mismatch')
 require(row['downUptimeMs']<=row['heldSnapshotFinishedUptimeMs']<=row['releaseUptimeMs']<=row['finishedUptimeMs'],'Held snapshot must precede release')
 require(not row.get('contactCleanupError') and not row.get('finallyCancelAttempted'),'Contact cleanup could not be established')
 before=row['before'];after=row['after'];require((before['requests'],before['owner'])==(after['requests'],after['owner']),'Held takeover/cancel fabricated business action')
 if takeover:
  state=row['heldState'];target=row['heldTarget']
  require(target.get('enabled') is False and state.get('armed') is False,'Actual disabled takeover BEFORE UP missing')
  require(state['nativeUptimeMs']<row['releaseUptimeMs'] and (state['requests'],state['owner'])==(before['requests'],before['owner']),'Released-state inference cannot prove held takeover')

def verify_retirement(retired):
 require(retired.get('absent') is True and retired.get('quietAbsent') is True,'Actual old-host absence and quiet interval required')
 for key in ['windows','quietWindows']:
  require(isinstance(retired[key].get('windowNodes'),list),'Raw native retirement windows missing')
  require(not any(node.get('id') in ['tag-example','tag-state'] for node in retired[key]['windowNodes']),'Retired Tag remains in actual native windows')

def png_identity(root,name):
 path=(root/name).resolve();require(path.parent==root.resolve() and path.is_file(),'Missing or escaped actual PNG')
 data=path.read_bytes();require(data[:8]==b'\x89PNG\r\n\x1a\n' and data[12:16]==b'IHDR','Actual PNG header required')
 width,height=struct.unpack('>II',data[16:24]);require(width>0 and height>width,'Actual portrait PNG required')
 return {'path':str(path),'sha256':hashlib.sha256(data).hexdigest(),'width':width,'height':height}

def check_cohort(cohort,density,root=None):
 name=cohort['name'];require(cohort.get('status')=='NATIVE_ASSERTIONS_PASSED_PENDING_HOST_REVIEW','Native cohort failed/incomplete: '+name)
 require(0<=cohort['elapsedMs']<=180000,'Native method exceeded180s: '+name)
 rows=cohort['observations'];expected=EXPECTED[name];require([row['name'] for row in rows]==[row[0] for row in expected],'Missing/duplicate/order-changed observations: '+name)
 images=[]
 for row,(_,requests,owner,echo,exposed,enabled) in zip(rows,expected):
  verify_state(row['state'],requests,owner,echo,exposed);target=row['target']
  require(row.get('sameNativeAXSource') is True,'Original native AccessibilityNodeInfo source changed')
  require(target.get('id')=='tag-example' and target.get('className')=='android.widget.Button' and target.get('contentDescription')=='Controlled tag','Actual public named native Button required')
  require(target.get('enabled') is enabled and target.get('checkable') is True and target.get('checked')==(False if exposed=='false' else owner),'Native enabled/checked state differs from exposed owner policy')
  require(target.get('visible') is True,'Actual Tag root not visible')
  frame=rect(target['bounds']);viewport=rect(row['scroll']['bounds']);require(viewport[0]<=frame[0] and frame[2]<=viewport[2] and viewport[1]<=frame[1] and frame[3]<=viewport[3],'Actual root clipped/outside native viewport')
  require(row['captureStartedEpochMs']<=target['nativeEpochMs']<=row['captureFinishedEpochMs'],'Native fields outside capture bracket')
  nodes=row['windows']['windowNodes'];require(sum(node.get('id')=='tag-example' for node in nodes)==1,'Actual native target must be unique across windows')
  if root is not None: images.append(png_identity(root,row['png']))
 if name=='baseline-actions':
  static=cohort['staticNode'];require(static['id']=='tag-status' and static.get('contentDescription')=='Tag status inactive' and static.get('clickable') is False and 16 not in static['actions'],'Static Tag must not expose native click')
 elif name=='guard-cancel-lifetime':
  require(len(cohort['contacts'])==2,'Exactly takeover and cancellation required');verify_contact(cohort['contacts'][0],True);verify_contact(cohort['contacts'][1],False);verify_retirement(cohort['retirement'])
  if root is not None:
   for contact in cohort['contacts']:images.append(png_identity(root,contact['heldPNG']))
 else:
  short=rect(rows[0]['target']['bounds']);long=rect(rows[1]['target']['bounds']);after=rect(rows[2]['target']['bounds'])
  require(rows[1]['state']['size']=='140' and rows[2]['state']['size']=='140','Actual140 owner constraint missing')
  require(abs((long[2]-long[0])-140*density)<=1 and abs(rows[1]['state']['frameWidth']*density-(long[2]-long[0]))<=1,'Actual140 width/onLayout/native frame mismatch')
  require(long[3]-long[1]>short[3]-short[1] and after[3]-after[1]==long[3]-long[1],'Long label must actually wrap without first-action geometry change')
  require(abs(rows[1]['state']['frameHeight']*density-(long[3]-long[1]))<=1,'Actual onLayout/native long height mismatch')
 return {'name':name,'status':'AUTOMATED_PENDING_ROOT_VISUAL_AND_SOURCE_JOIN','observationCount':len(rows),'nativeSeconds':cohort['elapsedMs']/1000,'images':images}

def verify_setup(setup):
 require(setup.get('status')=='READY_FROM_ACTUAL_SINGLE_CONNECTION' and setup.get('connectionCount')==1,'Actual single-connection setup missing')
 require(setup.get('maximumMs')==90000 and 0<=setup['elapsedMs']<=90000 and setup['finishedUptimeMs']-setup['startedUptimeMs']==setup['elapsedMs'],'Setup missing/over90s or inconsistent timestamps')
 require(setup.get('componentInputBeforeAdmission') is False,'Component input preceded actual scene admission')
 require(setup.get('clearQueries',0)>=2 and setup.get('clearObservedMs',0)>=30000,'Actual sustained30s native scene admission missing')
 counts=setup['nativeInputCounts'];require(counts=={'sceneSelections':1,'componentContacts':0,'systemUIWait':1 if setup.get('systemUIWaitUsed') else 0},'Missing/wrong native setup input counts')
 clicks=[a for a in setup['actions'] if a.get('action')=='ACTION_CLICK'];require(len(clicks)==1 and clicks[0].get('label')=='Tag scene' and clicks[0].get('accepted') is True,'Actual single Tag scene selection missing')
 waits=[a for a in setup['actions'] if a.get('label')=='one startup SystemUI Wait'];require(len(waits)==counts['systemUIWait'] and all(a.get('exitCode')==0 for a in waits),'Stock Wait input receipt mismatch')
 require(not any(a.get('label') in ['tag-example','tag-status'] for a in setup['actions']),'Unexpected component contact during setup')
 first=setup['firstClearObservation'];last=setup['lastClearObservation'];require(last['nativeUptimeMs']-first['nativeUptimeMs']>=30000,'Native observed admission interval shorter than30s')
 for observation in [first,last]:
  windows=observation['windows'];require(windows.get('windowRoots',0)>0 and windows.get('windowNodes'),'Actual native root/windows missing')
  require(not any("isn't responding" in str(n.get('text') or '') for n in windows['windowNodes']),'ANR in actual admitted windows')
  for kind in ['scene','target','marker','viewport']:require(observation[kind].get('packageName')=='dev.codonui.showcase','Wrong actual app native root/package')
  scene=observation['scene'];require(scene.get('contentDescription')=='Tag scene' and scene.get('selected') is True,'Actual selected Tag scene required')
  target=observation['target'];require(target.get('id')=='tag-example' and target.get('className')=='android.widget.Button' and target.get('contentDescription')=='Controlled tag' and target.get('enabled') is True and target.get('visible') is True,'Actual enabled Tag target missing')
  marker=observation['marker'];require(marker.get('id')=='tag-state' and isinstance(marker.get('text'),str) and marker['text'],'Actual refreshed Tag state required')
  viewport=observation['viewport'];require(viewport.get('id')=='showcase-scroll' and viewport.get('enabled') is True and viewport.get('visible') is True,'Actual enabled native viewport missing')
  frame=rect(target['bounds']);outer=rect(viewport['bounds']);require(outer[0]<=frame[0] and frame[2]<=outer[2] and outer[1]<=frame[1] and frame[3]<=outer[3],'Setup target clipped/outside actual viewport')
  for expected_id in ['tag-example','showcase-scroll']:require(sum(n.get('id')==expected_id for n in windows['windowNodes'])==1,'Missing/ambiguous actual native setup node '+expected_id)
  verify_state(observation['state'],0,False,True,'default')
 if counts['systemUIWait']:
  recovery=setup['systemUIRecovery'];require(recovery.get('accepted') is True and recovery.get('png')=='setup-systemui-before-wait.png','Missing actual preserved stock Wait')
  title=recovery['title'];wait=recovery['wait'];require(title.get('id')=='android:id/alertTitle' and title.get('text')=="System UI isn't responding" and wait.get('id')=='android:id/aerr_wait' and wait.get('text')=='Wait' and wait.get('enabled') is True and title['windowId']==wait['windowId'],'Wrong ANR/action; no arbitrary dismissal')
  require(recovery.get('beforeWindows',{}).get('windowRoots',0)>0 and recovery.get('lastWindows',{}).get('windowRoots',0)>0 and recovery.get('clearedUptimeMs') is not None,'Missing before/cleared native ANR evidence')
  require(not any("isn't responding" in str(n.get('text') or '') for n in recovery['lastWindows']['windowNodes']),'ANR remained after Wait')
 return {'status':'PASS_ACTUAL_SINGLE_CONNECTION_ADMISSION','clearObservedMs':setup['clearObservedMs'],'nativeInputCounts':counts,'systemUIWaitUsed':setup['systemUIWaitUsed']}

def reconcile(raw,density,root=None):
 require(density>0,'Actual positive device density required')
 setup_result=verify_setup(raw['setup'])
 if root is not None and raw['setup'].get('systemUIWaitUsed'): setup_result['recoveryImage']=png_identity(root,raw['setup']['systemUIRecovery']['png'])
 require(raw.get('operation')=='tag-g02-batch' and raw.get('connectionAdmission')=='READY_FROM_ACTUAL_NEW_CONNECTION','New actual connection admission missing')
 require(raw.get('methodLimitMs')==180000 and raw.get('batchLimitMs')==560000 and 0<=raw['elapsedMs']<=560000,'Original native method/batch limits changed or exceeded')
 require([row['name'] for row in raw['cohorts']]==COHORTS,'Exactly the three selected independent cohorts required')
 results=[];errors=[]
 for cohort in raw['cohorts']:
  try: results.append(check_cohort(cohort,density,root))
  except (ValueError,KeyError,TypeError,OSError,struct.error) as error: results.append({'name':cohort.get('name'),'status':'FAILED','error':str(error)});errors.append(str(error))
 require(raw.get('nativeActionSucceeded') is True and raw.get('hasFailedCohorts') is False and raw.get('status')=='NATIVE_COMPLETE_PENDING_HOST_VISUAL_AND_SOURCE_JOIN','Native batch failed/incomplete')
 return {'status':'AUTOMATED_TAG_G02_PENDING_VISUAL_AND_SOURCE_JOIN' if not errors else 'FAILED','setup':setup_result,'cohorts':results,'errors':errors,'remaining':['Root inspects actual long-French PNG for full wrapping/unclipped reachable first action','Join bound existing source62/scene6 for unexposed JS ref/callback retirement predicates; native identity is AccessibilityNodeInfo, not JS ref','Corresponding representative iOS evidence and root whole-cell acceptance review']}

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,required=True);parser.add_argument('--out',type=Path,required=True);parser.add_argument('--density',type=Path,required=True);args=parser.parse_args();require(not args.out.exists(),'Fresh host output required');args.out.mkdir(parents=True)
 try:
  values=re.findall(r'(?:Physical|Override) density: (\d+)',args.density.read_text());require(bool(values),'Actual wm density output missing');result=reconcile(json.loads((args.input/'receipt.json').read_text()),int(values[-1])/160,args.input)
 except Exception as error:result={'status':'FAILED','errors':[repr(error)]}
 (args.out/'terminal.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));return 0 if result['status']=='AUTOMATED_TAG_G02_PENDING_VISUAL_AND_SOURCE_JOIN' else 1

if __name__=='__main__':raise SystemExit(main())
