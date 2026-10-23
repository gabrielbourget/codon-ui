#include <atomic>
#include <cstdlib>
#include <future>
#include <new>
#include <iostream>
#include <stdexcept>
#include <thread>

// Fail each registry allocation without substituting any production lock/state.
std::atomic<int> failAllocationAfter{-1};
void *operator new(std::size_t size) {
  if (failAllocationAfter.load() >= 0 && failAllocationAfter.fetch_sub(1) == 0) throw std::bad_alloc();
  if (auto memory = std::malloc(size ? size : 1)) return memory;
  throw std::bad_alloc();
}
void operator delete(void *memory) noexcept { std::free(memory); }

// Explicit value/node doubles surround the actual new SDK registry. No SDK
// runtime, window, editor or native focus result is constructed by this model.
namespace folly { struct dynamic { int original; }; }
namespace facebook::react { class ShadowNode {}; }
#include <react/renderer/uimanager/NativeEventCommands.h>
#include "../../../../packages/react-native/cpp/FieldInputDispatchFrames.h"

using namespace facebook::react;
using namespace codon;
using namespace std::chrono_literals;

int main() {
  int assertions = 0;
  const auto check = [&](bool condition) { if (!condition) throw std::runtime_error("SDK command assertion failed"); assertions++; };
  const auto node = std::make_shared<const ShadowNode>();
  const auto arguments = std::make_shared<const folly::dynamic>(folly::dynamic{41});
  std::atomic<int> calls{0};
  const auto command = [&](std::function<bool()> current = [] { return true; }, std::function<void()> original = {}) {
    return std::make_shared<NativeEventCommand>(11, 12, "focus", node, arguments,
      original ? std::move(original) : [&] { calls++; }, std::move(current));
  };
  auto first = command();
  check(first->surfaceId == 11 && first->target == 12 && first->name == "focus");
  check(first->node.lock() == node && first->arguments == arguments);
  check(first->status() == NativeEventCommandStatus::Pending);
  check(first->executeOriginal());
  check(!first->executeOriginal() && !first->cancel() && calls == 1);
  check(first->status() == NativeEventCommandStatus::Completed);
  auto cancelled = command();
  check(cancelled->cancel() && !cancelled->cancel() && !cancelled->executeOriginal() && calls == 1);
  auto unavailable = command([] { return false; });
  check(!unavailable->executeOriginal() && unavailable->status() == NativeEventCommandStatus::DelegateRetired && calls == 1);
  auto thrown = command([] { return true; }, [] { throw std::logic_error("original SDK failure"); });
  try { thrown->executeOriginal(); check(false); } catch (const std::logic_error &error) { check(std::string(error.what()) == "original SDK failure"); }
  check(thrown->status() == NativeEventCommandStatus::Failed && !thrown->executeOriginal());
  for (int repetition = 0; repetition < 20; repetition++) {
    auto racing = command();
    const auto before = calls.load();
    auto execute = std::async(std::launch::async, [&] { return racing->executeOriginal(); });
    auto cancel = std::async(std::launch::async, [&] { return racing->cancel(); });
    const auto executed = execute.get(), retired = cancel.get();
    check(executed != retired && calls == before + (executed ? 1 : 0));
  }
  for (int allocation = 0; allocation < 4; allocation++) {
    NativeEventCommands failing;
    bool rejected = false;
    failAllocationAfter.store(allocation);
    try {
      auto registration = failing.enter([](const auto &value) { value->cancel(); });
      failAllocationAfter.store(-1);
    } catch (const std::bad_alloc &) { failAllocationAfter.store(-1); rejected = true; }
    check(rejected && !failing.captureCurrentThread());
  }
  NativeEventCommands registry, otherManager;
  check(!registry.captureCurrentThread());
  std::vector<int> order;
  auto outer = registry.enter([&](const auto &value) { order.push_back(1); value->executeOriginal(); });
  check(registry.captureCurrentThread() != nullptr && !otherManager.captureCurrentThread());
  check(std::async(std::launch::async, [&] { return !registry.captureCurrentThread(); }).get());
  {
    auto inner = registry.enter([&](const auto &value) { order.push_back(2); value->executeOriginal(); });
    registry.captureCurrentThread()->dispatchOriginal(command());
    check(order == std::vector<int>{2});
  }
  registry.captureCurrentThread()->dispatchOriginal(command());
  check(order == (std::vector<int>{2, 1}));
  auto duplicate = command();
  registry.captureCurrentThread()->dispatchOriginal(duplicate);
  const auto beforeDuplicate = order.size();
  try { registry.captureCurrentThread()->dispatchOriginal(duplicate); check(false); }
  catch (const std::runtime_error &error) { check(std::string(error.what()) == "native-event-command-already-claimed"); }
  check(order.size() == beforeDuplicate);
  auto captured = registry.captureCurrentThread();
  std::async(std::launch::async, [&] { outer->retire(); }).get();
  check(!captured->current() && !registry.captureCurrentThread());
  auto obsolete = command();
  try { captured->dispatchOriginal(obsolete); check(false); }
  catch (const std::runtime_error &error) { check(std::string(error.what()) == "native-event-command-registration-retired"); }
  check(obsolete->status() == NativeEventCommandStatus::Cancelled);
  auto unsettled = registry.enter([](const auto &) {});
  auto lost = command();
  try { registry.captureCurrentThread()->dispatchOriginal(lost); check(false); }
  catch (const std::runtime_error &error) { check(std::string(error.what()) == "native-event-command-unsettled"); }
  check(lost->status() == NativeEventCommandStatus::Cancelled);
  unsettled.reset();
  std::shared_ptr<NativeEventCommands::Registration> lifetime;
  std::shared_ptr<NativeEventCommands::Route> deadManager;
  {
    NativeEventCommands manager;
    lifetime = manager.enter([](const auto &value) { value->executeOriginal(); });
    deadManager = manager.captureCurrentThread();
  }
  check(!deadManager->current());
  lifetime.reset();
  // Releasing a handler may retire another registration; no registry lock can
  // surround that capture's destruction.
  auto firstLease = registry.enter([](const auto &value) { value->cancel(); });
  auto release = std::shared_ptr<int>(new int(1), [&](int *value) { firstLease->retire(); delete value; });
  auto secondLease = registry.enter([release](const auto &value) { value->cancel(); });
  release.reset(); secondLease.reset();
  check(!registry.captureCurrentThread());

  const FieldInputIdentity identity{"owner", "binding", "revision", 15, 2, 3, 11, 10,
    "document", "7", "window", "mount:7", "outer:1", "input:1", "component:10", "editor:10", 2};
  for (const bool afterHandler : {false, true}) {
    FieldInputDispatchFrames frames;
    auto ticket = frames.begin(identity, 1, "down", 1000ms);
    check(ticket && frames.startDelivery(ticket));
    auto original = command();
    auto work = std::make_shared<FieldInputCommandAction>(FieldInputCommandAction{11, 12, "focus",
      [original] { return FieldInputCommandResult{original->executeOriginal(), ""}; }, [original] { original->cancel(); }});
    if (afterHandler) frames.finishHandler(ticket, false);
    auto js = std::async(std::launch::async, [&] {
      auto result = frames.requestCommand(ticket, work);
      if (!result.callbackCompleted || !result.error.empty()) throw std::runtime_error("original command did not finish");
      if (!afterHandler) {
        if (!frames.acknowledge(ticket->token, identity, 1, "down", true, false, std::nullopt)) throw std::runtime_error("original ack lost");
        frames.finishHandler(ticket, false);
      }
      frames.finishPhases(ticket);
    });
    int serviced = 0;
    const auto native = std::this_thread::get_id();
    const auto result = frames.wait(ticket, {}, {}, [&](const FieldInputCommandAction &action) {
      check(std::this_thread::get_id() == native && action.surfaceId == 11 && action.target == 12 && action.name == "focus");
      serviced++; return action.perform();
    });
    js.get();
    check(serviced == 1 && original->status() == NativeEventCommandStatus::Completed);
    check(result.disposition == (afterHandler ? FieldInputDisposition::Unacknowledged : FieldInputDisposition::Allowed));
    frames.end(ticket, true);
    check(!frames.requestCommand(ticket, work).callbackCompleted);
  }
  {
    FieldInputDispatchFrames frames;
    auto ticket = frames.begin(identity, 1, "down", 1000ms); frames.startDelivery(ticket);
    auto original = command();
    auto work = std::make_shared<FieldInputCommandAction>(FieldInputCommandAction{12, 12, "focus",
      [original] { return FieldInputCommandResult{original->executeOriginal(), ""}; }, [original] { original->cancel(); }});
    check(frames.requestCommand(ticket, work).error == "field-input-command-frame-retired");
    check(original->status() == NativeEventCommandStatus::Cancelled);
    frames.end(ticket, false);
  }
  {
    FieldInputDispatchFrames frames;
    auto ticket = frames.begin(identity, 1, "down", 10ms); frames.startDelivery(ticket);
    auto original = command();
    auto work = std::make_shared<FieldInputCommandAction>(FieldInputCommandAction{11, 12, "focus",
      [original] { return FieldInputCommandResult{original->executeOriginal(), ""}; }, [original] { original->cancel(); }});
    check(frames.requestCommand(ticket, work).error == "field-input-command-timed-out");
    check(original->status() == NativeEventCommandStatus::Cancelled);
    check(frames.end(ticket, true).disposition == FieldInputDisposition::TimedOut);
  }
  for (const std::string retire : {"binding", "module", "phases", "handler"}) {
    FieldInputDispatchFrames frames;
    auto ticket = frames.begin(identity, 1, "down", 1000ms); frames.startDelivery(ticket);
    if (retire != "handler") frames.finishHandler(ticket, false);
    auto original = command();
    const auto before = calls.load();
    auto work = std::make_shared<FieldInputCommandAction>(FieldInputCommandAction{11, 12, "focus",
      [original] { return FieldInputCommandResult{original->executeOriginal(), ""}; },
      [&, original] { original->cancel(); (void)frames.isCurrent(ticket); }});
    auto js = std::async(std::launch::async, [&] {
      auto result = frames.requestCommand(ticket, work);
      if (result.callbackCompleted || result.error.empty()) throw std::runtime_error("retired command was accepted");
      if (retire == "handler") frames.finishHandler(ticket, true, "handler-first");
      frames.finishPhases(ticket, true, result.error);
      return result;
    });
    bool cancelledBeforePerform = false;
    const auto result = frames.wait(ticket, {}, {}, [&](const FieldInputCommandAction &action) {
      if (retire == "binding") frames.retireBinding(identity.ownerId, identity.bindingId);
      else if (retire == "module") frames.retire();
      else if (retire == "phases") frames.finishPhases(ticket, true, "phase-first");
      else frames.finishHandler(ticket, true, "handler-first");
      cancelledBeforePerform = original->status() == NativeEventCommandStatus::Cancelled;
      return action.perform();
    });
    const auto reply = js.get();
    check(cancelledBeforePerform);
    check(calls == before && !original->executeOriginal());
    if (retire == "phases" || retire == "handler") {
      check(reply.error == (retire == "phases" ? "phase-first" : "handler-first"));
      check(result.disposition == FieldInputDisposition::Failed);
    } else check(result.disposition == FieldInputDisposition::Retired);
    frames.end(ticket, true);
  }
  for (const std::string failure : {"throw", "empty", "missing"}) {
    FieldInputDispatchFrames frames;
    auto ticket = frames.begin(identity, 1, "down", 1000ms); frames.startDelivery(ticket); frames.finishHandler(ticket, false);
    auto original = command();
    const auto before = calls.load();
    auto work = std::make_shared<FieldInputCommandAction>(FieldInputCommandAction{11, 12, "focus",
      [original] { return FieldInputCommandResult{original->executeOriginal(), ""}; }, [original] { original->cancel(); }});
    auto js = std::async(std::launch::async, [&] {
      auto result = frames.requestCommand(ticket, work);
      if (result.callbackCompleted || result.error.empty()) throw std::runtime_error("service failure lost");
      frames.finishPhases(ticket, true, "later-failure");
      return result;
    });
    const std::function<FieldInputCommandResult(const FieldInputCommandAction &)> service = failure == "missing" ?
      std::function<FieldInputCommandResult(const FieldInputCommandAction &)>{} : [&](const FieldInputCommandAction &) -> FieldInputCommandResult {
        if (failure == "throw") throw std::logic_error("original-service-failure");
        return {};
      };
    const auto result = frames.wait(ticket, {}, {}, service);
    const auto reply = js.get();
    check(result.disposition == FieldInputDisposition::Failed && reply.error == result.error);
    check(result.error != "later-failure");
    check(original->status() == NativeEventCommandStatus::Cancelled && calls == before);
    frames.end(ticket, true);
  }
  {
    FieldInputDispatchFrames frames;
    auto ticket = frames.begin(identity, 1, "down", 1000ms); frames.startDelivery(ticket); frames.finishHandler(ticket, false);
    auto original = command();
    auto work = std::make_shared<FieldInputCommandAction>(FieldInputCommandAction{11, 12, "focus",
      [original] { return FieldInputCommandResult{original->executeOriginal(), ""}; }, [original] { original->cancel(); }});
    auto js = std::async(std::launch::async, [&] {
      auto result = frames.requestCommand(ticket, work);
      if (!result.callbackCompleted) throw std::runtime_error("nested rejection cancelled original work");
      frames.finishPhases(ticket);
    });
    frames.wait(ticket, {}, {}, [&](const FieldInputCommandAction &action) {
      check(frames.requestMount(ticket).error == "field-input-mount-frame-retired");
      check(frames.requestFocus(ticket->token, identity, 1, "down", {2, "next"}).error == "field-input-focus-request-retired");
      return action.perform();
    });
    js.get();
    check(original->status() == NativeEventCommandStatus::Completed);
    frames.end(ticket, true);
  }
  std::cout << assertions << " actual SDK command-registry / Codon frame assertions passed; no linked or installed SDK verdict\n";
}
