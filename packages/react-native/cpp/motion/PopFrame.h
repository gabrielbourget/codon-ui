#pragma once

#include "FabricSnapshot.h"
#include <folly/dynamic.h>

namespace codon::motion {

struct TNativePopFrame {
  TNativeFabricSnapshot snapshot;
  std::shared_ptr<const facebook::react::ShadowNode> positionedParent;
  double width;
  double height;
  double left;
  double top;
  double right;
  double bottom;
  bool rightToLeft;
};

// Reads already-computed metrics from one retained revision. It never asks a
// mounted view, original Yoga node or intrinsic callback to perform layout.
TNativePopFrame captureNativePopFrame(
    const facebook::react::UIManager &manager, int target, int containingRoot = 0);

folly::dynamic encodeNativePopFrame(const TNativePopFrame &frame);
std::string queryNativePopFrame(
    const facebook::react::UIManager &manager, const std::string &request);

} // namespace codon::motion
