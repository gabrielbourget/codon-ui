package com.codonui.input;

// Pinned react-aria3.48 useDrop/useAutoScroll constants; no verifier budget is changed.
final class CUIDragMotion {
  static double edgeDelta(double position, double extent) {
    if (!Double.isFinite(position) || !Double.isFinite(extent) || extent <= 0) return 0;
    if (position < 20) return position - 20;
    if (position > extent - 20) return position - extent + 20;
    return 0;
  }
  static final class Hover {
    String identity = "", operation = "";
    double x, y, due;
    boolean initialized, fired;
    void stop() { identity=""; operation=""; due=0; initialized=false; fired=false; }
    void update(String target,String effect,double nextX,double nextY,boolean enabled,double now) {
      if (!enabled || target.isEmpty() || effect.equals("cancel")) { stop(); return; }
      if (!initialized || !identity.equals(target) || !operation.equals(effect) || x!=nextX || y!=nextY) {
        identity=target; operation=effect; x=nextX; y=nextY; due=now+800; fired=false; initialized=true;
      }
    }
    boolean ready(double now) { if (!initialized || fired || now<due) return false; fired=true; return true; }
  }
}
