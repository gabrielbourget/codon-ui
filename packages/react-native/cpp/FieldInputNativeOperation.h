#pragma once

#include <algorithm>
#include <vector>
#include "FieldInputOwnedInput.h"

namespace codon {
// Only the original native service stack is marked. This is not a runtime
// feature switch and carries no authority beyond that manager and thread.
class FieldInputNativeOperation final {
 public:
  explicit FieldInputNativeOperation(const void *manager) { stack_.push_back(manager); }
  ~FieldInputNativeOperation() { stack_.pop_back(); }
  FieldInputNativeOperation(const FieldInputNativeOperation &) = delete;
  FieldInputNativeOperation &operator=(const FieldInputNativeOperation &) = delete;
  static bool contains(const void *manager) {
    return std::find(stack_.begin(), stack_.end(), manager) != stack_.end();
  }
  class Input final {
   public:
    Input(const void *manager, std::shared_ptr<const FieldInputOwnedInput> context)
        : manager_(manager), context_(std::move(context)) { inputs_.push_back(this); }
    ~Input() { inputs_.pop_back(); }
    Input(const Input &) = delete;
    Input &operator=(const Input &) = delete;
   private:
    friend class FieldInputNativeOperation;
    const void *manager_;
    std::shared_ptr<const FieldInputOwnedInput> context_;
  };
  static std::shared_ptr<const FieldInputOwnedInput> input(const void *manager, int32_t target) {
    if (inputs_.empty()) return nullptr;
    const auto scope = inputs_.back();
    return scope->manager_ == manager && scope->context_ && scope->context_->identity.target == target ? scope->context_ : nullptr;
  }
 private:
  inline static thread_local std::vector<const void *> stack_;
  inline static thread_local std::vector<const Input *> inputs_;
};
} // namespace codon
