#include <fbjni/fbjni.h>
#include <react/fabric/FabricUIManagerBinding.h>
#include <react/fabric/JFabricUIManager.h>
#include <react/renderer/scheduler/Scheduler.h>
#include "SnapshotQuery.h"
#include "PopFrame.h"

namespace jni = facebook::jni;
using namespace facebook::react;

static std::shared_ptr<UIManager> scopedManager(
    jni::alias_ref<JFabricUIManager::javaobject> manager) {
  if (!manager) throw std::runtime_error("Native motion: actual manager unavailable");
  // Locked RN0.86.3 stores its Hybrid binding here; consumer rules retain it.
  static const auto field = JFabricUIManager::javaClassStatic()->getField<FabricUIManagerBinding::javaobject>("mBinding");
  auto nativeBinding = manager->getFieldValue(field);
  if (!nativeBinding) throw std::runtime_error("Native motion: Fabric binding retired");
  auto scheduler = nativeBinding->cthis()->getScheduler();
  if (!scheduler) throw std::runtime_error("Native motion: Fabric scheduler retired");
  auto uiManager = scheduler->getUIManager();
  if (!uiManager) throw std::runtime_error("Native motion: Fabric manager retired");
  return uiManager;
}

static jni::local_ref<jstring> nativeSnapshot(
    jni::alias_ref<jclass>, jni::alias_ref<JFabricUIManager::javaobject> manager,
    jint target, jni::alias_ref<jstring> owner, jni::alias_ref<jstring> binding,
    jni::alias_ref<jstring> revision) {
  if (!owner || !binding || !revision) throw std::runtime_error("Native motion: actual owner unavailable");
  const auto uiManager = scopedManager(manager);
  return jni::make_jstring(codon::motion::queryNativeFabricSnapshot(
      *uiManager, target, owner->toStdString(), binding->toStdString(), revision->toStdString()));
}

static jni::local_ref<jstring> nativePopFrame(
    jni::alias_ref<jclass>, jni::alias_ref<JFabricUIManager::javaobject> manager,
    jni::alias_ref<jstring> request) {
  if (!request) throw std::invalid_argument("Native popLayout: request required");
  const auto uiManager = scopedManager(manager);
  return jni::make_jstring(codon::motion::queryNativePopFrame(*uiManager, request->toStdString()));
}

extern "C" JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *) {
  return jni::initialize(vm, [] {
    jni::findClassStatic("com/codonui/input/CUIMotionSnapshotModule")->registerNatives({
        makeNativeMethod("nativeSnapshot", nativeSnapshot),
        makeNativeMethod("nativePopFrame", nativePopFrame)});
  });
}
