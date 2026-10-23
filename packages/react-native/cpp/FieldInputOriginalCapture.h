#pragma once

#include "FieldInputNativeOperation.h"
#include <react/renderer/core/EventListener.h>
#include <react/renderer/uimanager/UIManager.h>
#include <optional>
#include <thread>

namespace codon {
// The SDK holds its listener lock during callbacks. Retain the original record
// there, then leave that lock before any bounded JS/UI focus or mount service.
inline std::optional<facebook::react::RawEvent> captureFieldOriginalInput(
    facebook::react::UIManager &manager, int32_t target, const std::function<void()> &emit) {
  using namespace facebook::react;
  if (FieldInputNativeOperation::contains(&manager)) { emit(); return std::nullopt; }
  std::optional<RawEvent> original;
  const auto thread = std::this_thread::get_id();
  const auto listener = std::make_shared<const EventListener>([&](const RawEvent &event) {
    const auto family = event.shadowNodeFamily.lock();
    if (std::this_thread::get_id() != thread || event.type != "topNativeSegmentInput" || !family ||
        family->getTag() != target || !event.eventTarget || !event.eventPayload || original) return false;
    original.emplace(event);
    return true;
  });
  manager.addEventListener(listener);
  try { emit(); }
  catch (...) { manager.removeEventListener(listener); throw; }
  manager.removeEventListener(listener);
  return original;
}
} // namespace codon
