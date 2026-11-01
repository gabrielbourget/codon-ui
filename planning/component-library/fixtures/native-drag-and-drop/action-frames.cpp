#include "../../../../packages/react-native/cpp/drag/ActionFrames.h"
#include <future>
#include <iostream>
#include <vector>

using namespace codon::drag;
static ActionIdentity original() { return {"module", "owner", "collection", "revision", "window", "session", "lift", 1, 10, 20, 30, 1}; }
int main() {
  int checks = 0;
  const auto check = [&](bool value) { if (!value) throw std::runtime_error("native drag response assertion failed at " + std::to_string(checks)); checks++; };
  {
    ActionFrames frames; auto id = original(); id.rootTarget = 0;
    check(!frames.begin(id, true)); auto ticket = frames.begin(original(), true); check(ticket != nullptr);
    check(!frames.begin(original(), true)); check(ticket->deadline - ActionFrames::Clock::now() > std::chrono::seconds(4));
    check(!frames.acknowledge(ticket->token, ticket->identity, "before-start")); check(frames.start(ticket)); check(!frames.start(ticket));
    auto wrong = original(); wrong.epoch++; check(!frames.accepts(ticket->token, wrong));
    check(!frames.acknowledge(ticket->token, wrong, "foreign"));
    check(frames.acknowledge(ticket->token, original(), "payload")); check(!frames.acknowledge(ticket->token, original(), "replay"));
    frames.returned(ticket); auto result = frames.wait(ticket, [] { return true; });
    check(result.current && result.acknowledged && result.returned && result.response == "payload");
    check(!frames.accepts(ticket));
    auto key = frames.begin(original(), false); check(key != nullptr); check(key->deadline - ActionFrames::Clock::now() <= std::chrono::seconds(1)); frames.close(key, "closed");
  }
  {
    ActionFrames frames; auto ticket = frames.begin(original(), true);
    std::function<void()> laterEffect; int effects = 0;
    auto js = std::async(std::launch::async, [&] {
      const bool started = frames.start(ticket);
      laterEffect = [&] { effects++; };
      const bool settled = frames.acknowledge(ticket->token, original(), "original");
      frames.returned(ticket); return started && settled;
    });
    const auto result = frames.wait(ticket, [] { return true; });
    check(js.get()); check(result.current); check(effects == 0);
    laterEffect(); check(effects == 1);
  }
  {
    ActionFrames frames; auto ticket = frames.begin(original(), true);
    auto js = std::async(std::launch::async, [&] { frames.start(ticket); frames.acknowledge(ticket->token, original(), "payload"); frames.returned(ticket, "original callback"); });
    const auto result = frames.wait(ticket, [] { return true; }); js.get(); check(!result.current && result.error == "original callback");
  }
  {
    ActionFrames frames; auto ticket = frames.begin(original(), true);
    frames.start(ticket); frames.returned(ticket);
    const auto result = frames.wait(ticket, [] { return true; });
    check(!result.current && !result.acknowledged && result.error == "native-drag-original-action-unacknowledged");
  }
  {
    ActionFrames frames; auto ticket = frames.begin(original(), true); frames.retire();
    check(!frames.start(ticket)); check(!frames.acknowledge(ticket->token, original(), "late"));
    auto result = frames.wait(ticket, [] { return true; }); check(!result.current && result.error == "native-drag-module-retired");
    check(!frames.begin(original(), true));
  }
  {
    ActionFrames frames; auto ticket = frames.begin(original(), true);
    auto js = std::async(std::launch::async, [&] { frames.start(ticket); frames.acknowledge(ticket->token, original(), "payload"); frames.returned(ticket); });
    auto result = frames.wait(ticket, [] { return false; }); js.get(); check(!result.current && result.error == "native-drag-original-owner-retired");
    auto next = frames.begin(original(), true); check(next && next->token > ticket->token);
    check(!frames.start(ticket)); check(!frames.acknowledge(ticket->token, original(), "replay"));
    check(frames.start(next)); check(frames.acknowledge(next->token, original(), "next")); frames.returned(next);
    check(frames.wait(next, [] { return true; }).current);
  }
  {
    ActionFrames frames; auto ticket = frames.begin(original(), true);
    auto foreign = std::async(std::launch::async, [&] { return frames.wait(ticket, [] { return true; }); });
    check(foreign.get().error == "native-drag-original-thread-required");
    check(frames.accepts(ticket)); frames.close(ticket, "cancelled"); check(!frames.accepts(ticket));
  }
  std::cout << checks << " actual drag response assertions passed; no native work drain\n";
}
