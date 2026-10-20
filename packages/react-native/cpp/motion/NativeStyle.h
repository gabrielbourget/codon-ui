#pragma once

#include "NativeABI.h"
#include <react/renderer/components/view/YogaStylableProps.h>

namespace codon::motion {

facebook::yoga::Style copyNativeYogaStyle(
    const facebook::react::YogaStylableProps &props, bool swapLeftAndRight);

facebook::yoga::Style swapNativeYogaStyle(facebook::yoga::Style style);

} // namespace codon::motion
