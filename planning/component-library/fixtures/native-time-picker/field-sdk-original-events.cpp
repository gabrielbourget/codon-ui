#include <algorithm>
#include <functional>
#include <iostream>
#include <memory>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <type_traits>
#include <vector>
#include <react/renderer/core/EventQueueProcessor.h>
#include <react/utils/OnScopeExit.h>
#include <react/featureflags/ReactNativeFeatureFlags.h>

namespace facebook::react {
class ShadowNodeFamily {};
class EventEmitter { public: static std::mutex &DispatchMutex() { static std::mutex mutex; return mutex; } };
struct ModelScopeExitBuilder {};
template <class T> auto operator+(ModelScopeExitBuilder, T callback) { return OnScopeExit<T>(std::move(callback)); }
#define SCOPE_EXIT auto originalTargetRelease = ModelScopeExitBuilder{} + [&]()
class EventQueue {
 public:
  EventQueueProcessor eventProcessor_;
  std::vector<RawEvent> ordinaryQueue;
  explicit EventQueue(EventQueueProcessor processor) : eventProcessor_(std::move(processor)) {}
  void dispatchOriginalNativeEvents(jsi::Runtime &, std::vector<RawEvent> &&) const;
};
class EventDispatcher {
 public:
  EventQueue eventQueue_;
  std::weak_ptr<EventLogger> eventLogger_;
  EventDispatcher(EventQueueProcessor processor, std::shared_ptr<EventLogger> logger) : eventQueue_(std::move(processor)), eventLogger_(logger) {}
  void dispatchOriginalNativeEvents(jsi::Runtime &, std::vector<RawEvent> &&) const;
};
class Scheduler {
 public:
  std::shared_ptr<std::optional<const EventDispatcher>> eventDispatcher_;
  explicit Scheduler(EventQueueProcessor processor, std::shared_ptr<EventLogger> logger)
      : eventDispatcher_(std::make_shared<std::optional<const EventDispatcher>>(std::in_place, std::move(processor), logger)) {}
  bool dispatchOriginalNativeEvents(jsi::Runtime &, std::vector<RawEvent> &&) const;
};
}
#include "original-event-method-excerpts.inc"
using namespace facebook::react;
namespace jsi = facebook::jsi;

int main() {
  int assertions = 0;
  const auto check = [&](bool value) { if (!value) throw std::runtime_error("original SDK event processor assertion failed"); assertions++; };
  for (bool mapping : {false, true}) {
    ReactNativeFeatureFlags::mapping = mapping;
    jsi::Runtime runtime; auto logger = std::make_shared<EventLogger>();
    auto target = std::make_shared<EventTarget>(); auto payload = std::make_shared<EventPayload>(); auto family = std::make_shared<ShadowNodeFamily>();
    std::vector<ReactEventPriority> ordinary, admitted;
    int ordinaryConclusions = 0, admittedConclusions = 0;
    EventQueueProcessor baseline([&](auto &, auto *, const auto &, auto priority, const auto &, auto) { ordinary.push_back(priority); },
      [&](auto &) { ordinaryConclusions++; }, [](const auto &) {}, logger);
    EventQueueProcessor processor([&](auto &, auto *actualTarget, const auto &, auto priority, const auto &actualPayload, auto time) {
      if (actualTarget != target.get() || &actualPayload != payload.get() || time.value != 41)
        throw std::runtime_error("original SDK event metadata changed");
      admitted.push_back(priority);
    }, [&](auto &) { admittedConclusions++; }, [](const auto &) {}, logger);
    Scheduler scheduler(std::move(processor), logger);
    const std::vector<RawEvent::Category> categories{RawEvent::Category::Unspecified, RawEvent::Category::ContinuousStart,
      RawEvent::Category::Unspecified, RawEvent::Category::Discrete, RawEvent::Category::Continuous,
      RawEvent::Category::Idle, RawEvent::Category::ContinuousEnd, RawEvent::Category::Unspecified};
    std::vector<RawEvent> events;
    for (auto category : categories) events.emplace_back("topFocus", payload, target, family, category, false, HighResTimeStamp{41});
    auto originals = events;
    baseline.flushEvents(runtime, std::move(events));
    for (const auto &event : originals) {
      check(event.shadowNodeFamily.lock() == family && !event.isUnique);
      std::vector<RawEvent> one; one.push_back(event);
      check(scheduler.dispatchOriginalNativeEvents(runtime, std::move(one)));
    }
    check(ordinary == admitted && admitted.size() == categories.size());
    check(ordinaryConclusions == 1 && admittedConclusions == static_cast<int>(categories.size()));
    check(target->retained == 0 && target->retains == static_cast<int>(categories.size() * 2));
    check(logger->starts == static_cast<int>(categories.size()));
    check(logger->processingStarts == static_cast<int>(categories.size() * 2) && logger->processingEnds == logger->processingStarts);
    check(scheduler.eventDispatcher_->value().eventQueue_.ordinaryQueue.empty());
    scheduler.eventDispatcher_->reset(); std::vector<RawEvent> unavailable;
    unavailable.emplace_back("topBlur", payload, target, family);
    check(!scheduler.dispatchOriginalNativeEvents(runtime, std::move(unavailable)));
  }
  {
    jsi::Runtime runtime; auto logger = std::make_shared<EventLogger>(); auto target = std::make_shared<EventTarget>();
    auto payload = std::make_shared<EventPayload>(); auto family = std::make_shared<ShadowNodeFamily>();
    int callbacks = 0, conclusions = 0;
    EventQueueProcessor processor([&](auto &, auto *, const auto &, auto, const auto &, auto) { callbacks++; throw std::logic_error("original event failure"); },
      [&](auto &) { conclusions++; }, [](const auto &) {}, logger);
    Scheduler scheduler(std::move(processor), logger); std::vector<RawEvent> originals;
    originals.emplace_back("topFocus", payload, target, family);
    originals.emplace_back("topBlur", payload, target, family);
    bool observed = false;
    try { scheduler.dispatchOriginalNativeEvents(runtime, std::move(originals)); }
    catch (const std::logic_error &error) { observed = std::string(error.what()) == "original event failure"; }
    check(observed && callbacks == 1 && conclusions == 0);
    check(target->retained == 0 && target->retains == 2);
    check(logger->starts == 2 && logger->processingStarts == 1 && logger->processingEnds == 0);
    check(scheduler.eventDispatcher_->value().eventQueue_.ordinaryQueue.empty());
  }
  std::cout << assertions << " actual SDK processor and exact original-event forwarding assertions passed; no linked or installed verdict\n";
}
