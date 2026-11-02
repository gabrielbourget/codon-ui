#pragma once
#include <string_view>

namespace codon::input {
inline bool dateSegmentCapturesKey(std::string_view key, bool shift, bool alt, bool control, bool meta,
    bool composing, bool readOnly, bool picker) {
  if (key == "ArrowLeft" || key == "ArrowRight") return true;
  if (picker && alt && (key == "ArrowUp" || key == "ArrowDown")) return true;
  if (control && key == "a") return true;
  if (shift || alt || control || meta) return false;
  if (key == "Backspace" || key == "Delete") return true;
  return !composing && !readOnly && (key == "ArrowUp" || key == "ArrowDown" || key == "Up" || key == "Down" ||
    key == "PageUp" || key == "PageDown" || key == "Home" || key == "End");
}
}
