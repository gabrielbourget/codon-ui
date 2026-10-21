/* Copyright 2024 Adobe. Apache-2.0; see src/collection/LICENSE.react-aria.md. */
#pragma once
#include <algorithm>
#include <cmath>

namespace codon {
struct MenuPointerRect {
  double left, top, right, bottom;
  bool contains(double x, double y) const { return x >= left && x <= right && y >= top && y <= bottom; }
};

// Private UI-thread state from the pinned hook; observations and default authority stay with UIKit.
class MenuPointerGrace {
  MenuPointerRect submenu{};
  bool hasSubmenu = false, hasPrevious = false, prevent = false, pointerMode = true;
  double previousX = 0, previousY = 0, lastProcessedTime = 0;
  int side = 0, movements = 2;
  double inactivity = -1, handoff = -1;
 public:
  void setSubmenu(MenuPointerRect rectangle) { submenu = rectangle; hasSubmenu = true; side = 0; }
  void activateSubmenu(MenuPointerRect rectangle) { submenu = rectangle; hasSubmenu = true; }
  bool suppressed() const { return prevent; }
  bool setPointerMode(bool value) {
    if (pointerMode == value) return false;
    retire(); pointerMode = value; return true;
  }
  double deadline() const { return inactivity >= 0 ? inactivity : handoff; }
  void reset() { prevent = false; movements = 2; hasPrevious = false; }
  void retire() { reset(); inactivity = -1; handoff = -1; }

  bool move(double x, double y, double now, MenuPointerRect parent) {
    if (!pointerMode || now - lastProcessedTime < 50) return false;
    inactivity = -1; handoff = -1;
    if (!hasPrevious) { previousX = x; previousY = y; hasPrevious = true; return true; }
    if (!hasSubmenu) return true;
    if (side == 0) side = x > submenu.right ? -1 : 1;
    if (!parent.contains(x, y)) { reset(); return true; }
    constexpr double padding = 3.14159265358979323846 / 12;
    double toSubmenu = side == 1 ? submenu.left - previousX : previousX - submenu.right;
    double angleTop = std::atan2(previousY - submenu.top, toSubmenu) + padding;
    double angleBottom = std::atan2(previousY - submenu.bottom, toSubmenu) - padding;
    double anglePointer = std::atan2(previousY - y, side == -1 ? -(x - previousX) : x - previousX);
    bool towards = anglePointer < angleTop && anglePointer > angleBottom;
    movements = towards ? std::min(movements + 1, 2) : std::max(movements - 1, 0);
    prevent = movements >= 2;
    lastProcessedTime = now; previousX = x; previousY = y;
    if (towards) inactivity = now + 1000;
    return true;
  }
  bool expire(double now) {
    if (inactivity >= 0 && now >= inactivity) {
      inactivity = -1; reset(); handoff = now + 100;
    } else if (handoff >= 0 && now >= handoff) {
      handoff = -1; return true;
    }
    return false;
  }
};
} // namespace codon
