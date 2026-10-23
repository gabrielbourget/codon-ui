#pragma once

#include <algorithm>
#include <vector>

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
 private:
  inline static thread_local std::vector<const void *> stack_;
};
} // namespace codon
