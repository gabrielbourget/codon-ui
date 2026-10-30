#include "CounterEmptyLayout.h"
#include "CounterDisplayRule.h"
#include <react/renderer/components/text/RawTextProps.h>
#include <react/renderer/components/view/YogaLayoutableShadowNode.h>
#include <react/renderer/components/view/YogaStylableProps.h>
#include <stdexcept>
#include <string_view>

namespace codon::counter {
using namespace facebook::react;
namespace y = facebook::yoga;

bool isNativeCounterEmptyElement(const ShadowNode &node) {
  const auto *content = &node;
  const std::string_view name(node.getComponentName());
  if (name == "RNSVGSvgView" || name == "RNSVGSvgViewAndroid") {
    const auto &children = node.getChildren();
    if (children.size() != 1 || std::string_view(children.front()->getComponentName()) != "RNSVGGroup")
      throw std::runtime_error("Counter empty layout: original SVG group authority unavailable");
    // The pinned Svg host inserts this group; it is not an authored SVG child.
    content = children.front().get();
  }
  for (const auto &child : content->getChildren()) {
    if (std::string_view(child->getComponentName()) != "RawText") return false;
    const auto &text = static_cast<const RawTextProps &>(*child->getProps());
    if (!text.text.empty()) return false;
  }
  return true;
}

void applyNativeCounterEmptyLayout(y::Node &owner,
    const std::vector<std::shared_ptr<const ShadowNode>> &children, bool enabled) {
  size_t yogaIndex = 0;
  for (const auto &child : children) {
    const auto *layout = dynamic_cast<const YogaLayoutableShadowNode *>(child.get());
    if (!layout) {
      if (enabled) throw std::runtime_error("Counter empty layout: original native element authority unavailable");
      continue;
    }
    if (yogaIndex >= owner.getChildCount())
      throw std::runtime_error("Counter empty layout: original child layout correspondence changed");
    auto *selected = owner.getChild(yogaIndex++);
    if (!selected || selected->getContext() != layout || selected->getOwner() != &owner)
      throw std::runtime_error("Counter empty layout: independently owned child Yoga node required");
    const auto &props = static_cast<const YogaStylableProps &>(*child->getProps());
    applyCounterDisplayRule(*selected, owner, props.yogaStyle.display(), props.cuiHasAuthoredDisplay,
        enabled && isNativeCounterEmptyElement(*child), enabled);
  }
  if (yogaIndex != owner.getChildCount())
    throw std::runtime_error("Counter empty layout: original child layout correspondence changed");
}
}
