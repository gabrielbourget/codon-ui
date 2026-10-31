import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

fixture = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description="Compile and exercise the actual Android SDK command dispatcher and scoped original item.")
parser.add_argument("--sdk-root", required=True, type=Path)
parser.add_argument("--patch", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
parser.add_argument("--compile-inputs", type=Path, help="JSON of the actual Gradle Java compiler classpath and CUI sources")
parser.add_argument("--sdk-classes", type=Path, help="Matching complete SDK classes.jar for Kotlin internal visibility")
args = parser.parse_args()
assert bool(args.compile_inputs) == bool(args.sdk_classes), "Real compiler inputs and complete SDK classes are required together"
sdk = args.sdk_root.resolve()
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=False)
assert json.loads((sdk / "package.json").read_text())["version"] == "0.86.3"
patch = args.patch.read_bytes()
files = sorted(set(re.findall(r'^diff --git a/(.*?) b/', patch.decode(), re.M)))
assert len(files) == 25 and all((sdk / name).is_file() for name in files)
android = sdk / "ReactAndroid/src/main/java/com/facebook/react"
implementations = [
    android / "fabric/mounting/MountItemDispatcher.kt", android / "fabric/mounting/NativeEventCommandScope.kt",
    android / "fabric/mounting/mountitems/MountItem.kt", android / "fabric/mounting/mountitems/DispatchCommandMountItem.kt",
    android / "fabric/mounting/mountitems/DispatchStringCommandMountItem.kt",
]
inventory = {
    "sdk": "react-native@0.86.3", "patchSHA256": hashlib.sha256(patch).hexdigest(),
    "sourceFiles": {name: hashlib.sha256((sdk / name).read_bytes()).hexdigest() for name in files},
    "changedExistingMethods": [
        "UIManagerBinding::dispatchEventToJS (internal renderer helper after original pointer processing)",
        "Scheduler::uiManagerDidDispatchCommand", "EventDispatcher::dispatchEvent/dispatchUniqueEvent", "EventListenerContainer::willDispatchEvent",
        "RuntimeScheduler_Modern::runEventLoopTick/executeTask/performMicrotaskCheckpoint/scheduleRenderingUpdate",
        "MountItemDispatcher::addViewCommandMountItem (internal renderer enqueue, not a replaced delegate)",
    ],
    "newAndroidMethods": [
        "FabricUIManager::checkNativeEventCommandBoundary/beginNativeEventCommand",
        "MountItemDispatcher::checkNativeEventCommandBoundary/beginNativeEventCommand/endNativeEventCapture/nativeEventSurfaceCurrent/drainNativeEventCommands",
        "NativeEventCommandScope::constructor/capture/isCurrent/reject/finishAndDrain/wasExecuted/getError/close",
        "NativeEventCommandScope::captured original item getSurfaceId/toString/execute",
    ],
    "additiveCPPMethods": [
        "UIManagerBinding::getNativeEventPayloads; NativeEventPayloads constructor/destructor/enter/before/deleted copy operations; Entry/State/Registration construction/destruction/retire",
        "UIManager::getNativeEventCommands; NativeEventCommand constructor/status/claim/cancel/executeOriginal",
        "NativeEventCommands Entry/Registration/Route constructors; registry constructor/destructor/enter/captureCurrentThread; Registration destructor/retire; Route current/dispatchOriginal; deleted copy operations",
        "RawEvent::deferAfterListeners/continueAfterListeners; NativeEventContinuation constructor/run; NativeEventListenerScope constructor/destructor/active/deleted copy operations",
        "NativeEventTaskScope destructor/fail/finish abstract; NativeEventTaskRenderingUpdate constructor/run; RuntimeSchedulerBase/RuntimeScheduler/RuntimeScheduler_Modern::scheduleNativeEventWork",
        "EventQueue/EventDispatcher/Scheduler::dispatchOriginalNativeEvents",
    ],
    "actualKotlinInputs": {str(path.relative_to(sdk)): hashlib.sha256(path.read_bytes()).hexdigest() for path in implementations},
    "CUISourceFiles": {name: hashlib.sha256((fixture.parents[3] / name).read_bytes()).hexdigest() for name in [
        "packages/react-native/cpp/FieldInputDispatchFrames.h", "packages/react-native/cpp/FieldInputOriginalCommand.h",
        "packages/react-native/cpp/FieldInputCommandExecution.h", "packages/react-native/cpp/FieldInputRuntime.h",
        "packages/react-native/cpp/FieldInputMount.h", "packages/react-native/android/src/main/java/com/codonui/input/CUIFieldInputBinding.java",
        "packages/react-native/android/src/main/jni/FormDocumentJNI.cpp", "packages/react-native/ios/CUIFieldInputBinding.mm",
    ]},
    "scope": "Actual SDK dispatcher/scope/original command classes; explicit Android/manager/logging doubles. Actual CUI UI-stack capability. No Android boot, linked application or native effect verdict.",
}
(output / "inventory.json").write_text(json.dumps(inventory, indent=2) + "\n")
root = Path("/Users/gabrielbourget/.local/share/codon-native-lab/gradle/caches/modules-2/files-2.1")
def jar(group, name, version=None):
    candidates = sorted((root / group / name).glob((version or "*") + "/*/*.jar"))
    assert len(candidates) == 1, (name, candidates)
    return candidates[0]
