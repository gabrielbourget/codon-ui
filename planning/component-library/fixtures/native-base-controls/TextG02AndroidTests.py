"""One Text S03 cohort: programmatic fixture AX controls, physical target holds/Copy; root owns guest/cleanup."""
import argparse,datetime,json,re,struct,sys,time,xml.etree.ElementTree as E
from pathlib import Path
sys.dont_write_bytecode=True
FIXTURE=Path('/Users/gabrielbourget/Desktop/Dev/wavemap/tendril-systems/codon-ui/planning/component-library/fixtures/native-base-controls');sys.path.insert(0,str(FIXTURE))
from NativeAndroidTestSupport import copy_node,recorded_command
parser=argparse.ArgumentParser();parser.add_argument('--serial',required=True);parser.add_argument('--out',required=True,type=Path);parser.add_argument('--deadline-unix',required=True,type=float);args=parser.parse_args();args.out.mkdir(exist_ok=False)
adb='/Users/gabrielbourget/.local/share/codon-native-lab/sdk/platform-tools/adb';remote='/sdcard/Android/data/dev.codonui.lab.number/files/held-selection-7';number=0
result={'scope':'One Text S03 cohort with accepted programmatic fixture controls and physical target/Copy; no automatic wholeG02 promotion','startedUnix':time.time(),'status':'FAILED','opAttempted':False};write=lambda path,value:path.write_text(json.dumps(value,indent=2)+'\n')
def command(label,tail,cap):
    global number
    number+=1;prefix=args.out/(str(number).zfill(3)+'-'+label);argv=[adb,'-s',args.serial,*tail];print('START '+label+' '+datetime.datetime.now(datetime.timezone.utc).isoformat(),flush=True)
    row=recorded_command(argv,prefix,cap,args.deadline_unix);assert row.get('ownedGroupGone') is True and not row.get('cleanupError'),row;assert row['exitCode']==0 and not row.get('timedOut'),row
    return prefix.with_suffix('.stdout').read_text()
def identity(original,current):
    for key in ['rootTag','refIdentity','attaches','detaches']:assert original[key]==current[key],(key,original,current)
    assert current['parentOrdinary']==len(current['receipts'])
    for index,event in enumerate(current['receipts']):assert event['sequence']==index+1 and event['kind']=='parentPress' and event['rootTag']==original['rootTag'] and event['refIdentity']==original['refIdentity']
