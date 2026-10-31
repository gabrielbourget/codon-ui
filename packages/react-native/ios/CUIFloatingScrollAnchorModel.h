#pragma once
#include <algorithm>
#include <cmath>
#include <optional>

namespace cui {
struct ScrollAnchor { bool bottom; double offset; };
inline std::optional<ScrollAnchor> captureScrollAnchor(double focusTop, double focusBottom, double viewportTop, double viewportBottom) {
  if (!std::isfinite(focusTop) || !std::isfinite(focusBottom) || !std::isfinite(viewportTop) || !std::isfinite(viewportBottom) || focusBottom < focusTop || viewportBottom < viewportTop) return std::nullopt;
  bool bottom = focusTop - viewportTop > (viewportBottom - viewportTop) / 2;
  double offset = bottom ? focusBottom - viewportBottom : focusTop - viewportTop;
  return std::isfinite(offset) ? std::optional<ScrollAnchor>(ScrollAnchor{bottom, offset}) : std::nullopt;
}
inline std::optional<double> restoreScrollAnchor(ScrollAnchor anchor, double focusTop, double focusBottom, double viewportTop, double viewportBottom, double current, double minimum, double maximum) {
  if (!captureScrollAnchor(focusTop, focusBottom, viewportTop, viewportBottom) || !std::isfinite(current) || !std::isfinite(minimum) || !std::isfinite(maximum) || maximum < minimum) return std::nullopt;
  double delta = (anchor.bottom ? focusBottom - viewportBottom : focusTop - viewportTop) - anchor.offset;
  if (!std::isfinite(delta) || !std::isfinite(current + delta)) return std::nullopt;
  return delta == 0 ? current : std::clamp(current + delta, minimum, maximum);
}
}