compiler = jar("org.jetbrains.kotlin", "kotlin-compiler-embeddable", "2.1.20")
stdlib = jar("org.jetbrains.kotlin", "kotlin-stdlib", "2.1.20")
infer = jar("com.facebook.infer.annotation", "infer-annotation", "0.18.0")
compiler_jars = [compiler, stdlib]
for group, name in [("org.jetbrains.kotlin", "kotlin-script-runtime"), ("org.jetbrains.kotlin", "kotlin-reflect"), ("org.jetbrains.kotlin", "kotlin-daemon-embeddable"), ("org.jetbrains.intellij.deps", "trove4j"), ("org.jetbrains", "annotations"), ("org.jetbrains.kotlinx", "kotlinx-coroutines-core-jvm")]:
    candidates = sorted((root / group / name).glob("*/*/*.jar"))
    if candidates:
        compiler_jars.append(candidates[-1])
java = Path("/Users/gabrielbourget/.local/share/codon-native-lab/jdk/Contents/Home/bin/java")
stubs = {
    "clock.kt": '''package android.os
object SystemClock { var time: Long = 0; @JvmStatic fun uptimeMillis(): Long = time }
''',
    "view.kt": '''package android.view
class View { companion object { const val NO_ID = -1 }; fun draw(body: () -> Unit) { body() }; fun layout(body: () -> Unit) { body() } }
''',
    "annotations.kt": '''package androidx.annotation
annotation class UiThread
annotation class AnyThread
''',
    "proguard.kt": '''package com.facebook.proguard.annotations
annotation class DoNotStripAny
''',
    "log.kt": '''package com.facebook.common.logging
object FLog { @JvmStatic fun e(vararg args: Any?) {} }
''',
    "bridge.kt": '''package com.facebook.react.bridge
interface ReadableArray
open class RetryableMountingLayerException(value: String): RuntimeException(value)
class ReactNoCrashSoftException(value: String, cause: Throwable): RuntimeException(value, cause)
object ReactIgnorableMountingException { fun isIgnorable(error: Throwable): Boolean = false }
object ReactSoftExceptionLogger { val errors = mutableListOf<Throwable>(); fun logSoftException(tag: String, error: Throwable) { errors.add(error) } }
object UiThreadUtil { var ui = true; @JvmStatic fun isOnUiThread(): Boolean = ui; @JvmStatic fun assertOnUiThread() { check(ui) { "ui-thread-required" } } }
''',
    "fabric.kt": '''package com.facebook.react.fabric
class FabricUIManager { companion object { const val IS_DEVELOPMENT_ENVIRONMENT = false } }
''',
    "flags.kt": '''package com.facebook.react.internal.featureflags
object ReactNativeFeatureFlags { var late = false; fun disableEarlyViewCommandExecution(): Boolean = late; fun enableFabricLogs(): Boolean = false }
''',
    "trace.kt": '''package com.facebook.react.internal.tracing
object PerformanceTracer { fun trace(name: String, category: String, track: String, body: () -> Unit) { body() } }
''',
    "systrace.kt": '''package com.facebook.systrace
object Systrace { const val TRACE_TAG_REACT = 0L; fun beginSection(tag: Long, name: String) {}; fun endSection(tag: Long) {} }
''',
    "manager.kt": '''package com.facebook.react.fabric.mounting
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.RetryableMountingLayerException
import com.facebook.react.fabric.mounting.mountitems.MountItem
internal class MountingManager {
  var stopped = false; var waiting = false; var failure: RuntimeException? = null
  val views = mutableSetOf<Int>(); val trace = mutableListOf<String>(); val commands = mutableListOf<String>(); val argumentObjects = mutableListOf<ReadableArray>(); val attached = mutableListOf<MountItem>()
  fun surfaceIsStopped(surface: Int): Boolean = stopped
  fun isWaitingForViewAttach(surface: Int): Boolean = waiting
  fun getSurfaceManager(surface: Int): SurfaceMountingManager? = SurfaceMountingManager(this)
  fun getSurfaceManagerEnforced(surface: Int, label: String): SurfaceMountingManager = SurfaceMountingManager(this)
  fun receiveCommand(surface: Int, target: Int, name: String, arguments: ReadableArray) {
    if (!views.contains(target)) throw RetryableMountingLayerException("missing original target")
    trace.add("command:$name:$target"); commands.add("$name:$target"); argumentObjects.add(arguments)
    failure?.let { throw it }
  }
}
internal class SurfaceMountingManager(private val manager: MountingManager) { fun scheduleMountItemOnViewAttach(item: MountItem) { manager.attached.add(item) }; fun printSurfaceState() {} }
''',
}
paths = []
for name, value in stubs.items():
    path = output / name
    path.write_text(value)
    paths.append(path)
