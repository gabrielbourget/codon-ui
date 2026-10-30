#include "../../../../packages/react-native/cpp/overlay/CounterDisplayRule.h"
#include <yoga/Yoga.h>
#include <cassert>
#include <iostream>

namespace y = facebook::yoga;
using codon::counter::applyCounterDisplayRule;

int main() {
  size_t checks = 0;
  for (const auto direction : {y::Direction::LTR, y::Direction::RTL}) {
    y::Node source;
    auto original = source.style();
    original.setDimension(y::Dimension::Width, y::StyleSizeLength::points(20));
    original.setDimension(y::Dimension::Height, y::StyleSizeLength::points(20));
    source.setStyle(original);
    y::Node root;
    auto rootStyle = root.style();
    rootStyle.setFlexDirection(y::FlexDirection::Row);
    rootStyle.setDimension(y::Dimension::Width, y::StyleSizeLength::points(100));
    root.setStyle(rootStyle);
    y::Node selected;
    selected.setStyle(original);
    selected.setOwner(&root);
    root.setChildren({&selected});
    int originalIdentity = 17;
    selected.setContext(&originalIdentity);
    for (const auto state : {0, 1, 2, 3, 4, 5, 0}) {
      const bool enabled = state != 0;
      const bool empty = state != 1;
      const bool authored = state == 3 || state == 4;
      const auto display = state == 4 ? y::Display::None : y::Display::Flex;
      applyCounterDisplayRule(selected, root, display, authored, empty, enabled);
      YGNodeCalculateLayout(&root, 100, YGUndefined, static_cast<YGDirection>(direction));
      const bool hidden = (enabled && empty && !authored) || display == y::Display::None;
      assert(YGNodeLayoutGetWidth(&selected) == (hidden ? 0 : 20)); checks++;
      assert(YGNodeLayoutGetHeight(&selected) == (hidden ? 0 : 20)); checks++;
      assert(source.style() == original); checks++;
      assert(selected.getContext() == &originalIdentity); checks++;
      assert(selected.getOwner() == &root); checks++;
    }
    root.setChildren({});
    selected.setOwner(nullptr);
    y::Node replacement;
    replacement.setChildren({&selected});
    selected.setOwner(&replacement);
    applyCounterDisplayRule(selected, replacement, y::Display::Flex, false, true, false);
    assert(selected.style().display() == y::Display::Flex); checks++;
    replacement.setChildren({});
    selected.setOwner(nullptr);
    bool rejected = false;
    try { applyCounterDisplayRule(selected, root, y::Display::Flex, false, true, true); }
    catch (const std::runtime_error &) { rejected = true; }
    assert(rejected); checks++;
  }
  std::cout << "Counter original-layout checks: " << checks << std::endl;
}
