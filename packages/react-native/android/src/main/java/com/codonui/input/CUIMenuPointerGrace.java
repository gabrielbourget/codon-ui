/* Copyright 2024 Adobe. Apache-2.0; see src/collection/LICENSE.react-aria.md. */
package com.codonui.input;

/** Private UI-thread state from the pinned useSafelyMouseToSubmenu hook. No input is synthesized here. */
final class CUIMenuPointerGrace {
  static final class Rect {
    final double left, top, right, bottom;
    Rect(double left, double top, double right, double bottom) {
      this.left = left; this.top = top; this.right = right; this.bottom = bottom;
    }
    boolean contains(double x, double y) { return x >= left && x <= right && y >= top && y <= bottom; }
  }

  private Rect submenu;
  private boolean hasPrevious;
  private double previousX, previousY, lastProcessedTime;
  private int side, movements = 2;
  private double inactivity = -1, handoff = -1;
  private boolean suppressed;
  private boolean pointerMode = true;

  void setSubmenu(Rect rectangle) { submenu = rectangle; side = 0; }
  void activateSubmenu(Rect rectangle) { submenu = rectangle; }
  boolean suppressed() { return suppressed; }
  boolean setPointerMode(boolean value) {
    if (pointerMode == value) return false;
    retire(); pointerMode = value; return true;
  }
  double deadline() { return inactivity >= 0 ? inactivity : handoff; }

  void reset() { suppressed = false; movements = 2; hasPrevious = false; }
  void retire() { reset(); inactivity = -1; handoff = -1; }

  boolean move(double x, double y, double now, Rect parent) {
    if (!pointerMode || now - lastProcessedTime < 50) return false;
    inactivity = -1; handoff = -1;
    if (!hasPrevious) { previousX = x; previousY = y; hasPrevious = true; return true; }
    if (submenu == null) return true;
    if (side == 0) side = x > submenu.right ? -1 : 1;
    if (!parent.contains(x, y)) { reset(); return true; }
    double toSubmenu = side == 1 ? submenu.left - previousX : previousX - submenu.right;
    double angleTop = Math.atan2(previousY - submenu.top, toSubmenu) + Math.PI / 12;
    double angleBottom = Math.atan2(previousY - submenu.bottom, toSubmenu) - Math.PI / 12;
    double anglePointer = Math.atan2(previousY - y, side == -1 ? -(x - previousX) : x - previousX);
    boolean towards = anglePointer < angleTop && anglePointer > angleBottom;
    movements = towards ? Math.min(movements + 1, 2) : Math.max(movements - 1, 0);
    suppressed = movements >= 2;
    lastProcessedTime = now; previousX = x; previousY = y;
    if (towards) inactivity = now + 1000;
    return true;
  }

  // The platform schedules this with its monotonic UI-thread clock, retaining its original observation.
  boolean expire(double now) {
    if (inactivity >= 0 && now >= inactivity) {
      inactivity = -1; reset(); handoff = now + 100;
    } else if (handoff >= 0 && now >= handoff) {
      handoff = -1; return true;
    }
    return false;
  }
}
