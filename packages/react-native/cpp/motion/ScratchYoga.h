#pragma once

#include <yoga/Yoga.h>
#include <yoga/style/Style.h>
#include <array>
#include <functional>
#include <limits>
#include <vector>

namespace codon::motion {

using TNativeScratchBaseline = std::function<float(
    float, float, const std::array<float, 4> &, const std::array<float, 4> &)>;

struct TNativeScratchNode {
  int tag;
  facebook::yoga::Style style;
  YGErrata errata{YGErrataAll};
  bool formsContainingBlock{false};
  std::function<YGSize(float, YGMeasureMode, float, YGMeasureMode)> measure;
  TNativeScratchBaseline baseline;
  std::vector<TNativeScratchNode> children;
};

struct TNativeScratchConstraints {
  float minimumWidth{0};
  float minimumHeight{0};
  float maximumWidth{std::numeric_limits<float>::infinity()};
  float maximumHeight{std::numeric_limits<float>::infinity()};
  float pointScaleFactor{1};
  YGDirection direction{YGDirectionInherit};
  bool fixFlexBasisFitContent{false};
};

// Scratch results describe evaluated layout, never mounted geometry or paint.
struct TNativeScratchMeasurement {
  std::array<float, 4> frame;
  std::array<float, 4> border;
  std::array<float, 4> padding;
};

std::vector<TNativeScratchMeasurement> evaluateNativeScratchYoga(
    const TNativeScratchNode &root, const TNativeScratchConstraints &constraints,
    int target, const std::vector<facebook::yoga::Style> &stages);

} // namespace codon::motion
