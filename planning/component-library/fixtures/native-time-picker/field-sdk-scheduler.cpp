#include <atomic>
#include <deque>
#include <future>
#include <iostream>
#include <stdexcept>
#include <thread>

namespace folly { struct dynamic { int originalArgument; }; }
namespace facebook::react {
class ShadowNode {
 public:
  int target, surface;
  ShadowNode(int target, int surface) : target(target), surface(surface) {}
  int getTag() const { return target; }
  int getSurfaceId() const { return surface; }
};
}
#include <react/renderer/uimanager/NativeEventCommands.h>
#include "../../../../packages/react-native/cpp/FieldInputDispatchFrames.h"
using namespace facebook::react;
using namespace codon;
using namespace std::chrono_literals;

// Only the included scheduler body and registry/frame implementations are
// production code. These surrounding types explicitly model SDK queues.
struct TraceSection { TraceSection(const char *, const char *, const std::string &) {} };
struct ShadowView { int target; explicit ShadowView(const ShadowNode &node) : target(node.target) {} };
struct ReactNativeFeatureFlags {
  inline static bool invalidationGuard = false;
  static bool enableSchedulerDelegateInvalidation() { return invalidationGuard; }
};
struct RenderingQueue {
  std::deque<std::function<void()>> callbacks;
  void scheduleRenderingUpdate(int, std::function<void()> callback) { callbacks.push_back(std::move(callback)); }
  void run() { while (!callbacks.empty()) { auto callback = std::move(callbacks.front()); callbacks.pop_front(); callback(); } }
};
struct Platform {
  std::thread::id nativeThread = std::this_thread::get_id();
  std::deque<int> uiQueue;
  int target{10}, originalCalls{0};
  void schedulerDidDispatchCommand(const ShadowView &view, const std::string &name, const folly::dynamic &args) {
    if (name != "focus" || args.originalArgument != 41) throw std::runtime_error("SDK original arguments changed");
    if (std::this_thread::get_id() == nativeThread) { target = view.target; originalCalls++; }
    else uiQueue.push_back(view.target);
  }
  void resumeOrdinaryUIQueue() { while (!uiQueue.empty()) { target = uiQueue.front(); uiQueue.pop_front(); originalCalls++; } }
};
struct UIManager {
  NativeEventCommands commands;
  NativeEventCommands &getNativeEventCommands() { return commands; }
};
struct Scheduler {
  Platform *delegate_;
  std::shared_ptr<std::atomic<bool>> delegateInvalidated_ = std::make_shared<std::atomic<bool>>(false);
  std::shared_ptr<RenderingQueue> runtimeScheduler_ = std::make_shared<RenderingQueue>();
  std::shared_ptr<UIManager> uiManager_ = std::make_shared<UIManager>();
  void uiManagerDidDispatchCommand(const std::shared_ptr<const ShadowNode> &, const std::string &, const folly::dynamic &);
};
#include "scheduler-command-excerpt.inc"

int main() {
  int assertions = 0;
  const auto check = [&](bool value) { if (!value) throw std::runtime_error("patched SDK scheduler assertion failed"); assertions++; };
  auto originalNode = std::make_shared<const ShadowNode>(12, 11);
  {
    Platform platform;
    Scheduler scheduler{&platform};
    scheduler.uiManagerDidDispatchCommand(originalNode, "focus", folly::dynamic{41});
    check(scheduler.runtimeScheduler_->callbacks.size() == 1 && platform.originalCalls == 0);
    std::async(std::launch::async, [&] { scheduler.runtimeScheduler_->run(); }).get();
    check(platform.uiQueue.size() == 1 && platform.target == 10);
    platform.resumeOrdinaryUIQueue();
    check(platform.originalCalls == 1 && platform.target == 12);
  }
  const FieldInputIdentity identity{"owner", "binding", "revision", 15, 2, 3, 11, 10,
    "document", "7", "window", "mount:7", "outer:1", "input:1", "component:10", "editor:10", 2};
  for (bool prevent : {false, true}) {
    Platform platform;
    Scheduler scheduler{&platform};
    FieldInputDispatchFrames frames;
    auto ticket = frames.begin(identity, 1, "down", 1000ms);
    check(ticket && frames.startDelivery(ticket));
    std::shared_ptr<NativeEventCommand> captured;
    auto js = std::async(std::launch::async, [&] {
      auto lease = scheduler.uiManager_->getNativeEventCommands().enter([&](const auto &command) {
        captured = command;
        if (command->node.lock() != originalNode || command->arguments->originalArgument != 41)
          throw std::runtime_error("original SDK metadata changed");
        auto work = std::make_shared<FieldInputCommandAction>(FieldInputCommandAction{
          command->surfaceId, command->target, command->name,
          [command] { return FieldInputCommandResult{command->executeOriginal(), ""}; }, [command] { command->cancel(); }});
        auto result = frames.requestCommand(ticket, work);
        if (!result.callbackCompleted || !result.error.empty()) throw std::runtime_error("SDK command failed to complete");
      });
      scheduler.uiManagerDidDispatchCommand(originalNode, "focus", folly::dynamic{41});
      if (platform.target != 12 || platform.originalCalls != 1 || !scheduler.runtimeScheduler_->callbacks.empty())
        throw std::runtime_error("SDK command returned before original UI work");
      if (!frames.acknowledge(ticket->token, identity, 1, "down", true, prevent, std::nullopt))
        throw std::runtime_error("original field acknowledgement lost");
      frames.finishDelivery(ticket, false);
    });
    auto result = frames.wait(ticket, {}, {}, [&](const FieldInputCommandAction &work) {
      check(work.surfaceId == 11 && work.target == 12 && work.name == "focus");
      return work.perform();
    });
    js.get();
    check(platform.originalCalls == 1 && platform.target == 12 && platform.uiQueue.empty());
    check(result.disposition == (prevent ? FieldInputDisposition::Prevented : FieldInputDisposition::Allowed));
    check(frames.end(ticket, true).phasesComplete);
    check(captured && captured->status() == NativeEventCommandStatus::Completed && !captured->executeOriginal());
    scheduler.runtimeScheduler_->run();
    check(platform.originalCalls == 1);
    check(!scheduler.uiManager_->getNativeEventCommands().captureCurrentThread());
  }
  for (bool enabled : {false, true}) {
    Platform platform;
    Scheduler scheduler{&platform};
    ReactNativeFeatureFlags::invalidationGuard = enabled;
    scheduler.uiManagerDidDispatchCommand(originalNode, "focus", folly::dynamic{41});
    *scheduler.delegateInvalidated_ = true;
    std::async(std::launch::async, [&] { scheduler.runtimeScheduler_->run(); }).get();
    check(platform.uiQueue.size() == (enabled ? 0 : 1));
  }
  std::cout << assertions << " exact patched Scheduler / actual command-registry and frame assertions passed; no linked or installed SDK verdict\n";
}
