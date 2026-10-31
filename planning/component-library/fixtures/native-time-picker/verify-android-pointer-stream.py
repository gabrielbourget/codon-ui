import argparse, hashlib, json, re, subprocess
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--sdk-root',required=True,type=Path);parser.add_argument('--output',required=True,type=Path);parser.add_argument('--jdk',required=True,type=Path);args=parser.parse_args()
fixture=Path(__file__).resolve().parent;output=args.output;output.mkdir(exist_ok=False)
sdk=args.sdk_root/'ReactAndroid/src/main/java/com/facebook/react/uimanager/JSPointerDispatcher.java';source=sdk.read_text()
masked=re.sub(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"',lambda match:' '*len(match[0]),source)
methods=[]
for signature in ['  private void onDown(', '  private void onUp(', '  private static List<ViewTarget> findHitPathIntersection(']:
 start=source.index(signature);opening=source.index('{',start);depth=1
 for end in range(opening+1,len(masked)):
  depth+=(masked[end]=='{')-(masked[end]=='}')
  if depth==0:methods.append(source[start:end+1]);break
 else:raise AssertionError('Incomplete SDK method')
template=fixture/'FieldPointerStreamContract.java';code=template.read_text().replace('  // SDK_METHODS','\n\n'.join(methods));java=output/template.name;java.write_text(code)
(output/'inventory.json').write_text(json.dumps({'SDKSourceSHA256':hashlib.sha256(sdk.read_bytes()).hexdigest(),'exactMethodsSHA256':hashlib.sha256('\n\n'.join(methods).encode()).hexdigest(),'templateSHA256':hashlib.sha256(template.read_bytes()).hexdigest(),'scope':'Exact pinned SDK down/up/intersection bodies with explicit native hit/listener/event models. No Android runtime/installed acceptance.'},indent=2)+'\n')
subprocess.run([str(args.jdk/'bin/javac'),'-d',str(output),str(java)],check=True,timeout=30)
result=subprocess.check_output([str(args.jdk/'bin/java'),'-cp',str(output),'FieldPointerStreamContract'],text=True,timeout=8).strip()
(output/'result.json').write_text(json.dumps({'assertions':result,'installedAcceptance':False},indent=2)+'\n');print(result)
