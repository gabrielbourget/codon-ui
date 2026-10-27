#pragma once

#include <yoga/node/Node.h>

namespace codon::overlay {
void layoutOwnedOverlayRoot(
    facebook::yoga::Node &node, facebook::yoga::Config &config,
    float width, float height, facebook::yoga::Direction direction);
}
