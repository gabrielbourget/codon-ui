#pragma once

#include <jsi/jsi.h>
#include <optional>
#include <stdexcept>
#include <string_view>

namespace codon {
inline bool isFieldInputOriginalPointer(std::string_view type) {
  return type == "topPointerDown" || type == "topPointerUp" || type == "topPointerCancel" || type == "topClick";
}
inline const char *fieldInputOriginalPointerPhase(std::string_view type) {
  if (type == "topPointerDown") return "pointer-start";
  if (type == "topPointerUp") return "pointer-end";
  if (type == "topPointerCancel") return "pointer-cancel";
  if (type == "topClick") return "pointer-click";
  throw std::invalid_argument("field-input-original-pointer-type-invalid");
}

// Retain the original SDK payload on its JS stack. React's unchanged synthetic
// event methods write these flags on that same object, even when propagation
// stops before a field receiver or the synthetic event returns to its pool.
class FieldInputOriginalPointer final {
 public:
  void retain(facebook::jsi::Runtime &runtime, const facebook::jsi::Value &value) {
    payload_ = facebook::jsi::Value(runtime, value).asObject(runtime);
  }
  bool stopped(facebook::jsi::Runtime &runtime) const { return flag(runtime, "cancelBubble", true); }
  bool prevented(facebook::jsi::Runtime &runtime) const {
    return flag(runtime, "returnValue", false) || flag(runtime, "defaultPrevented", true);
  }
 private:
  bool flag(facebook::jsi::Runtime &runtime, const char *name, bool expected) const {
    if (!payload_) return false;
    const auto value = payload_->getProperty(runtime, name);
    return value.isBool() && value.getBool() == expected;
  }
  std::optional<facebook::jsi::Object> payload_;
};
} // namespace codon
