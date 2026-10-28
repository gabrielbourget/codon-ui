#pragma once

#include "ActionFrames.h"
#include "OriginalEvents.h"
#include "../motion/NativeABI.h"
#include <ReactCommon/CallInvoker.h>
#include <folly/json.h>
#include <jsi/JSIDynamic.h>
#include <react/renderer/core/EventEmitter.h>
#include <react/renderer/core/EventListener.h>
#include <react/renderer/core/ValueFactoryEventPayload.h>
#include <react/renderer/components/root/RootShadowNode.h>
#include <react/renderer/runtimescheduler/RuntimeScheduler.h>
#include <react/renderer/scheduler/Scheduler.h>
#include <react/renderer/uimanager/NativeEventCommands.h>
#include <react/renderer/uimanager/UIManagerBinding.h>
#include <atomic>
#include <cmath>
#include <unordered_map>
#include <vector>

namespace codon::drag {
inline int64_t integer(const folly::dynamic &value) {
  if (!value.isNumber() || !std::isfinite(value.asDouble()) || value.asDouble() <= 0 ||
      value.asDouble() != std::floor(value.asDouble()) || value.asDouble() > 9007199254740991.0)
    throw std::invalid_argument("native-drag-positive-integer-required");
  return static_cast<int64_t>(value.asDouble());
}
inline int32_t target(const folly::dynamic &value) {
  const auto number = integer(value);
  if (number > INT32_MAX) throw std::invalid_argument("native-drag-native-target-required");
  return static_cast<int32_t>(number);
}
inline ActionIdentity identity(const folly::dynamic &value) {
  ActionIdentity result;
  for (auto [name, field] : {std::pair{"moduleId", &result.moduleId}, {"ownerId", &result.ownerId},
      {"bindingId", &result.bindingId}, {"revision", &result.revision}, {"windowId", &result.windowId},
      {"sessionId", &result.sessionId}, {"kind", &result.kind}}) {
    if (!value.at(name).isString()) throw std::invalid_argument("native-drag-identity-string-required");
    *field = value.at(name).asString();
  }
  result.surfaceId = target(value.at("surfaceId")); result.scopeTarget = target(value.at("scopeTarget"));
  result.rootTarget = target(value.at("rootTarget")); result.itemTarget = value.at("itemTarget") == 0 ? 0 : target(value.at("itemTarget"));
  result.epoch = integer(value.at("epoch"));
  if (!result.valid()) throw std::invalid_argument("native-drag-original-identity-invalid");
  return result;
}
inline folly::dynamic encode(const ActionIdentity &value) {
  return folly::dynamic::object("moduleId", value.moduleId)("ownerId", value.ownerId)("bindingId", value.bindingId)
    ("revision", value.revision)("windowId", value.windowId)("sessionId", value.sessionId)("kind", value.kind)
    ("surfaceId", value.surfaceId)("scopeTarget", value.scopeTarget)("rootTarget", value.rootTarget)
    ("itemTarget", value.itemTarget)("epoch", value.epoch);
}
inline facebook::react::RootShadowNode::Shared rootFor(facebook::react::UIManager &manager, int32_t surface) {
  facebook::react::RootShadowNode::Shared result;
  manager.getShadowTreeRegistry().visit(surface, [&](const facebook::react::ShadowTree &tree) { result = tree.getCurrentRevision().rootShadowNode; });
  return result;
}
inline std::shared_ptr<const facebook::react::ShadowNode> nodeFor(const facebook::react::ShadowNode &root, int32_t tag) {
  for (const auto &child : root.getChildren()) {
    if (child->getTag() == tag) return child;
    if (auto result = nodeFor(*child, tag)) return result;
  }
  return nullptr;
}
inline std::shared_ptr<facebook::react::RuntimeScheduler> schedulerFor(facebook::react::UIManager &manager) {
  using namespace facebook::react;
  const auto scheduler = dynamic_cast<Scheduler *>(manager.getDelegate());
  if (!scheduler) return nullptr;
  const auto runtime = scheduler->getContextContainer()->find<std::weak_ptr<RuntimeScheduler>>(RuntimeSchedulerKey);
  return runtime ? runtime->lock() : nullptr;
}

class ActionRuntime final : public std::enable_shared_from_this<ActionRuntime> {
 public:
  explicit ActionRuntime(std::string moduleId) : moduleId(std::move(moduleId)) {}
  const std::string moduleId;
  ActionFrames frames;
  void install(const std::shared_ptr<facebook::react::CallInvoker> &invoker) {
    std::lock_guard lock(invokerMutex_);
    if (invoker && live_.load()) { invoker_ = invoker; installed_.store(true); }
  }
  bool ready() const { return live_.load() && installed_.load(); }
  void retire() { live_.store(false); installed_.store(false); frames.retire(); std::lock_guard lock(invokerMutex_); invoker_.reset(); }
  bool accepts(const std::string &encoded) const {
    if (!ready()) return false;
    try { auto request = folly::parseJson(encoded); const auto id = identity(request.at("identity"));
      return request.at("version") == 1 && id.moduleId == moduleId && frames.accepts(integer(request.at("token")), id);
    } catch (...) { return false; }
  }
  bool settle(const std::string &encoded) {
    if (!ready()) return false;
    try { auto request = folly::parseJson(encoded); const auto id = identity(request.at("identity"));
      return request.at("version") == 1 && id.moduleId == moduleId && request.at("response").isString() &&
        frames.acknowledge(integer(request.at("token")), id, request.at("response").asString());
    } catch (...) { return false; }
  }

