import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess


fixture = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description="Exercise the actual SDK post-listener continuation and exact dispatcher bodies.")
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
    "ReactCommon/react/renderer/core/NativeEventContinuation.h",
    "ReactCommon/react/renderer/core/RawEvent.h",
    "ReactCommon/react/renderer/core/RawEvent.cpp",
    "ReactCommon/react/renderer/core/EventDispatcher.cpp",
    "ReactCommon/react/renderer/core/EventListener.cpp",
]
patch = args.patch.read_bytes()
assert all(name.encode() in patch for name in files)
inventory = {
    "sdk": "react-native@0.86.3",
    "patch": str(args.patch.resolve()),
    "patchSHA256": hashlib.sha256(patch).hexdigest(),
    "sourceFiles": {name: hashlib.sha256((sdk / name).read_bytes()).hexdigest() for name in files},
    "changedExistingMethods": ["Scheduler::uiManagerDidDispatchCommand", "EventDispatcher::dispatchEvent/dispatchUniqueEvent", "EventListenerContainer::willDispatchEvent"],
    "additiveMethods": [
        "UIManager::getNativeEventCommands (out-of-line, new registry member)",
        "NativeEventCommand::NativeEventCommand/status/claim/cancel/executeOriginal",
        "NativeEventCommands::Entry::Entry",
        "NativeEventCommands::NativeEventCommands/~NativeEventCommands/deleted copy operations",
        "NativeEventCommands::Registration::Registration/~Registration/retire/deleted copy operations",
        "NativeEventCommands::Route::Route/current/dispatchOriginal",
        "NativeEventCommands::enter/captureCurrentThread",
        "RawEvent::deferAfterListeners/continueAfterListeners",
        "NativeEventContinuation::NativeEventContinuation/run",
        "NativeEventListenerScope::NativeEventListenerScope/~NativeEventListenerScope/active/deleted copy operations",
    ],
    "CUISourceFiles": {
        name: hashlib.sha256((fixture.parents[3] / name).read_bytes()).hexdigest()
        for name in ["packages/react-native/cpp/FieldInputOriginalCapture.h", "packages/react-native/ios/CUIFieldInputBinding.mm", "packages/react-native/android/src/main/jni/FormDocumentJNI.cpp"]
    },
    "scope": "Actual CUI original-input continuation, SDK continuation, RawEvent, EventListener.cpp and exact dispatcher bodies; explicit surrounding queue/target/value doubles. No linked/installed acceptance.",
}
# Persist the complete SDK inventory before any compiler invocation.
(output / "inventory.json").write_text(json.dumps(inventory, indent=2) + "\n")
source = (sdk / "ReactCommon/react/renderer/core/EventDispatcher.cpp").read_text()
masked = re.sub(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"', lambda match: " " * len(match[0]), source)
methods = []
for name in ["dispatchEvent", "dispatchUniqueEvent", "addListener", "removeListener"]:
    start = source.index("void EventDispatcher::" + name + "(")
    opening = source.index("{", start)
    depth = 1
    for end in range(opening + 1, len(masked)):
        depth += (masked[end] == "{") - (masked[end] == "}")
        if depth == 0:
            break
    else:
        raise AssertionError("Incomplete SDK method " + name)
    method = source[start:end + 1]
    if name in ["dispatchEvent", "dispatchUniqueEvent"]:
        assert method.index("willDispatchEvent(rawEvent)") < method.index("continueAfterListeners()") < method.index("eventQueue_.enqueue")
    methods.append(method)
(output / "dispatcher-event-excerpts.inc").write_text("// Copyright Meta Platforms, Inc. and affiliates. MIT; exact patched SDK source.\nnamespace facebook::react {\n" + "\n".join(methods) + "\n}\n")
stubs = output / "stubs"
headers = {
    "react/renderer/uimanager/UIManager.h": "#pragma once\n// Explicit manager double is declared by the fixture.\n",
    "react/timing/primitives.h": "#pragma once\nnamespace facebook::react { struct HighResTimeStamp { double value; static HighResTimeStamp now() { return {0}; } }; }\n",
    "react/renderer/core/EventLogger.h": "#pragma once\nnamespace facebook::react { using EventTag = int; }\n",
    "react/renderer/core/EventPayload.h": "#pragma once\n#include <memory>\nnamespace facebook::react { struct EventPayload {}; using SharedEventPayload = std::shared_ptr<const EventPayload>; }\n",
    "react/renderer/core/EventTarget.h": "#pragma once\n#include <memory>\nnamespace facebook::react { struct EventTarget {}; using SharedEventTarget = std::shared_ptr<const EventTarget>; }\n",
}
for name, text in headers.items():
    path = stubs / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
(output / "model-support.h").write_text("#include <algorithm>\n#include <functional>\n#include <memory>\n#include <vector>\n")
executable = output / "field-sdk-events"
subprocess.run([
    "/usr/bin/clang++", "-std=c++20", "-pthread", "-Wall", "-Wextra", "-Werror",
    "-I" + str(stubs), "-I" + str(sdk / "ReactCommon"), "-I" + str(output), "-include", str(output / "model-support.h"),
    str(fixture / "field-sdk-events.cpp"), str(sdk / "ReactCommon/react/renderer/core/RawEvent.cpp"), str(sdk / "ReactCommon/react/renderer/core/EventListener.cpp"), "-o", str(executable),
], check=True, timeout=30)
record = subprocess.check_output([str(executable)], text=True, timeout=8).strip()
result = {"patchSHA256": inventory["patchSHA256"], "executable": record, "linkedSDKAcceptance": False, "installedAcceptance": False}
(output / "result.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
