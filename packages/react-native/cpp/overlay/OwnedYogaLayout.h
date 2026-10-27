#pragma once

#include <yoga/node/Node.h>

namespace codon::overlay {
float resolvePanelTransitionLength(float points, float percent, float containingBlock);
void layoutOwnedOverlayRoot(
    facebook::yoga::Node &node, facebook::yoga::Config &config,
    float width, float height, facebook::yoga::Direction direction);
}
