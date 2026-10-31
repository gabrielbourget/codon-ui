#include "../../../../packages/react-native/cpp/drag/ActionFrames.h"
#include "../../../../packages/react-native/cpp/drag/OriginalEvents.h"
#include <cassert>
#include <future>
#include <iostream>
#include <vector>

using namespace codon::drag;
static ActionIdentity original() { return {"module", "owner", "collection", "revision", "window", "session", "lift", 1, 10, 20, 30, 1}; }
int main() {
  int checks = 0;
  const auto check = [&](bool value) { if (!value) throw std::runtime_error("native drag frame assertion failed at " + std::to_string(checks)); checks++; };
  {
    ActionFrames frames; auto id = original(); id.rootTarget = 0;
    check(!frames.begin(id, true)); auto ticket = frames.begin(original(), true); check(ticket != nullptr);
    check(!frames.begin(original(), true)); check(ticket->deadline - ActionFrames::Clock::now() > std::chrono::seconds(4));
    check(!frames.acknowledge(ticket->token, ticket->identity, "before-start")); check(frames.start(ticket)); check(!frames.start(ticket));
    auto wrong = original(); wrong.epoch++; check(!frames.accepts(ticket->token, wrong));
    check(!frames.acknowledge(ticket->token, wrong, "foreign"));
    check(frames.acknowledge(ticket->token, original(), "payload")); check(!frames.acknowledge(ticket->token, original(), "replay"));
    frames.returned(ticket); frames.finish(ticket); auto result = frames.wait(ticket, [] { return true; });
    check(result.current && result.acknowledged && result.returned && result.phasesComplete && result.response == "payload");
    check(!frames.accepts(ticket));
    auto key = frames.begin(original(), false); check(key != nullptr); check(key->deadline - ActionFrames::Clock::now() <= std::chrono::seconds(1)); frames.close(key, "closed");
  }
  {
    ActionFrames frames; auto ticket = frames.begin(original(), true); std::vector<int> order;
    const auto nativeThread = std::this_thread::get_id(); int executions = 0;
    auto js = std::async(std::launch::async, [&] {
      check(frames.start(ticket)); order.push_back(1);
      const auto work = frames.request(ticket, [&] { check(std::this_thread::get_id() == nativeThread); executions++; order.push_back(2); return WorkResult{true, ""}; });
      check(work.performed && work.error.empty()); order.push_back(3);
      check(frames.acknowledge(ticket->token, original(), "original")); frames.returned(ticket); frames.finish(ticket);
    });
    const auto result = frames.wait(ticket, [] { return true; }); js.get();
    check(executions == 1 && order == std::vector<int>({1,2,3}) && result.current);
  }
  {
    ActionFrames frames; auto ticket = frames.begin(original(), true);
    auto js = std::async(std::launch::async, [&] { frames.start(ticket); frames.acknowledge(ticket->token, original(), "payload"); frames.returned(ticket, "original callback"); frames.finish(ticket); });
    const auto result = frames.wait(ticket, [] { return true; }); js.get(); check(!result.current && result.error == "original callback");
  }
  {
    ActionFrames frames; auto ticket = frames.begin(original(), true); int executions = 0;
    auto js = std::async(std::launch::async, [&] {
      frames.start(ticket); const auto work = frames.request(ticket, [&] { executions++; throw std::runtime_error("original native command"); return WorkResult{}; });
      check(!work.performed && work.error == "original native command"); frames.returned(ticket); frames.finish(ticket);
    });
    auto result = frames.wait(ticket, [] { return true; }); js.get(); check(executions == 1 && !result.current && result.error == "original native command");
  }
  {
    ActionFrames frames; auto ticket = frames.begin(original(), true); int cancelled = 0, executed = 0;
    auto js = std::async(std::launch::async, [&] { frames.start(ticket); frames.retire(); const auto work = frames.request(ticket, [&] { executed++; return WorkResult{true,""}; }, [&] { cancelled++; }); check(!work.performed); });
    auto result = frames.wait(ticket, [] { return true; }); js.get(); check(!result.current && cancelled == 1 && executed == 0);
  }
  {
    ActionFrames frames; auto ticket = frames.begin(original(), true);
    auto js = std::async(std::launch::async, [&] { frames.start(ticket); frames.acknowledge(ticket->token, original(), "payload"); frames.returned(ticket); frames.finish(ticket); });
    auto result = frames.wait(ticket, [] { return false; }); js.get(); check(!result.current && result.error == "native-drag-original-owner-retired");
  }
  {
    std::vector<int> late; OriginalEvents<int> events([&](auto records) { late = std::move(records); });
    check(events.take().empty()); auto native = std::async(std::launch::async, [&] { events.publish({7,8}); }); native.get();
    check(late == std::vector<int>({7,8})); check(events.take().empty()); events.publish({9}); check(late == std::vector<int>({7,8}));
    OriginalEvents<int> completed([&](auto) { throw std::runtime_error("duplicate ordinary delivery"); });
    completed.publish({1,2}); check(completed.take() == std::vector<int>({1,2})); check(completed.take().empty());
  }
  std::cout << checks << " actual drag frame/mailbox assertions passed\n";
}