try:
    assert time.time()+190<args.deadline_unix,'Insufficient time for bounded matched cohort and artifact pull';result['opAttempted']=True
    try:
        raw=command('matched-text-s03',['shell','am','instrument','-w','-e','op','matched-text-s03','-e','outputDir',remote,'dev.codonui.lab.number/.Actions'],180)
        match=re.search(r'INSTRUMENTATION_RESULT: codon=(.*)',raw);assert match,raw;receipt=json.loads(match[1]);write(args.out/'instrumentation-receipt.json',receipt)
        assert 'INSTRUMENTATION_CODE: -1' in raw and receipt['operation']=='matched-text-s03',raw
        assert receipt['nativeActionSucceeded'] is True and receipt['status']=='MATCHED_S03_SCOPED_ASSERTIONS_PASSED',receipt
    finally:
        try:command('pull-guest-output',['pull',remote,str(args.out/'guest-output')],20)
        except BaseException as error:result['artifactPullError']=repr(error)
    assert receipt['elapsedMs']<=120000 and receipt['setupElapsedMs']<=30000 and receipt['scrolls']<=20,receipt
    assert receipt['holdDurationMs']==1000 and receipt['copyDurationMs']==200 and receipt['quietDurationMs']==750
    assert receipt['diagnosticOnly'] is True and receipt['holdGesture']=='draganddrop' and receipt['copyGesture']=='swipe' and receipt['fixtureControlAction']=='ACTION_CLICK' and receipt['holdDurationArgumentMs']==1000
    result['longPressTimeoutMs']=receipt['longPressTimeoutMs']
    original=receipt['initial'];assert original['policy']=='default' and original['rootTag']>0 and original['refIdentity']>0 and original['parentOrdinary']==0 and original['receipts']==[]
    assert receipt['callerActionsBefore']==0 and receipt['callerActionsAfter']==receipt['final']['parentOrdinary'];identity(original,receipt['final'])
    assert [(c['name'],c['expectedPolicy'],c['expectedSelection']) for c in receipt['cases']]==[('initial-default','default',False),('explicit-true','explicit-true',True),('restored-default','default',False)]
    checks=[]
    for case in receipt['cases']:
        assert case['status']=='SCOPED_ASSERTIONS_PASSED' and case['targetMatchCount']==1;expected=case['expectedSelection'];before=case['before'];assert before['policy']==case['expectedPolicy'];identity(original,before)
        for key in ['firstNative','secondNative']:
            native=case[key];assert native['text']=='Choose a context item' and native['editable'] is False
            copy=copy_node(E.Element('hierarchy'),native);assert (copy is not None)==expected
            start,end=native['selectionStart'],native['selectionEnd']
            assert (0<=start<end<=len('Choose a context item')) if expected else (start<0 or end<=start)
            if expected:assert copy.get('enabled')=='true'
            checks.append({'case':case['name'],'snapshot':key,'range':[start,end],'copyPresent':copy is not None,'windowRoots':native['windowRoots']})
        for key in ['afterHold','quiet750ms']+(['afterCopy'] if expected else []):
            value=case[key];identity(original,value);assert 0<=value['parentOrdinary']-before['parentOrdinary']<=1
        if expected:assert case['afterCopy']['receipts']==case['afterHold']['receipts']
        for suffix in ['menu.png','range.png']+(['copy.png'] if expected else []):
            image=(args.out/'guest-output'/(case['name']+'-'+suffix)).read_bytes();assert image[:8]==b'\x89PNG\r\n\x1a\n';width,height=struct.unpack('>II',image[16:24]);assert height>width
    assert [p['policy'] for p in receipt['transitions']]==['explicit-true','default']
    for transition in receipt['transitions']:
        before=transition['before']
        for key in ['acknowledged','quiet750ms']:
            value=transition[key];identity(original,value);assert value['policy']==transition['policy'] and value['receipts']==before['receipts'] and value['parentOrdinary']==before['parentOrdinary']
    for transition in receipt['transitions']:
        for phase in ['acknowledgmentObservation','quietObservation']:
            observation=transition[phase];assert observation['capMs']==10000 and observation['markerAndScrollRefreshRequired'] is True and observation['elapsedMs']<10000
            assert observation['firstRefreshedPolicyJSON'] and observation['lastRefreshedPolicyJSON']['policy']==transition['policy']
    for name in ['prepare-default-control.png','policy-explicit-true-control.png','policy-default-control.png']:
        image=(args.out/'guest-output'/name).read_bytes();assert image[:8]==b'\x89PNG\r\n\x1a\n';width,height=struct.unpack('>II',image[16:24]);assert height>width
    physical=[row for row in receipt['inputs'] if 'command' in row];assert len(physical)==4,physical
    for row in physical:assert re.fullmatch(r'input touchscreen (?:swipe (?P<swipe_x>\d+) (?P<swipe_y>\d+) (?P=swipe_x) (?P=swipe_y) 200|draganddrop (?P<drag_x>\d+) (?P<drag_y>\d+) (?P=drag_x) (?P=drag_y) 1000)',row['command']) and row['exitCode']==0,row
    assert len([row for row in physical if row['command'].endswith(' 1000')])==3 and len([row for row in physical if row['command'].endswith(' 200')])==1
    assert len([row for row in physical if row['label']=='explicit-true Copy'])==1
    controls=[row for row in receipt['inputs'] if row.get('action')=='ACTION_CLICK']
    assert [row['label'] for row in controls]==['G02 prepare Text button context','G02 enable Text context selection','G02 default Text context selection'] and all(row['accepted'] is True for row in controls),controls
    write(args.out/'independent-native-snapshot-checks.json',checks);result['status']='DRAGANDDROP_DIAGNOSTIC_ASSERTIONS_PASSED_NO_PROMOTION'
except BaseException as error:result['error']=repr(error);raise
finally:result['finishedUnix']=time.time();write(args.out/'terminal.json',result)
