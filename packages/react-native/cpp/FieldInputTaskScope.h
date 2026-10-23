#pragma once

#include "FieldInputDispatchFrames.h"
#include <react/renderer/runtimescheduler/NativeEventTaskScope.h>
#include <memory>
#include <stdexcept>

namespace codon {
// Keeps the frame owner alive until the SDK has finished the original task's
// actual checkpoint and rendering stage, even after a native-side timeout.
class FieldInputTaskScope final : public facebook::react::NativeEventTaskScope {
 public:
  FieldInputTaskScope(std::shared_ptr<void> owner, FieldInputDispatchFrames &frames,
      FieldInputDispatchFrames::Handle ticket)
      : owner_(std::move(owner)), frames_(frames), ticket_(std::move(ticket)) {
    if (!owner_ || !ticket_) throw std::invalid_argument("field-input-task-scope-required");
  }
  void fail(const std::string &error) noexcept override {
    try {
      frames_.finishHandler(ticket_, true, error);
      frames_.finishPhases(ticket_, true, error);
    } catch (...) {
      // An allocation/cleanup failure cannot grant native default authority.
      // The original frame's deadline still retires an unfinished delivery.
    }
  }
  void finish() noexcept override {
    if (finished_) return;
    finished_ = true;
    try { frames_.finishPhases(ticket_); }
    catch (...) { fail("field-input-task-finish-threw"); }
  }
 private:
  std::shared_ptr<void> owner_;
  FieldInputDispatchFrames &frames_;
  FieldInputDispatchFrames::Handle ticket_;
  bool finished_{false};
};
} // namespace codon
