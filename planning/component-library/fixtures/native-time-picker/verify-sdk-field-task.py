import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess


fixture = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description="Exercise actual SDK task lifetime, real Task.cpp, CUI frames/scope and exact checkpoint/render methods.")
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
    "ReactCommon/react/renderer/runtimescheduler/NativeEventTaskScope.h",
    "ReactCommon/react/renderer/runtimescheduler/Task.h",
    "ReactCommon/react/renderer/runtimescheduler/RuntimeScheduler.h",
    "ReactCommon/react/renderer/runtimescheduler/RuntimeScheduler.cpp",
    "ReactCommon/react/renderer/runtimescheduler/RuntimeScheduler_Modern.h",
    "ReactCommon/react/renderer/runtimescheduler/RuntimeScheduler_Modern.cpp",
]
patch = args.patch.read_bytes()
assert all(name.encode() in patch for name in files)
inventory = {
    "sdk": "react-native@0.86.3",
    "patch": str(args.patch.resolve()),
    "patchSHA256": hashlib.sha256(patch).hexdigest(),
    "sourceFiles": {name: hashlib.sha256((sdk / name).read_bytes()).hexdigest() for name in sorted(set(re.findall(r"^diff --git a/(.*?) b/", patch.decode(), re.M)))},
    "changedExistingMethods": [
        "UIManagerBinding::dispatchEventToJS (internal renderer helper after original pointer processing)",
        "MountItemDispatcher::addViewCommandMountItem", "Scheduler::uiManagerDidDispatchCommand", "EventDispatcher::dispatchEvent/dispatchUniqueEvent", "EventListenerContainer::willDispatchEvent",
        "RuntimeScheduler_Modern::runEventLoopTick/executeTask/performMicrotaskCheckpoint/scheduleRenderingUpdate",
    ],
    "additiveMethods": [
        "UIManagerBinding::getNativeEventPayloads; NativeEventPayloads constructor/destructor/enter/before/deleted copy operations; Entry/State/Registration construction/destruction/retire",
        "EventQueue/EventDispatcher/Scheduler::dispatchOriginalNativeEvents",
        "FabricUIManager::checkNativeEventCommandBoundary/beginNativeEventCommand",
        "MountItemDispatcher::checkNativeEventCommandBoundary/beginNativeEventCommand/endNativeEventCapture/nativeEventSurfaceCurrent/drainNativeEventCommands",
        "NativeEventCommandScope::constructor/capture/isCurrent/reject/finishAndDrain/wasExecuted/getError/close; original item getSurfaceId/toString/execute",
        "UIManager::getNativeEventCommands",
        "NativeEventCommand::NativeEventCommand/status/claim/cancel/executeOriginal",
        "NativeEventCommands::Entry::Entry",
        "NativeEventCommands::NativeEventCommands/~NativeEventCommands/deleted copy operations",
        "NativeEventCommands::Registration::Registration/~Registration/retire/deleted copy operations",
        "NativeEventCommands::Route::Route/current/dispatchOriginal",
        "NativeEventCommands::enter/captureCurrentThread",
        "RawEvent::deferAfterListeners/continueAfterListeners",
        "NativeEventContinuation::NativeEventContinuation/run",
        "NativeEventListenerScope::NativeEventListenerScope/~NativeEventListenerScope/active/deleted copy operations",
        "NativeEventTaskScope::~NativeEventTaskScope/fail/finish (abstract interface)",
        "NativeEventTaskRenderingUpdate::NativeEventTaskRenderingUpdate/run",
        "RuntimeSchedulerBase/RuntimeScheduler/RuntimeScheduler_Modern::scheduleNativeEventWork",
    ],
    "unchangedImplementationInputs": {
        name: hashlib.sha256((sdk / name).read_bytes()).hexdigest()
        for name in ["ReactCommon/react/renderer/runtimescheduler/Task.cpp", "ReactCommon/react/utils/OnScopeExit.h", "ReactCommon/callinvoker/ReactCommon/SchedulerPriority.h"]
    },
    "CUISourceFiles": {
        name: hashlib.sha256((fixture.parents[3] / name).read_bytes()).hexdigest()
        for name in ["packages/react-native/cpp/FieldInputOwnedInput.h", "packages/react-native/cpp/FieldInputSubphase.h", "packages/react-native/cpp/FieldInputNativeOperation.h", "packages/react-native/cpp/form/FieldInputBinding.h", "packages/react-native/cpp/FieldInputRuntime.h", "packages/react-native/cpp/FieldInputTaskScope.h", "packages/react-native/cpp/FieldInputDispatchFrames.h", "packages/react-native/cpp/FieldInputOriginalCommand.h", "packages/react-native/cpp/FieldInputMount.h", "packages/react-native/ios/CUIFieldInputBinding.mm", "packages/react-native/android/src/main/jni/FormDocumentJNI.cpp"]
    },
    "fixtureFiles": {name: hashlib.sha256((fixture / name).read_bytes()).hexdigest() for name in ["field-sdk-task.cpp", "field-input-subphases.cpp"]},
    "scope": "Actual Task.cpp, SDK scope/registry and CUI frame/scope; exact lifecycle/checkpoint/render methods. Explicit surrounding JSI, queue, tracing and consistency doubles. No linked platform SDK, focus/default or installed acceptance.",
}
# The complete SDK/CUI and patch inventory exists before any compiler.
(output / "inventory.json").write_text(json.dumps(inventory, indent=2) + "\n")
source = (sdk / files[-1]).read_text()
masked = re.sub(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"', lambda match: " " * len(match[0]), source)
methods = []
for name in ["scheduleNativeEventWork", "runEventLoopTick", "executeTask", "performMicrotaskCheckpoint", "updateRendering", "scheduleRenderingUpdate"]:
    start = source.index("RuntimeScheduler_Modern::" + name + "(")
    start = source.rfind("\n", 0, start) + 1
    opening = source.index("{", start)
    depth = 1
    for end in range(opening + 1, len(masked)):
        depth += (masked[end] == "{") - (masked[end] == "}")
        if depth == 0:
            break
    else:
        raise AssertionError("Incomplete SDK method " + name)
    method = source[start:end + 1]
    if name == "scheduleNativeEventWork":
        assert method.index("nativeEventScopeFactory =") < method.index("scheduleTask(task)")
    if name == "runEventLoopTick":
        assert method.index("nativeEventScope = factory(runtime)") < method.index("executeTask(runtime") < method.index("performMicrotaskCheckpoint(runtime)") < method.index("updateRendering(taskEndTime)")
    methods.append(method)
(output / "task-method-excerpts.inc").write_text("// Copyright Meta Platforms, Inc. and affiliates. MIT; exact patched SDK source.\nnamespace facebook::react {\n" + "\n".join(methods) + "\n}\n")
stubs = output / "stubs"
headers = {
    "react/timing/primitives.h": '''#pragma once
namespace facebook::react {
struct HighResDuration { double value{}; static HighResDuration zero() { return {0}; } };
struct HighResTimeStamp { double value{}; static HighResTimeStamp now() { return {0}; } };
inline HighResTimeStamp operator+(HighResTimeStamp time, HighResDuration duration) { return {time.value + duration.value}; }
inline bool operator<=(HighResTimeStamp left, HighResTimeStamp right) { return left.value <= right.value; }
inline bool operator>(HighResTimeStamp left, HighResTimeStamp right) { return left.value > right.value; }
}
''',
    "jsi/jsi.h": '''#pragma once
#include <deque>
#include <functional>
#include <initializer_list>
#include <stdexcept>
#include <string>
namespace facebook::jsi {
class Runtime;
class Function;
class Object;
struct NativeState { virtual ~NativeState() = default; };
class Value {
 public:
  static Value undefined() { return {}; }
  bool isObject() const { return false; }
  Object getObject(Runtime &) const;
};
class Function { public: Value call(Runtime &, std::initializer_list<bool>) { return Value::undefined(); } };
class Object { public: bool isFunction(Runtime &) const { return false; } Function getFunction(Runtime &) const { return {}; } };
inline Object Value::getObject(Runtime &) const { return {}; }
class Runtime {
 public:
  std::deque<std::function<void()>> microtasks;
  int falseReturns{0};
  bool drainMicrotasks() {
    if (falseReturns > 0) { falseReturns--; return false; }
    while (!microtasks.empty()) { auto callback = std::move(microtasks.front()); microtasks.pop_front(); callback(); }
    return true;
  }
};
class JSError : public std::runtime_error { public: JSError(Runtime &, const std::string &value) : std::runtime_error(value) {} };
}
''',
}
for name, text in headers.items():
    path = stubs / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
executable = output / "field-sdk-task"
subprocess.run([
    "/usr/bin/clang++", "-std=c++20", "-pthread", "-Wall", "-Wextra", "-Werror", "-I" + str(stubs),
    "-I" + str(sdk / "ReactCommon"), "-I" + str(sdk / "ReactCommon/callinvoker"), "-I" + str(output),
    str(fixture / "field-sdk-task.cpp"), str(sdk / "ReactCommon/react/renderer/runtimescheduler/Task.cpp"), "-o", str(executable),
], check=True, timeout=30)
record = subprocess.check_output([str(executable)], text=True, timeout=8).strip()
subphase_executable = output / "field-input-subphases"
subprocess.run(["/usr/bin/clang++", "-std=c++20", "-pthread", "-Wall", "-Wextra", "-Werror", str(fixture / "field-input-subphases.cpp"), "-o", str(subphase_executable)], check=True, timeout=25)
subphase_record = subprocess.check_output([str(subphase_executable)], text=True, timeout=8).strip()
result = {"patchSHA256": inventory["patchSHA256"], "executable": record, "inputSubphases": subphase_record, "linkedSDKAcceptance": False, "installedAcceptance": False}
(output / "result.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