  using Mount = std::function<WorkResult()>;
  bool schedule(const ActionFrames::Handle &ticket, const std::shared_ptr<facebook::react::UIManager> &manager,
      folly::dynamic payload, Mount mount) {
    using namespace facebook::react;
    if (!ready() || !ticket || ticket->identity.moduleId != moduleId || !manager || !payload.isObject() || !mount) return false;
    const auto scheduler = schedulerFor(*manager); const auto root = rootFor(*manager, ticket->identity.surfaceId);
    if (!scheduler || !root) return false;
    auto scope = nodeFor(*root, ticket->identity.scopeTarget), collection = nodeFor(*root, ticket->identity.rootTarget);
    auto item = ticket->identity.itemTarget ? nodeFor(*root, ticket->identity.itemTarget) : nullptr;
    if (!scope || !collection || (ticket->identity.itemTarget && !item) || !scope->getEventEmitter()) return false;
    const auto packet = folly::toJson(folly::dynamic::object("version", 1)("token", ticket->token)
      ("identity", encode(ticket->identity))("payload", std::move(payload)));
    const auto current = [weak = std::weak_ptr<UIManager>(manager), scope, collection, item, surface = ticket->identity.surfaceId] {
      const auto manager = weak.lock(); const auto root = manager ? rootFor(*manager, surface) : nullptr;
      if (!root) return false;
      for (const auto &original : {scope, collection, item}) if (original) {
        const auto node = nodeFor(*root, original->getTag());
        if (!node || node->getFamilyShared() != original->getFamilyShared()) return false;
      }
      return true;
    };
    const auto weak = weak_from_this(); const auto weakManager = std::weak_ptr<UIManager>(manager);
    return scheduler->scheduleNativeEventWork([weak, ticket, weakManager, scope, packet, current, mount](facebook::jsi::Runtime &runtime) {
      const auto self = weak.lock(); if (!self || !self->ready() || !self->frames.accepts(ticket)) return;
      try {
        auto manager = weakManager.lock(); auto binding = UIManagerBinding::getBinding(runtime);
        const auto bridgeless = runtime.global().getProperty(runtime, "RN$Bridgeless");
        const auto microtasks = runtime.global().getProperty(runtime, "RN$enableMicrotasksInReact");
        if (!bridgeless.isBool() || !bridgeless.getBool() || !microtasks.isBool() || !microtasks.getBool() ||
            !manager || !binding || &binding->getUIManager() != manager.get() || !current())
          throw std::runtime_error("native-drag-original-runtime-or-family-retired");
        const auto target = scope->getEventEmitter()->getEventTarget();
        if (!target) throw std::runtime_error("native-drag-original-event-target-retired");
        { std::lock_guard lock(EventEmitter::DispatchMutex()); target->retain(runtime); }
        try {
          const auto handle = target->getInstanceHandle(runtime);
          if (handle.isNull() || handle.isUndefined()) throw std::runtime_error("native-drag-original-instance-retired");
          auto event = ValueFactoryEventPayload([packet](facebook::jsi::Runtime &runtime) {
            return facebook::jsi::valueFromDynamic(runtime, folly::dynamic::object("packet", packet));
          });
          binding->dispatchEvent(runtime, target.get(), EventEmitter::normalizeEventType("nativeDragAction"), ReactEventPriority::Discrete, event, HighResTimeStamp::now());
        } catch (...) { target->release(runtime); throw; }
        target->release(runtime);
        self->frames.returned(ticket);
        self->queueMount(runtime, ticket, weakManager, mount);
      } catch (const std::exception &error) { self->frames.returned(ticket, error.what()); self->frames.finish(ticket, error.what()); }
      catch (...) { self->frames.returned(ticket, "native-drag-original-js-callback-threw"); self->frames.finish(ticket, "native-drag-original-js-callback-threw"); }
    }, [weak, ticket, weakManager](facebook::jsi::Runtime &runtime) -> std::shared_ptr<NativeEventTaskScope> {
      auto self = weak.lock(); auto manager = weakManager.lock();
      if (!self || !manager || !self->ready() || !self->frames.start(ticket)) return nullptr;
      auto scope = std::make_shared<TaskScope>(self, ticket);
      scope->commands = manager->getNativeEventCommands().enter([weak, ticket, weakManager, &runtime](const auto &command) {
        const auto self = weak.lock(); const auto manager = weakManager.lock();
        if (!self || !manager || !command || !self->frames.accepts(ticket) || command->surfaceId != ticket->identity.surfaceId)
          throw std::runtime_error("native-drag-original-command-retired");
        const auto node = command->node.lock(); const auto root = rootFor(*manager, command->surfaceId);
        const auto current = node && root ? nodeFor(*root, command->target) : nullptr;
        if (!node || !current || current->getFamilyShared() != node->getFamilyShared()) {
          command->cancel(); throw std::runtime_error("native-drag-original-command-family-retired");
        }
        auto events = self->eventMailbox(manager);
        const auto result = self->frames.request(ticket, [self, manager, command, events] {
          std::vector<RawEvent> originals;
          const auto result = self->capture(manager, [&] { return WorkResult{command->executeOriginal(), ""}; }, originals);
          events->publish(std::move(originals)); return result;
        }, [command] { command->cancel(); });
        std::string error = result.error;
        try { self->deliver(runtime, manager, events->take()); }
        catch (const std::exception &failure) { if (error.empty()) error = failure.what(); }
        catch (...) { if (error.empty()) error = "native-drag-original-notification-threw"; }
        if (!result.performed || !error.empty() || !self->frames.accepts(ticket))
          throw std::runtime_error(error.empty() ? "native-drag-original-command-incomplete" : error);
      });
      return scope;
    });
  }

