#include "FormDocumentJNI.h"
#include "FabricManager.h"
#include "../../../../cpp/form/FormDocumentQuery.h"
#include "../../../../cpp/form/FieldGroupQuery.h"
#include "../../../../cpp/FieldInputRuntime.h"
#include "../../../../cpp/FieldInputOriginalCapture.h"
#include "../../../../cpp/FieldInputCommandExecution.h"
#include "../../../../cpp/form/FieldInputBinding.h"
#include <ReactCommon/BindingsInstallerHolder.h>
#include <fbjni/NativeRunnable.h>

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
static jni::local_ref<jstring> nativeTakeFieldRecords(jni::alias_ref<jclass>, jni::alias_ref<jstring> lease) {
  const auto state = lease ? codon::fieldInputRuntime(lease->toStdString()) : nullptr;
  if (!state) throw std::runtime_error("field-input-receipt-module-retired");
  return jni::make_jstring(state->takeRecords());
}
static void nativeRecordFieldInput(jni::alias_ref<jclass>, jni::alias_ref<jstring> lease, jni::alias_ref<jstring> encoded) {
  const auto state = lease ? codon::fieldInputRuntime(lease->toStdString()) : nullptr;
  if (state && encoded) state->records.append(encoded->toStdString());
}
static void nativeRetireField(jni::alias_ref<jclass>, jni::alias_ref<jstring> lease) {
  if (lease) codon::retireFieldInputRuntime(lease->toStdString());
}
static void nativeRetireBinding(jni::alias_ref<jclass>, jni::alias_ref<jstring> lease, jni::alias_ref<jstring> owner, jni::alias_ref<jstring> binding) {
  if (!lease || !owner || !binding) return;
  const auto state = codon::fieldInputRuntime(lease->toStdString());
  if (state) state->frames.retireBinding(owner->toStdString(), binding->toStdString());
}
static jni::local_ref<jstring> dispatchFieldOriginal(
    jni::alias_ref<JFabricUIManager::javaobject> managerObject, jni::alias_ref<JFieldInputBinding::javaobject> owner,
    jni::alias_ref<jstring> documentValue, jni::alias_ref<jstring> snapshotValue, jni::alias_ref<jstring> keyValue,
    jni::alias_ref<jstring> declarations, jdouble epoch, const RawEvent *originalInput = nullptr,
    codon::FieldInputDispatchFrames::Clock::time_point originDeadline = codon::FieldInputDispatchFrames::Clock::time_point::max()) {
  using namespace codon;
  using namespace codon::form;
  if (!owner || !documentValue || !snapshotValue || !keyValue || !declarations) throw std::invalid_argument("field-input-native-original-record-required");
  const auto manager = scopedManager(managerObject);
  const auto document = folly::parseJson(documentValue->toStdString()), snapshot = folly::parseJson(snapshotValue->toStdString());
  auto key = folly::parseJson(keyValue->toStdString());
  const auto binding = fieldInputBinding(document);
  const auto target = fieldGroupTarget(key.at("target"));
  const bool pointer = originalInput && isFieldInputOriginalPointer(originalInput->type);
  if (!pointer && snapshot.at("eventFocusedTarget") != target) throw std::invalid_argument("field-input-original-focus-retired");
  auto fabric = captureFabricFormDocument(*manager, fieldGroupTarget(document.at("surfaceId")));
  if (document.at("revision").asString() != std::to_string(fabric.revision) || !fabric.positions.contains(target))
    throw std::invalid_argument("field-input-original-document-retired");
  const auto original = fabric.preorder[fabric.positions.at(target)].node;
  if (originalInput && ((!pointer && originalInput->type != "topNativeSegmentInput") ||
      originalInput->shadowNodeFamily.lock() != original->getFamilyShared() ||
      originalInput->eventTarget != original->getEventEmitter()->getEventTarget()))
    throw std::invalid_argument("field-input-original-editor-retired");
  const auto targetRow = fieldInputTargetInstance(snapshot, target);
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
  const auto groups = orderedFieldInputGroups(document, registered, target, snapshot);
  const auto identity = fieldInputIdentity(document, snapshot, binding, target, fieldInputInteger(folly::dynamic(epoch)));
  const auto eventId = fieldInputInteger(key.at("eventId"));
  const auto phase = pointer ? fieldInputOriginalPointerPhase(originalInput->type) : originalInput ? "input" : key.at("cancelled").asBool() ? "cancel" : key.at("phase").asString();
  const auto ticket = state->frames.begin(identity, eventId, phase, std::chrono::milliseconds(1000), std::move(scopes), originDeadline);
  if (!ticket) throw std::invalid_argument("field-input-original-frame-retired");
  FieldInputFrameLifetime lifetime(state->frames, ticket);
  key["fieldDispatch"] = folly::toJson(fieldInputPacket(ticket, binding, groups));
  const auto eventTimestamp = originalInput ? originalInput->eventStartTimeStamp : HighResTimeStamp::fromDOMHighResTimeStamp(key.at("timestamp").asDouble());
  if (!originalInput) key["timeStamp"] = eventTimestamp.toDOMHighResTimeStamp();
  const auto before = key;
  const std::weak_ptr<const RootShadowNode> weakRoot = fabric.root;
  const std::weak_ptr<UIManager> weakManager = manager;
  const auto revision = fabric.revision;
  const bool scheduled = state->schedule(ticket, manager, original, originalInput ? originalInput->type : "nativeFieldKey", std::move(key),
    eventTimestamp, [weakRoot, weakManager, revision] {
      const auto manager = weakManager.lock(); const auto root = weakRoot.lock();
      return manager && root && isFabricFormDocumentCurrent(*manager, {root, revision, {}, {}});
    }, originalInput);
  FieldInputMountCursor mountCursor{fabric.root};
  const auto waited = scheduled ? state->frames.waitWithInputs(ticket, [&](const FieldInputDispatchFrames::Handle &ticket, const FieldInputFocusAction &action) {
    static const auto read = JFieldInputBinding::javaClassStatic()->getMethod<jni::local_ref<jstring>(jint)>("currentScopeSnapshot");
    static const auto focus = JFieldInputBinding::javaClassStatic()->getMethod<jni::local_ref<jstring>(jstring)>("focus");
    const auto expectedScope = ticket->scopeFor(action.groupTarget);
    if (!expectedScope) throw std::invalid_argument("field-input-focus-scope-not-admitted");
    const auto value = folly::parseJson(read(owner, action.groupTarget)->toStdString());
    const auto currentDocument = folly::parseJson(value.at("encodedDocument").asString());
    const auto &currentSnapshot = value.at("fieldGroupSnapshot");
    if (!fieldInputScopeCurrent(*expectedScope, currentDocument, currentSnapshot, fieldInputInteger(value.at("scopeEpoch"))))
      throw std::invalid_argument("field-input-focus-scope-retired");
    const auto selected = fieldInputFocusTarget(currentDocument, currentSnapshot, action, ticket->identity.target);
    FieldInputFocusResult result;
    if (!selected) { result.current = true; return result; }
    const auto row = fieldInputOriginal(currentSnapshot, selected);
    std::unordered_set<int32_t> members;
    for (const auto &node : currentSnapshot.at("instances")) members.insert(fieldGroupTarget(node.at("target")));
    members.insert(action.groupTarget);
    const auto request = folly::toJson(folly::dynamic::object("target", selected)("original", row)
      ("epoch", expectedScope->epoch)("scopeTarget", action.groupTarget)
      ("token", ticket->token)("eventId", ticket->eventId)("action", action.kind));
    return state->captureFocusEvents(ticket, manager, [&](const RawEvent &event) {
      const auto family = event.shadowNodeFamily.lock();
      return family && family->getSurfaceId() == identity.surfaceId && members.contains(family->getTag()) && event.type != "topNativeFieldKey";
    }, [&] {
      const auto response = folly::parseJson(focus(owner, jni::make_jstring(request).get())->toStdString());
      FieldInputFocusResult result{response.at("requested").asBool(), response.at("observed").asBool(), response.at("current").asBool(),
        static_cast<int32_t>(response.at("target").asInt()), response.at("nativeInstance").asString(), response.at("editorInstance").asString(), response.at("error").asString()};
      if (result.current && result.error.empty()) mountCursor.appliedRoot = captureFabricFormDocument(*manager, identity.surfaceId).root;
      return result;
    });
  }, [&](const FieldInputDispatchFrames::Handle &ticket) {
    return state->captureMountEvents(ticket, manager, [&](const RawEvent &event) {
      return isFieldInputMountEvent(*manager, ticket, event);
    }, [&] {
      static const auto witness = JFieldInputBinding::javaClassStatic()->getMethod<jni::local_ref<jstring>()>("mountWitness");
      const auto target = state->frames.mountTarget(ticket);
      if (target > 0) {
        static const auto boundary = JFieldInputBinding::javaClassStatic()->getMethod<void(jint)>("checkCommandBoundary");
        boundary(owner, identity.surfaceId);
      }
      return mountFieldInputTransactions(*manager, ticket, mountCursor, [&] { return witness(owner)->toStdString(); }, target);
    });
  }, [&](const FieldInputDispatchFrames::Handle &ticket, const FieldInputCommandAction &command) {
    return state->captureCommandEvents(ticket, manager, [&](const RawEvent &event) {
      return isFieldInputCommandEvent(*manager, ticket, event) || isFieldInputMountEvent(*manager, ticket, event);
    }, [&] {
      static const auto boundary = JFieldInputBinding::javaClassStatic()->getMethod<void(jint)>("checkCommandBoundary");
      static const auto readScope = JFieldInputBinding::javaClassStatic()->getMethod<jni::local_ref<jstring>(jint)>("currentScopeSnapshot");
      static const auto execute = JFieldInputBinding::javaClassStatic()->getMethod<jni::local_ref<jstring>(jstring, jlong, jlong)>("executeOriginalCommand");
      if (!state->frames.isCurrent(ticket) || !command.current || !command.current())
        return FieldInputCommandResult{false, "field-input-original-command-retired"};
      boundary(owner, identity.surfaceId);
      for (const auto &scope : ticket->scopes) {
        const auto value = folly::parseJson(readScope(owner, scope.outerTarget)->toStdString());
        if (!fieldInputScopeCurrent(scope, folly::parseJson(value.at("encodedDocument").asString()),
            value.at("fieldGroupSnapshot"), fieldInputInteger(value.at("scopeEpoch"))))
          return FieldInputCommandResult{false, "field-input-original-command-scope-retired"};
      }
      const auto remaining = std::chrono::duration_cast<std::chrono::milliseconds>(ticket->deadline - FieldInputDispatchFrames::Clock::now()).count();
      if (remaining <= 0) return FieldInputCommandResult{false, "field-input-original-command-expired"};
      FieldInputCommandExecution execution(command);
      const auto request = folly::toJson(folly::dynamic::object("surfaceId", identity.surfaceId)("target", command.target)("command", command.name));
      const auto response = folly::parseJson(execute(owner, jni::make_jstring(request).get(), execution.token(), remaining)->toStdString());
      auto result = execution.result();
      if (result.error.empty()) result.error = response.at("error").asString();
      if (!response.at("nativeItemReturned").asBool() && result.error.empty()) result.error = "field-input-native-command-not-executed";
      return result;
    });
  }) : FieldInputDecision{FieldInputDisposition::Retired, {}, false, false};
  bool current = false;
  folly::dynamic afterSnapshot = nullptr;
  try {
    static const auto read = JFieldInputBinding::javaClassStatic()->getMethod<jni::local_ref<jstring>()>("currentSnapshot");
    const auto value = folly::parseJson(read(owner)->toStdString());
    afterSnapshot = value.at("fieldGroupSnapshot");
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
  const auto subphases = fieldInputSubphaseResults(state->frames, ticket);
  const auto decision = state->frames.end(ticket, current);
  return jni::make_jstring(folly::toJson(folly::dynamic::object("kind", pointer ? "pointer" : originalInput ? "input" : "key")("event", before)("identity", encodeFieldInputIdentity(identity))
    ("wait", fieldInputDispositionName(waited.disposition))("decision", fieldInputDispositionName(decision.disposition))
    ("deliveryStarted", decision.deliveryStarted)("deliveryReturned", decision.deliveryReturned)("error", decision.error)
    ("originalDefaultPrevented", decision.originalDefaultPrevented)("renderPhasesComplete", decision.phasesComplete)
    ("scopeCurrent", current)("before", snapshot)("after", afterSnapshot)("inputSubphases", subphases)));
}

static jni::local_ref<jstring> nativeDispatchFieldKey(jni::alias_ref<jclass>,
    jni::alias_ref<JFabricUIManager::javaobject> manager, jni::alias_ref<JFieldInputBinding::javaobject> owner,
    jni::alias_ref<jstring> document, jni::alias_ref<jstring> snapshot, jni::alias_ref<jstring> key,
    jni::alias_ref<jstring> declarations, jdouble epoch) {
  return dispatchFieldOriginal(manager, owner, document, snapshot, key, declarations, epoch);
}
static jni::local_ref<jstring> nativeEmitOwnedInput(jni::alias_ref<jclass>,
    jni::alias_ref<JFabricUIManager::javaobject> managerObject, jni::alias_ref<JFieldInputBinding::javaobject> owner,
    jni::alias_ref<jstring> document, jni::alias_ref<jstring> snapshot, jni::alias_ref<jstring> input,
    jni::alias_ref<jstring> declarations, jdouble epoch, jni::alias_ref<jni::JRunnable::javaobject> emitter) {
  if (!emitter || !input) throw std::invalid_argument("field-input-original-emitter-required");
  const auto manager = scopedManager(managerObject);
  const auto record = folly::parseJson(input->toStdString());
  static const auto run = jni::findClassStatic("java/lang/Runnable")->getMethod<void()>("run");
  if (codon::FieldInputNativeOperation::contains(manager.get())) {
    const auto context = codon::form::captureFieldOwnedInput(manager, folly::parseJson(document->toStdString()),
      folly::parseJson(snapshot->toStdString()), folly::parseJson(declarations->toStdString()),
      codon::form::fieldGroupTarget(record.at("target")), codon::fieldInputInteger(folly::dynamic(epoch)),
      codon::fieldInputInteger(record.at("eventId")));
    codon::FieldInputNativeOperation::Input inputScope(manager.get(), context);
    run(emitter);
    return jni::make_jstring("");
  }
  jni::local_ref<jstring> receipt;
  // A current native-operation observer keeps its existing first-delivery
  // handoff; this continuation does not borrow a returned key capability.
  codon::continueFieldOriginalInput(*manager, codon::form::fieldGroupTarget(record.at("target")), [&] { run(emitter); },
    [&](const RawEvent &original) {
      receipt = dispatchFieldOriginal(managerObject, owner, document, snapshot, input, declarations, epoch, &original);
    });
  if (receipt) return receipt;
  return jni::make_jstring("");
}

static jni::local_ref<jstring> nativeEmitFieldPointer(jni::alias_ref<jclass>,
    jni::alias_ref<JFabricUIManager::javaobject> managerObject, jni::alias_ref<JFieldInputBinding::javaobject> owner,
    jni::alias_ref<jstring> document, jni::alias_ref<jni::JRunnable::javaobject> emitter) {
  using namespace codon;
  using namespace codon::form;
  if (!emitter || !document) throw std::invalid_argument("field-input-pointer-original-required");
  const auto manager = scopedManager(managerObject);
  const auto source = folly::parseJson(document->toStdString());
  std::unordered_set<int32_t> members;
  const auto &pointerMembers = source.at("pointerMembers");
  if (!pointerMembers.isArray()) throw std::invalid_argument("field-input-pointer-members-required");
  for (const auto &target : pointerMembers) members.insert(fieldGroupTarget(target));
  static const auto run = jni::findClassStatic("java/lang/Runnable")->getMethod<void()>("run");
  jni::local_ref<jstring> receipt;
  folly::dynamic phases = folly::dynamic::array;
  folly::dynamic retired = folly::dynamic::array;
  static const auto read = JFieldInputBinding::javaClassStatic()->getMethod<jni::local_ref<jstring>(jint)>("currentPointerSnapshot");
  static const auto selectOwner = JFieldInputBinding::javaClassStatic()->getMethod<jni::local_ref<JFieldInputBinding::javaobject>(jint)>("currentPointerOwner");
  const bool prevented = continueFieldOriginalPointer(*manager, [&](const RawEvent &event) {
    const auto family = event.shadowNodeFamily.lock();
    return family && family->getSurfaceId() == source.at("surfaceId").asInt() && members.contains(family->getTag());
  }, [&] { run(emitter); }, [&](const RawEvent &original, FieldInputDispatchFrames::Clock::time_point deadline) -> std::optional<bool> {
    folly::dynamic record = folly::dynamic::object;
    const auto family = original.shadowNodeFamily.lock();
    if (!family) throw std::runtime_error("field-input-pointer-family-retired");
    const auto currentOwner = selectOwner(owner, family->getTag());
    const auto value = currentOwner ? read(currentOwner, family->getTag()) : nullptr;
    if (!value || value->toStdString().empty()) {
      retired.push_back(folly::dynamic::object("type", original.type)("target", family->getTag()));
      return std::nullopt;
    }
    const auto current = folly::parseJson(value->toStdString());
    record["target"] = family->getTag();
    record["eventId"] = current.at("pointerEventId");
    const auto encoded = jni::make_jstring(folly::toJson(record));
    const auto currentDocument = jni::make_jstring(current.at("encodedDocument").asString());
    const auto currentSnapshot = jni::make_jstring(folly::toJson(current.at("fieldGroupSnapshot")));
    const auto currentDeclarations = jni::make_jstring(folly::toJson(current.at("pointerDeclarations")));
    receipt = dispatchFieldOriginal(managerObject, currentOwner, currentDocument, currentSnapshot, encoded,
      currentDeclarations, static_cast<jdouble>(current.at("scopeEpoch").asInt()), &original, deadline);
    phases.push_back(folly::parseJson(receipt->toStdString()));
    return folly::parseJson(receipt->toStdString()).at("originalDefaultPrevented").asBool();
  });
  if (receipt) {
    auto aggregate = folly::parseJson(receipt->toStdString());
    aggregate["originalDefaultPrevented"] = prevented;
    aggregate["pointerPhases"] = std::move(phases);
    aggregate["retiredPointerPhases"] = std::move(retired);
    return jni::make_jstring(folly::toJson(aggregate));
  }
  if (!retired.empty()) return jni::make_jstring(folly::toJson(folly::dynamic::object("kind", "pointer-retired")
    ("originalDefaultPrevented", false)("retiredPointerPhases", std::move(retired))));
  return jni::make_jstring("");
}

static jboolean nativeOriginalCommandCurrent(jni::alias_ref<jclass>, jlong token) {
  return static_cast<jboolean>(codon::FieldInputCommandExecution::current(token));
}
static jni::local_ref<jstring> nativePerformOriginalCommand(jni::alias_ref<jclass>, jlong token) {
  return jni::make_jstring(codon::FieldInputCommandExecution::perform(token));
}

void registerFormDocumentNatives() {
  JFieldInputBinding::javaClassStatic()->registerNatives({makeNativeMethod("nativeDispatchFieldKey", nativeDispatchFieldKey),
    makeNativeMethod("nativeEmitOwnedInput", nativeEmitOwnedInput),
    makeNativeMethod("nativeEmitFieldPointer", nativeEmitFieldPointer),
    makeNativeMethod("nativeOriginalCommandCurrent", nativeOriginalCommandCurrent),
    makeNativeMethod("nativePerformOriginalCommand", nativePerformOriginalCommand),
    makeNativeMethod("nativeRetireBinding", nativeRetireBinding), makeNativeMethod("nativeRecordFieldInput", nativeRecordFieldInput)});
  jni::findClassStatic("com/codonui/input/CUIEditorKeyboardDefaultsModule")->registerNatives({
    makeNativeMethod("nativeTakeFieldRecords", nativeTakeFieldRecords),
    makeNativeMethod("nativeFieldBindings", nativeFieldBindings), makeNativeMethod("nativeSettleField", nativeSettleField),
    makeNativeMethod("nativeAcceptsField", nativeAcceptsField), makeNativeMethod("nativeRetireField", nativeRetireField)});
  jni::findClassStatic("com/codonui/input/CUIFormDocumentModule")->registerNatives({
    makeNativeMethod("nativeFormDocument", nativeFormDocument),
    makeNativeMethod("nativeFormDocumentStamp", nativeFormDocumentStamp),
    makeNativeMethod("nativeFieldGroupSelection", nativeFieldGroupSelection),
    makeNativeMethod("nativeCreateFormSession", nativeCreateFormSession),
    makeNativeMethod("nativeRetireFormSession", nativeRetireFormSession)});
}
