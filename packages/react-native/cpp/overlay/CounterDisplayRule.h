#pragma once
#include <yoga/node/Node.h>
#include <stdexcept>

namespace codon::counter {
inline void applyCounterDisplayRule(facebook::yoga::Node &selected, facebook::yoga::Node &owner,
    facebook::yoga::Display authoredDisplay, bool hasAuthoredDisplay, bool empty, bool enabled) {
  if (selected.getOwner() != &owner)
    throw std::runtime_error("Counter empty layout: independently owned child Yoga node required");
  auto style = selected.style();
  style.setDisplay(enabled && empty && !hasAuthoredDisplay ? facebook::yoga::Display::None : authoredDisplay);
  if (style != selected.style()) {
    selected.setStyle(style);
    selected.markDirtyAndPropagate();
  }
}
}
