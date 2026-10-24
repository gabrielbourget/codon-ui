#include <react/renderer/uimanager/NativeEventPayloads.h>
#include <future>
#include <iostream>
#include <stdexcept>
namespace facebook::react { class EventTarget { public: int tag; explicit EventTarget(int value) : tag(value) {} }; }
using namespace facebook::react;
int main() {
  int checks = 0;
  const auto check = [&](bool value) { if (!value) throw std::runtime_error("actual SDK pointer payload scope assertion failed"); checks++; };
  facebook::jsi::Runtime runtime; facebook::jsi::Value payload; EventTarget target(17);
  NativeEventPayloads first, second;
  int entered = 0, completed = 0;
  check(!first.before(runtime, &target, "topPointerDown", payload));
  auto outer = first.enter([&](auto &actualRuntime, auto *actualTarget, const auto &type, auto &actualPayload) -> NativeEventPayloads::Completion {
    if (&actualRuntime != &runtime || actualTarget != &target || &actualPayload != &payload || type != "topPointerDown")
      throw std::runtime_error("SDK changed original JS-delivery arguments");
    entered++; return [&](bool succeeded) { completed += succeeded ? 1 : 100; };
  });
  auto completion = first.before(runtime, &target, "topPointerDown", payload);
  check(entered == 1 && completed == 0); completion(true); check(completed == 1);
  check(!second.before(runtime, &target, "topPointerDown", payload));
  check(!std::async(std::launch::async, [&] { return first.before(runtime, &target, "topPointerDown", payload); }).get());
  int nestedCalls = 0;
  {
    auto inner = first.enter([&](auto &, auto *, const auto &, auto &) -> NativeEventPayloads::Completion { nestedCalls++; return {}; });
    check(!first.before(runtime, &target, "topPointerDown", payload));
    check(nestedCalls == 1 && entered == 1);
    inner->retire(); inner->retire();
    completion = first.before(runtime, &target, "topPointerDown", payload); completion(false);
    check(entered == 2 && completed == 101);
  }
  completion = first.before(runtime, &target, "topPointerDown", payload); completion(true);
  check(entered == 3 && completed == 102);
  outer.reset(); check(!first.before(runtime, &target, "topPointerDown", payload));
  bool threw = false;
  try { first.enter({}); } catch (const std::invalid_argument &) { threw = true; }
  check(threw);
  {
    auto failing = first.enter([](auto &, auto *, const auto &, auto &) -> NativeEventPayloads::Completion { throw std::logic_error("original payload observer failure"); });
    threw = false;
    try { first.before(runtime, &target, "topPointerDown", payload); }
    catch (const std::logic_error &error) { threw = std::string(error.what()) == "original payload observer failure"; }
    check(threw);
  }
  check(!first.before(runtime, &target, "topPointerDown", payload));
  std::shared_ptr<NativeEventPayloads::Registration> retained;
  {
    NativeEventPayloads transient;
    retained = transient.enter([](auto &, auto *, const auto &, auto &) -> NativeEventPayloads::Completion { return {}; });
  }
  retained->retire(); retained.reset(); check(true);
  std::cout << checks << " actual SDK payload registration/lifecycle assertions passed; explicit JSI/target doubles, no native verdict\n";
}
