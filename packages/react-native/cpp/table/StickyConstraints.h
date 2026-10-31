#pragma once

#include <algorithm>
#include <cmath>
#include <optional>
#include <stdexcept>

namespace codon::table {

// CSS Positioned Layout3 §3.4, in one shared untransformed layout coordinate space.
struct TStickyAxis {
  double normalStart;
  double borderSize;
  double containingStart;
  double containingSize;
  double viewportStart;
  double viewportSize;
  double marginStart{0};
  double marginEnd{0};
  std::optional<double> startInset;
  std::optional<double> endInset;
  bool logicalEndIsPhysicalStart{false};
};

inline double nativeStickyAxisOffset(const TStickyAxis &axis) {
  for (const double value : {axis.normalStart, axis.borderSize, axis.containingStart,
      axis.containingSize, axis.viewportStart, axis.viewportSize, axis.marginStart, axis.marginEnd})
    if (!std::isfinite(value)) throw std::invalid_argument("Table sticky: finite actual geometry required");
  if (axis.borderSize < 0 || axis.containingSize < 0 || axis.viewportSize < 0 ||
      (axis.startInset && !std::isfinite(*axis.startInset)) ||
      (axis.endInset && !std::isfinite(*axis.endInset)))
    throw std::invalid_argument("Table sticky: invalid actual extent/inset");
  if (!axis.startInset && !axis.endInset) return 0;

  double viewStart = axis.viewportStart + axis.startInset.value_or(0);
  double viewEnd = axis.viewportStart + axis.viewportSize - axis.endInset.value_or(0);
  const auto finiteResult = [](double result) {
    if (!std::isfinite(result)) throw std::invalid_argument("Table sticky: geometry overflow");
    return result;
  };
  finiteResult(viewStart);
  finiteResult(viewEnd);
  if (viewEnd - viewStart < axis.borderSize) {
    if (axis.logicalEndIsPhysicalStart) viewStart = viewEnd - axis.borderSize;
    else viewEnd = viewStart + axis.borderSize;
  }

  const double normalEnd = axis.normalStart + axis.borderSize;
  const double containingEnd = axis.containingStart + axis.containingSize;
  finiteResult(viewStart);
  finiteResult(viewEnd);
  finiteResult(normalEnd);
  finiteResult(containingEnd);
  const double marginStart = std::min(axis.marginStart,
      std::abs(axis.normalStart - axis.marginStart - axis.containingStart));
  const double marginEnd = std::min(axis.marginEnd,
      std::abs(containingEnd - normalEnd - axis.marginEnd));
  if (axis.startInset && axis.normalStart < viewStart)
    return finiteResult(std::max(0.0, std::min(viewStart - axis.normalStart, containingEnd - marginEnd - normalEnd)));
  if (axis.endInset && normalEnd > viewEnd)
    return finiteResult(std::min(0.0, std::max(viewEnd - normalEnd, axis.containingStart + marginStart - axis.normalStart)));
  return 0;
}

} // namespace codon::table
