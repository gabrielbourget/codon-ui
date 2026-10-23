import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess


fixture = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description="Compare original-event forwarding with the actual SDK processor policy/state.")
parser.add_argument("--sdk-root", required=True, type=Path)
parser.add_argument("--patch", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
sdk = args.sdk_root.resolve()
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=False)
assert json.loads((sdk / "package.json").read_text())["version"] == "0.86.3"
patch = args.patch.read_bytes()
files = sorted(set(re.findall(r'^diff --git a/(.*?) b/', patch.decode(), re.M)))
assert len(files) == 19 and all((sdk / name).is_file() for name in files)
inventory = {
    "sdk": "react-native@0.86.3", "patch": str(args.patch.resolve()), "patchSHA256": hashlib.sha256(patch).hexdigest(),
    "sourceFiles": {name: hashlib.sha256((sdk / name).read_bytes()).hexdigest() for name in files},
    "changedExistingMethods": ["Scheduler::uiManagerDidDispatchCommand", "EventDispatcher::dispatchEvent/dispatchUniqueEvent", "EventListenerContainer::willDispatchEvent", "RuntimeScheduler_Modern::runEventLoopTick/executeTask/performMicrotaskCheckpoint/scheduleRenderingUpdate"],
    "additiveMethods": [
        "UIManager::getNativeEventCommands",
        "NativeEventCommand::NativeEventCommand/status/claim/cancel/executeOriginal",
        "NativeEventCommands::Entry::Entry",
        "NativeEventCommands::NativeEventCommands/~NativeEventCommands/deleted copy operations",
        "NativeEventCommands::Registration::Registration/~Registration/retire/deleted copy operations",
        "NativeEventCommands::Route::Route/current/dispatchOriginal", "NativeEventCommands::enter/captureCurrentThread",
        "RawEvent::deferAfterListeners/continueAfterListeners", "NativeEventContinuation::NativeEventContinuation/run",
        "NativeEventListenerScope::NativeEventListenerScope/~NativeEventListenerScope/active/deleted copy operations",
        "NativeEventTaskScope::~NativeEventTaskScope/fail/finish (abstract interface)",
        "NativeEventTaskRenderingUpdate::NativeEventTaskRenderingUpdate/run",
        "RuntimeSchedulerBase/RuntimeScheduler/RuntimeScheduler_Modern::scheduleNativeEventWork",
        "EventQueue/EventDispatcher/Scheduler::dispatchOriginalNativeEvents",
    ],
    "unchangedProcessorSHA256": hashlib.sha256((sdk / "ReactCommon/react/renderer/core/EventQueueProcessor.cpp").read_bytes()).hexdigest(),
    "CUISourceFiles": {
        name: hashlib.sha256((fixture.parents[3] / name).read_bytes()).hexdigest() for name in [
            "packages/react-native/cpp/FieldInputRuntime.h", "packages/react-native/cpp/FieldInputTaskScope.h",
            "packages/react-native/cpp/FieldInputOriginalCommand.h", "packages/react-native/cpp/FieldInputMount.h",
            "packages/react-native/ios/CUIFieldInputBinding.mm", "packages/react-native/android/src/main/jni/FormDocumentJNI.cpp",
        ]
    },
    "scope": "Actual unchanged SDK processor and exact additive forwarding methods with explicit value/target/logger/queue doubles; no linked or installed acceptance.",
}
(output / "inventory.json").write_text(json.dumps(inventory, indent=2) + "\n")
methods = []
for file, names in [
    ("core/EventQueueProcessor.cpp", ["EventQueueProcessor::EventQueueProcessor", "EventQueueProcessor::flushEvents", "EventQueueProcessor::flushStateUpdates"]),
    ("core/EventQueue.cpp", ["EventQueue::dispatchOriginalNativeEvents"]),
    ("core/EventDispatcher.cpp", ["EventDispatcher::dispatchOriginalNativeEvents"]),
    ("scheduler/Scheduler.cpp", ["Scheduler::dispatchOriginalNativeEvents"]),
]:
    source = (sdk / "ReactCommon/react/renderer" / file).read_text()
    masked = re.sub(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"', lambda match: " " * len(match[0]), source)
    for name in names:
        start = source.index(name + "(")
        start = source.rfind("\n", 0, start) + 1
        opening = source.index("{", start)
        depth = 1
        for end in range(opening + 1, len(masked)):
            depth += (masked[end] == "{") - (masked[end] == "}")
            if depth == 0:
                break
        else:
            raise AssertionError("Incomplete SDK method " + name)
        methods.append(source[start:end + 1])
(output / "original-event-method-excerpts.inc").write_text("// Copyright Meta Platforms, Inc. and affiliates. MIT; exact SDK source.\nnamespace facebook::react {\n" + "\n".join(methods) + "\n}\n")
stubs = output / "stubs"
headers = {
    "jsi/jsi.h": "#pragma once\nnamespace facebook::jsi { class Runtime {}; class Value {}; }\n",
    "react/timing/primitives.h": "#pragma once\nnamespace facebook::react { struct HighResTimeStamp { double value; static HighResTimeStamp now() { return {0}; } }; }\n",
    "react/renderer/core/StateUpdate.h": "#pragma once\nnamespace facebook::react { struct StateUpdate {}; }\n",
    "react/renderer/core/EventLogger.h": '''#pragma once
#include <memory>
#include <string>
#include <react/timing/primitives.h>
namespace facebook::react {
struct EventTarget; using EventTag = int;
struct EventLogger {
  int starts{0}, processingStarts{0}, processingEnds{0};
  EventTag onEventStart(const std::string &, const std::shared_ptr<EventTarget> &, HighResTimeStamp) { return ++starts; }
  void onEventProcessingStart(EventTag) { processingStarts++; }
  void onEventProcessingEnd(EventTag) { processingEnds++; }
};
}
''',
    "react/renderer/core/EventPayload.h": "#pragma once\n#include <memory>\nnamespace facebook::react { struct EventPayload {}; using SharedEventPayload = std::shared_ptr<const EventPayload>; }\n",
    "react/renderer/core/EventTarget.h": '''#pragma once
#include <memory>
#include <jsi/jsi.h>
namespace facebook::react {
struct EventTarget { mutable int retained{0}, retains{0}; void retain(facebook::jsi::Runtime &) const { retained++; retains++; } void release(facebook::jsi::Runtime &) const { retained--; } };
using SharedEventTarget = std::shared_ptr<EventTarget>;
}
''',
    "react/featureflags/ReactNativeFeatureFlags.h": "#pragma once\nnamespace facebook::react { struct ReactNativeFeatureFlags { inline static bool mapping{false}; static bool fixMappingOfEventPrioritiesBetweenFabricAndReact() { return mapping; } }; }\n",
}
for name, value in headers.items():
    path = stubs / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value)
(output / "support.h").write_text("#include <algorithm>\n#include <functional>\n#include <memory>\n#include <type_traits>\n#include <vector>\n#define react_native_log_error(...) ((void)0)\n")
executable = output / "field-sdk-original-events"
subprocess.run([
    "/usr/bin/clang++", "-std=c++20", "-pthread", "-Wall", "-Wextra", "-Werror", "-I" + str(stubs),
    "-I" + str(sdk / "ReactCommon"), "-I" + str(output), "-include", str(output / "support.h"),
    str(fixture / "field-sdk-original-events.cpp"), str(sdk / "ReactCommon/react/renderer/core/RawEvent.cpp"),
    str(sdk / "ReactCommon/react/renderer/core/EventListener.cpp"), "-o", str(executable),
], check=True, timeout=30)
record = subprocess.check_output([str(executable)], text=True, timeout=8).strip()
result = {"patchSHA256": inventory["patchSHA256"], "executable": record, "linkedSDKAcceptance": False, "installedAcceptance": False}
(output / "result.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
