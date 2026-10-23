#include "../../../../packages/react-native/cpp/FieldInputDispatchFrames.h"
#include <atomic>
#include <deque>
#include <future>
#include <iostream>
#include <stdexcept>

// The runner inserts the exact current SDK Scheduler method. These surrounding
// types are explicit test doubles, not a linked React Native runtime or UIKit.
namespace folly { struct dynamic { int originalArgument; }; }
struct TraceSection { TraceSection(const char *, const char *, const std::string &) {} };
struct ShadowNode {
  int target, surface;
  int getSurfaceId() const { return surface; }
};
struct ShadowView {
  int target;
  explicit ShadowView(const ShadowNode &node) : target(node.target) {}
};
struct ReactNativeFeatureFlags {
  inline static bool invalidationGuard = false;
  static bool enableSchedulerDelegateInvalidation() { return invalidationGuard; }
};
struct RenderingQueue {
  std::deque<std::function<void()>> callbacks;
  void scheduleRenderingUpdate(int, std::function<void()> callback) { callbacks.push_back(std::move(callback)); }
  void run() {
    while (!callbacks.empty()) {
      auto next = std::move(callbacks.front()); callbacks.pop_front(); next();
    }
  }
};
struct OriginalPlatformQueue {
  struct Command { int target; std::string name; int argument; };
  std::deque<Command> queued;
  int focusedTarget{10}, calls{0};
  void schedulerDidDispatchCommand(const ShadowView &view, const std::string &name, const folly::dynamic &args) {
    // Corresponds to the separately checked off-main UIKit enqueue boundary.
    queued.push_back({view.target, name, args.originalArgument});
  }
  void resumeOriginalUIQueue() {
    while (!queued.empty()) {
      const auto command = queued.front(); queued.pop_front();
      if (command.name != "focus" || command.argument != 41) throw std::runtime_error("original command changed");
      focusedTarget = command.target; calls++;
    }
  }
};
struct Scheduler {
  OriginalPlatformQueue *delegate_;
  std::shared_ptr<std::atomic<bool>> delegateInvalidated_ = std::make_shared<std::atomic<bool>>(false);
  std::shared_ptr<RenderingQueue> runtimeScheduler_ = std::make_shared<RenderingQueue>();
  void uiManagerDidDispatchCommand(const std::shared_ptr<const ShadowNode> &, const std::string &, const folly::dynamic &);
};

#include "scheduler-command-excerpt.inc"

int main() {
  using namespace codon;
  using namespace std::chrono_literals;
  int assertions = 0;
  const auto check = [&](bool value) { if (!value) throw std::runtime_error("field command boundary assertion failed"); assertions++; };
  const FieldInputIdentity identity{"owner", "binding", "revision", 15, 2, 3, 11, 10,
    "document", "7", "window", "mount:7", "outer:1", "input:1", "component:10", "editor:10", 2};
  for (const bool prevent : {false, true}) {
    OriginalPlatformQueue platform;
    Scheduler scheduler{&platform};
    FieldInputDispatchFrames frames;
    const auto ticket = frames.begin(identity, 1, "down", 1000ms);
    check(ticket && frames.startDelivery(ticket));
    const auto otherOriginal = std::make_shared<const ShadowNode>(ShadowNode{12, 11});
    scheduler.uiManagerDidDispatchCommand(otherOriginal, "focus", folly::dynamic{41});
    check(platform.queued.empty() && scheduler.runtimeScheduler_->callbacks.size() == 1);
    check(platform.focusedTarget == 10);
    check(frames.acknowledge(ticket->token, identity, 1, "down", true, prevent, std::nullopt));
    frames.finishHandler(ticket, false);
    auto render = std::async(std::launch::async, [&] {
      const auto mount = frames.requestMount(ticket);
      if (mount.mounted || !mount.error.empty()) throw std::runtime_error("command-only turn unexpectedly mounted");
      scheduler.runtimeScheduler_->scheduleRenderingUpdate(11, [&] { frames.finishPhases(ticket); });
      scheduler.runtimeScheduler_->run();
    });
    int mountChecks = 0;
    const auto waited = frames.wait(ticket, {}, [&] { mountChecks++; return FieldInputMountResult{}; });
    render.get();
    const auto ended = frames.end(ticket, true);
    check(mountChecks == 1 && ended.phasesComplete);
    check(waited.disposition == (prevent ? FieldInputDisposition::Prevented : FieldInputDisposition::Allowed));
    check(ended.disposition == waited.disposition && ended.originalDefaultPrevented == prevent);
    check(platform.queued.size() == 1 && platform.calls == 0 && platform.focusedTarget == 10);
    // The field frame is complete while the original requested focus has not
    // happened. Its before-default completion contract therefore is not met.
    const auto targetAtNativeDefault = platform.focusedTarget;
    platform.resumeOriginalUIQueue();
    check(platform.calls == 1 && platform.focusedTarget == 12 && targetAtNativeDefault == 10);
    platform.resumeOriginalUIQueue();
    check(platform.calls == 1);
  }
  for (const bool guard : {false, true}) {
    OriginalPlatformQueue platform;
    Scheduler scheduler{&platform};
    ReactNativeFeatureFlags::invalidationGuard = guard;
    scheduler.uiManagerDidDispatchCommand(std::make_shared<const ShadowNode>(ShadowNode{12, 11}), "focus", folly::dynamic{41});
    *scheduler.delegateInvalidated_ = true;
    scheduler.runtimeScheduler_->run();
    check(platform.queued.size() == (guard ? 0 : 1));
  }
  std::cout << assertions << " exact SDK Scheduler excerpt / actual field-frame assertions passed; command completion gap reproduced; no installed SDK verdict\n";
}
