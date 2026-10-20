#pragma once

#include "NativeABI.h"
#include <folly/dynamic.h>
#include <react/renderer/components/view/YogaStylableProps.h>

namespace codon::motion {

// Only fields owned by the pop presentation. No editor or event data is kept.
folly::dynamic captureNativePopStyle(const facebook::react::YogaStylableProps &props);
folly::dynamic filterNativePopStyle(const folly::dynamic &props);
folly::dynamic nativePopStyle(double width, double height, double x, double y,
    bool rightToLeft, bool anchorRight, bool anchorBottom);

} // namespace codon::motion
