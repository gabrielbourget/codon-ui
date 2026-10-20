#pragma once

#include <array>
#include <cmath>
#include <optional>
#include <stdexcept>
#include <string_view>

namespace codon::motion {

// Yoga's evaluated edges are physical left/top/right/bottom. Native style
// spellings retain RN's reported RTL swap independently of Yoga configuration.
inline std::optional<std::array<bool, 4>> nativeMeasuredEdgeSelection(
    std::string_view name, std::string_view prefix, std::string_view suffix,
    bool rightToLeft, bool wasLeftAndRightSwapped) {
  if (name.size() < prefix.size() + suffix.size() || !name.starts_with(prefix) || !name.ends_with(suffix))
    return std::nullopt;
  const auto middle = name.substr(prefix.size(), name.size() - prefix.size() - suffix.size());
  const auto matches = [&](std::string_view edge) { return middle == edge; };
  std::array<bool, 4> selected{};
  if (matches("Left")) selected[wasLeftAndRightSwapped ? 2 : 0] = true;
  else if (matches("Right")) selected[wasLeftAndRightSwapped ? 0 : 2] = true;
  else if (matches("Top") || matches("BlockStart")) selected[1] = true;
  else if (matches("Bottom") || matches("BlockEnd")) selected[3] = true;
  else if (matches("Start") || matches("InlineStart")) selected[rightToLeft ? 2 : 0] = true;
  else if (matches("End") || matches("InlineEnd")) selected[rightToLeft ? 0 : 2] = true;
  else if (matches("Horizontal") || matches("Inline")) selected[0] = selected[2] = true;
  else if (matches("Vertical") || matches("Block")) selected[1] = selected[3] = true;
  else if (matches("")) selected.fill(true);
  else return std::nullopt;
  return selected;
}

inline double nativeMeasuredEdgeValue(
    const std::array<float, 4> &physical, const std::array<bool, 4> &selected) {
  std::optional<double> value;
  for (std::size_t index = 0; index < physical.size(); index++) {
    if (!selected[index]) continue;
    if (!std::isfinite(physical[index])) throw std::runtime_error("Native motion layout: non-finite evaluated edge");
    if (value && *value != physical[index]) throw std::runtime_error("Native motion layout: ambiguous evaluated shorthand");
    value = physical[index];
  }
  if (!value) throw std::runtime_error("Native motion layout: evaluated edge selection required");
  return *value;
}

} // namespace codon::motion
