#include <algorithm>
#include <atomic>
#include <deque>
#include <exception>
#include <future>
#include <iostream>
#include <optional>
#include <queue>
#include <string>
#include <thread>
#include <unordered_set>
#include <utility>
#include <vector>

#include <react/renderer/runtimescheduler/Task.h>
#include <react/utils/OnScopeExit.h>
#include "../../../../packages/react-native/cpp/FieldInputTaskScope.h"
#include "../../../../packages/react-native/cpp/FieldInputOriginalCommand.h"
namespace folly { struct dynamic { int original{41}; }; }
namespace facebook::react { class ShadowNode {}; }
#include <react/renderer/uimanager/NativeEventCommands.h>

namespace facebook::react {
// Explicit surrounding tracing/consistency/value/queue doubles. The included
// task lifecycle, checkpoint, rendering methods and linked Task.cpp are SDK code.
struct TraceSection { template <class... T> explicit TraceSection(T &&...) {} };
struct ScopedShadowTreeRevisionLock { explicit ScopedShadowTreeRevisionLock(void *) {} };
inline int serialize(SchedulerPriority priority) { return static_cast<int>(priority); }
inline HighResDuration timeoutForSchedulerPriority(SchedulerPriority) { return {10}; }
struct TimingDelegate { void dispatchPendingEventTimingEntries(HighResTimeStamp, const std::unordered_set<int> &) {} };
struct IntersectionDelegate { void updateIntersectionObservations(const std::unordered_set<int> &) {} };
using RuntimeSchedulerRenderingUpdate = std::function<void()>;
using SurfaceId = int;
class RuntimeScheduler_Modern {
 public:
  std::deque<std::shared_ptr<Task>> queue;
  jsi::Runtime *eagerRuntime{nullptr};
  Task *currentTask_{nullptr};
  SchedulerPriority currentPriority_{SchedulerPriority::NormalPriority};
  void *shadowTreeRevisionConsistencyManager_{nullptr};
  HighResTimeStamp lastYieldingOpportunity_{};
  HighResDuration longestPeriodWithoutYieldingOpportunity_{};
  std::function<HighResTimeStamp()> now_ = [] { return HighResTimeStamp{1}; };
  bool performingMicrotaskCheckpoint_{false};
  std::atomic<TimingDelegate *> eventTimingDelegate_{nullptr};
  IntersectionDelegate *intersectionObserverDelegate_{nullptr};
  std::unordered_set<int> surfaceIdsWithPendingRenderingUpdates_;
  std::queue<RuntimeSchedulerRenderingUpdate> pendingRenderingUpdates_;
  std::vector<std::string> errors;
  std::function<void(jsi::Runtime &, jsi::JSError &)> onTaskError_ = [&](auto &, auto &error) { errors.push_back(error.what()); };
  void markYieldingOpportunity(HighResTimeStamp) {}
  void reportLongTasks(const Task &, HighResTimeStamp, HighResTimeStamp) {}
  void scheduleTask(std::shared_ptr<Task> task) {
    queue.push_back(task);
    if (eagerRuntime) runEventLoopTick(*eagerRuntime, *task);
  }
  void ordinary(RawCallback callback) { scheduleTask(std::make_shared<Task>(SchedulerPriority::NormalPriority, std::move(callback), HighResTimeStamp{10})); }
  void runNext(jsi::Runtime &runtime) {
    while (!queue.empty() && !queue.front()->callback) queue.pop_front();
    if (queue.empty()) throw std::runtime_error("model queue has no executable task");
    auto task = queue.front(); queue.pop_front(); runEventLoopTick(runtime, *task);
  }
  void cancelNext() { queue.front()->callback.reset(); queue.front()->nativeEventScopeFactory = {}; queue.pop_front(); }
  bool scheduleNativeEventWork(RawCallback &&, NativeEventTaskScopeFactory);
  void runEventLoopTick(jsi::Runtime &, Task &);
  void executeTask(jsi::Runtime &, Task &, bool) const;
  void performMicrotaskCheckpoint(jsi::Runtime &);
  void updateRendering(HighResTimeStamp);
  void scheduleRenderingUpdate(SurfaceId, RuntimeSchedulerRenderingUpdate &&);
};
}
namespace facebook::react::jsinspector_modern::tracing {
enum class EventLoopPhase { Task, Microtasks };
struct EventLoopReporter { explicit EventLoopReporter(EventLoopPhase) {} };
}
#include "task-method-excerpts.inc"
namespace jsi = facebook::jsi;
using namespace facebook::react;
using namespace codon;
using namespace std::chrono_literals;

