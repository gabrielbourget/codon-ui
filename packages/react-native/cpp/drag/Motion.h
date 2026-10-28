#pragma once
#include <cmath>
#include <string>

namespace codon::drag {
// Pinned react-aria3.48 useDrop/useAutoScroll values; these are component behavior.
inline double edgeScrollDelta(double position, double extent) {
  if (!std::isfinite(position) || !std::isfinite(extent) || extent <= 0) return 0;
  if (position < 20) return position - 20;
  if (position > extent - 20) return position - extent + 20;
  return 0;
}
struct HoverActivation {
  std::string identity;
  std::string operation;
  double x = 0, y = 0, due = 0;
  bool initialized = false, fired = false;
  void stop() { identity.clear(); operation.clear(); initialized = false; fired = false; due = 0; }
  void update(const std::string &target, const std::string &effect, double nextX, double nextY, bool enabled, double now) {
    if (!enabled || target.empty() || effect == "cancel") { stop(); return; }
    if (!initialized || target != identity || effect != operation || nextX != x || nextY != y) {
      identity = target; operation = effect; x = nextX; y = nextY; due = now + 800; fired = false; initialized = true;
    }
  }
  bool ready(double now) {
    if (!initialized || fired || now < due) return false;
    fired = true; return true;
  }
};
}