classes = output / "classes"
command = [str(java), "-Xmx768m", "-cp", ":".join(map(str, compiler_jars)), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-no-stdlib", "-no-reflect", "-jvm-target", "17", "-classpath", str(stdlib) + ":" + str(infer), "-d", str(classes)]
command += list(map(str, implementations + paths + [fixture / "android-sdk-command-drain.kt"]))
(output / "compiler-command.json").write_text(json.dumps(command, indent=2) + "\n")
subprocess.run(command, check=True, timeout=50)
record = subprocess.check_output([str(java), "-cp", str(classes) + ":" + str(stdlib) + ":" + str(infer), "com.facebook.react.fabric.mounting.Android_sdk_command_drainKt"], text=True, timeout=8).strip()
cpp = output / "field-command-execution"
subprocess.run(["/usr/bin/clang++", "-std=c++20", "-pthread", "-Wall", "-Wextra", "-Werror", str(fixture / "field-command-execution.cpp"), "-o", str(cpp)], check=True, timeout=20)
cpp_record = subprocess.check_output([str(cpp)], text=True, timeout=5).strip()
result = {"patchSHA256": inventory["patchSHA256"], "actualSDKDispatcher": record, "CUIExecutionCapability": cpp_record, "nativeOrInstalledAcceptance": False}
if args.compile_inputs:
    inputs = json.loads(args.compile_inputs.read_text())
    sdk_classes = args.sdk_classes.resolve()
    classpath = [str(sdk_classes)] + inputs["classpath"]
    facade = android / "fabric/FabricUIManager.java"
    java_sources = list(map(Path, inputs["sources"]))
    real_inventory = {
        "patchSHA256": inventory["patchSHA256"],
        "sources": {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in implementations + [facade] + java_sources},
        "classpath": {path: hashlib.sha256(Path(path).read_bytes()).hexdigest() for path in classpath},
        "scope": "Actual cached Android dependencies and all CUI Java/codegen sources; no linked SDK/application or native acceptance.",
    }
    (output / "real-compiler-inventory.json").write_text(json.dumps(real_inventory, indent=2) + "\n")
    kotlin_output, sdk_java_output, cui_java_output = [output / name for name in ["real-sdk-kotlin", "real-sdk-java", "real-cui-java"]]
    real_command = command[:command.index("-classpath")] + ["-classpath", ":".join(classpath), "-Xfriend-paths=" + str(sdk_classes), "-module-name", "ReactAndroid_release", "-d", str(kotlin_output)] + list(map(str, implementations))
    (output / "real-kotlin-command.json").write_text(json.dumps(real_command, indent=2) + "\n")
    subprocess.run(real_command, check=True, timeout=50)
    for name, destination, sources, overlays in [
        ("sdk-java", sdk_java_output, [facade], [kotlin_output]),
        ("cui-java", cui_java_output, java_sources, [sdk_java_output, kotlin_output]),
    ]:
        real_command = [str(java.with_name("javac")), "-proc:none", "-source", inputs["sourceCompatibility"], "-target", inputs["targetCompatibility"], "-classpath", ":".join(list(map(str, overlays)) + classpath), "-d", str(destination)] + list(map(str, sources))
        (output / ("real-" + name + "-command.json")).write_text(json.dumps(real_command, indent=2) + "\n")
        subprocess.run(real_command, check=True, timeout=50)
    result["realDependencyCompilation"] = {"SDKKotlinSources": len(implementations), "SDKJavaSources": 1, "CUIJavaSources": len(java_sources), "allPassed": True}
(output / "result.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
