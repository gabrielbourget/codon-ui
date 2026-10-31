import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess


repo = Path(__file__).resolve().parents[4]
fixture = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description="Characterize the exact locked SDK command queue boundary without a guest.")
parser.add_argument("--output", required=True, type=Path)
parser.add_argument("--sdk-root", type=Path, default=repo / "apps/native-showcase/node_modules/react-native")
parser.add_argument("--jdk", type=Path, default=Path(os.environ.get("JAVA_HOME", "/Users/gabrielbourget/.local/share/codon-native-lab/jdk/Contents/Home")))
args = parser.parse_args()
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=False)
sdk = args.sdk_root.resolve()
assert json.loads((sdk / "package.json").read_text())["version"] == "0.86.3"
sources = {}


def read(relative, root=sdk):
    path = root / relative
    value = path.read_text()
    sources[str(path.relative_to(root))] = {"root": "react-native@0.86.3" if root == sdk else "codon-ui", "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    return value


def method(source, signature):
    start = source.index(signature)
    opening = source.index("{", start)
    # Ignore literals/comments while balancing the original method's braces.
    masked = re.sub(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', lambda match: " " * len(match[0]), source)
    depth = 1
    for index in range(opening + 1, len(masked)):
        depth += (masked[index] == "{") - (masked[index] == "}")
        if depth == 0:
            return source[start:index + 1], source[:start].count("\n") + 1
    raise AssertionError("Original SDK method is incomplete")


scheduler_source = read("ReactCommon/react/renderer/scheduler/Scheduler.cpp")
scheduler, scheduler_line = method(scheduler_source, "void Scheduler::uiManagerDidDispatchCommand(")
assert "runtimeScheduler_->scheduleRenderingUpdate(" in scheduler
assert "delegate->schedulerDidDispatchCommand(shadowView, commandName, args);" in scheduler
(output / "scheduler-command-excerpt.inc").write_text("// Copyright Meta Platforms, Inc. and affiliates. MIT; exact current SDK excerpt.\n" + scheduler + "\n")

ios_source = read("React/Fabric/Mounting/RCTMountingManager.mm")
ios, ios_line = method(ios_source, "- (void)dispatchCommand:(ReactTag)reactTag")
assert "if (RCTIsMainQueue())" in ios and "RCTExecuteOnMainQueue(^{" in ios
assert ios.count("synchronouslyDispatchCommandOnUIThread:reactTag commandName:commandName args:args") == 2

android_source = read("ReactAndroid/src/main/java/com/facebook/react/fabric/FabricUIManager.java")
android, android_line = method(android_source, "public void dispatchCommand(\n      final int surfaceId,\n      final int reactTag,\n      final String commandId,")
assert android.count("mMountItemDispatcher.addViewCommandMountItem(") == 2
assert "tryDispatchMountItems" not in android
dispatcher_source = read("ReactAndroid/src/main/java/com/facebook/react/fabric/mounting/MountItemDispatcher.kt")
enqueue, enqueue_line = method(dispatcher_source, "fun addViewCommandMountItem(")
assert "viewCommandMountItems.add(mountItem)" in enqueue and "mountItems.add(mountItem)" in enqueue
assert "tryDispatchMountItems" not in enqueue
mount, mount_line = method(android_source, "private void scheduleMountItem(")
assert "if (shouldSchedule)" in mount and "mMountItemDispatcher.tryDispatchMountItems();" in mount
assert "mountItem != null" in mount and "!batchMountItem.isBatchEmpty()" in mount

runtime_source = read("ReactCommon/react/renderer/runtimescheduler/RuntimeScheduler_Modern.cpp")
synchronous, synchronous_line = method(runtime_source, "void RuntimeScheduler_Modern::executeNowOnTheSameThread(")
assert "executeSynchronouslyOnSameThread_CAN_DEADLOCK(" in synchronous
assert "deadline" not in synchronous and "wait_until" not in synchronous

native_mount = read("packages/react-native/cpp/FieldInputMount.h", repo)
early = native_mount.index("if (applied == currentRoot || !fieldInputRootEffectsChanged(")
delegate = native_mount.index("platform->schedulerShouldRenderTransactions(coordinator);")
assert early < native_mount.index("return {};", early) < delegate
read("packages/react-native/cpp/FieldInputDispatchFrames.h", repo)
read("packages/react-native/cpp/FieldInputRuntime.h", repo)
focus = read("src/private/webapis/dom/nodes/ReactNativeElement.js")
text_focus = read("Libraries/Components/TextInput/TextInputState.js")
commands = read("Libraries/Utilities/codegenNativeCommands.js")
assert "TextInputState.focusTextInput(this);" in focus
assert "iOSTextInputCommands.focus(textField);" in text_focus and "AndroidTextInputCommands.focus(textField);" in text_focus
assert "dispatchCommand(ref, command, args);" in commands

java_source = """// Copyright Meta Platforms, Inc. and affiliates. MIT; exact method below.
final class FabricUIManager {
  final CommandQueue mMountItemDispatcher = new CommandQueue();
  private Command createDispatchCommandMountItemForInterop(int surface, int target, String name, ReadableArray args) {
    return MountItemFactory.createDispatchCommandMountItem(surface, target, name, args);
  }
""" + android + "\n}\n"
(output / "FabricUIManager.java").write_text(java_source)
subprocess.run(["/usr/bin/clang++", "-std=c++20", "-pthread", "-I" + str(output), str(fixture / "field-command-boundary.cpp"), "-o", str(output / "field-command-boundary")], check=True, timeout=25)
cpp = subprocess.check_output([str(output / "field-command-boundary")], text=True, timeout=5).strip()
subprocess.run([str(args.jdk / "bin/javac"), "-d", str(output / "java"), str(output / "FabricUIManager.java"), str(fixture / "FieldCommandBoundaryContract.java")], check=True, timeout=20)
java = subprocess.check_output([str(args.jdk / "bin/java"), "-cp", str(output / "java"), "FieldCommandBoundaryContract"], text=True, timeout=5).strip()
report = {
    "reactNative": "0.86.3",
    "scope": "Exact SDK source excerpts with explicit queue/type doubles and actual Codon frames; no SDK binary, guest, focus or default acceptance",
    "result": "current-command-only-before-default-contract-not-satisfied",
    "sourceChecks": {"schedulerQueuesRenderingCallback": scheduler_line, "UIKitOffMainQueuesOriginalCommand": ios_line, "AndroidOriginalCommandEnqueues": android_line, "AndroidEnqueueDoesNotExecute": enqueue_line, "AndroidMountDrainRequiresRealWork": mount_line, "synchronousRuntimeEntryHasNoDeadline": synchronous_line, "CodonUnchangedEffectsSkipTransactionDelegate": True, "originalRefFocusUsesCommandPath": True},
    "executables": {"cpp": cpp, "java": java},
    "sources": sources,
}
(output / "result.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
