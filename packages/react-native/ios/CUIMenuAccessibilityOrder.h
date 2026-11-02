#pragma once
#include <algorithm>
#include <cstdint>
#include <string>
#include <vector>

namespace codon {
// Only original views admitted by the current list/window/descriptor guards enter this helper.
struct MenuAccessibilityTarget {
  std::intptr_t target;
  std::string binding;
  int ordinal;
  int order;
  bool separator;
};
struct MenuAccessibilityEntry { std::intptr_t target; std::int64_t index; };
struct MenuAccessibilityOrder {
  std::int64_t count;
  std::vector<MenuAccessibilityEntry> entries;
};
inline MenuAccessibilityOrder menuAccessibilityOrder(int itemCount, const std::vector<MenuAccessibilityTarget> &targets) {
  MenuAccessibilityOrder result{std::max(itemCount, 0), {}};
  if (itemCount < 0) return result;
  std::vector<MenuAccessibilityTarget> admitted;
  for (const auto &candidate : targets) {
    if (candidate.target <= 0 || candidate.binding.empty() || candidate.ordinal < 0 ||
      candidate.ordinal > itemCount || (!candidate.separator && candidate.ordinal == itemCount) ||
      (candidate.separator && candidate.order < 0)) continue;
    bool duplicate = false;
    for (const auto &other : targets) {
      if (&other == &candidate) continue;
      if (other.target == candidate.target || other.binding == candidate.binding ||
        (!other.separator && !candidate.separator && other.ordinal == candidate.ordinal) ||
        (other.separator && candidate.separator && other.order == candidate.order)) { duplicate = true; break; }
    }
    if (!duplicate) admitted.push_back(candidate);
  }
  std::sort(admitted.begin(), admitted.end(), [](const auto &a, const auto &b) {
    if (a.ordinal != b.ordinal) return a.ordinal < b.ordinal;
    if (a.separator != b.separator) return a.separator;
    return a.order < b.order;
  });
  std::int64_t inserted = 0;
  for (const auto &target : admitted) {
    result.entries.push_back({target.target, target.ordinal + inserted});
    if (target.separator) ++inserted;
  }
  result.count += inserted;
  return result;
}
} // namespace codon
