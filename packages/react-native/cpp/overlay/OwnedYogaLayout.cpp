#include "OwnedYogaLayout.h"

#include <yoga/Yoga.h>
#include <cmath>
#include <stdexcept>

namespace codon::overlay {
PanelCyclicLength panelCyclicLength(std::string_view field, bool hasPercentage, bool inlineCycle, bool blockCycle, bool row) {
  if (!hasPercentage) return PanelCyclicLength::None;
  const bool cyclic = (blockCycle && (field == "height" || field == "minHeight" || field == "maxHeight")) ||
      (inlineCycle && (field == "width" || field == "minWidth" || field == "maxWidth")) ||
      (field == "flexBasis" && (row ? inlineCycle : blockCycle));
  if (!cyclic) return PanelCyclicLength::None;
  return field.starts_with("min") ? PanelCyclicLength::Zero
      : field.starts_with("max") ? PanelCyclicLength::Undefined : PanelCyclicLength::Auto;
}

void applyPanelBlockFlow(facebook::yoga::Style &style) {
  style.setFlex(facebook::yoga::FloatOptional{});
  style.setFlexGrow(facebook::yoga::FloatOptional{0});
  style.setFlexShrink(facebook::yoga::FloatOptional{0});
  style.setFlexBasis(facebook::yoga::StyleSizeLength::ofAuto());
  style.setAlignSelf(facebook::yoga::Align::Auto);
}

void applyPanelFlexFlow(facebook::yoga::Style &style) {
  if (style.flexShrink().isUndefined()) style.setFlexShrink(facebook::yoga::FloatOptional{1});
}

float resolvePanelTransitionLength(float points, float percent, float containingBlock) {
  const float value = points + percent * containingBlock;
  if (!std::isfinite(value)) throw std::runtime_error("Panel transition requires finite original containing-block lengths");
  return value;
}

void layoutOwnedOverlayRoot(
    facebook::yoga::Node &node, facebook::yoga::Config &config,
    float width, float height, facebook::yoga::Direction direction) {
  if (node.getOwner() || !std::isfinite(width) || !std::isfinite(height) || width < 0 || height < 0)
    throw std::runtime_error("Panel layout requires an exclusive owned Yoga root and a finite native containing block");
  facebook::yoga::Node container(&config);
  auto style = container.style();
  style.setDimension(facebook::yoga::Dimension::Width, facebook::yoga::StyleSizeLength::points(width));
  style.setDimension(facebook::yoga::Dimension::Height, facebook::yoga::StyleSizeLength::points(height));
  container.setStyle(style);
  container.insertChild(&node, 0);
  node.setOwner(&container);
  try {
    YGNodeCalculateLayout(&container, width, height, static_cast<YGDirection>(direction));
  } catch (...) {
    container.removeChild(&node);
    node.setOwner(nullptr);
    throw;
  }
  // Both nodes are owned here. Preserve the original child's resolved layout on detachment.
  container.removeChild(&node);
  node.setOwner(nullptr);
}
}
