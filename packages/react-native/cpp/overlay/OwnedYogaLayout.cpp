#include "OwnedYogaLayout.h"

#include <yoga/Yoga.h>
#include <cmath>
#include <stdexcept>

namespace codon::overlay {
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
