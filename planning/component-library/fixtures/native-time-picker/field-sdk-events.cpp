#include <algorithm>
#include <future>
#include <iostream>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

// Value, event-target and queue doubles surround the actual RawEvent,
// continuation, listener implementation and exact SDK dispatcher methods.
#include <react/renderer/core/RawEvent.h>
#include <react/renderer/core/EventListener.h>
namespace facebook::react {
class ShadowNodeFamily { public: int getTag() const { return 12; } };
struct ModelQueue {
  std::vector<RawEvent> events;
  void enqueueEvent(RawEvent &&event) { events.push_back(std::move(event)); }
  void enqueueUniqueEvent(RawEvent &&event) { events.push_back(std::move(event)); }
};
struct ModelLogger {
  int calls{0};
  EventTag onEventStart(const std::string &, const SharedEventTarget &, HighResTimeStamp) { calls++; return 77; }
};
class EventDispatcher {
 public:
  mutable ModelQueue eventQueue_;
  mutable EventListenerContainer eventListeners_;
  std::weak_ptr<ModelLogger> eventLogger_;
  void dispatchEvent(RawEvent &&event) const;
  void dispatchUniqueEvent(RawEvent &&event) const;
  void addListener(std::shared_ptr<const EventListener> listener) const;
  void removeListener(const std::shared_ptr<const EventListener> &listener) const;
};
}
#include "dispatcher-event-excerpts.inc"
namespace facebook::react {
class UIManager {
 public:
  EventDispatcher dispatcher;
  void addEventListener(std::shared_ptr<const EventListener> listener) { dispatcher.addListener(std::move(listener)); }
  void removeEventListener(const std::shared_ptr<const EventListener> &listener) { dispatcher.removeListener(listener); }
};
}
#include "../../../../packages/react-native/cpp/FieldInputOriginalCapture.h"
using namespace facebook::react;


