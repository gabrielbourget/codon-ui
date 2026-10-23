#pragma once

#include "FieldInputDispatchFrames.h"
#include <limits>
#include <stdexcept>

namespace codon {
// UI-thread stack capability for SDK Java callbacks into this original action.
// The SDK closes its queued receipt before this capability leaves the stack.
class FieldInputCommandExecution final {
 public:
  explicit FieldInputCommandExecution(const FieldInputCommandAction &action) : action_(action) {
    if (!action_.current || !action_.perform || serial_ == std::numeric_limits<int64_t>::max())
      throw std::invalid_argument("field-input-command-execution-required");
    token_ = ++serial_; stack_.push_back(this);
  }
  ~FieldInputCommandExecution() { stack_.pop_back(); }
  FieldInputCommandExecution(const FieldInputCommandExecution &) = delete;
  FieldInputCommandExecution &operator=(const FieldInputCommandExecution &) = delete;
  int64_t token() const { return token_; }
  const FieldInputCommandResult &result() const { return result_; }
  static bool current(int64_t token) {
    auto scope = find(token);
    if (!scope) return false;
    try { return scope->action_.current(); } catch (...) { return false; }
  }
  static std::string perform(int64_t token) {
    auto scope = find(token);
    if (!scope || scope->performed_) return "field-input-command-execution-retired";
    scope->performed_ = true;
    if (!current(token)) return "field-input-command-execution-expired";
    try { scope->result_ = scope->action_.perform(); }
    catch (const std::exception &error) { scope->result_.error = error.what(); }
    catch (...) { scope->result_.error = "field-input-command-execution-threw"; }
    if (!scope->result_.error.empty()) return scope->result_.error;
    return scope->result_.callbackCompleted ? "" : "field-input-command-callback-not-completed";
  }
 private:
  static FieldInputCommandExecution *find(int64_t token) {
    if (stack_.empty() || stack_.back()->token_ != token) return nullptr;
    return stack_.back();
  }
  const FieldInputCommandAction &action_;
  int64_t token_{0};
  FieldInputCommandResult result_{};
  bool performed_{false};
  inline static thread_local int64_t serial_{0};
  inline static thread_local std::vector<FieldInputCommandExecution *> stack_;
};
} // namespace codon
