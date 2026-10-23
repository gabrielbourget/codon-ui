#include "FormDocumentJNI.h"
#include "FabricManager.h"
#include "../../../../cpp/form/FormDocumentQuery.h"
#include "../../../../cpp/form/FieldGroupQuery.h"
#include "../../../../cpp/FieldInputRuntime.h"
#include "../../../../cpp/form/FieldInputBinding.h"
#include <ReactCommon/BindingsInstallerHolder.h>

namespace jni = facebook::jni;
using namespace facebook::react;
struct JFieldInputBinding : jni::JavaClass<JFieldInputBinding> {
  static constexpr auto kJavaDescriptor = "Lcom/codonui/input/CUIFieldInputBinding;";
};

static jni::local_ref<jstring> nativeFormDocument(
    jni::alias_ref<jclass>, jni::alias_ref<JFabricUIManager::javaobject> manager,
    jint surface, jint target, jlong session, jni::alias_ref<jstring> group) {
  if (!session) throw std::invalid_argument("Native form: current module identity required");
  return jni::make_jstring(codon::form::queryFabricFormDocument(
      *scopedManager(manager), surface, target, *reinterpret_cast<codon::form::NativeFormDocumentSession *>(session), {},
      group ? group->toStdString() : ""));
}

static jlong nativeCreateFormSession(jni::alias_ref<jclass>, jni::alias_ref<jstring> identity) {
  if (!identity) throw std::invalid_argument("Native form: module identity required");
  return reinterpret_cast<jlong>(new codon::form::NativeFormDocumentSession(identity->toStdString()));
}
static jni::local_ref<jstring> nativeFormDocumentStamp(jni::alias_ref<jclass>,
    jni::alias_ref<JFabricUIManager::javaobject> manager, jint surface, jlong session) {
  if (!session) throw std::invalid_argument("Native form: current module identity required");
  return jni::make_jstring(codon::form::queryFabricFormDocumentStamp(*scopedManager(manager), surface,
      *reinterpret_cast<codon::form::NativeFormDocumentSession *>(session)));
}
static void nativeRetireFormSession(jni::alias_ref<jclass>, jlong session) {
  delete reinterpret_cast<codon::form::NativeFormDocumentSession *>(session);
}
static jni::local_ref<jstring> nativeFieldGroupSelection(jni::alias_ref<jclass>,
    jni::alias_ref<jstring> document, jni::alias_ref<jstring> snapshot) {
  if (!document || !snapshot) throw std::invalid_argument("field-group-original-snapshot-required");
  return jni::make_jstring(folly::toJson(codon::form::fieldGroupSelection(
    folly::parseJson(document->toStdString()), folly::parseJson(snapshot->toStdString()))));
}
static jni::local_ref<BindingsInstallerHolder::javaobject> nativeFieldBindings(jni::alias_ref<jclass>, jni::alias_ref<jstring> lease) {
  if (!lease) throw std::invalid_argument("field-input-runtime-lease-required");
  const auto state = std::make_shared<codon::FieldInputRuntime>();
  codon::registerFieldInputRuntime(lease->toStdString(), state);
  const auto identity = lease->toStdString();
  return BindingsInstallerHolder::newObjectCxxArgs([state, identity](facebook::jsi::Runtime &runtime, const std::shared_ptr<CallInvoker> &invoker) {
    state->install(invoker);
    const std::weak_ptr<codon::FieldInputRuntime> weak = state;
    auto focus = facebook::jsi::Function::createFromHostFunction(runtime,
      facebook::jsi::PropNameID::forAscii(runtime, "__cuiNativeFieldInputMoveFocus"), 2,
      [weak, identity](facebook::jsi::Runtime &runtime, const facebook::jsi::Value &, const facebook::jsi::Value *args, size_t count) {
        const auto current = weak.lock();
        const auto result = current && current->ready() && count == 2 && args[0].isString() && args[1].isString() &&
          args[0].getString(runtime).utf8(runtime) == identity ? current->moveFocus(runtime, args[1].getString(runtime).utf8(runtime)) : "";
        return facebook::jsi::String::createFromUtf8(runtime, result);
      });
    runtime.global().setProperty(runtime, "__cuiNativeFieldInputMoveFocus", std::move(focus));
  });
}
static jboolean nativeSettleField(jni::alias_ref<jclass>, jni::alias_ref<jstring> lease, jni::alias_ref<jstring> request) {
  if (!lease || !request) return false;
  const auto state = codon::fieldInputRuntime(lease->toStdString());
  return state && state->ready() && codon::settleFieldInput(state->frames, request->toStdString());
}
static jboolean nativeAcceptsField(jni::alias_ref<jclass>, jni::alias_ref<jstring> lease, jni::alias_ref<jstring> request) {
  if (!lease || !request) return false;
  const auto state = codon::fieldInputRuntime(lease->toStdString());
  return state && state->ready() && codon::acceptsFieldInput(state->frames, request->toStdString());
}
static void nativeRetireField(jni::alias_ref<jclass>, jni::alias_ref<jstring> lease) {
  if (lease) codon::retireFieldInputRuntime(lease->toStdString());
}
static void nativeRetireBinding(jni::alias_ref<jclass>, jni::alias_ref<jstring> lease, jni::alias_ref<jstring> owner, jni::alias_ref<jstring> binding) {
  if (!lease || !owner || !binding) return;
  const auto state = codon::fieldInputRuntime(lease->toStdString());
  if (state) state->frames.retireBinding(owner->toStdString(), binding->toStdString());
}
static jni::local_ref<jstring> nativeDispatchFieldKey(jni::alias_ref<jclass>,
    jni::alias_ref<JFabricUIManager::javaobject> managerObject, jni::alias_ref<JFieldInputBinding::javaobject> owner,
    jni::alias_ref<jstring> documentValue, jni::alias_ref<jstring> snapshotValue, jni::alias_ref<jstring> keyValue,
    jni::alias_ref<jstring> declarations, jdouble epoch) {
  using namespace codon;
  using namespace codon::form;
  if (!owner || !documentValue || !snapshotValue || !keyValue || !declarations) throw std::invalid_argument("field-input-native-original-record-required");
  const auto manager = scopedManager(managerObject);
  const auto document = folly::parseJson(documentValue->toStdString()), snapshot = folly::parseJson(snapshotValue->toStdString());
  auto key = folly::parseJson(keyValue->toStdString());
  const auto binding = fieldInputBinding(document);
  const auto target = fieldGroupTarget(key.at("target"));
  if (snapshot.at("focusedTarget") != target) throw std::invalid_argument("field-input-original-focus-retired");
  auto fabric = captureFabricFormDocument(*manager, fieldGroupTarget(document.at("surfaceId")));
  if (document.at("revision").asString() != std::to_string(fabric.revision) || !fabric.positions.contains(target))
    throw std::invalid_argument("field-input-original-document-retired");
  const auto original = fabric.preorder[fabric.positions.at(target)].node;
  const auto targetRow = fieldInputOriginal(snapshot, target);
  if (const auto owner = targetRow.get_ptr("hostOwnerId")) key["ownerId"] = *owner;
  const auto state = fieldInputRuntime(binding.moduleLease);
  if (!state || !state->ready()) throw std::invalid_argument("field-input-runtime-unavailable");
  std::vector<TFieldInputBinding> registered;
  std::vector<FieldInputIdentity> scopes;
  for (const auto &entry : folly::parseJson(declarations->toStdString())) {
    const auto scopeDocument = folly::parseJson(entry.at("encodedDocument").asString());
    const auto scopeBinding = fieldInputBinding(scopeDocument);
    if (scopeBinding.moduleLease != binding.moduleLease) throw std::invalid_argument("field-input-original-scope-module-retired");
    registered.push_back(scopeBinding);
    scopes.push_back(fieldInputIdentity(scopeDocument, entry.at("snapshot"), scopeBinding, target, fieldInputInteger(entry.at("epoch"))));
  }
  const auto groups = orderedFieldInputGroups(document, registered, target);
  const auto identity = fieldInputIdentity(document, snapshot, binding, target, fieldInputInteger(folly::dynamic(epoch)));
  const auto eventId = fieldInputInteger(key.at("eventId"));
  const auto phase = key.at("cancelled").asBool() ? "cancel" : key.at("phase").asString();
  const auto ticket = state->frames.begin(identity, eventId, phase, std::chrono::milliseconds(1000), std::move(scopes));
  if (!ticket) throw std::invalid_argument("field-input-original-frame-retired");
  FieldInputFrameLifetime lifetime(state->frames, ticket);
  key["fieldDispatch"] = folly::toJson(fieldInputPacket(ticket, binding, groups));
  const auto before = key;
  const std::weak_ptr<const RootShadowNode> weakRoot = fabric.root;
  const std::weak_ptr<UIManager> weakManager = manager;
  const auto revision = fabric.revision;
  const bool scheduled = state->schedule(ticket, manager, original, "nativeFieldKey", std::move(key),
    HighResTimeStamp::fromDOMHighResTimeStamp(before.at("timestamp").asDouble()), [weakRoot, weakManager, revision] {
      const auto manager = weakManager.lock(); const auto root = weakRoot.lock();
      return manager && root && isFabricFormDocumentCurrent(*manager, {root, revision, {}, {}});
    });
  const auto waited = scheduled ? state->frames.wait(ticket, [&](const FieldInputFocusAction &action) {
    static const auto read = JFieldInputBinding::javaClassStatic()->getMethod<jni::local_ref<jstring>(jint)>("currentScopeSnapshot");
    static const auto focus = JFieldInputBinding::javaClassStatic()->getMethod<jni::local_ref<jstring>(jstring)>("focus");
    const auto expectedScope = ticket->scopeFor(action.groupTarget);
    if (!expectedScope) throw std::invalid_argument("field-input-focus-scope-not-admitted");
    const auto value = folly::parseJson(read(owner, action.groupTarget)->toStdString());
    const auto currentDocument = folly::parseJson(value.at("encodedDocument").asString());
    const auto &currentSnapshot = value.at("fieldGroupSnapshot");
    if (!fieldInputScopeCurrent(*expectedScope, currentDocument, currentSnapshot, fieldInputInteger(value.at("scopeEpoch"))))
      throw std::invalid_argument("field-input-focus-scope-retired");
    const auto selected = fieldInputFocusTarget(currentDocument, currentSnapshot, action);
    FieldInputFocusResult result;
    if (!selected) { result.current = true; return result; }
    const auto row = fieldInputOriginal(currentSnapshot, selected);
    std::unordered_set<int32_t> members;
    for (const auto &node : currentDocument.at("fieldGroup").at("nodes")) members.insert(fieldGroupTarget(node.at("target")));
    members.insert(action.groupTarget);
    const auto request = folly::toJson(folly::dynamic::object("target", selected)("original", row)
      ("epoch", expectedScope->epoch)("scopeTarget", action.groupTarget));
    return state->captureFocusEvents(ticket, manager, [&](const RawEvent &event) {
      const auto family = event.shadowNodeFamily.lock();
      return family && family->getSurfaceId() == identity.surfaceId && members.contains(family->getTag()) && event.type != "topNativeFieldKey";
    }, [&] {
      const auto response = folly::parseJson(focus(owner, jni::make_jstring(request).get())->toStdString());
      return FieldInputFocusResult{response.at("requested").asBool(), response.at("observed").asBool(), response.at("current").asBool(),
        static_cast<int32_t>(response.at("target").asInt()), response.at("nativeInstance").asString(), response.at("editorInstance").asString(), response.at("error").asString()};
    });
  }) : FieldInputDecision{FieldInputDisposition::Retired, {}, false, false};
  bool current = false;
  try {
    static const auto read = JFieldInputBinding::javaClassStatic()->getMethod<jni::local_ref<jstring>()>("currentSnapshot");
    const auto value = folly::parseJson(read(owner)->toStdString());
    const auto afterDocument = folly::parseJson(value.at("encodedDocument").asString());
    const auto afterBinding = fieldInputBinding(afterDocument);
    current = afterBinding.bindingId == binding.bindingId && afterBinding.bindingRevision == binding.bindingRevision &&
      afterBinding.moduleLease == binding.moduleLease && value.at("fieldGroupSnapshot").at("windowId") == identity.windowId;
    static const auto readScope = JFieldInputBinding::javaClassStatic()->getMethod<jni::local_ref<jstring>(jint)>("currentScopeSnapshot");
    for (const auto &scope : ticket->scopes) {
      const auto scoped = folly::parseJson(readScope(owner, scope.outerTarget)->toStdString());
      current = current && fieldInputScopeCurrent(scope, folly::parseJson(scoped.at("encodedDocument").asString()),
        scoped.at("fieldGroupSnapshot"), fieldInputInteger(scoped.at("scopeEpoch")));
    }
  } catch (const std::exception &) { current = false; }
  const auto decision = state->frames.end(ticket, current);
  return jni::make_jstring(folly::toJson(folly::dynamic::object("kind", "key")("event", before)("identity", encodeFieldInputIdentity(identity))
    ("wait", fieldInputDispositionName(waited.disposition))("decision", fieldInputDispositionName(decision.disposition))
    ("deliveryStarted", decision.deliveryStarted)("deliveryReturned", decision.deliveryReturned)("error", decision.error)));
}

void registerFormDocumentNatives() {
  JFieldInputBinding::javaClassStatic()->registerNatives({makeNativeMethod("nativeDispatchFieldKey", nativeDispatchFieldKey),
    makeNativeMethod("nativeRetireBinding", nativeRetireBinding)});
  jni::findClassStatic("com/codonui/input/CUIEditorKeyboardDefaultsModule")->registerNatives({
    makeNativeMethod("nativeFieldBindings", nativeFieldBindings), makeNativeMethod("nativeSettleField", nativeSettleField),
    makeNativeMethod("nativeAcceptsField", nativeAcceptsField), makeNativeMethod("nativeRetireField", nativeRetireField)});
  jni::findClassStatic("com/codonui/input/CUIFormDocumentModule")->registerNatives({
    makeNativeMethod("nativeFormDocument", nativeFormDocument),
    makeNativeMethod("nativeFormDocumentStamp", nativeFormDocumentStamp),
    makeNativeMethod("nativeFieldGroupSelection", nativeFieldGroupSelection),
    makeNativeMethod("nativeCreateFormSession", nativeCreateFormSession),
    makeNativeMethod("nativeRetireFormSession", nativeRetireFormSession)});
}
