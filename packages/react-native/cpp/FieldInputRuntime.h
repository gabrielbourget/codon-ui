#pragma once

#include "FieldInputProtocol.h"
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
    focusEvents_.clear();
  }
  FieldInputFocusResult captureFocusEvents(const FieldInputDispatchFrames::Handle &ticket,
      const std::shared_ptr<facebook::react::UIManager> &manager,
      const std::function<bool(const facebook::react::RawEvent &)> &belongs,
      const std::function<FieldInputFocusResult()> &perform) {
    using namespace facebook::react;
    std::vector<OriginalEvent> events;
    const auto nativeThread = std::this_thread::get_id();
    auto listener = std::make_shared<const EventListener>([&](const RawEvent &event) {
      if (std::this_thread::get_id() != nativeThread || !live_.load() || !event.eventTarget || !event.eventPayload ||
          !belongs || !belongs(event)) return false;
      events.push_back({manager, event.eventTarget, event.eventPayload, event.type, event.eventStartTimeStamp});
      return true;
    });
    manager->addEventListener(listener);
    FieldInputFocusResult result;
    try { result = perform(); }
    catch (const std::exception &error) { result.error = error.what(); }
    catch (...) { result.error = "field-input-original-focus-command-threw"; }
    manager->removeEventListener(listener);
    bool asynchronous = false;
    {
      std::lock_guard lock(mutex_);
      auto found = focusEvents_.find(ticket->token);
      if (found != focusEvents_.end()) {
        found->second.complete = true;
        if (!found->second.closed) found->second.events = std::move(events);
        else { focusEvents_.erase(found); asynchronous = true; }
      } else asynchronous = true;
    }
    // These original native notifications have not been delivered previously.
    // A timed-out key loses all default/focus authority; real focus callbacks
    // still retain their ordinary first delivery if their original target lives.
    if (asynchronous && !events.empty()) scheduleOriginals(std::move(events));
    return result;
  }
  std::string moveFocus(facebook::jsi::Runtime &runtime, const std::string &encoded) {
    uint64_t token;
    try { token = fieldInputInteger(folly::parseJson(encoded).at("token")); }
    catch (const std::exception &) { return moveFieldInputFocus(frames, encoded); }
    {
      std::lock_guard lock(mutex_);
      if (!live_.load() || focusEvents_.contains(token)) return "";
      focusEvents_.emplace(token, FocusHandoff{});
    }
    auto result = moveFieldInputFocus(frames, encoded);
    std::vector<OriginalEvent> events;
    {
      std::lock_guard lock(mutex_);
      auto found = focusEvents_.find(token);
      if (found != focusEvents_.end()) {
        found->second.closed = true;
        if (found->second.complete) { events = std::move(found->second.events); focusEvents_.erase(found); }
        else {
          const auto value = folly::parseJson(result);
          if (value.at("error") != "field-input-focus-timed-out") focusEvents_.erase(found);
        }
      }
    }
    for (const auto &event : events) {
      if (!deliverOriginal(runtime, event)) {
        auto value = folly::parseJson(result); value["current"] = false;
        value["error"] = "field-input-original-focus-event-retired"; result = folly::toJson(value);
      }
    }
    return result;
  }
  bool schedule(const FieldInputDispatchFrames::Handle &ticket,
      const std::shared_ptr<facebook::react::UIManager> &manager,
      const std::shared_ptr<const facebook::react::ShadowNode> &original,
      const std::string &type, folly::dynamic payload, facebook::react::HighResTimeStamp timestamp,
      std::function<bool()> currentDocument) {
    using namespace facebook::react;
    std::shared_ptr<CallInvoker> invoker;
    {
      std::lock_guard lock(mutex_);
      if (!live_.load() || !invoker_) return false;
      invoker = invoker_;
    }
    if (!ticket || !manager || !original || original->getTag() != ticket->identity.target ||
        original->getSurfaceId() != ticket->identity.surfaceId || !original->getEventEmitter() ||
        (type != "nativeFieldKey" && type != "nativeFieldPointer") || !payload.isObject()) return false;
    std::weak_ptr<FieldInputRuntime> weakSelf = shared_from_this();
    std::weak_ptr<FieldInputDispatchFrames::Ticket> weakTicket = ticket;
    std::weak_ptr<UIManager> weakManager = manager;
    std::weak_ptr<const ShadowNode> weakOriginal = original;
    const auto eventType = EventEmitter::normalizeEventType(type);
    invoker->invokeAsync([weakSelf, weakTicket, weakManager, weakOriginal, eventType,
        payload = std::move(payload), timestamp, currentDocument = std::move(currentDocument)](facebook::jsi::Runtime &runtime) {
      const auto state = weakSelf.lock();
      const auto frame = weakTicket.lock();
      if (!state || !frame || !state->live_.load() || !state->frames.startDelivery(frame)) return;
      bool failed = true;
      std::string failure = "field-input-original-Fabric-target-retired";
      try {
        const auto manager = weakManager.lock();
        const auto node = weakOriginal.lock();
        const auto binding = UIManagerBinding::getBinding(runtime);
        if (state->live_.load() && manager && node && binding && &binding->getUIManager() == manager.get() &&
            currentDocument && currentDocument()) {
          const auto target = node->getEventEmitter()->getEventTarget();
          if (target) {
            {
              std::lock_guard lock(EventEmitter::DispatchMutex());
              target->retain(runtime);
            }
            try {
              if (!target->getInstanceHandle(runtime).isNull() && !target->getInstanceHandle(runtime).isUndefined() &&
                  state->live_.load() && currentDocument()) {
                // First delivery of this original native record, using the
                // original Fabric target and React's own event handler.
                ValueFactoryEventPayload eventPayload([&payload](facebook::jsi::Runtime &runtime) {
                  return facebook::jsi::valueFromDynamic(runtime, payload);
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
      state->frames.finishDelivery(frame, failed, failure);
    });
    return true;
  }
 private:
  struct FocusHandoff {
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
      if (const auto state = weak.lock()) for (const auto &event : events) state->deliverOriginal(runtime, event);
    });
  }
  mutable std::mutex mutex_;
  std::atomic<bool> live_{true};
  std::shared_ptr<facebook::react::CallInvoker> invoker_;
  std::unordered_map<uint64_t, FocusHandoff> focusEvents_;
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
