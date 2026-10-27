#include <fbjni/fbjni.h>
#include <react/fabric/FabricUIManagerBinding.h>
#include <react/fabric/JFabricUIManager.h>
#include <react/renderer/scheduler/Scheduler.h>
#include "SnapshotQuery.h"
#include "FabricManager.h"
#include "FormDocumentJNI.h"
#include "PopFrame.h"
#include "PopPresentation.h"
#include "ViewportQuery.h"
#include "InitialValueQuery.h"
#include "MotionDrawingJNI.h"
#include "BackdropJNI.h"
#include "MotionIntrinsicsJNI.h"
#include "GeometryQuery.h"
#include "../../../../cpp/table/StickyPresentation.h"
#include <folly/json.h>

namespace jni = facebook::jni;
using namespace facebook::react;

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
static jni::local_ref<jstring> nativeInitialValue(
    jni::alias_ref<jclass>, jni::alias_ref<JFabricUIManager::javaobject> manager,
    jint target, jni::alias_ref<jstring> owner, jni::alias_ref<jstring> binding,
    jni::alias_ref<jstring> revision, jni::alias_ref<jstring> name) {
  if (!owner || !binding || !revision || !name) throw std::invalid_argument("Native motion: initial value identity required");
  return jni::make_jstring(codon::motion::queryNativeInitialValue(*scopedManager(manager), target,
      owner->toStdString(), binding->toStdString(), revision->toStdString(), name->toStdString()));
}
static jni::local_ref<jstring> nativeViewport(
    jni::alias_ref<jclass>, jni::alias_ref<JFabricUIManager::javaobject> manager,
    jni::alias_ref<jstring> request) {
  if (!request) throw std::invalid_argument("Native viewport: request required");
  return jni::make_jstring(codon::motion::queryNativeViewport(*scopedManager(manager), request->toStdString()));
}
static jni::local_ref<jstring> nativeEvaluatedLayout(
    jni::alias_ref<jclass>, jni::alias_ref<JFabricUIManager::javaobject> manager,
    jint target, jni::alias_ref<jstring> owner, jni::alias_ref<jstring> binding,
    jni::alias_ref<jstring> revision, jni::alias_ref<jobject> context, jni::alias_ref<jstring> request, jlong presentation) {
  if (!owner || !binding || !revision || !context || !request)
    throw std::invalid_argument("Native motion layout: actual owner/context required");
  const auto factory = [context](const codon::motion::TNativeFabricSnapshot &snapshot,
      const codon::motion::TNativeScratchPropsResolver &props, const codon::motion::TNativeFabricReadGuard &check) {
    return codon::motion::createAndroidIntrinsicResolver(snapshot, snapshot.target->getContextContainer(), context, check, props);
  };
  const auto authored = [presentation](const ShadowNode &node) {
    return presentation ? reinterpret_cast<codon::motion::NativePopPresentation *>(presentation)->authoredProps(node) : node.getProps();
  };
  return jni::make_jstring(codon::motion::queryNativeEvaluatedLayout(*scopedManager(manager), target,
      owner->toStdString(), binding->toStdString(), revision->toStdString(), request->toStdString(), factory, {}, authored));
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

struct NativeTableSession {
  std::shared_ptr<codon::table::NativeTableStickyPresentation> service;
};
static jlong nativeCreateTable(jni::alias_ref<jclass>,
    jni::alias_ref<JFabricUIManager::javaobject> manager, jni::alias_ref<jobject> module) {
  auto session = std::make_unique<NativeTableSession>();
  session->service = std::make_shared<codon::table::NativeTableStickyPresentation>(scopedManager(manager));
  auto weakModule = jni::make_weak(module);
  auto mounted = module->getClass()->getMethod<void()>("onTableStickyMount");
  session->service->setMountCallback([weakModule, mounted] {
    jni::ThreadScope scope;
    auto target = weakModule.lockLocal();
    if (!target) return;
    mounted(target);
  });
  return reinterpret_cast<jlong>(session.release());
}
static NativeTableSession &tableSession(jlong handle) {
  if (!handle) throw std::runtime_error("Table sticky: module retired");
  return *reinterpret_cast<NativeTableSession *>(handle);
}
static jni::local_ref<jstring> nativeTableRequest(jni::alias_ref<jclass>, jlong handle, jni::alias_ref<jstring> request) {
  if (!request) throw std::invalid_argument("Table sticky: request required");
  return jni::make_jstring(tableSession(handle).service->request(request->toStdString()));
}
static jni::local_ref<jstring> nativeTableTargets(jni::alias_ref<jclass>, jlong handle) {
  auto result = folly::dynamic::array();
  for (const auto &entry : tableSession(handle).service->targets())
    result.push_back(folly::dynamic::object("lease", entry.lease)("target", entry.target)
        ("containingRoot", entry.containingRoot)("session", entry.session));
  return jni::make_jstring(folly::toJson(result));
}
static void nativeTableSynchronize(jni::alias_ref<jclass>, jlong handle) { tableSession(handle).service->synchronize(); }
static void nativeTableFrame(jni::alias_ref<jclass>, jlong handle, jni::alias_ref<jstring> lease, jni::alias_ref<jdoubleArray> geometry) {
  if (!lease || !geometry) throw std::invalid_argument("Table sticky: frame required");
  auto *environment = jni::Environment::current();
  if (environment->GetArrayLength(geometry.get()) != 8) throw std::invalid_argument("Table sticky: complete native frame required");
  std::array<double, 8> values;
  environment->GetDoubleArrayRegion(geometry.get(), 0, 8, values.data());
  tableSession(handle).service->frame(lease->toStdString(),
      {values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7]});
}
static void nativeTableRetire(jni::alias_ref<jclass>, jlong handle, jni::alias_ref<jstring> lease) {
  if (lease) tableSession(handle).service->retire(lease->toStdString());
}
static void nativeCloseTable(jni::alias_ref<jclass>, jlong handle) {
  if (!handle) return;
  std::unique_ptr<NativeTableSession> session(reinterpret_cast<NativeTableSession *>(handle));
  session->service->setMountCallback({});
  session->service->close();
}

extern "C" JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *) {
  return jni::initialize(vm, [] {
    codon::motion::registerMotionDrawingNatives(jni::Environment::current());
    registerFormDocumentNatives();
    registerBackdropNatives(jni::Environment::current());
    jni::findClassStatic("com/codonui/input/CUIMotionSnapshotModule")->registerNatives({
        makeNativeMethod("nativeSnapshot", nativeSnapshot),
        makeNativeMethod("nativeInitialValue", nativeInitialValue),
        makeNativeMethod("nativeEvaluatedLayout", nativeEvaluatedLayout),
        makeNativeMethod("nativePopFrame", nativePopFrame),
        makeNativeMethod("nativeViewport", nativeViewport),
        makeNativeMethod("nativeCreatePop", nativeCreatePop),
        makeNativeMethod("nativePopRequest", nativePopRequest),
        makeNativeMethod("nativeClosePop", nativeClosePop),
        makeNativeMethod("nativeCreateTable", nativeCreateTable),
        makeNativeMethod("nativeTableRequest", nativeTableRequest),
        makeNativeMethod("nativeTableTargets", nativeTableTargets),
        makeNativeMethod("nativeTableSynchronize", nativeTableSynchronize),
        makeNativeMethod("nativeTableFrame", nativeTableFrame),
        makeNativeMethod("nativeTableRetire", nativeTableRetire),
        makeNativeMethod("nativeCloseTable", nativeCloseTable)});
  });
}
