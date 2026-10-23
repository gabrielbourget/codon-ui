import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess


repo = Path(__file__).resolve().parents[4]
fixture = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description="Compile the actual SDK command API/scheduler excerpt with actual Codon frames.")
parser.add_argument("--sdk-root", required=True, type=Path)
parser.add_argument("--patch", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
sdk = args.sdk_root.resolve()
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=False)
assert json.loads((sdk / "package.json").read_text())["version"] == "0.86.3"
files = [
    "ReactCommon/react/renderer/uimanager/NativeEventCommands.h",
    "ReactCommon/react/renderer/uimanager/UIManager.h",
    "ReactCommon/react/renderer/uimanager/UIManager.cpp",
    "ReactCommon/react/renderer/scheduler/Scheduler.cpp",
]
patch = args.patch.read_bytes()
assert all(name.encode() in patch for name in files)
inventory = {
    "sdk": "react-native@0.86.3",
    "patch": str(args.patch.resolve()),
    "patchSHA256": hashlib.sha256(patch).hexdigest(),
    "sourceFiles": {name: hashlib.sha256((sdk / name).read_bytes()).hexdigest() for name in files},
    "changedExistingMethods": ["Scheduler::uiManagerDidDispatchCommand"],
    "additiveMethods": [
        "UIManager::getNativeEventCommands (out-of-line, new registry member)",
        "NativeEventCommand::NativeEventCommand/status/claim/cancel/executeOriginal",
        "NativeEventCommands::Entry::Entry",
        "NativeEventCommands::NativeEventCommands/~NativeEventCommands/deleted copy operations",
        "NativeEventCommands::Registration::Registration/~Registration/retire/deleted copy operations",
        "NativeEventCommands::Route::Route/current/dispatchOriginal",
        "NativeEventCommands::enter/captureCurrentThread",
    ],
    "CUIFrameSHA256": hashlib.sha256((repo / "packages/react-native/cpp/FieldInputDispatchFrames.h").read_bytes()).hexdigest(),
    "scope": "Actual new SDK registry and actual scheduler method with explicit node/value/queue doubles; actual CUI frames. No linked SDK or installed acceptance.",
}
# This source/method/patch inventory exists before either compiler invocation.
(output / "inventory.json").write_text(json.dumps(inventory, indent=2) + "\n")
source = (sdk / files[-1]).read_text()
start = source.index("void Scheduler::uiManagerDidDispatchCommand(")
opening = source.index("{", start)
masked = re.sub(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"', lambda match: " " * len(match[0]), source)
depth = 1
for end in range(opening + 1, len(masked)):
    depth += (masked[end] == "{") - (masked[end] == "}")
    if depth == 0:
        break
else:
    raise AssertionError("SDK scheduler method is incomplete")
method = source[start:end + 1]
assert method.index("captureCurrentThread()") < method.index("runtimeScheduler_->scheduleRenderingUpdate(")
assert "route->dispatchOriginal(command);" in method
(output / "scheduler-command-excerpt.inc").write_text("// Copyright Meta Platforms, Inc. and affiliates. MIT; exact patched SDK source.\n" + method + "\n")
records = {}
for name in ["field-sdk-commands", "field-sdk-scheduler"]:
    executable = output / name
    subprocess.run(["/usr/bin/clang++", "-std=c++20", "-pthread", "-Wall", "-Wextra", "-Werror", "-I" + str(sdk / "ReactCommon"), "-I" + str(output), str(fixture / (name + ".cpp")), "-o", str(executable)], check=True, timeout=25)
    records[name] = subprocess.check_output([str(executable)], text=True, timeout=8).strip()
result = {"patchSHA256": inventory["patchSHA256"], "executables": records, "linkedSDKAcceptance": False, "installedAcceptance": False}
(output / "result.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
