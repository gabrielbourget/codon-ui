#include "CUIMenuAccessibilityOrder.h"
#include <cassert>
#include <iostream>
#include <limits>

using codon::MenuAccessibilityTarget;
using codon::menuAccessibilityOrder;
static MenuAccessibilityTarget item(int ordinal) {
  return {100 + ordinal, "item-" + std::to_string(ordinal), ordinal, -1, false};
}
static MenuAccessibilityTarget separator(int target, int before, int order) {
  return {target, "separator-" + std::to_string(target), before, order, true};
}
static std::intptr_t at(const codon::MenuAccessibilityOrder &order, std::int64_t index) {
  for (const auto &entry : order.entries) if (entry.index == index) return entry.target;
  return 0;
}
int main() {
  std::vector<MenuAccessibilityTarget> five{item(4), item(2), item(0), item(3), item(1)};
  auto original = menuAccessibilityOrder(5, five);
  assert(original.count == 5);
  for (int ordinal = 0; ordinal < 5; ++ordinal) assert(at(original, ordinal) == 100 + ordinal);
  auto named = five;
  named.push_back(separator(200, 2, 3));
  auto ordered = menuAccessibilityOrder(5, named);
  assert(ordered.count == 6 && ordered.entries.size() == 6);
  const int expected[]{100, 101, 200, 102, 103, 104};
  for (int index = 0; index < 6; ++index) assert(at(ordered, index) == expected[index]);
  for (const auto &target : five) assert(target.ordinal == target.target - 100);
  named.push_back(separator(203, 5, 10));
  named.push_back(separator(202, 2, 4));
  named.push_back(separator(201, 0, 0));
  auto boundaries = menuAccessibilityOrder(5, named);
  const int boundaryExpected[]{201, 100, 101, 200, 202, 102, 103, 104, 203};
  assert(boundaries.count == 9);
  for (int index = 0; index < 9; ++index) assert(at(boundaries, index) == boundaryExpected[index]);
  // A missing/unmaterialized item retains its logical hole; no substitute view is fabricated.
  auto sparse = menuAccessibilityOrder(5, {item(0), separator(200, 2, 3), item(4)});
  assert(sparse.count == 6 && sparse.entries.size() == 3);
  assert(at(sparse, 0) == 100 && at(sparse, 1) == 0 && at(sparse, 2) == 200 && at(sparse, 3) == 0 && at(sparse, 5) == 104);
  // Duplicated ordinals, descriptor bindings, targets or separator positions fail closed.
  auto conflict = item(1); conflict.target = 999; conflict.binding = "other";
  auto duplicates = menuAccessibilityOrder(5, {item(0), item(1), conflict, separator(200, 2, 3)});
  assert(duplicates.count == 6 && at(duplicates, 1) == 0 && at(duplicates, 2) == 200);
  auto duplicateBinding = separator(200, 2, 3); duplicateBinding.binding = item(0).binding;
  auto bindings = menuAccessibilityOrder(5, {item(0), duplicateBinding, item(4)});
  assert(bindings.count == 5 && bindings.entries.size() == 1 && at(bindings, 4) == 104);
  auto duplicateTarget = separator(100, 2, 3);
  assert(menuAccessibilityOrder(5, {item(0), duplicateTarget}).entries.empty());
  assert(menuAccessibilityOrder(5, {separator(200, 2, 3), separator(201, 2, 3)}).entries.empty());
  auto invalid = menuAccessibilityOrder(5, {separator(200, -1, 1), separator(201, 6, 2), separator(202, 1, -1), item(5)});
  assert(invalid.count == 5 && invalid.entries.empty());
  auto empty = menuAccessibilityOrder(0, {separator(200, 0, 0)});
  assert(empty.count == 1 && at(empty, 0) == 200);
  // Logical holes are sparse even at the admitted integer limit.
  auto maximum = menuAccessibilityOrder(std::numeric_limits<int>::max(), {separator(200, std::numeric_limits<int>::max(), 0)});
  assert(maximum.count == static_cast<std::int64_t>(std::numeric_limits<int>::max()) + 1 && maximum.entries.size() == 1);
  assert(menuAccessibilityOrder(-1, named).entries.empty());
  std::cout << "PASS: original five, named/decorative admission boundary, linked order, boundaries, sparse holes, duplicate/invalid rejection, empty and integer limit\n";
}
