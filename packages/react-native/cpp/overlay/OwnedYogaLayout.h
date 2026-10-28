#pragma once

#include <yoga/node/Node.h>
#include <string_view>

namespace codon::overlay {
enum class PanelCyclicLength { None, Auto, Zero, Undefined };
PanelCyclicLength panelCyclicLength(std::string_view field, bool hasPercentage, bool inlineCycle, bool blockCycle, bool row);
void applyPanelBlockFlow(facebook::yoga::Style &style);
void applyPanelFlexFlow(facebook::yoga::Style &style);
float resolvePanelTransitionLength(float points, float percent, float containingBlock);
void layoutOwnedOverlayRoot(
    facebook::yoga::Node &node, facebook::yoga::Config &config,
    float width, float height, facebook::yoga::Direction direction);
}
