#include <fbjni/fbjni.h>
#include <react/fabric/FabricUIManagerBinding.h>
#include <react/fabric/JFabricUIManager.h>
#include <react/renderer/scheduler/Scheduler.h>
#include "FabricManager.h"
#include "DragActionJNI.h"
#include "PopFrame.h"
#include "PopPresentation.h"
#include "ViewportQuery.h"
#include "MotionDrawingJNI.h"
#include "BackdropJNI.h"
#include "ForegroundJNI.h"
#include "NativeFeatureRegistration.h"

namespace jni = facebook::jni;
using namespace facebook::react;

static jni::local_ref<jstring> nativePopFrame(
    jni::alias_ref<jclass>, jni::alias_ref<JFabricUIManager::javaobject> manager,
    jni::alias_ref<jstring> request) {
  if (!request) throw std::invalid_argument("Native popLayout: request required");
  const auto uiManager = scopedManager(manager);
  return jni::make_jstring(codon::motion::queryNativePopFrame(*uiManager, request->toStdString()));
}
static jni::local_ref<jstring> nativeViewport(
    jni::alias_ref<jclass>, jni::alias_ref<JFabricUIManager::javaobject> manager,
    jni::alias_ref<jstring> request) {
  if (!request) throw std::invalid_argument("Native viewport: request required");
  return jni::make_jstring(codon::motion::queryNativeViewport(*scopedManager(manager), request->toStdString()));
}
static jlong nativeCreatePop(jni::alias_ref<jclass>,
    jni::alias_ref<JFabricUIManager::javaobject> manager) {
  return reinterpret_cast<jlong>(new codon::motion::NativePopPresentation(scopedManager(manager)));
}
static jni::local_ref<jstring> nativePopRequest(jni::alias_ref<jclass>, jlong handle,
    jni::alias_ref<jstring> request) {
  if (!handle || !request) throw std::runtime_error("Native popLayout: session retired");
  return jni::make_jstring(reinterpret_cast<codon::motion::NativePopPresentation *>(handle)->request(request->toStdString()));
}
static void nativeClosePop(jni::alias_ref<jclass>, jlong handle) {
  delete reinterpret_cast<codon::motion::NativePopPresentation *>(handle);
}

extern "C" JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *) {
  return jni::initialize(vm, [] {
    codon::motion::registerMotionDrawingNatives(jni::Environment::current());
    registerDragActionNatives();
    registerBackdropNatives(jni::Environment::current());
    registerForegroundNatives(jni::Environment::current());
    registerNativeFeatureNatives();
    jni::findClassStatic("com/codonui/input/CUIMotionSnapshotModule")->registerNatives({
        makeNativeMethod("nativePopFrame", nativePopFrame),
        makeNativeMethod("nativeViewport", nativeViewport),
        makeNativeMethod("nativeCreatePop", nativeCreatePop),
        makeNativeMethod("nativePopRequest", nativePopRequest),
        makeNativeMethod("nativeClosePop", nativeClosePop)});
  });
}