struct CommandScope final : NativeEventTaskScope {
  FieldInputTaskScope frame;
  int &finishes;
  std::string error;
  CommandScope(std::shared_ptr<void> owner, FieldInputDispatchFrames &frames, FieldInputDispatchFrames::Handle ticket,
      NativeEventCommands &registry, int &finishes)
      : frame(std::move(owner), frames, ticket), finishes(finishes) {
    if (!frames.startDelivery(ticket)) throw std::runtime_error("original task admission expired");
    frame.attachCommands(registry, [&frames, ticket](const auto &command) {
      const auto result = requestFieldInputOriginalCommand(frames, ticket, command,
        [command] { return FieldInputCommandResult{command->executeOriginal(), ""}; });
      if (!result.callbackCompleted || !result.error.empty()) throw std::runtime_error(result.error);
    });
  }
  void fail(const std::string &value) noexcept override { if (error.empty()) error = value; frame.fail(value); }
  void finish() noexcept override { finishes++; frame.finish(); }
};

int main() {
  int assertions = 0;
  const auto check = [&](bool value) { if (!value) throw std::runtime_error("SDK task assertion failed"); assertions++; };
  const FieldInputIdentity identity{"owner", "binding", "revision", 15, 2, 3, 11, 10,
    "document", "7", "window", "mount:7", "outer:1", "input:1", "component:10", "editor:10", 2};
  const auto node = std::make_shared<const ShadowNode>();
  const auto args = std::make_shared<const folly::dynamic>();
  for (bool eager : {false, true}) {
    RuntimeScheduler_Modern scheduler; jsi::Runtime runtime; FieldInputDispatchFrames frames; NativeEventCommands registry;
    auto owner = std::make_shared<int>(1); auto ticket = frames.begin(identity, 1, "down", 1000ms);
    std::shared_ptr<CommandScope> scope; int finishes = 0, originalCalls = 0; std::vector<std::string> order;
    auto js = std::async(std::launch::async, [&] {
      const auto command = [&] {
        auto route = registry.captureCurrentThread();
        if (!route) throw std::runtime_error("SDK task command scope ended early");
        auto work = std::make_shared<NativeEventCommand>(11, 12, "focus", node, args, [&] { originalCalls++; }, [route] { return route->current(); });
        route->dispatchOriginal(work);
      };
      if (eager) scheduler.eagerRuntime = &runtime;
      if (!scheduler.scheduleNativeEventWork([&](auto &) {
        order.push_back("handler"); command();
        if (!frames.acknowledge(ticket->token, identity, 1, "down", true, false, std::nullopt)) throw std::runtime_error("original ack failed");
        frames.finishHandler(ticket, false);
        runtime.microtasks.push_back([&] {
          order.push_back("microtask"); command();
          scheduler.scheduleRenderingUpdate(11, [&] { order.push_back("render"); command(); });
        });
      }, [&](auto &) { order.push_back("enter"); scope = std::make_shared<CommandScope>(owner, frames, ticket, registry, finishes); return scope; }))
        throw std::runtime_error("scoped SDK work was declined");
      if (!eager) scheduler.runNext(runtime);
      if (registry.captureCurrentThread()) throw std::runtime_error("SDK task registration leaked into next task");
      scheduler.eagerRuntime = nullptr;
      scheduler.ordinary([&](auto &) { if (registry.captureCurrentThread()) throw std::runtime_error("unrelated handler captured"); order.push_back("ordinary"); });
      scheduler.runNext(runtime);
    });
    const auto result = frames.wait(ticket, {}, {}, [](const auto &action) { return action.perform(); });
    js.get();
    check(result.disposition == FieldInputDisposition::Allowed && result.phasesComplete);
    check(originalCalls == 3 && finishes == 1 && scope->error.empty());
    check(order == (std::vector<std::string>{"enter", "handler", "microtask", "render", "ordinary"}));
    check(scheduler.currentTask_ == nullptr && !scheduler.performingMicrotaskCheckpoint_);
    check(scheduler.errors.empty()); frames.end(ticket, true);
  }
  for (const std::string failure : {"handler-js", "handler-cpp", "microtask-js", "microtask-cpp", "render", "checkpoint-bound"}) {
    RuntimeScheduler_Modern scheduler; jsi::Runtime runtime; FieldInputDispatchFrames frames; NativeEventCommands registry;
    auto ticket = frames.begin(identity, 1, "down", 1000ms); int finishes = 0, renderCalls = 0; std::shared_ptr<CommandScope> scope;
    scheduler.scheduleNativeEventWork([&](auto &) {
      if (failure == "handler-js") throw jsi::JSError(runtime, "handler-js");
      if (failure == "handler-cpp") throw std::logic_error("handler-cpp");
      frames.acknowledge(ticket->token, identity, 1, "down", true, false, std::nullopt); frames.finishHandler(ticket, false);
      runtime.microtasks.push_back([&] {
        if (failure == "microtask-js") throw jsi::JSError(runtime, "microtask-js");
        if (failure == "microtask-cpp") throw std::logic_error("microtask-cpp");
      });
      if (failure == "render") scheduler.scheduleRenderingUpdate(11, [&] { renderCalls++; throw std::logic_error("render-failed"); });
      if (failure == "checkpoint-bound") runtime.falseReturns = 255;
    }, [&](auto &) { scope = std::make_shared<CommandScope>(std::make_shared<int>(1), frames, ticket, registry, finishes); return scope; });
    bool escaped = false;
    try { scheduler.runNext(runtime); } catch (const std::exception &) { escaped = true; }
    const auto result = frames.wait(ticket);
    check(result.disposition == FieldInputDisposition::Failed && !scope->error.empty());
    check(finishes == 1 && !registry.captureCurrentThread() && scheduler.currentTask_ == nullptr);
    check(!scheduler.performingMicrotaskCheckpoint_);
    check(escaped == (failure == "render" || failure == "checkpoint-bound"));
    check(scheduler.errors.size() == (escaped ? 0 : 1));
    if (failure.starts_with("microtask")) check(scope->error == failure && result.error == failure);
    if (failure == "render") {
      scheduler.ordinary([](auto &) {}); scheduler.runNext(runtime);
      check(renderCalls == 1 && scheduler.pendingRenderingUpdates_.empty());
      check(scope->error == "render-failed" && result.error == "render-failed");
    }
    frames.end(ticket, true);
  }
  for (const std::string failure : {"null", "js", "cpp", "unknown"}) {
    RuntimeScheduler_Modern scheduler; jsi::Runtime runtime; int calls = 0;
    scheduler.scheduleNativeEventWork([&](auto &) { calls++; }, [&](jsi::Runtime &) -> std::shared_ptr<NativeEventTaskScope> {
      if (failure == "null") return nullptr;
      if (failure == "js") throw jsi::JSError(runtime, "factory-js");
      if (failure == "cpp") throw std::logic_error("factory-cpp");
      throw 41;
    });
    bool unknown = false;
    try { scheduler.runNext(runtime); } catch (int value) { unknown = value == 41; }
    check(calls == 0 && unknown == (failure == "unknown"));
    check(scheduler.errors.size() == ((unknown || failure == "null") ? 0 : 1));
    check(scheduler.currentTask_ == nullptr);
  }
  {
    RuntimeScheduler_Modern scheduler; jsi::Runtime runtime; int calls = 0, factories = 0;
    check(!scheduler.scheduleNativeEventWork({}, [&](jsi::Runtime &) -> std::shared_ptr<NativeEventTaskScope> { factories++; return nullptr; }));
    check(!scheduler.scheduleNativeEventWork([&](auto &) { calls++; }, {}));
    check(scheduler.queue.empty() && calls == 0 && factories == 0);
    scheduler.scheduleNativeEventWork([&](auto &) { calls++; }, [&](jsi::Runtime &) -> std::shared_ptr<NativeEventTaskScope> { factories++; return nullptr; });
    scheduler.cancelNext(); check(calls == 0 && factories == 0);
    scheduler.ordinary([&](auto &) { calls++; throw jsi::JSError(runtime, "ordinary-js"); }); scheduler.runNext(runtime);
    check(calls == 1 && scheduler.errors == std::vector<std::string>{"ordinary-js"});
  }
  {
    RuntimeScheduler_Modern scheduler; jsi::Runtime runtime; FieldInputDispatchFrames frames; NativeEventCommands registry;
    auto ticket = frames.begin(identity, 1, "down", 200ms); int finishes = 0, calls = 0; std::string lateError;
    std::shared_ptr<CommandScope> scope;
    auto js = std::async(std::launch::async, [&] {
      scheduler.scheduleNativeEventWork([&](auto &) {
        std::this_thread::sleep_for(230ms);
        auto route = registry.captureCurrentThread();
        if (!route) throw std::runtime_error("expired original task lost cancellation scope");
        auto work = std::make_shared<NativeEventCommand>(11, 12, "focus", node, args, [&] { calls++; }, [route] { return route->current(); });
        try { route->dispatchOriginal(work); } catch (const std::runtime_error &error) { lateError = error.what(); }
        if (work->status() != NativeEventCommandStatus::Cancelled) throw std::runtime_error("late original SDK command escaped");
        frames.finishHandler(ticket, false);
      }, [&](auto &) { scope = std::make_shared<CommandScope>(std::make_shared<int>(1), frames, ticket, registry, finishes); return scope; });
      scheduler.runNext(runtime);
      if (registry.captureCurrentThread()) throw std::runtime_error("retired task scope leaked");
    });
    auto result = frames.wait(ticket); frames.end(ticket, true); js.get();
    check(result.disposition == FieldInputDisposition::TimedOut && calls == 0 && !lateError.empty());
    check(finishes == 1 && scheduler.errors.empty());
  }
  {
    RuntimeScheduler_Modern scheduler; jsi::Runtime runtime; int originalCalls = 0;
    scheduler.ordinary([&](auto &) { scheduler.scheduleRenderingUpdate(11, [&] { originalCalls++; throw std::logic_error("ordinary-render"); }); });
    for (int attempt = 0; attempt < 2; attempt++) {
      if (attempt) scheduler.ordinary([](auto &) {});
      bool escaped = false;
      try { scheduler.runNext(runtime); } catch (const std::logic_error &) { escaped = true; }
      check(escaped && originalCalls == attempt + 1);
    }
    check(scheduler.pendingRenderingUpdates_.size() == 1);
  }
  {
    RuntimeScheduler_Modern scheduler; jsi::Runtime runtime; FieldInputDispatchFrames frames; NativeEventCommands registry;
    auto ticket = frames.begin(identity, 1, "down", 1000ms); int finishes = 0; std::shared_ptr<CommandScope> scope;
    scheduler.onTaskError_ = [&](auto &, auto &error) { scheduler.errors.push_back(error.what()); throw std::logic_error("reporter-failed"); };
    scheduler.scheduleNativeEventWork([&](auto &) { throw jsi::JSError(runtime, "first-handler-error"); },
      [&](auto &) { scope = std::make_shared<CommandScope>(std::make_shared<int>(1), frames, ticket, registry, finishes); return scope; });
    bool escaped = false;
    try { scheduler.runNext(runtime); } catch (const std::logic_error &error) { escaped = std::string(error.what()) == "reporter-failed"; }
    const auto result = frames.wait(ticket);
    check(escaped && scope->error == "first-handler-error" && result.error == "first-handler-error");
    check(finishes == 1 && !registry.captureCurrentThread() && scheduler.currentTask_ == nullptr);
    check(scheduler.errors == std::vector<std::string>{"first-handler-error"});
    frames.end(ticket, true);
  }
  for (const std::string retirement : {"owner", "module"}) {
    RuntimeScheduler_Modern scheduler; jsi::Runtime runtime; FieldInputDispatchFrames frames; NativeEventCommands registry;
    auto ticket = frames.begin(identity, 1, "down", 1000ms); int finishes = 0, calls = 0; std::shared_ptr<CommandScope> scope;
    scheduler.scheduleNativeEventWork([&](auto &) {
      frames.acknowledge(ticket->token, identity, 1, "down", true, false, std::nullopt);
      frames.finishHandler(ticket, false);
      runtime.microtasks.push_back([&] {
        if (retirement == "owner") frames.retireBinding(identity.ownerId, identity.bindingId); else frames.retire();
        auto route = registry.captureCurrentThread();
        if (!route) throw std::logic_error("retired frame lost its task cancellation scope");
        auto work = std::make_shared<NativeEventCommand>(11, 12, "focus", node, args, [&] { calls++; }, [route] { return route->current(); });
        route->dispatchOriginal(work);
      });
    }, [&](auto &) { scope = std::make_shared<CommandScope>(std::make_shared<int>(1), frames, ticket, registry, finishes); return scope; });
    scheduler.runNext(runtime);
    check(frames.wait(ticket).disposition == FieldInputDisposition::Retired && calls == 0);
    check(finishes == 1 && !registry.captureCurrentThread() && !scope->error.empty());
    check(scheduler.errors.size() == 1 && scheduler.currentTask_ == nullptr);
    frames.end(ticket, false);
  }
  {
    FieldInputDispatchFrames frames; auto owner = std::make_shared<int>(1);
    auto ticket = frames.begin(identity, 1, "down", 1000ms); frames.startDelivery(ticket);
    NativeEventCommands registry, otherRegistry; FieldInputTaskScope scope(owner, frames, ticket);
    scope.attachCommands(registry, [](const auto &command) { command->cancel(); });
    check(registry.captureCurrentThread() != nullptr && !otherRegistry.captureCurrentThread());
    try { scope.attachCommands(otherRegistry, [](const auto &) {}); check(false); }
    catch (const std::runtime_error &error) { check(std::string(error.what()) == "field-input-command-scope-already-attached"); }
    frames.finishHandler(ticket, false); scope.finish(); scope.finish();
    check(!registry.captureCurrentThread() && !otherRegistry.captureCurrentThread());
    try { scope.attachCommands(otherRegistry, [](const auto &) {}); check(false); }
    catch (const std::runtime_error &error) { check(std::string(error.what()) == "field-input-command-scope-already-attached"); }
    auto original = std::make_shared<NativeEventCommand>(11, 12, "focus", node, args, [] {}, [] { return true; });
    auto missing = requestFieldInputOriginalCommand(frames, ticket, original, {});
    check(missing.error == "field-input-original-command-executor-required" && original->status() == NativeEventCommandStatus::Cancelled);
    check(requestFieldInputOriginalCommand(frames, ticket, nullptr, {}).error == "field-input-original-command-required");
    frames.end(ticket, true);
  }
  {
    FieldInputDispatchFrames frames; auto ticket = frames.begin(identity, 1, "down", 1000ms); frames.startDelivery(ticket);
    int originalCalls = 0;
    auto original = std::make_shared<NativeEventCommand>(11, 12, "focus", node, args, [&] { originalCalls++; }, [] { return true; });
    auto scope = std::make_shared<FieldInputTaskScope>(std::make_shared<int>(1), frames, ticket); NativeEventCommands registry;
    auto js = std::async(std::launch::async, [&] {
      scope->attachCommands(registry, [&](const auto &command) {
        const auto result = requestFieldInputOriginalCommand(frames, ticket, command, [command] { return FieldInputCommandResult{command->executeOriginal(), ""}; });
        if (result.error != "field-input-sdk-command-drain-unavailable" || result.callbackCompleted)
          throw std::runtime_error("missing native drain was accepted");
        frames.finishHandler(ticket, true, result.error); scope->finish();
      });
      registry.captureCurrentThread()->dispatchOriginal(original);
      if (registry.captureCurrentThread()) throw std::runtime_error("failed native route retained registration");
    });
    const auto decision = frames.wait(ticket, {}, {}, [](const auto &) { return FieldInputCommandResult{false, "field-input-sdk-command-drain-unavailable"}; });
    js.get();
    check(originalCalls == 0 && original->status() == NativeEventCommandStatus::Cancelled);
    check(decision.disposition == FieldInputDisposition::Failed && decision.error == "field-input-sdk-command-drain-unavailable");
    frames.end(ticket, true);
  }
  {
    FieldInputDispatchFrames frames; auto ticket = frames.begin(identity, 1, "down", 1000ms); frames.startDelivery(ticket);
    std::vector<std::string> order;
    auto js = std::async(std::launch::async, [&] {
      auto prepared = frames.requestMount(ticket, 12);
      if (!prepared.mounted || !prepared.error.empty()) throw std::runtime_error("command target mount preparation failed");
      order.push_back("earlier-notification");
      auto original = std::make_shared<NativeEventCommand>(11, 12, "focus", node, args, [&] { order.push_back("original-command"); }, [] { return true; });
      auto result = requestFieldInputOriginalCommand(frames, ticket, original, [original] { return FieldInputCommandResult{original->executeOriginal(), ""}; });
      if (!result.callbackCompleted) throw std::runtime_error("prepared original command did not execute");
      frames.acknowledge(ticket->token, identity, 1, "down", true, false, std::nullopt); frames.finishDelivery(ticket, false);
    });
    bool targetObserved = false;
    const auto decision = frames.wait(ticket, {}, [&] { targetObserved = frames.mountTarget(ticket) == 12; order.push_back("genuine-mount"); return FieldInputMountResult{true, ""}; },
      [](const auto &command) { return command.perform(); });
    js.get();
    check(targetObserved && frames.mountTarget(ticket) == 0);
    check(decision.disposition == FieldInputDisposition::Allowed);
    check(order == (std::vector<std::string>{"genuine-mount", "earlier-notification", "original-command"}));
    frames.end(ticket, true);
  }
  std::cout << assertions << " actual SDK Task/CUI scope and exact task/checkpoint/render assertions passed; no linked or installed verdict\n";
}
