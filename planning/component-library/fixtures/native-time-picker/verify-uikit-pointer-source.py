import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess


parser = argparse.ArgumentParser(description="Compile the actual CUI pointer adapter with exact SDK touch methods and explicit UIKit models.")
parser.add_argument("--sdk-root", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
fixture = Path(__file__).resolve().parent
root = fixture.parents[3]
sdk = args.sdk_root.resolve()
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=False)
assert json.loads((sdk / "package.json").read_text())["version"] == "0.86.3"
source = (sdk / "React/Fabric/RCTSurfacePointerHandler.mm").read_text()
masked = re.sub(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"', lambda match: " " * len(match[0]), source)


def extract(signature):
    start = source.index(signature)
    opening = source.index("{", start)
    depth = 1
    for end in range(opening + 1, len(masked)):
        depth += (masked[end] == "{") - (masked[end] == "}")
        if depth == 0:
            return source[start:end + 1]
    raise AssertionError("Incomplete original SDK method: " + signature)


methods = ["- (instancetype)init\n", "- (void)attachToView:", "- (void)detachFromView:",
           "- (void)touchesBegan:", "- (void)touchesMoved:", "- (void)touchesEnded:", "- (void)touchesCancelled:", "- (void)reset\n"]
functions = ["static BOOL AllTouchesAreCancelledOrEnded(", "static BOOL AnyTouchesChanged("]
method_text = "\n\n".join(extract(name) for name in methods) + "\n"
function_text = "\n\n".join(extract(name) for name in functions) + "\n"
(output / "sdk-touch-methods.inc").write_text(method_text)
(output / "sdk-touch-functions.inc").write_text(function_text)
stubs = output / "stubs"
for name in ["React/RCTSurfacePointerHandler.h", "UIKit/UIGestureRecognizerSubclass.h"]:
    path = stubs / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('#pragma once\n#import "uikit-pointer-model.h"\n')
files = [fixture / "uikit-pointer-model.h", fixture / "uikit-pointer-model.mm", Path(__file__).resolve(),
         root / "packages/react-native/ios/CUIFieldPointerHandler.h", root / "packages/react-native/ios/CUIFieldPointerHandler.mm"]
inventory = {
    "sdk": "react-native@0.86.3",
    "SDKSourceSHA256": hashlib.sha256(source.encode()).hexdigest(),
    "exactSDKMethods": methods,
    "exactSDKFunctions": functions,
    "SDKExcerptSHA256": hashlib.sha256((method_text + function_text).encode()).hexdigest(),
    "CUISourceSHA256": {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in files},
    "scope": "Actual CUI adapter and exact SDK init/attach/detach/touch/reset bodies. Explicit UIKit/native-pointer/gesture models; no UIKit default or installed acceptance.",
}
(output / "inventory.json").write_text(json.dumps(inventory, indent=2) + "\n")
executable = output / "uikit-pointer-source"
subprocess.run([
    "/usr/bin/clang++", "-std=c++20", "-fobjc-arc", "-fblocks", "-Wall", "-Wextra", "-Werror", "-Wno-unused-parameter",
    "-I" + str(stubs), "-I" + str(fixture), "-I" + str(output),
    str(fixture / "uikit-pointer-model.mm"), str(root / "packages/react-native/ios/CUIFieldPointerHandler.mm"),
    "-framework", "Foundation", "-o", str(executable),
], check=True, timeout=30)
record = subprocess.check_output([str(executable)], text=True, timeout=8).strip()
result = {"assertions": record, "UIKitOrInstalledAcceptance": False}
(output / "result.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result))
