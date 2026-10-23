#pragma once

#include "FieldInputProtocol.h"
#include "FieldInputMount.h"
#include "FieldInputRecords.h"
#include "FieldInputOriginalEvents.h"
#include "FieldInputNativeOperation.h"
#include "FieldInputTaskScope.h"
#include <ReactCommon/CallInvoker.h>
#include <jsi/JSIDynamic.h>
#include <react/renderer/core/EventEmitter.h>
#include <react/renderer/core/ShadowNode.h>
#include <react/renderer/core/ValueFactoryEventPayload.h>
#include <react/renderer/core/RawEvent.h>
#include <react/renderer/core/EventListener.h>
#include <react/renderer/uimanager/UIManagerBinding.h>
#include <atomic>
#include <functional>
#include <unordered_map>
#include <thread>

namespace codon {
class FieldInputRuntime final : public std::enable_shared_from_this<FieldInputRuntime> {
 public:
  struct OriginalEvent {
    std::weak_ptr<facebook::react::UIManager> manager;
    std::weak_ptr<facebook::react::EventTarget> target;
    facebook::react::SharedEventPayload payload;
    std::string type;
    facebook::react::HighResTimeStamp timestamp;
  };
  FieldInputDispatchFrames frames;
  FieldInputRecords records;
  std::string takeRecords() {
    auto batch = records.take();
    folly::dynamic encoded = folly::dynamic::array;
    for (const auto &record : batch.records) encoded.push_back(record);
    return folly::toJson(folly::dynamic::object("records", std::move(encoded))("dropped", batch.dropped));
  }
  void install(const std::shared_ptr<facebook::react::CallInvoker> &invoker) {
    std::lock_guard lock(mutex_);
    if (live_.load() && !invoker_) invoker_ = invoker;
  }
  bool ready() const {
    std::lock_guard lock(mutex_);
    return live_.load() && invoker_ != nullptr;
  }
  void retire() {
    live_.store(false);
    frames.retire();
    std::lock_guard lock(mutex_);
    invoker_.reset();
    originalEvents_.clear();
  }
  template <typename TResult>
  TResult captureEvents(const FieldInputDispatchFrames::Handle &ticket,
      const std::shared_ptr<facebook::react::UIManager> &manager,
      const std::function<bool(const facebook::react::RawEvent &)> &belongs,
      const std::function<TResult()> &perform) {
    using namespace facebook::react;
    std::vector<OriginalEvent> events;
    std::string observerError;
    const auto nativeThread = std::this_thread::get_id();
    auto listener = std::make_shared<const EventListener>([&](const RawEvent &event) {
      if (std::this_thread::get_id() != nativeThread || !live_.load() || !event.eventTarget || !event.eventPayload || !belongs) return false;
      try {
        if (!belongs(event)) return false;
        events.push_back({manager, event.eventTarget, event.eventPayload, event.type, event.eventStartTimeStamp});
        return true;
      } catch (const std::exception &error) { if (observerError.empty()) observerError = error.what(); }
      catch (...) { if (observerError.empty()) observerError = "field-input-original-event-observer-threw"; }
      return false;
    });
    manager->addEventListener(listener);
    TResult result;
    try { FieldInputNativeOperation operation(manager.get()); result = perform(); }
    catch (const std::exception &error) { result.error = error.what(); }
    catch (...) { result.error = "field-input-original-native-operation-threw"; }
    manager->removeEventListener(listener);
    if (result.error.empty()) result.error = observerError;
    bool asynchronous = false;
    {
      std::lock_guard lock(mutex_);
      auto found = originalEvents_.find(ticket->token);
      if (found != originalEvents_.end()) {
        found->second.complete = true;
        if (!found->second.closed) found->second.events = std::move(events);
        else { originalEvents_.erase(found); asynchronous = true; }
      } else asynchronous = true;
    }
    // These original native notifications have not been delivered previously.
    // A timed-out key loses all default/focus authority; real focus callbacks
    // still retain their ordinary first delivery if their original target lives.
    if (asynchronous && !events.empty()) scheduleOriginals(std::move(events));
    return result;
  }
  FieldInputFocusResult captureFocusEvents(const FieldInputDispatchFrames::Handle &ticket,
      const std::shared_ptr<facebook::react::UIManager> &manager,
      const std::function<bool(const facebook::react::RawEvent &)> &belongs,
      const std::function<FieldInputFocusResult()> &perform) {
    return captureEvents<FieldInputFocusResult>(ticket, manager, belongs, perform);
  }
  FieldInputMountResult captureMountEvents(const FieldInputDispatchFrames::Handle &ticket,
      const std::shared_ptr<facebook::react::UIManager> &manager,
      const std::function<bool(const facebook::react::RawEvent &)> &belongs,
      const std::function<FieldInputMountResult()> &perform) {
    return captureEvents<FieldInputMountResult>(ticket, manager, belongs, perform);
  }
  std::string moveFocus(facebook::jsi::Runtime &runtime, const std::string &encoded) {
    originalDelivery_.drain([&](const OriginalEvent &event) { return deliverOriginal(runtime, event); });
    uint64_t token;
    try { token = fieldInputInteger(folly::parseJson(encoded).at("token")); }
    catch (const std::exception &) { return moveFieldInputFocus(frames, encoded); }
    {
      std::lock_guard lock(mutex_);
      if (!live_.load() || originalEvents_.contains(token)) return "";
      originalEvents_.emplace(token, OriginalHandoff{});
    }
    auto result = moveFieldInputFocus(frames, encoded);
    std::vector<OriginalEvent> events;
    {
      std::lock_guard lock(mutex_);
      auto found = originalEvents_.find(token);
      if (found != originalEvents_.end()) {
        found->second.closed = true;
        if (found->second.complete) { events = std::move(found->second.events); originalEvents_.erase(found); }
        else {
          const auto value = folly::parseJson(result);
          if (value.at("error") != "field-input-focus-timed-out") originalEvents_.erase(found);
        }
      }
    }
    originalDelivery_.append(std::move(events));
    if (!originalDelivery_.drain([&](const OriginalEvent &event) { return deliverOriginal(runtime, event); })) {
      auto value = folly::parseJson(result); value["current"] = false;
      if (value.at("error").asString().empty()) value["error"] = "field-input-original-focus-event-retired";
      result = folly::toJson(value);
    }
    return result;
  }
  bool schedule(const FieldInputDispatchFrames::Handle &ticket,
      const std::shared_ptr<facebook::react::UIManager> &manager,
      const std::shared_ptr<const facebook::react::ShadowNode> &original,
      const std::string &type, folly::dynamic payload, facebook::react::HighResTimeStamp timestamp,
      std::function<bool()> currentDocument, facebook::react::SharedEventPayload originalPayload = nullptr) {
    using namespace facebook::react;
    {
      std::lock_guard lock(mutex_);
      if (!live_.load() || !invoker_) return false;
    }
    if (!ticket || !manager || !original || original->getTag() != ticket->identity.target ||
        original->getSurfaceId() != ticket->identity.surfaceId || !original->getEventEmitter() ||
        (type != "nativeFieldKey" && type != "nativeFieldPointer" && type != "topNativeSegmentInput") || !payload.isObject()) return false;
    const auto scheduler = fieldInputRuntimeScheduler(*manager);
    if (!scheduler || ((type == "topNativeSegmentInput") != (originalPayload != nullptr)) ||
        (originalPayload && ticket->phase != "input")) return false;
    std::weak_ptr<FieldInputRuntime> weakSelf = shared_from_this();
    std::weak_ptr<FieldInputDispatchFrames::Ticket> weakTicket = ticket;
    std::weak_ptr<UIManager> weakManager = manager;
    std::weak_ptr<const ShadowNode> weakOriginal = original;
    const auto eventType = EventEmitter::normalizeEventType(type);
    return scheduler->scheduleNativeEventWork([weakSelf, weakTicket, weakManager, weakOriginal, eventType,
        payload = std::move(payload), originalPayload = std::move(originalPayload), timestamp, currentDocument = std::move(currentDocument)](facebook::jsi::Runtime &runtime) {
      const auto state = weakSelf.lock();
      const auto frame = weakTicket.lock();
      if (!state || !frame || !state->live_.load() || !state->frames.isCurrent(frame)) return;
      bool failed = true;
      std::string failure = "field-input-original-Fabric-target-retired";
      try {
        const auto bridgeless = runtime.global().getProperty(runtime, "RN$Bridgeless");
        const auto microtasks = runtime.global().getProperty(runtime, "RN$enableMicrotasksInReact");
        if (!bridgeless.isBool() || !bridgeless.getBool() || !microtasks.isBool() || !microtasks.getBool())
          throw std::runtime_error("field-input-supported-render-loop-unavailable");
        state->originalDelivery_.drain([&](const OriginalEvent &event) { return state->deliverOriginal(runtime, event); });
        const auto manager = weakManager.lock();
        const auto node = weakOriginal.lock();
        const auto binding = UIManagerBinding::getBinding(runtime);
        if (state->live_.load() && state->frames.isCurrent(frame) && manager && node && binding && &binding->getUIManager() == manager.get() &&
            currentDocument && currentDocument()) {
          const auto target = node->getEventEmitter()->getEventTarget();
          if (target) {
            {
              std::lock_guard lock(EventEmitter::DispatchMutex());
              target->retain(runtime);
            }
            try {
              if (!target->getInstanceHandle(runtime).isNull() && !target->getInstanceHandle(runtime).isUndefined() &&
                  state->live_.load() && state->frames.isCurrent(frame) && currentDocument()) {
                // First delivery of this original native record, using the
                // original Fabric target and React's own event handler.
                ValueFactoryEventPayload eventPayload([&payload, &originalPayload, &state, &frame](facebook::jsi::Runtime &runtime) {
                  if (!state->frames.isCurrent(frame)) throw std::runtime_error("field-input-original-dispatch-expired");
                  if (!originalPayload) {
                    auto value = facebook::jsi::valueFromDynamic(runtime, payload);
                    if (!state->frames.isCurrent(frame)) throw std::runtime_error("field-input-original-dispatch-expired");
                    return value;
                  }
                  auto value = originalPayload->asJSIValue(runtime);
                  if (!value.isObject()) throw std::runtime_error("field-input-original-payload-invalid");
                  state->records.append(folly::toJson(folly::dynamic::object("kind", "original-input")
                    ("token", frame->token)("eventId", frame->eventId)("payload", facebook::jsi::dynamicFromValue(runtime, value))));
                  auto object = value.asObject(runtime);
                  if (object.hasProperty(runtime, "fieldDispatch")) throw std::runtime_error("field-input-original-packet-ambiguous");
                  object.setProperty(runtime, "fieldDispatch", facebook::jsi::String::createFromUtf8(runtime, payload.at("fieldDispatch").asString()));
                  if (!state->frames.isCurrent(frame)) throw std::runtime_error("field-input-original-dispatch-expired");
                  return value;
                });
                binding->dispatchEvent(runtime, target.get(), eventType, ReactEventPriority::Discrete, eventPayload, timestamp);
                failed = false;
                failure.clear();
              }
            } catch (...) { target->release(runtime); throw; }
            target->release(runtime);
          }
        }
      } catch (const std::exception &error) { failed = true; failure = error.what(); }
      catch (...) { failed = true; failure = "field-input-original-Fabric-dispatch-threw"; }
      state->frames.finishHandler(frame, failed, failure);
      if (failed) state->frames.finishPhases(frame, true, failure);
      else {
        try { state->queueMountPhase(runtime, frame, weakManager); }
        catch (const std::exception &error) { state->frames.finishPhases(frame, true, error.what()); }
        catch (...) { state->frames.finishPhases(frame, true, "field-input-microtask-enqueue-threw"); }
      }
    }, [weakSelf, weakTicket](facebook::jsi::Runtime &) -> std::shared_ptr<NativeEventTaskScope> {
      const auto state = weakSelf.lock();
      const auto ticket = weakTicket.lock();
      if (!state || !ticket || !state->live_.load()) return nullptr;
      auto scope = std::make_shared<FieldInputTaskScope>(state, state->frames, ticket);
      if (!state->frames.startDelivery(ticket)) return nullptr;
      return scope;
    });
  }
 private:
  std::vector<OriginalEvent> closeHandoff(uint64_t token, bool timedOut) {
    std::lock_guard lock(mutex_);
    std::vector<OriginalEvent> events;
    auto found = originalEvents_.find(token);
    if (found == originalEvents_.end()) return events;
    found->second.closed = true;
    if (found->second.complete) { events = std::move(found->second.events); originalEvents_.erase(found); }
    else if (!timedOut) originalEvents_.erase(found);
    return events;
  }
  void queueMountPhase(facebook::jsi::Runtime &runtime, const FieldInputDispatchFrames::Handle &ticket,
      const std::weak_ptr<facebook::react::UIManager> &manager) {
    const auto weak = weak_from_this();
    const std::weak_ptr<FieldInputDispatchFrames::Ticket> weakTicket = ticket;
    auto phase = facebook::jsi::Function::createFromHostFunction(runtime,
      facebook::jsi::PropNameID::forAscii(runtime, "cuiOriginalFieldMountPhase"), 0,
      [weak, weakTicket, manager](facebook::jsi::Runtime &runtime, const facebook::jsi::Value &,
          const facebook::jsi::Value *, size_t) -> facebook::jsi::Value {
        const auto state = weak.lock(); const auto ticket = weakTicket.lock();
        if (!state || !ticket || !state->live_.load() || !state->frames.canFinishPhases(ticket)) return facebook::jsi::Value::undefined();
        try {
          { std::lock_guard lock(state->mutex_);
            if (state->originalEvents_.contains(ticket->token)) throw std::runtime_error("field-input-original-handoff-overlap");
            state->originalEvents_.emplace(ticket->token, OriginalHandoff{});
          }
          auto result = state->frames.requestMount(ticket);
          const auto events = state->closeHandoff(ticket->token, result.error == "field-input-mount-timed-out");
          state->originalDelivery_.append(events);
          if (!state->originalDelivery_.drain([&](const OriginalEvent &event) { return state->deliverOriginal(runtime, event); }) &&
              state->frames.canFinishPhases(ticket)) throw std::runtime_error("field-input-original-mount-event-retired");
          if (!state->frames.canFinishPhases(ticket)) return facebook::jsi::Value::undefined();
          if (!result.error.empty()) throw std::runtime_error(result.error);
          if (result.mounted) {
            // Original native notifications may enqueue further React work.
            // Let its microtasks run before checking for the next real commit.
            state->queueMountPhase(runtime, ticket, manager);
          }
          // The SDK task scope completes phases after its entire checkpoint
          // and rendering queue, rather than from an earlier queue callback.
        } catch (const std::exception &error) { state->frames.finishPhases(ticket, true, error.what()); }
        catch (...) { state->frames.finishPhases(ticket, true, "field-input-original-mount-phase-threw"); }
        return facebook::jsi::Value::undefined();
      });
    runtime.queueMicrotask(phase);
  }
  struct OriginalHandoff {
    bool closed{false}, complete{false};
    std::vector<OriginalEvent> events;
  };
  bool deliverOriginal(facebook::jsi::Runtime &runtime, const OriginalEvent &event) {
    using namespace facebook::react;
    if (!live_.load()) return false;
    const auto manager = event.manager.lock();
    const auto target = event.target.lock();
    const auto binding = UIManagerBinding::getBinding(runtime);
    if (!manager || !target || !event.payload || !binding || &binding->getUIManager() != manager.get()) return false;
    { std::lock_guard lock(EventEmitter::DispatchMutex()); target->retain(runtime); }
    bool delivered = false;
    try {
      if (!target->getInstanceHandle(runtime).isNull() && !target->getInstanceHandle(runtime).isUndefined()) {
        binding->dispatchEvent(runtime, target.get(), event.type, ReactEventPriority::Discrete, *event.payload, event.timestamp);
        delivered = true;
      }
    } catch (...) { target->release(runtime); throw; }
    target->release(runtime);
    return delivered;
  }
  void scheduleOriginals(std::vector<OriginalEvent> events) {
    std::shared_ptr<facebook::react::CallInvoker> invoker;
    { std::lock_guard lock(mutex_); if (!live_.load()) return; invoker = invoker_; }
    if (!invoker) return;
    const auto weak = weak_from_this();
    invoker->invokeAsync([weak, events = std::move(events)](facebook::jsi::Runtime &runtime) {
      if (const auto state = weak.lock()) {
        state->originalDelivery_.append(std::move(events));
        state->originalDelivery_.drain([&](const OriginalEvent &event) { return state->deliverOriginal(runtime, event); });
      }
    });
  }
  FieldInputOriginalEvents<OriginalEvent> originalDelivery_;
  mutable std::mutex mutex_;
  std::atomic<bool> live_{true};
  std::shared_ptr<facebook::react::CallInvoker> invoker_;
  std::unordered_map<uint64_t, OriginalHandoff> originalEvents_;
};

inline std::mutex fieldInputRuntimeRegistryMutex;
inline std::unordered_map<std::string, std::weak_ptr<FieldInputRuntime>> fieldInputRuntimes;
inline std::shared_ptr<FieldInputRuntime> fieldInputRuntime(const std::string &lease) {
  std::lock_guard lock(fieldInputRuntimeRegistryMutex);
  const auto found = fieldInputRuntimes.find(lease);
  return found == fieldInputRuntimes.end() ? nullptr : found->second.lock();
}
inline void registerFieldInputRuntime(const std::string &lease, const std::shared_ptr<FieldInputRuntime> &state) {
  std::lock_guard lock(fieldInputRuntimeRegistryMutex);
  if (lease.empty() || !state || !fieldInputRuntimes[lease].expired()) throw std::invalid_argument("field-input-runtime-ambiguous");
  fieldInputRuntimes[lease] = state;
}
inline void retireFieldInputRuntime(const std::string &lease) {
  std::shared_ptr<FieldInputRuntime> state;
  {
    std::lock_guard lock(fieldInputRuntimeRegistryMutex);
    const auto found = fieldInputRuntimes.find(lease);
    if (found == fieldInputRuntimes.end()) return;
    state = found->second.lock();
    fieldInputRuntimes.erase(found);
  }
  if (state) state->retire();
}
} // namespace codon
