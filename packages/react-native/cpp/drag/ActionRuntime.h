#pragma once

#include "ActionFrames.h"
#include "../motion/NativeABI.h"
#include <ReactCommon/CallInvoker.h>
#include <folly/json.h>
#include <jsi/JSIDynamic.h>
#include <react/renderer/core/EventEmitter.h>
#include <react/renderer/core/ValueFactoryEventPayload.h>
#include <react/renderer/components/root/RootShadowNode.h>
#include <react/renderer/uimanager/UIManagerBinding.h>
#include <atomic>
#include <cmath>
#include <unordered_map>

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

  bool schedule(const ActionFrames::Handle &ticket, const std::shared_ptr<facebook::react::UIManager> &manager,
      folly::dynamic payload) {
    using namespace facebook::react;
    if (!ready() || !ticket || ticket->identity.moduleId != moduleId || !manager || !payload.isObject()) return false;
    std::shared_ptr<CallInvoker> invoker;
    { std::lock_guard lock(invokerMutex_); invoker = invoker_; }
    const auto root = rootFor(*manager, ticket->identity.surfaceId);
    if (!invoker || !root) return false;
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
    invoker->invokeAsync([weak, ticket, weakManager, scope, packet, current](facebook::jsi::Runtime &runtime) {
      const auto self = weak.lock(); if (!self || !self->ready() || !self->frames.start(ticket)) return;
      try {
        auto manager = weakManager.lock(); auto binding = UIManagerBinding::getBinding(runtime);
        if (!manager || !binding || &binding->getUIManager() != manager.get() || !current())
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
      } catch (const std::exception &error) { self->frames.returned(ticket, error.what()); }
      catch (...) { self->frames.returned(ticket, "native-drag-original-js-callback-threw"); }
    });
    return true;
  }

 private:
  std::mutex invokerMutex_;
  std::shared_ptr<facebook::react::CallInvoker> invoker_;
  std::atomic<bool> live_{true}, installed_{false};
};
inline std::string run(const std::shared_ptr<ActionRuntime> &runtime, const std::shared_ptr<facebook::react::UIManager> &manager,
    const ActionIdentity &identity, folly::dynamic payload, bool pointer, const std::function<bool()> &current) {
  if (!runtime || !runtime->ready() || !manager || !current || !current()) throw std::runtime_error("native-drag-original-owner-unavailable");
  const auto ticket = runtime->frames.begin(identity, pointer);
  if (!ticket) throw std::runtime_error("native-drag-original-action-reentry-or-retirement");
  try {
    if (!runtime->schedule(ticket, manager, std::move(payload))) throw std::runtime_error("native-drag-js-invoker-unavailable");
    const auto result = runtime->frames.wait(ticket, current);
    if (!result.current || !result.error.empty()) throw std::runtime_error(result.error.empty() ? "native-drag-original-action-incomplete" : result.error);
    return result.response;
  } catch (...) { runtime->frames.close(ticket, "native-drag-original-action-failed"); throw; }
}
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