 private:
  class TaskScope final : public facebook::react::NativeEventTaskScope {
   public:
    TaskScope(std::shared_ptr<ActionRuntime> owner, ActionFrames::Handle ticket) : owner(std::move(owner)), ticket(std::move(ticket)) {}
    std::shared_ptr<facebook::react::NativeEventCommands::Registration> commands;
    void fail(const std::string &error) noexcept override {
      try { owner->frames.returned(ticket, error); owner->frames.finish(ticket, error); } catch (...) {}
    }
    void finish() noexcept override {
      if (finished) return; finished = true;
      try { commands.reset(); owner->frames.finish(ticket); } catch (...) {}
    }
   private:
    std::shared_ptr<ActionRuntime> owner; ActionFrames::Handle ticket; bool finished{false};
  };
  std::shared_ptr<OriginalEvents<facebook::react::RawEvent>> eventMailbox(const std::shared_ptr<facebook::react::UIManager> &manager) {
    std::shared_ptr<facebook::react::CallInvoker> invoker;
    { std::lock_guard lock(invokerMutex_); invoker = invoker_; }
    const std::weak_ptr<facebook::react::UIManager> weakManager = manager;
    return std::make_shared<OriginalEvents<facebook::react::RawEvent>>([invoker, weakManager](std::vector<facebook::react::RawEvent> events) {
      if (!invoker) return;
      invoker->invokeAsync([weakManager, events = std::move(events)](facebook::jsi::Runtime &runtime) mutable {
        const auto manager = weakManager.lock();
        const auto scheduler = manager ? dynamic_cast<facebook::react::Scheduler *>(manager->getDelegate()) : nullptr;
        if (scheduler) scheduler->dispatchOriginalNativeEvents(runtime, std::move(events));
      });
    });
  }
  WorkResult capture(const std::shared_ptr<facebook::react::UIManager> &manager, const Mount &perform, std::vector<facebook::react::RawEvent> &events) {
    using namespace facebook::react;
    const auto native = std::this_thread::get_id();
    auto listener = std::make_shared<const EventListener>([&](const RawEvent &event) {
      if (std::this_thread::get_id() != native || !ready() || event.isUnique || !event.eventTarget || !event.eventPayload ||
          event.shadowNodeFamily.expired()) return false;
      events.push_back(event); return true;
    });
    manager->addEventListener(listener); WorkResult result;
    try { result = perform(); }
    catch (const std::exception &error) { result.error = error.what(); }
    catch (...) { result.error = "native-drag-original-operation-threw"; }
    manager->removeEventListener(listener); return result;
  }
  void deliver(facebook::jsi::Runtime &runtime, const std::shared_ptr<facebook::react::UIManager> &manager,
      std::vector<facebook::react::RawEvent> events) {
    if (events.empty()) return;
    const auto scheduler = dynamic_cast<facebook::react::Scheduler *>(manager->getDelegate());
    if (!scheduler || !scheduler->dispatchOriginalNativeEvents(runtime, std::move(events)))
      throw std::runtime_error("native-drag-original-notification-target-retired");
  }
  void queueMount(facebook::jsi::Runtime &runtime, const ActionFrames::Handle &ticket,
      const std::weak_ptr<facebook::react::UIManager> &manager, const Mount &mount) {
    const auto weak = weak_from_this();
    auto phase = facebook::jsi::Function::createFromHostFunction(runtime, facebook::jsi::PropNameID::forAscii(runtime, "cuiOriginalDragMount"), 0,
      [weak, ticket, manager, mount](facebook::jsi::Runtime &runtime, const facebook::jsi::Value &, const facebook::jsi::Value *, size_t) -> facebook::jsi::Value {
        auto self = weak.lock(); auto currentManager = manager.lock();
        if (!self || !currentManager || !self->frames.accepts(ticket)) return facebook::jsi::Value::undefined();
        try {
          auto events = self->eventMailbox(currentManager);
          const auto result = self->frames.request(ticket, [self, currentManager, mount, events] {
            std::vector<facebook::react::RawEvent> originals;
            const auto result = self->capture(currentManager, mount, originals); events->publish(std::move(originals)); return result;
          });
          std::string error = result.error;
          try { self->deliver(runtime, currentManager, events->take()); }
          catch (const std::exception &failure) { if (error.empty()) error = failure.what(); }
          catch (...) { if (error.empty()) error = "native-drag-original-notification-threw"; }
          if (!error.empty()) throw std::runtime_error(error);
          if (result.performed && self->frames.accepts(ticket)) self->queueMount(runtime, ticket, manager, mount);
        } catch (const std::exception &error) { self->frames.finish(ticket, error.what()); }
        catch (...) { self->frames.finish(ticket, "native-drag-original-mount-phase-threw"); }
        return facebook::jsi::Value::undefined();
      });
    runtime.queueMicrotask(phase);
  }
  std::mutex invokerMutex_;
  std::shared_ptr<facebook::react::CallInvoker> invoker_;
  std::atomic<bool> live_{true}, installed_{false};
};
inline std::mutex registryMutex;
inline std::unordered_map<std::string, std::weak_ptr<ActionRuntime>> registry;
inline void registerRuntime(const std::shared_ptr<ActionRuntime> &runtime) {
  std::lock_guard lock(registryMutex);
  if (!runtime || runtime->moduleId.empty() || !registry[runtime->moduleId].expired()) throw std::invalid_argument("native-drag-module-ambiguous");
  registry[runtime->moduleId] = runtime;
}
inline std::shared_ptr<ActionRuntime> runtimeFor(const std::string &moduleId) {
  std::lock_guard lock(registryMutex); const auto found = registry.find(moduleId); return found == registry.end() ? nullptr : found->second.lock();
}
inline void retireRuntime(const std::string &moduleId) {
  std::shared_ptr<ActionRuntime> runtime;
  { std::lock_guard lock(registryMutex); const auto found = registry.find(moduleId); if (found == registry.end()) return;
    runtime = found->second.lock(); registry.erase(found); }
  if (runtime) runtime->retire();
}
} // namespace codon::drag
