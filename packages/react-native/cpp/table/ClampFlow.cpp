#include "ClampFlow.h"

#include <algorithm>
#include <cmath>
#include <stdexcept>

namespace codon::table {
namespace {
void finite(double value) {
  if (!std::isfinite(value)) throw std::runtime_error("Table clamp requires finite original native fragments");
}
void dimension(double value) {
  finite(value);
  if (value < 0) throw std::runtime_error("Table clamp requires nonnegative native dimensions");
}
struct TLine {
  double top, bottom, baseline;
  uint64_t flow;
  std::vector<TClampFragment> fragments;
};
}

TClampViewport resolveClampViewport(const std::vector<TClampFragment> &fragments,
    double contentHeight, int maximumLines, double pointScaleFactor) {
  dimension(contentHeight);
  finite(pointScaleFactor);
  if (pointScaleFactor <= 0 || maximumLines < 0)
    throw std::runtime_error("Table clamp requires its original native scale and line policy");
  TClampViewport result{.contentHeight = contentHeight, .height = contentHeight};
  auto ordered = fragments;
  for (const auto &fragment : ordered) {
    finite(fragment.frame.origin.x); finite(fragment.frame.origin.y);
    dimension(fragment.frame.size.width); dimension(fragment.frame.size.height);
    finite(fragment.baseline);
    if (fragment.tag <= 0 || fragment.line < 0 || fragment.flow == 0)
      throw std::runtime_error("Table clamp requires original fragment ownership");
  }
  if (maximumLines == 0 || ordered.empty()) return result;
  std::stable_sort(ordered.begin(), ordered.end(), [](const auto &first, const auto &last) {
    return first.frame.origin.y < last.frame.origin.y;
  });
  const double tolerance = 0.5 / pointScaleFactor;
  std::vector<TLine> lines;
  for (const auto &fragment : ordered) {
    if (fragment.frame.size.height == 0) continue;
    auto line = std::find_if(lines.begin(), lines.end(), [&](const auto &candidate) {
      return candidate.flow == fragment.flow && std::abs(candidate.baseline - fragment.baseline) <= tolerance;
    });
    if (line == lines.end()) {
      lines.push_back({fragment.frame.getMinY(), fragment.frame.getMaxY(), fragment.baseline,
          fragment.flow, {fragment}});
    } else {
      line->top = std::min<double>(line->top, fragment.frame.getMinY());
      line->bottom = std::max<double>(line->bottom, fragment.frame.getMaxY());
      line->fragments.push_back(fragment);
    }
  }
  std::stable_sort(lines.begin(), lines.end(), [](const auto &first, const auto &last) { return first.top < last.top; });
  if (lines.size() <= static_cast<size_t>(maximumLines)) return result;
  const auto &last = lines[maximumLines - 1];
  double bottom = 0;
  for (int index = 0; index < maximumLines; index++) bottom = std::max(bottom, lines[index].bottom);
  result.height = std::min(contentHeight, std::ceil(std::max(0.0, bottom) * pointScaleFactor) / pointScaleFactor);
  result.lastBaseline = last.baseline;
  result.lastLine = last.fragments;
  result.clipped = result.height < contentHeight;
  return result;
}

double revealClampRect(double offset, double viewportHeight, double contentHeight,
    double targetTop, double targetBottom, double contentOrigin) {
  finite(offset); dimension(viewportHeight); dimension(contentHeight);
  finite(targetTop); finite(targetBottom); finite(contentOrigin);
  if (targetBottom < targetTop) throw std::runtime_error("Table clamp requires an ordered focus rectangle");
  const auto maximum = std::max(contentOrigin, contentOrigin + contentHeight - viewportHeight);
  offset = std::clamp(offset, contentOrigin, maximum);
  if (targetBottom - targetTop > viewportHeight) offset = targetTop;
  else if (targetTop < offset) offset = targetTop;
  else if (targetBottom > offset + viewportHeight) offset = targetBottom - viewportHeight;
  return std::clamp(offset, contentOrigin, maximum);
}

} // namespace codon::table
