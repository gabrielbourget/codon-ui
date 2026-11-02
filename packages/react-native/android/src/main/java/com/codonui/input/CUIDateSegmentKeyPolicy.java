package com.codonui.input;

final class CUIDateSegmentKeyPolicy {
  static boolean captures(String key, boolean shift, boolean alt, boolean control, boolean meta,
      boolean composing, boolean readOnly, boolean picker) {
    if ("ArrowLeft".equals(key) || "ArrowRight".equals(key)) return true;
    if (picker && alt && ("ArrowUp".equals(key) || "ArrowDown".equals(key))) return true;
    if (control && "a".equals(key)) return true;
    if (shift || alt || control || meta) return false;
    if ("Backspace".equals(key) || "Delete".equals(key)) return true;
    return !composing && !readOnly && ("ArrowUp".equals(key) || "ArrowDown".equals(key) || "Up".equals(key) || "Down".equals(key) ||
      "PageUp".equals(key) || "PageDown".equals(key) || "Home".equals(key) || "End".equals(key));
  }
}
