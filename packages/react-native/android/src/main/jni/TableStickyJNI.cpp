#include "TableStickyJNI.h"
#include "FabricManager.h"
#include "../../../../cpp/table/StickyPresentation.h"
#include <folly/json.h>
#include <limits>
#include <algorithm>

namespace jni = facebook::jni;
using namespace facebook::react;

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
static std::vector<std::string> tableFrameLeases(jni::alias_ref<jstring> encoded) {
  if (!encoded) throw std::invalid_argument("Table sticky: frame leases required");
  const auto input = folly::parseJson(encoded->toStdString());
  if (!input.isArray()) throw std::invalid_argument("Table sticky: frame leases required");
  std::vector<std::string> leases;
  for (const auto &lease : input) {
    if (!lease.isString() || lease.asString().empty()) throw std::invalid_argument("Table sticky: frame lease required");
    if (std::find(leases.begin(), leases.end(), lease.asString()) != leases.end()) throw std::invalid_argument("Table sticky: duplicate frame lease");
    leases.push_back(lease.asString());
  }
  return leases;
}
static jlong nativeTablePrepare(jni::alias_ref<jclass>, jlong handle, jni::alias_ref<jstring> leases) {
  return static_cast<jlong>(tableSession(handle).service->prepareFrames(tableFrameLeases(leases)));
}
static jboolean nativeTableFrames(jni::alias_ref<jclass>, jlong handle, jlong revision,
    jni::alias_ref<jstring> encodedLeases, jni::alias_ref<jdoubleArray> geometry) {
  const auto leases = tableFrameLeases(encodedLeases);
  if (!geometry || leases.size() > static_cast<size_t>(std::numeric_limits<jsize>::max()) / 8)
    throw std::invalid_argument("Table sticky: complete native frames required");
  const auto count = static_cast<jsize>(leases.size() * 8);
  auto *environment = jni::Environment::current();
  if (environment->GetArrayLength(geometry.get()) != count) throw std::invalid_argument("Table sticky: complete native frames required");
  std::vector<double> values(count);
  if (count) environment->GetDoubleArrayRegion(geometry.get(), 0, count, values.data());
  std::vector<std::pair<std::string, codon::table::TStickyViewport>> frames;
  for (size_t index = 0; index < leases.size(); index++) {
    const auto offset = index * 8;
    frames.push_back({leases[index], {values[offset], values[offset + 1], values[offset + 2], values[offset + 3],
        values[offset + 4], values[offset + 5], values[offset + 6], values[offset + 7]}});
  }
  return tableSession(handle).service->frames(static_cast<uint64_t>(revision), frames);
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

void registerTableStickyNatives() {
  jni::findClassStatic("com/codonui/input/CUITableNativeSession")->registerNatives({
        makeNativeMethod("nativeCreateTable", nativeCreateTable),
        makeNativeMethod("nativeTableRequest", nativeTableRequest),
        makeNativeMethod("nativeTableTargets", nativeTableTargets),
        makeNativeMethod("nativeTableSynchronize", nativeTableSynchronize),
        makeNativeMethod("nativeTableFrame", nativeTableFrame),
        makeNativeMethod("nativeTablePrepare", nativeTablePrepare),
        makeNativeMethod("nativeTableFrames", nativeTableFrames),
        makeNativeMethod("nativeTableRetire", nativeTableRetire),
        makeNativeMethod("nativeCloseTable", nativeCloseTable)});
}