int main() {
  int assertions = 0;
  const auto check = [&](bool value) { if (!value) throw std::runtime_error("SDK continuation assertion failed"); assertions++; };
  const auto target = std::make_shared<EventTarget>();
  const auto payload = std::make_shared<EventPayload>();
  const auto family = std::make_shared<ShadowNodeFamily>();
  const auto makeEvent = [&](bool unique = false) {
    return RawEvent("topPointerDown", payload, target, family, RawEvent::Category::Discrete, unique, HighResTimeStamp{41});
  };
  for (bool unique : {false, true}) {
    EventDispatcher dispatcher;
    const auto logger = std::make_shared<ModelLogger>(); dispatcher.eventLogger_ = logger;
    auto ordinary = makeEvent(unique);
    if (unique) dispatcher.dispatchUniqueEvent(std::move(ordinary)); else dispatcher.dispatchEvent(std::move(ordinary));
    check(dispatcher.eventQueue_.events.size() == 1);
    const auto &queued = dispatcher.eventQueue_.events.back();
    check(queued.eventPayload == payload && queued.eventTarget == target && queued.shadowNodeFamily.lock() == family);
    check(queued.eventStartTimeStamp.value == 41 && queued.category == RawEvent::Category::Discrete && queued.isUnique == unique);
    check(logger->calls == (unique ? 0 : 1) && queued.loggingTag == (unique ? 0 : 77));
  }
  for (bool unique : {false, true}) {
    EventDispatcher dispatcher;
    std::vector<int> order;
    int callbacks = 0;
    auto legacy = std::make_shared<const EventListener>([&](const RawEvent &) { callbacks++; return true; });
    dispatcher.addListener(legacy);
    if (unique) dispatcher.dispatchUniqueEvent(makeEvent(unique)); else dispatcher.dispatchEvent(makeEvent(unique));
    check(callbacks == 1 && dispatcher.eventQueue_.events.empty()); dispatcher.removeListener(legacy);
    std::shared_ptr<const EventListener> listener;
    auto added = std::make_shared<const EventListener>([&](const RawEvent &) { order.push_back(3); return false; });
    std::optional<RawEvent> copy;
    listener = std::make_shared<const EventListener>([&](const RawEvent &event) {
      order.push_back(1);
      if (!event.deferAfterListeners([&] {
        order.push_back(2);
        // This takes the actual listener container's exclusive lock.
        dispatcher.removeListener(listener); dispatcher.addListener(added);
        callbacks++;
      })) throw std::runtime_error("first original continuation was not admitted");
      copy.emplace(event);
      return true;
    });
    dispatcher.addListener(listener);
    auto original = makeEvent(unique);
    if (unique) dispatcher.dispatchUniqueEvent(std::move(original)); else dispatcher.dispatchEvent(std::move(original));
    check(order == (std::vector<int>{1, 2}) && callbacks == 2 && dispatcher.eventQueue_.events.empty());
    check(copy && copy->eventPayload == payload && copy->eventTarget == target && copy->shadowNodeFamily.lock() == family);
    check(copy->type == "topPointerDown" && copy->eventStartTimeStamp.value == 41 && copy->isUnique == unique);
    check(copy->continueAfterListeners() && callbacks == 2);
    check(!copy->deferAfterListeners([] {}));
    if (unique) dispatcher.dispatchUniqueEvent(makeEvent(unique)); else dispatcher.dispatchEvent(makeEvent(unique));
    check(order == (std::vector<int>{1, 2, 3}) && dispatcher.eventQueue_.events.size() == 1);
  }
  {
    auto event = makeEvent(); int calls = 0;
    check(event.deferAfterListeners([&] { calls++; }));
    const auto error = std::async(std::launch::async, [&] {
      try { event.continueAfterListeners(); } catch (const std::runtime_error &error) { return std::string(error.what()); }
      return std::string{};
    }).get();
    check(error == "native-event-continuation-wrong-thread" && calls == 0);
    check(event.continueAfterListeners() && calls == 1);
  }
  {
    EventDispatcher dispatcher; int calls = 0;
    auto listener = std::make_shared<const EventListener>([&](const RawEvent &event) {
      event.deferAfterListeners([&] { calls++; throw std::logic_error("original event failure"); }); return true;
    });
    dispatcher.addListener(listener); auto original = makeEvent();
    try { dispatcher.dispatchEvent(std::move(original)); check(false); }
    catch (const std::logic_error &error) { check(std::string(error.what()) == "original event failure"); }
    check(original.continueAfterListeners() && calls == 1 && dispatcher.eventQueue_.events.empty());
  }
  {
    EventDispatcher dispatcher; std::vector<std::string> order;
    auto listener = std::make_shared<const EventListener>([&](const RawEvent &event) {
      const auto type = event.type;
      return event.deferAfterListeners([&, type] {
        order.push_back(type);
        if (type == "topPointerDown") {
          auto nested = makeEvent(); nested.type = "topFocus"; dispatcher.dispatchEvent(std::move(nested));
          order.push_back("outer-returned");
        }
      });
    });
    dispatcher.addListener(listener); dispatcher.dispatchEvent(makeEvent());
    check(order == (std::vector<std::string>{"topPointerDown", "topFocus", "outer-returned"}));
    check(dispatcher.eventQueue_.events.empty());
  }
  {
    auto event = makeEvent(); int calls = 0;
    check(event.deferAfterListeners([&] { event = makeEvent(); calls++; }));
    check(event.continueAfterListeners() && calls == 1);
    check(!event.continueAfterListeners());
    try { event.deferAfterListeners({}); check(false); }
    catch (const std::invalid_argument &error) { check(std::string(error.what()) == "native-event-continuation-required"); }
    check(event.deferAfterListeners([&] { calls++; }));
    check(event.continueAfterListeners() && calls == 2);
  }
  {
    UIManager manager; int emitted = 0, received = 0;
    std::vector<std::string> order;
    const auto captured = codon::continueFieldOriginalInput(manager, 12, [&] {
      emitted++; order.push_back("emit-enter");
      auto original = makeEvent(); original.type = "topNativeSegmentInput";
      manager.dispatcher.dispatchEvent(std::move(original)); order.push_back("emit-return");
    }, [&](const RawEvent &event) {
      received++; order.push_back("receive");
      if (event.eventPayload != payload || event.eventTarget != target || event.shadowNodeFamily.lock() != family || event.eventStartTimeStamp.value != 41)
        throw std::runtime_error("actual CUI continuation changed original metadata");
      auto observer = std::make_shared<const EventListener>([](const auto &) { return false; });
      manager.addEventListener(observer); manager.removeEventListener(observer);
    });
    check(captured && emitted == 1 && received == 1 && manager.dispatcher.eventQueue_.events.empty());
    check(order == (std::vector<std::string>{"emit-enter", "receive", "emit-return"}));
    manager.dispatcher.dispatchEvent(makeEvent());
    check(received == 1 && manager.dispatcher.eventQueue_.events.size() == 1);
  }
  for (const std::string scenario : {"target", "thread", "type", "payload", "native-operation", "earlier-owner"}) {
    UIManager manager; int emitted = 0, received = 0;
    auto earlier = std::make_shared<const EventListener>([](const RawEvent &) { return true; });
    if (scenario == "earlier-owner") manager.addEventListener(earlier);
    std::unique_ptr<codon::FieldInputNativeOperation> operation;
    if (scenario == "native-operation") operation = std::make_unique<codon::FieldInputNativeOperation>(&manager);
    const auto captured = codon::continueFieldOriginalInput(manager, scenario == "target" ? 13 : 12, [&] {
      emitted++; auto original = makeEvent(); original.type = "topNativeSegmentInput";
      if (scenario == "type") original.type = "topFocus";
      if (scenario == "payload") original.eventPayload.reset();
      if (scenario == "thread") std::async(std::launch::async, [&] { manager.dispatcher.dispatchEvent(std::move(original)); }).get();
      else manager.dispatcher.dispatchEvent(std::move(original));
    }, [&](const RawEvent &) { received++; });
    check(!captured && emitted == 1 && received == 0);
    check(manager.dispatcher.eventQueue_.events.size() == (scenario == "earlier-owner" ? 0 : 1));
  }
  for (const std::string failure : {"receiver", "emitter"}) {
    UIManager manager; int emitted = 0, received = 0;
    try {
      codon::continueFieldOriginalInput(manager, 12, [&] {
        emitted++; auto original = makeEvent(); original.type = "topNativeSegmentInput";
        manager.dispatcher.dispatchEvent(std::move(original));
        if (failure == "emitter") throw std::logic_error("original emitter failure");
      }, [&](const RawEvent &) { received++; if (failure == "receiver") throw std::logic_error("original receiver failure"); });
      check(false);
    } catch (const std::logic_error &error) {
      check(std::string(error.what()) == (failure == "receiver" ? "original receiver failure" : "original emitter failure"));
    }
    check(emitted == 1 && received == 1 && manager.dispatcher.eventQueue_.events.empty());
    manager.dispatcher.dispatchEvent(makeEvent());
    check(received == 1 && manager.dispatcher.eventQueue_.events.size() == 1);
  }
  {
    UIManager manager; int emitted = 0, received = 0; std::string failure;
    auto listener = std::make_shared<const EventListener>([&](const RawEvent &) {
      try {
        codon::continueFieldOriginalInput(manager, 12, [&] { emitted++; }, [&](const RawEvent &) { received++; });
      } catch (const std::runtime_error &error) { failure = error.what(); }
      return true;
    });
    manager.addEventListener(listener); manager.dispatcher.dispatchEvent(makeEvent()); manager.removeEventListener(listener);
    check(failure == "field-input-original-listener-stack-active" && emitted == 0 && received == 0);
    check(!NativeEventListenerScope::active() && manager.dispatcher.eventQueue_.events.empty());
  }
  {
    EventDispatcher dispatcher; int calls = 0; std::string failure;
    auto listener = std::make_shared<const EventListener>([&](const RawEvent &event) {
      event.deferAfterListeners([&] { calls++; });
      try { const_cast<RawEvent &>(event).continueAfterListeners(); }
      catch (const std::runtime_error &error) { failure = error.what(); }
      return true;
    });
    dispatcher.addListener(listener); dispatcher.dispatchEvent(makeEvent());
    check(failure == "native-event-continuation-listener-stack-active" && calls == 1);
    check(!NativeEventListenerScope::active() && dispatcher.eventQueue_.events.empty());
    dispatcher.removeListener(listener);
  }
  std::cout << assertions << " actual SDK RawEvent/continuation/listener and exact dispatcher assertions passed; no linked or installed verdict\n";
}
