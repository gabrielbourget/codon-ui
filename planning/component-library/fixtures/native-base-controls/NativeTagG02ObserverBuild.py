import ast,datetime,hashlib,json,os,pathlib,signal,sys,time,zipfile
sys.dont_write_bytecode=True
FIXTURE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(FIXTURE))
from NativeAndroidTestSupport import recorded_command
from NativeCellVerification import load_admission
cell=sys.argv[2] if len(sys.argv)>2 else "CAT.tag.G02"
assert cell in ["CAT.tag.G02","CAT.placeholder-text.G04"]
admission=load_admission(__file__,cell,{"ios":[],"android":["placeholder-g04-observer-compile" if cell=="CAT.placeholder-text.G04" else "tag-g02-observer-compile"]})
ROOT=pathlib.Path(sys.argv[1]).resolve();OUT=ROOT/'compile-1';SDK=pathlib.Path('/Users/gabrielbourget/.local/share/codon-native-lab/sdk');JDK=pathlib.Path('/Users/gabrielbourget/.local/share/codon-native-lab/jdk/Contents/Home')
start=time.time();work=start+120;end=start+150;steps=[];status='FAILED';error=None
sha=lambda path:hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
write=lambda path,value:path.write_text(json.dumps(value,indent=2)+'\n')
assert not OUT.exists();prepared=json.loads((ROOT/'compile-readiness.json').read_text());assert all(sha(path)==digest for path,digest in prepared['filesSHA256'].items())
OUT.mkdir();(OUT/'classes').mkdir();(OUT/'dex').mkdir()
env={**os.environ,'JAVA_HOME':str(JDK),'JAVA_TOOL_OPTIONS':'-XX:ActiveProcessorCount=1','PYTHONDONTWRITEBYTECODE':'1'}
def cutoff(signum,frame):raise TimeoutError('120s compiler work cutoff;30s cleanup reserve')
def interrupted(signum,frame):raise InterruptedError('Received signal '+str(signum))
signal.signal(signal.SIGTERM,interrupted);signal.signal(signal.SIGINT,interrupted)
signal.signal(signal.SIGALRM,cutoff);signal.setitimer(signal.ITIMER_REAL,120)
def run(name,argv):
    print('START '+name+' '+datetime.datetime.now(datetime.timezone.utc).isoformat(),flush=True)
    row=recorded_command(argv,OUT/name,max(.1,work-time.time()),work,env=env);row['name']=name;steps.append(row);write(OUT/'steps.json',steps)
    assert row.get('ownedGroupGone') is True and not row.get('cleanupError'),row
    assert row['exitCode']==0 and not row.get('timedOut'),row
try:
    jar=str(SDK/'platforms/android-36/android.jar');tools=SDK/'build-tools/36.0.0'
    run('javac',[str(JDK/'bin/javac'),'-source','8','-target','8','-classpath',jar,'-d',str(OUT/'classes'),str(ROOT/'source/Actions.java')])
    run('dex',[str(tools/'d8'),'--lib',jar,'--output',str(OUT/'dex'),*map(str,sorted((OUT/'classes').rglob('*.class')))])
    run('link',[str(tools/'aapt2'),'link','--manifest',str(ROOT/'source/AndroidManifest.xml'),'-I',jar,'-o',str(OUT/'unsigned.apk')])
    with zipfile.ZipFile(OUT/'unsigned.apk','a',compression=zipfile.ZIP_DEFLATED) as archive:archive.write(OUT/'dex/classes.dex','classes.dex')
    run('align',[str(tools/'zipalign'),'-f','4',str(OUT/'unsigned.apk'),str(OUT/'inspector.apk')])
    run('sign',[str(tools/'apksigner'),'sign','--ks','/Users/gabrielbourget/Desktop/Dev/wavemap/tendril-systems/codon-ui/apps/native-showcase/android/app/debug.keystore','--ks-key-alias','androiddebugkey','--ks-pass','pass:android','--key-pass','pass:android',str(OUT/'inspector.apk')])
    run('verify',[str(tools/'apksigner'),'verify','--verbose',str(OUT/'inspector.apk')]);status='PASS_PLACEHOLDER_G04_OBSERVER_COMPILE_ONLY' if cell=='CAT.placeholder-text.G04' else 'PASS_TAG_G02_OBSERVER_COMPILE_ONLY'
except BaseException as failure:error=repr(failure);raise
finally:
    signal.setitimer(signal.ITIMER_REAL,0)
    write(OUT/'terminal.json',{'status':status,'error':error,'startedUnix':start,'finishedUnix':time.time(),'elapsedSeconds':time.time()-start,'within150Seconds':time.time()<=end,'apkSHA256':sha(OUT/'inspector.apk') if (OUT/'inspector.apk').exists() else None,'sourceSHA256':sha(ROOT/'source/Actions.java'),'manifestSHA256':sha(ROOT/'source/AndroidManifest.xml'),'guestActions':0,'sequentialCommands':True,'activeProcessorCount':1,'steps':steps,'nativeCellAdmission':admission})
