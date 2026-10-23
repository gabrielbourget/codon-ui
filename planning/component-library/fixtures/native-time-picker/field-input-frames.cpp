#include "../../../../packages/react-native/cpp/FieldInputDispatchFrames.h"
#include <atomic>
#include <future>
#include <iostream>
#include <stdexcept>
#include <thread>

using namespace codon;
using namespace std::chrono_literals;

int main() {
  int assertions = 0;
  const auto check = [&](bool value) { if (!value) throw std::runtime_error("field-input frame assertion failed"); ++assertions; };
  const FieldInputIdentity identity{"owner", "binding", "revision", 15, 2, 3, 11, 10,
    "document", "7", "window", "mount:7", "outer:1", "input:1", "component:10", "editor:10", 2};
  const FieldInputFocusAction next{2, "next"};
  FieldInputDispatchFrames frames;
  auto ticket = frames.begin(identity, 1, "down", 1000ms);
  check(ticket != nullptr);
  check(!frames.acknowledge(ticket->token, identity, 1, "down", true, true, next));
  check(frames.startDelivery(ticket));
  check(!frames.startDelivery(ticket));
  check(frames.accepts(ticket->token, identity, 1, "down"));
  auto foreign = identity; foreign.documentRevision = "8";
  check(!frames.acknowledge(ticket->token, foreign, 1, "down", true, true, next));
  foreign = identity; foreign.editorInstance = "replacement";
  check(!frames.accepts(ticket->token, foreign, 1, "down"));
  check(!frames.acknowledge(ticket->token + 1, identity, 1, "down", true, true, next));
  check(!frames.acknowledge(ticket->token, identity, 1, "up", true, true, next));
  check(!frames.acknowledge(ticket->token, identity, 2, "down", true, true, next));
  check(!frames.acknowledge(ticket->token, identity, 1, "down", true, true, FieldInputFocusAction{99, "next"}));
  check(!frames.acknowledge(ticket->token, identity, 1, "down", true, true, FieldInputFocusAction{2, "wrap"}));
  check(frames.acknowledge(ticket->token, identity, 1, "down", true, true, next));
  check(!frames.accepts(ticket->token, identity, 1, "down"));
  check(!frames.acknowledge(ticket->token, identity, 1, "down", true, true, next));
  auto waiting = std::async(std::launch::async, [&] { return frames.wait(ticket); });
  // An acknowledgement from a child/group is insufficient until React's
  // original bubbling dispatch returns, including later source callbacks.
  check(waiting.wait_for(15ms) == std::future_status::timeout);
  frames.finishDelivery(ticket, false);
  check(waiting.get().disposition == FieldInputDisposition::Prevented);
  auto result = frames.end(ticket, true);
  check(result.disposition == FieldInputDisposition::Prevented);
  check(result.focus == next);
  check(result.deliveryStarted && result.deliveryReturned);
  check(!frames.acknowledge(ticket->token, identity, 1, "down", true, true, next));
  check(!frames.startDelivery(ticket));

  for (const auto &phase : {"down", "up", "cancel", "pointer-start", "pointer-end", "pointer-cancel"}) {
    auto current = frames.begin(identity, 2, phase, 1000ms);
    check(frames.startDelivery(current));
    check(frames.acknowledge(current->token, identity, 2, phase, true, true, {}));
    frames.finishDelivery(current, false);
    const bool cancel = std::string(phase) == "cancel" || std::string(phase) == "pointer-cancel";
    check(frames.wait(current).disposition == (cancel ? FieldInputDisposition::Allowed : FieldInputDisposition::Prevented));
    check(frames.end(current, true).disposition == (cancel ? FieldInputDisposition::Allowed : FieldInputDisposition::Prevented));
  }
  auto cancelled = frames.begin(identity, 3, "cancel", 1000ms);
  check(frames.startDelivery(cancelled));
  check(!frames.acknowledge(cancelled->token, identity, 3, "cancel", true, false, next));
  frames.finishDelivery(cancelled, false);
  check(frames.end(cancelled, true).disposition == FieldInputDisposition::Unacknowledged);

  auto missing = frames.begin(identity, 4, "up", 1000ms);
  check(frames.startDelivery(missing)); frames.finishDelivery(missing, false);
  check(frames.wait(missing).disposition == FieldInputDisposition::Unacknowledged);
  check(frames.end(missing, true).disposition == FieldInputDisposition::Unacknowledged);
  auto thrown = frames.begin(identity, 5, "down", 1000ms);
  check(frames.startDelivery(thrown));
  check(frames.acknowledge(thrown->token, identity, 5, "down", true, true, next));
  frames.finishDelivery(thrown, true, "original-renderer-failure");
  check(frames.wait(thrown).disposition == FieldInputDisposition::Failed);
  result = frames.end(thrown, true);
  check(result.disposition == FieldInputDisposition::Failed && !result.focus && result.error == "original-renderer-failure");

  auto busy = frames.begin(identity, 6, "down", 5ms);
  result = frames.wait(busy);
  check(result.disposition == FieldInputDisposition::TimedOut && !result.deliveryStarted && !result.focus);
  check(!frames.startDelivery(busy));
  check(!frames.acknowledge(busy->token, identity, 6, "down", true, true, next));
  check(frames.end(busy, true).disposition == FieldInputDisposition::TimedOut);

  auto overrun = frames.begin(identity, 7, "down", 5ms);
  check(frames.startDelivery(overrun));
  check(frames.acknowledge(overrun->token, identity, 7, "down", true, true, next));
  result = frames.wait(overrun);
  check(result.disposition == FieldInputDisposition::TimedOut && result.deliveryStarted && !result.deliveryReturned && !result.focus);
  frames.finishDelivery(overrun, false);
  result = frames.end(overrun, true);
  check(result.disposition == FieldInputDisposition::TimedOut && !result.focus);

  auto replaced = frames.begin(identity, 8, "down", 1000ms);
  check(frames.startDelivery(replaced));
  check(frames.acknowledge(replaced->token, identity, 8, "down", true, true, next));
  frames.finishDelivery(replaced, false);
  result = frames.end(replaced, false);
  check(result.disposition == FieldInputDisposition::Retired && !result.focus);

  auto ownerVeto = frames.begin(identity, 9, "down", 1000ms);
  check(frames.startDelivery(ownerVeto));
  check(frames.acknowledge(ownerVeto->token, identity, 9, "down", false, true, next));
  frames.finishDelivery(ownerVeto, false);
  result = frames.end(ownerVeto, true);
  check(result.disposition == FieldInputDisposition::Retired && !result.focus);

  auto outer = frames.begin(identity, 10, "down", 1000ms);
  check(frames.startDelivery(outer));
  auto inner = frames.begin(identity, 11, "up", 1000ms);
  check(!frames.acknowledge(outer->token, identity, 10, "down", true, true, next));
  check(frames.end(outer, true).disposition == FieldInputDisposition::Retired);
  check(frames.startDelivery(inner));
  check(frames.acknowledge(inner->token, identity, 11, "up", true, false, {}));
  frames.finishDelivery(inner, false);
  check(frames.end(inner, true).disposition == FieldInputDisposition::Allowed);
  check(frames.acknowledge(outer->token, identity, 10, "down", true, true, next));
  frames.finishDelivery(outer, false);
  check(frames.end(outer, true).disposition == FieldInputDisposition::Prevented);

  auto navigation = frames.begin(identity, 20, "down", 1000ms);
  check(frames.startDelivery(navigation));
  const auto uiThread = std::this_thread::get_id();
  int actualFocus = 10, focusCalls = 0;
  auto dispatch = std::async(std::launch::async, [&] {
    const auto first = frames.requestFocus(navigation->token, identity, 20, "down", next);
    const auto second = frames.requestFocus(navigation->token, identity, 20, "down", next);
    const bool acknowledged = frames.acknowledge(navigation->token, identity, 20, "down", true, true, {});
    frames.finishDelivery(navigation, false);
    return first.observed && first.target == 13 && second.observed && second.target == 20 && acknowledged;
  });
  const auto navigated = frames.wait(navigation, [&](const FieldInputFocusAction &action) {
    check(std::this_thread::get_id() == uiThread && action == next);
    ++focusCalls; actualFocus = actualFocus == 10 ? 13 : 20;
    return FieldInputFocusResult{true, true, true, actualFocus, "actual-component", "actual-editor", ""};
  });
  check(dispatch.get());
  check(focusCalls == 2 && actualFocus == 20);
  check(navigated.disposition == FieldInputDisposition::Prevented);
  check(frames.end(navigation, true).disposition == FieldInputDisposition::Prevented);

  auto focusFailure = frames.begin(identity, 21, "down", 1000ms);
  check(frames.startDelivery(focusFailure));
  auto failedFocus = std::async(std::launch::async, [&] {
    const auto value = frames.requestFocus(focusFailure->token, identity, 21, "down", next);
    frames.acknowledge(focusFailure->token, identity, 21, "down", true, true, {});
    frames.finishDelivery(focusFailure, false);
    return value.error;
  });
  const auto failedService = frames.wait(focusFailure, [&](const FieldInputFocusAction &) -> FieldInputFocusResult {
    throw std::runtime_error("original-SDK-focus-failure");
  });
  check(failedFocus.get() == "original-SDK-focus-failure");
  check(failedService.disposition == FieldInputDisposition::Failed && failedService.error == "original-SDK-focus-failure");
  check(frames.end(focusFailure, true).disposition == FieldInputDisposition::Failed);

  auto unavailable = frames.begin(identity, 22, "down", 5ms);
  check(frames.startDelivery(unavailable));
  check(frames.requestFocus(unavailable->token, identity, 22, "down", next).error == "field-input-focus-timed-out");
  check(frames.wait(unavailable).disposition == FieldInputDisposition::TimedOut);
  check(frames.end(unavailable, true).disposition == FieldInputDisposition::TimedOut);

  auto cancelledFocus = frames.begin(identity, 23, "cancel", 1000ms);
  check(frames.startDelivery(cancelledFocus));
  check(!frames.requestFocus(cancelledFocus->token, identity, 23, "cancel", next).error.empty());
  frames.finishDelivery(cancelledFocus, false); frames.end(cancelledFocus, true);

  auto replacedBinding = frames.begin(identity, 24, "down", 1000ms);
  check(frames.startDelivery(replacedBinding));
  frames.retireBinding("other-owner", identity.bindingId);
  check(frames.accepts(replacedBinding->token, identity, 24, "down"));
  frames.retireBinding(identity.ownerId, identity.bindingId);
  check(!frames.accepts(replacedBinding->token, identity, 24, "down"));
  check(frames.end(replacedBinding, true).disposition == FieldInputDisposition::Retired);

  auto parent = identity;
  parent.ownerId = "parent"; parent.bindingId = "parent-binding"; parent.bindingRevision = "parent-revision";
  parent.metadataTarget = 25; parent.outerTarget = 20; parent.inputTarget = 21;
  parent.outerInstance = "outer:20"; parent.inputInstance = "input:21"; parent.epoch = 8;
  auto nested = frames.begin(identity, 30, "down", 1000ms, {identity, parent});
  check(nested && nested->scopeFor(20) && *nested->scopeFor(20) == parent && !nested->scopeFor(99));
  check(frames.startDelivery(nested));
  auto ancestorAction = std::async(std::launch::async, [&] {
    const auto actual = frames.requestFocus(nested->token, identity, 30, "down", {20, "previous"});
    frames.acknowledge(nested->token, identity, 30, "down", true, true, {});
    frames.finishDelivery(nested, false);
    return actual;
  });
  check(frames.wait(nested, [&](const FieldInputFocusAction &action) {
    check(action.groupTarget == 20 && action.kind == "previous");
    return FieldInputFocusResult{true, true, true, 19, "component:19", "editor:19", ""};
  }).disposition == FieldInputDisposition::Prevented);
  check(ancestorAction.get().target == 19);
  check(frames.end(nested, true).disposition == FieldInputDisposition::Prevented);

  auto parentRetired = frames.begin(identity, 31, "down", 1000ms, {identity, parent});
  check(frames.startDelivery(parentRetired));
  frames.retireBinding("foreign", parent.bindingId);
  check(frames.accepts(parentRetired->token, identity, 31, "down"));
  frames.retireBinding(parent.ownerId, parent.bindingId);
  check(!frames.accepts(parentRetired->token, identity, 31, "down"));
  check(frames.end(parentRetired, true).disposition == FieldInputDisposition::Retired);

  auto committedValue = parent; committedValue.documentRevision = "8"; committedValue.mountRevision = "mount:8";
  check(committedValue.sameScope(parent));
  for (auto member : {&FieldInputIdentity::ownerId, &FieldInputIdentity::bindingId, &FieldInputIdentity::bindingRevision,
      &FieldInputIdentity::documentId, &FieldInputIdentity::windowId, &FieldInputIdentity::outerInstance,
      &FieldInputIdentity::inputInstance, &FieldInputIdentity::nativeInstance, &FieldInputIdentity::editorInstance}) {
    auto changed = parent; changed.*member = "replacement";
    check(!changed.sameScope(parent));
  }
  for (auto member : {&FieldInputIdentity::metadataTarget, &FieldInputIdentity::outerTarget, &FieldInputIdentity::inputTarget,
      &FieldInputIdentity::surfaceId, &FieldInputIdentity::target}) {
    auto changed = parent; changed.*member += 100;
    check(!changed.sameScope(parent));
  }
  auto epochChanged = parent; epochChanged.epoch++;
  check(!epochChanged.sameScope(parent));
  for (auto member : {&FieldInputIdentity::documentId, &FieldInputIdentity::documentRevision, &FieldInputIdentity::windowId,
      &FieldInputIdentity::nativeInstance, &FieldInputIdentity::editorInstance}) {
    auto changed = parent; changed.*member = "foreign";
    check(!frames.begin(identity, 32, "down", 1000ms, {identity, changed}));
  }
  auto reusedRoot = parent; reusedRoot.outerTarget = identity.inputTarget;
  check(!frames.begin(identity, 32, "down", 1000ms, {identity, reusedRoot}));
  check(!frames.begin(identity, 32, "down", 1000ms, {parent}));
  check(!frames.begin(identity, 32, "down", 1000ms, {identity, parent, parent}));

  auto retiring = frames.begin(identity, 12, "down", 1000ms);
  auto retirement = std::async(std::launch::async, [&] { return frames.wait(retiring); });
  frames.retire();
  check(retirement.wait_for(100ms) == std::future_status::ready);
  check(retirement.get().disposition == FieldInputDisposition::Retired);
  check(!frames.startDelivery(retiring));
  check(!frames.begin(identity, 13, "down", 1000ms));
  check(frames.end(retiring, false).disposition == FieldInputDisposition::Retired);

  FieldInputDispatchFrames validation;
  auto invalid = identity; invalid.target = 0; check(!validation.begin(invalid, 1, "down", 100ms));
  invalid = identity; invalid.inputTarget = invalid.outerTarget; check(!validation.begin(invalid, 1, "down", 100ms));
  invalid = identity; invalid.nativeInstance = ""; check(!validation.begin(invalid, 1, "down", 100ms));
  check(!validation.begin(identity, 0, "down", 100ms));
  check(!validation.begin(identity, 1, "repeat", 100ms));
  check(!validation.begin(identity, 1, "down", 0ms));
  check(!validation.begin(identity, 1, "down", 1001ms));
  std::cout << assertions << " actual C++ field-input frame assertions passed; no SDK/default verdict\n";
}
