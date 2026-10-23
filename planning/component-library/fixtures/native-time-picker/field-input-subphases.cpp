#include "../../../../packages/react-native/cpp/FieldInputSubphase.h"
#include "../../../../packages/react-native/cpp/FieldInputNativeOperation.h"
#include <future>
#include <iostream>
#include <thread>
using namespace codon;
using namespace std::chrono_literals;
class AssertionFailure final : public std::exception {
 public:
  explicit AssertionFailure(std::string message) : message_(std::move(message)) {}
  const char *what() const noexcept override { return message_.c_str(); }
 private:
  std::string message_;
};

int main() {
  int checks = 0;
  std::string scenarioName = "native-context";
  const auto check = [&](bool value) { if (!value) throw AssertionFailure("owned-input subphase assertion " + std::to_string(checks + 1) + " failed in " + scenarioName); checks++; };
  const FieldInputIdentity identity{"owner", "binding", "revision", 15, 2, 3, 11, 10,
    "document", "7", "window", "mount:7", "outer:1", "input:1", "component:10", "editor:10", 2};
  auto owner = std::make_shared<int>(1);
  const auto contextFor = [&](int64_t event) {
    return FieldInputOwnedInput{identity, event, {identity}, owner,
      [](const auto &ticket) { return std::to_string(ticket->token); }, [] { return true; }};
  };
  {
    int manager = 1, otherManager = 2;
    auto context = std::make_shared<const FieldInputOwnedInput>(contextFor(2));
    check(!FieldInputNativeOperation::input(&manager, 10));
    FieldInputNativeOperation operation(&manager);
    {
      FieldInputNativeOperation::Input input(&manager, context);
      check(FieldInputNativeOperation::input(&manager, 10) == context);
      check(!FieldInputNativeOperation::input(&otherManager, 10) && !FieldInputNativeOperation::input(&manager, 12));
      check(!std::async(std::launch::async, [&] { return FieldInputNativeOperation::input(&manager, 10); }).get());
      {
        FieldInputNativeOperation::Input nested(&otherManager, context);
        check(!FieldInputNativeOperation::input(&manager, 10));
        check(FieldInputNativeOperation::input(&otherManager, 10) == context);
      }
      check(FieldInputNativeOperation::input(&manager, 10) == context);
    }
    check(!FieldInputNativeOperation::input(&manager, 10));
  }
  for (const std::string scenario : {"normal", "missing-ack", "wrong-ack", "prevent-input", "throw", "unknown", "declined", "binding", "module", "parent-end", "timeout"}) {
    scenarioName = scenario;
    FieldInputDispatchFrames frames;
    auto root = frames.begin(identity, 1, "down", scenario == "timeout" ? 15ms : 1000ms);
    check(frames.startDelivery(root));
    check(frames.acknowledge(root->token, identity, 1, "down", true, true, {}));
    frames.finishHandler(root, false);
    auto context = contextFor(2);
    FieldInputDispatchFrames::Handle captured;
    int callbacks = 0, reports = 0; bool caughtOriginal = false, failed = false;
    try {
      dispatchFieldInputSubphase(frames, root, context, owner.get(), [&](const auto &input) {
        captured = input; callbacks++;
        check(input->token != root->token && input->deadline == root->deadline && input->phase == "input");
        check(frames.activeInput(root) == input && !frames.isCurrent(root));
        check(!frames.accepts(root->token, identity, 1, "down") && frames.accepts(input->token, identity, 2, "input"));
        if (scenario == "wrong-ack") check(!frames.acknowledge(input->token, identity, 1, "down", true, false, {}));
        if (scenario == "prevent-input") check(!frames.acknowledge(input->token, identity, 2, "input", true, true, {}));
        if (scenario == "throw") throw std::logic_error("original-input-exception");
        if (scenario == "unknown") throw 41;
        if (scenario == "binding") frames.retireBinding(identity.ownerId, identity.bindingId);
        if (scenario == "module") frames.retire();
        if (scenario == "parent-end") check(frames.end(root, false).disposition == FieldInputDisposition::Retired);
        if (scenario == "timeout") std::this_thread::sleep_for(25ms);
        if (scenario == "normal" || scenario == "declined") check(frames.acknowledge(input->token, identity, 2, "input", true, false, {}));
        return scenario != "declined";
      }, [&](const auto &input, const auto &decision) {
        reports++;
        check(input == captured && !frames.accepts(input->token, identity, 2, "input"));
        check(!decision.phasesComplete);
        if (scenario == "normal") check(decision.disposition == FieldInputDisposition::Allowed && frames.isCurrent(root));
      });
    } catch (const std::logic_error &error) { failed = true; caughtOriginal = std::string(error.what()) == "original-input-exception"; }
    catch (int value) { failed = true; caughtOriginal = value == 41; }
    catch (const std::runtime_error &) { failed = true; }
    check(callbacks == 1 && reports == 1 && failed == (scenario != "normal"));
    if (scenario == "throw" || scenario == "unknown") check(caughtOriginal);
    if (scenario == "normal") {
      auto inputResult = frames.inputResults(root); check(inputResult.size() == 1 && !inputResult[0].second.phasesComplete);
      frames.finishPhases(root);
      inputResult = frames.inputResults(root); check(inputResult[0].second.phasesComplete);
      check(frames.wait(root).disposition == FieldInputDisposition::Prevented);
      check(frames.end(root, true).disposition == FieldInputDisposition::Prevented);
    } else { frames.finishPhases(root); frames.end(root, false); }
  }
  for (const std::string invalid : {"owner", "current", "packet", "window", "surface", "scope", "expired"}) {
    scenarioName = invalid;
    FieldInputDispatchFrames frames; auto root = frames.begin(identity, 1, "down", invalid == "expired" ? 5ms : 1000ms);
    frames.startDelivery(root); auto context = contextFor(2); auto other = std::make_shared<int>(2);
    if (invalid == "owner") context.owner = other;
    if (invalid == "current") context.current = [] { return false; };
    if (invalid == "packet") context.packet = {};
    if (invalid == "window") context.identity.windowId = "other";
    if (invalid == "surface") context.identity.surfaceId = 12;
    if (invalid == "scope") context.scopes.push_back(identity);
    if (invalid == "expired") std::this_thread::sleep_for(10ms);
    int callbacks = 0;
    try { dispatchFieldInputSubphase(frames, root, context, owner.get(), [&](const auto &) { callbacks++; return true; }, [](const auto &, const auto &) {}); check(false); }
    catch (const std::runtime_error &) { check(callbacks == 0); }
    if (invalid != "expired") check(frames.activeInput(root) == root);
    frames.end(root, false);
  }
  {
    scenarioName = "nested";
    FieldInputDispatchFrames frames; auto root = frames.begin(identity, 1, "down", 1000ms); frames.startDelivery(root);
    auto js = std::async(std::launch::async, [&] {
      auto first = contextFor(2), second = contextFor(3);
      dispatchFieldInputSubphase(frames, root, first, owner.get(), [&](const auto &input) {
        auto result = frames.requestFocus(input->token, identity, 2, "input", {2, "next"});
        if (!result.current) throw std::runtime_error("child native focus failed");
        dispatchFieldInputSubphase(frames, input, second, owner.get(), [&](const auto &nested) {
          auto action = std::make_shared<FieldInputCommandAction>(FieldInputCommandAction{11, 12, "focus", [] { return FieldInputCommandResult{true, ""}; }, [] {}});
          if (!frames.requestCommand(nested, action).callbackCompleted) throw std::runtime_error("nested command failed");
          return frames.acknowledge(nested->token, identity, 3, "input", true, false, {});
        }, [](const auto &, const auto &) {});
        return frames.acknowledge(input->token, identity, 2, "input", true, false, {});
      }, [](const auto &, const auto &) {});
      frames.acknowledge(root->token, identity, 1, "down", true, false, {}); frames.finishDelivery(root, false);
    });
    int focused = 0, commanded = 0;
    const auto result = frames.waitWithInputs(root, [&](const auto &input, const auto &) {
      if (input->eventId != 2) throw std::runtime_error("wrong serviced child"); focused++; FieldInputFocusResult value; value.current = true; return value;
    }, {}, [&](const auto &input, const auto &action) {
      if (input->eventId != 3) throw std::runtime_error("wrong serviced grandchild"); commanded++; return action.perform();
    });
    js.get();
    check(result.disposition == FieldInputDisposition::Allowed && focused == 1 && commanded == 1);
    auto inputs = frames.inputResults(root); check(inputs.size() == 2 && inputs[0].second.phasesComplete && inputs[1].second.phasesComplete);
    frames.end(root, true);
  }
  {
    scenarioName = "busy-input";
    FieldInputDispatchFrames frames; auto root = frames.begin(identity, 1, "down", 100ms); frames.startDelivery(root);
    std::promise<void> entered; auto js = std::async(std::launch::async, [&] {
      bool failed = false;
      try { auto context = contextFor(2); dispatchFieldInputSubphase(frames, root, context, owner.get(), [&](const auto &input) {
        entered.set_value(); std::this_thread::sleep_for(150ms);
        if (frames.acknowledge(input->token, identity, 2, "input", true, false, {})) throw std::logic_error("late child acknowledged");
        return true;
      }, [](const auto &, const auto &) {}); } catch (const std::runtime_error &) { failed = true; }
      return failed;
    });
    entered.get_future().get(); check(frames.waitWithInputs(root, {}, {}, {}).disposition == FieldInputDisposition::TimedOut);
    check(frames.end(root, true).disposition == FieldInputDisposition::TimedOut); check(js.get());
    auto next = frames.begin(identity, 3, "down", 1000ms); check(frames.startDelivery(next)); frames.end(next, false);
  }
  std::cout << checks << " production owned-input subphase/frame/native-context assertions passed; no native/installed verdict\n";
}
