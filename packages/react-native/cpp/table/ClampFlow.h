#pragma once

#include <react/renderer/graphics/Rect.h>
#include <cstdint>
#include <vector>

namespace codon::table {

enum class ClampFragmentKind { Line, Atomic };

struct TClampFragment {
  facebook::react::Rect frame;
  double baseline{0};
  int tag{0};
  int line{0};
  uint64_t flow{0};
  ClampFragmentKind kind{ClampFragmentKind::Line};
};

struct TClampViewport {
  double contentHeight{0};
  double height{0};
  double lastBaseline{0};
  bool clipped{false};
  std::vector<TClampFragment> lastLine;
};

// Fragments are complete original layout output, never a guessed font-size grid.
TClampViewport resolveClampViewport(const std::vector<TClampFragment> &fragments,
    double contentHeight, int maximumLines, double pointScaleFactor);
double revealClampRect(double offset, double viewportHeight, double contentHeight,
    double targetTop, double targetBottom, double contentOrigin = 0);

} // namespace codon::table
