#pragma once

#include "FieldInputNativeOperation.h"
#include <react/renderer/core/EventListener.h>
#include <react/renderer/uimanager/UIManager.h>
#include <stdexcept>
#include <thread>

namespace codon {
// The SDK retains this original dispatch stack until its listener lock has
// unwound. The receiver may then run the existing bounded UI/JS service.
inline bool continueFieldOriginalInput(facebook::react::UIManager &manager, int32_t target,
    const std::function<void()> &emit,
    const std::function<void(const facebook::react::RawEvent &)> &receive) {
  using namespace facebook::react;
  if (!receive) throw std::invalid_argument("field-input-original-receiver-required");
  if (FieldInputNativeOperation::contains(&manager)) { emit(); return false; }
  if (NativeEventListenerScope::active())
    throw std::runtime_error("field-input-original-listener-stack-active");
  bool captured = false;
  const auto thread = std::this_thread::get_id();
  const auto listener = std::make_shared<const EventListener>([&](const RawEvent &event) {
    const auto family = event.shadowNodeFamily.lock();
    if (std::this_thread::get_id() != thread || event.type != "topNativeSegmentInput" || !family ||
        family->getTag() != target || !event.eventTarget || !event.eventPayload || captured) return false;
    if (!event.deferAfterListeners([&, original = RawEvent(event)] {
      captured = true;
      receive(original);
    })) throw std::runtime_error("field-input-original-continuation-already-claimed");
    return true;
  });
  manager.addEventListener(listener);
  try { emit(); }
  catch (...) { manager.removeEventListener(listener); throw; }
  manager.removeEventListener(listener);
  return captured;
}
inline bool continueFieldOriginalPointer(facebook::react::UIManager &manager,
    const std::function<bool(const facebook::react::RawEvent &)> &belongs,
    const std::function<void()> &emit,
    const std::function<bool(const facebook::react::RawEvent &, FieldInputDispatchFrames::Clock::time_point)> &receive) {
  using namespace facebook::react;
  if (!belongs || !emit || !receive) throw std::invalid_argument("field-input-pointer-receiver-required");
  if (NativeEventListenerScope::active()) throw std::runtime_error("field-input-original-listener-stack-active");
  bool prevented = false;
  const auto deadline = FieldInputDispatchFrames::Clock::now() + std::chrono::milliseconds(1000);
  const auto thread = std::this_thread::get_id();
  const auto listener = std::make_shared<const EventListener>([&](const RawEvent &event) {
    if (std::this_thread::get_id() != thread || !event.eventTarget || !event.eventPayload ||
        (event.type != "topPointerDown" && event.type != "topPointerUp" && event.type != "topPointerCancel" &&
          event.type != "topClick") || !belongs(event)) return false;
    if (!event.deferAfterListeners([&, original = RawEvent(event)] {
      prevented = receive(original, deadline) || prevented;
    })) throw std::runtime_error("field-input-original-continuation-already-claimed");
    return true;
  });
  manager.addEventListener(listener);
  try { emit(); } catch (...) { manager.removeEventListener(listener); throw; }
  manager.removeEventListener(listener);
  return prevented;
}
} // namespace codon
