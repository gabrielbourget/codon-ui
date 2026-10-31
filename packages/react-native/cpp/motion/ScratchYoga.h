#pragma once

#include <yoga/Yoga.h>
#include <yoga/style/Style.h>
#include <array>
#include <functional>
#include <limits>
#include <vector>

namespace codon::motion {

using TNativeScratchBaseline = std::function<float(
    float, float, const std::array<float, 4> &, const std::array<float, 4> &, YGDirection)>;
using TNativeScratchMeasure = std::function<YGSize(
    float, YGMeasureMode, float, YGMeasureMode, YGDirection)>;

struct TNativeScratchNode {
  int tag;
  facebook::yoga::Style style;
  YGErrata errata{YGErrataAll};
  bool formsContainingBlock{false};
  TNativeScratchMeasure measure;
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
  std::array<float, 4> margin{};
  YGDirection direction{YGDirectionInherit};
};

struct TNativeScratchNodeMeasurement {
  int tag;
  int parentTag;
  YGDisplay display;
  YGPositionType positionType;
  bool formsContainingBlock;
  TNativeScratchMeasurement layout;
};

struct TNativeScratchStage {
  TNativeScratchNode root;
  TNativeScratchConstraints constraints;
};

// Every stage owns its complete immutable input, including intrinsic callbacks
// and containing-block state. The output is independent layout, never a mount.
std::vector<std::vector<TNativeScratchNodeMeasurement>> evaluateNativeScratchStages(
    const std::vector<TNativeScratchStage> &stages, int target);

std::vector<TNativeScratchMeasurement> evaluateNativeScratchYoga(
    const TNativeScratchNode &root, const TNativeScratchConstraints &constraints,
    int target, const std::vector<facebook::yoga::Style> &stages);

} // namespace codon::motion
