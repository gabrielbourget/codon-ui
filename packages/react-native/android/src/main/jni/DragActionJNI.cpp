#include "DragActionJNI.h"
#include "FabricManager.h"
#include "../../../../cpp/drag/ActionMount.h"
#include <ReactCommon/BindingsInstallerHolder.h>

namespace jni = facebook::jni;
using namespace facebook::react;
struct JDragActionDispatch : jni::JavaClass<JDragActionDispatch> {
  static constexpr auto kJavaDescriptor = "Lcom/codonui/input/CUIDragActionDispatch;";
};
static jni::local_ref<BindingsInstallerHolder::javaobject> nativeActionBindings(jni::alias_ref<jclass>, jni::alias_ref<jstring> lease) {
  if (!lease) throw std::invalid_argument("native-drag-module-identity-required");
  auto state = std::make_shared<codon::drag::ActionRuntime>(lease->toStdString()); codon::drag::registerRuntime(state);
  return BindingsInstallerHolder::newObjectCxxArgs([state](facebook::jsi::Runtime &, const std::shared_ptr<CallInvoker> &invoker) { state->install(invoker); });
}
static jboolean nativeAcceptsAction(jni::alias_ref<jclass>, jni::alias_ref<jstring> lease, jni::alias_ref<jstring> request) {
  auto state = lease ? codon::drag::runtimeFor(lease->toStdString()) : nullptr;
  return state && request && state->accepts(request->toStdString());
}
static jboolean nativeSettleAction(jni::alias_ref<jclass>, jni::alias_ref<jstring> lease, jni::alias_ref<jstring> request) {
  auto state = lease ? codon::drag::runtimeFor(lease->toStdString()) : nullptr;
  return state && request && state->settle(request->toStdString());
}
static void nativeRetireActions(jni::alias_ref<jclass>, jni::alias_ref<jstring> lease) {
  if (lease) codon::drag::retireRuntime(lease->toStdString());
}
static jni::local_ref<jstring> nativeDispatch(jni::alias_ref<jclass>, jni::alias_ref<JFabricUIManager::javaobject> manager,
    jni::alias_ref<JDragActionDispatch::javaobject> owner, jni::alias_ref<jstring> encodedIdentity, jni::alias_ref<jstring> payload, jboolean pointer) {
  if (!owner || !encodedIdentity || !payload) throw std::invalid_argument("native-drag-original-record-required");
  static const auto current = JDragActionDispatch::javaClassStatic()->getMethod<jboolean()>("current");
  static const auto witness = JDragActionDispatch::javaClassStatic()->getMethod<jni::local_ref<jstring>()>("mountWitness");
  const auto identity = codon::drag::identity(folly::parseJson(encodedIdentity->toStdString()));
  const auto original = std::make_shared<jni::global_ref<JDragActionDispatch::javaobject>>(jni::make_global(owner));
  return jni::make_jstring(codon::drag::run(codon::drag::runtimeFor(identity.moduleId), scopedManager(manager), identity,
    folly::parseJson(payload->toStdString()), pointer, [original] { return current(*original); }, [original] { return witness(*original)->toStdString(); }));
}
void registerDragActionNatives() {
  using jni::makeNativeMethod;
  jni::findClassStatic("com/codonui/input/CUIDragAndDropModule")->registerNatives({
    makeNativeMethod("nativeActionBindings", nativeActionBindings), makeNativeMethod("nativeAcceptsAction", nativeAcceptsAction),
    makeNativeMethod("nativeSettleAction", nativeSettleAction), makeNativeMethod("nativeRetireActions", nativeRetireActions)});
  JDragActionDispatch::javaClassStatic()->registerNatives({makeNativeMethod("nativeDispatch", nativeDispatch)});
}
