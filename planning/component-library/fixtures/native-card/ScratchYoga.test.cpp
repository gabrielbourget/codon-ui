#include "ScratchYoga.h"
#include "NativeYogaNames.h"
#include <cmath>
#include <algorithm>
#include <yoga/event/event.h>
#include <iostream>
#include <stdexcept>
#include <string>

using namespace codon::motion;
namespace y = facebook::yoga;
static int assertions = 0;
static void require(bool condition, const std::string &message) {
  assertions++;
  if (!condition) throw std::runtime_error(message);
}
static void near(float actual, float expected, const std::string &message) {
  require(std::abs(actual - expected) < 0.001f, message + ": " +
      std::to_string(actual) + " != " + std::to_string(expected));
}
template <typename TCpp, typename TEnum> static void enumNames(const char *(*upstream)(TEnum)) {
  for (int32_t index = 0; index < y::ordinalCount<TCpp>(); index++) {
    const auto value = static_cast<TEnum>(index);
    require(std::string(nativeYogaEnumName(value)) == upstream(value), "actual pinned Yoga enum spelling");
  }
}
template <typename F> static void rejects(F callback, const std::string &message) {
  try { callback(); } catch (const std::exception &error) {
    require(std::string(error.what()).find(message) != std::string::npos, error.what());
    return;
  }
  throw std::runtime_error("expected rejection: " + message);
}
static TNativeScratchNode tree() {
  TNativeScratchNode root{1, {}};
  root.style.setAlignItems(y::Align::FlexStart);
  TNativeScratchNode target{2, {}};
  target.style.setDimension(y::Dimension::Width, y::StyleSizeLength::points(120));
  target.style.setDimension(y::Dimension::Height, y::StyleSizeLength::points(40));
  TNativeScratchNode child{3, {}};
  child.style.setDimension(y::Dimension::Width, y::StyleSizeLength::points(240));
  child.style.setDimension(y::Dimension::Height, y::StyleSizeLength::points(10));
  target.children.push_back(child);
  root.children.push_back(target);
  return root;
}
static TNativeScratchConstraints constraints(float width = 400, float scale = 1) {
  TNativeScratchConstraints result;
  result.minimumWidth = result.maximumWidth = width;
  result.minimumHeight = result.maximumHeight = 300;
  result.pointScaleFactor = scale;
  result.direction = YGDirectionLTR;
  return result;
}
int main() {
  try {
    int allocations = 0, retirements = 0;
    y::Event::subscribe([&](YGNodeConstRef, y::Event::Type type, const y::Event::Data &) {
      if (type == y::Event::NodeAllocation) allocations++;
      if (type == y::Event::NodeDeallocation) retirements++;
    });
    auto input = tree();
    enumNames<y::Align, YGAlign>(YGAlignToString);
    enumNames<y::BoxSizing, YGBoxSizing>(YGBoxSizingToString);
    enumNames<y::Display, YGDisplay>(YGDisplayToString);
    enumNames<y::FlexDirection, YGFlexDirection>(YGFlexDirectionToString);
    enumNames<y::Justify, YGJustify>(YGJustifyToString);
    enumNames<y::Overflow, YGOverflow>(YGOverflowToString);
    enumNames<y::PositionType, YGPositionType>(YGPositionTypeToString);
    enumNames<y::Wrap, YGWrap>(YGWrapToString);
    auto style = input.children[0].style;
    std::vector<y::Style> stages;
    for (const auto width : {120.0f, 0.0f, 13.25f, 400.0f}) {
      style.setDimension(y::Dimension::Width, y::StyleSizeLength::points(width));
      stages.push_back(style);
    }
    style.setDimension(y::Dimension::Width, y::StyleSizeLength::ofAuto());
    stages.push_back(style);
    const auto values = evaluateNativeScratchYoga(input, constraints(), 2, stages);
    require(values.size() == 5, "all coupled stages returned");
    constexpr float pointWidths[]{120, 0, 13.25f, 400};
    for (size_t i = 0; i < 4; i++) near(values[i].frame[2], std::round(pointWidths[i]), "point width");
    near(values[4].frame[2], 240, "auto uses independently laid out child");
    require(input.children[0].style.dimension(y::Dimension::Width) == y::StyleSizeLength::points(120), "author style retained");
    for (const auto width : {0.0f, 33.25f, 100.125f, 400.0f, 1024.5f}) {
      for (const auto scale : {1.0f, 1.5f, 2.0f, 3.0f}) {
        for (const auto percent : {0.0f, 12.5f, 25.0f, 50.0f, 75.0f, 100.0f, 125.0f}) {
          auto stage = input.children[0].style;
          stage.setDimension(y::Dimension::Width, y::StyleSizeLength::percent(percent));
          const auto result = evaluateNativeScratchYoga(input, constraints(width, scale), 2, {stage});
          near(result[0].frame[2], std::round(width * percent / 100 * scale) / scale, "native percent/pixel rounding");
        }
      }
    }
    style = input.children[0].style;
    style.setPadding(y::Edge::Left, y::StyleLength::points(11));
    style.setPadding(y::Edge::Top, y::StyleLength::points(3));
    style.setPadding(y::Edge::Right, y::StyleLength::points(7));
    style.setPadding(y::Edge::Bottom, y::StyleLength::points(5));
    style.setBorder(y::Edge::All, y::StyleLength::points(2));
    const auto bordered = evaluateNativeScratchYoga(input, constraints(), 2, {style})[0];
    near(bordered.frame[2], 120, "border-box width");
    constexpr float paddingValues[]{11, 3, 7, 5};
    for (size_t i = 0; i < 4; i++) {
      near(bordered.border[i], 2, "actual edge border");
      near(bordered.padding[i], paddingValues[i], "actual edge padding");
    }
    const auto unbounded = evaluateNativeScratchYoga(input, TNativeScratchConstraints{}, 2, {input.children[0].style});
    near(unbounded[0].frame[2], 120, "unbounded root preserves point dimension");
    auto natural = input.children[0].style;
    natural.setDimension(y::Dimension::Width, y::StyleSizeLength::ofAuto());
    near(evaluateNativeScratchYoga(input, TNativeScratchConstraints{}, 2, {natural})[0].frame[2], 240, "unbounded root measures natural width");
    auto unboundedHeight = constraints();
    unboundedHeight.minimumHeight = 0;
    unboundedHeight.maximumHeight = std::numeric_limits<float>::infinity();
    near(evaluateNativeScratchYoga(input, unboundedHeight, 2, {input.children[0].style})[0].frame[3], 40, "unbounded height preserves point dimension");
    auto intrinsic = tree();
    intrinsic.children[0].children.clear();
    intrinsic.children[0].style.setDimension(y::Dimension::Width, y::StyleSizeLength::ofAuto());
    intrinsic.children[0].style.setDimension(y::Dimension::Height, y::StyleSizeLength::ofAuto());
    int calls = 0;
    intrinsic.children[0].measure = [&](float, YGMeasureMode, float, YGMeasureMode, YGDirection) { calls++; return YGSize{137, 23}; };
    const auto measured = evaluateNativeScratchYoga(intrinsic, constraints(), 2, {intrinsic.children[0].style})[0];
    require(calls > 0, "owned intrinsic callback invoked");
    near(measured.frame[2], 137, "intrinsic width");
    near(measured.frame[3], 23, "intrinsic height");
    intrinsic.children[0].measure = [](float, YGMeasureMode, float, YGMeasureMode, YGDirection) -> YGSize { throw std::runtime_error("intrinsic retired"); };
    rejects([&] { evaluateNativeScratchYoga(intrinsic, constraints(), 2, {intrinsic.children[0].style}); }, "intrinsic retired");
    intrinsic.children[0].measure = [](float, YGMeasureMode, float, YGMeasureMode, YGDirection) { return YGSize{NAN, -1}; };
    rejects([&] { evaluateNativeScratchYoga(intrinsic, constraints(), 2, {intrinsic.children[0].style}); }, "invalid intrinsic measurement");
    auto directed = intrinsic;
    std::vector<YGDirection> observedDirections;
    directed.children[0].measure = [&](float, YGMeasureMode, float, YGMeasureMode, YGDirection direction) {
      observedDirections.push_back(direction); return YGSize{137, 23};
    };
    auto ltr = constraints(), rightToLeft = ltr; rightToLeft.direction = YGDirectionRTL;
    evaluateNativeScratchYoga(directed, ltr, 2, {directed.children[0].style});
    require(!observedDirections.empty() && observedDirections.back() == YGDirectionLTR, "measure receives current LTR direction");
    observedDirections.clear();
    evaluateNativeScratchYoga(directed, rightToLeft, 2, {directed.children[0].style});
    require(!observedDirections.empty() && observedDirections.back() == YGDirectionRTL, "measure receives current RTL direction");
    auto firstStage = intrinsic;
    firstStage.children[0].measure = [](float, YGMeasureMode, float, YGMeasureMode, YGDirection) { return YGSize{41, 17}; };
    firstStage.children[0].style.setMargin(y::Edge::Left, y::StyleLength::points(5));
    auto secondStage = firstStage;
    secondStage.children[0].measure = [](float, YGMeasureMode, float, YGMeasureMode, YGDirection) { return YGSize{137, 29}; };
    secondStage.children[0].formsContainingBlock = true;
    const auto complete = evaluateNativeScratchStages({{firstStage, ltr}, {secondStage, rightToLeft}}, 2);
    require(complete.size() == 2 && complete[0].size() == 2 && complete[1].size() == 2, "complete independent stage trees returned");
    require(complete[0][0].tag == 1 && complete[0][0].parentTag == 0, "root identity and no parent retained");
    require(complete[0][1].tag == 2 && complete[0][1].parentTag == 1, "target parent retained");
    near(complete[0][1].layout.frame[2], 41, "first stage intrinsic authority");
    near(complete[1][1].layout.frame[2], 137, "second stage intrinsic authority");
    near(complete[0][1].layout.frame[3], 17, "first stage intrinsic height");
    near(complete[1][1].layout.frame[3], 29, "second stage intrinsic height");
    near(complete[0][1].layout.margin[0], 5, "evaluated physical margin retained");
    require(complete[0][1].layout.direction == YGDirectionLTR && complete[1][1].layout.direction == YGDirectionRTL, "each stage retains actual Yoga direction");
    require(!complete[0][1].formsContainingBlock && complete[1][1].formsContainingBlock, "containing-block state belongs to each stage");
    near(firstStage.children[0].measure(0, YGMeasureModeUndefined, 0, YGMeasureModeUndefined, YGDirectionLTR).width, 41, "first input callback unchanged");
    auto fixedUnknown = tree(); fixedUnknown.children[0].children.clear();
    fixedUnknown.children[0].measure = [](float, YGMeasureMode, float, YGMeasureMode, YGDirection) -> YGSize { throw std::runtime_error("unsupported intrinsic"); };
    near(evaluateNativeScratchStages({{fixedUnknown, ltr}}, 2)[0][1].layout.frame[2], 120, "fixed measured leaf needs no fabricated intrinsic");
    fixedUnknown.children[0].style.setDimension(y::Dimension::Width, y::StyleSizeLength::ofAuto());
    rejects([&] { evaluateNativeScratchStages({{fixedUnknown, ltr}}, 2); }, "unsupported intrinsic");
    auto duplicate = tree(); duplicate.children[0].children[0].tag = 2;
    rejects([&] { evaluateNativeScratchYoga(duplicate, constraints(), 2, {style}); }, "duplicate scratch tag");
    auto invalid = constraints(); invalid.pointScaleFactor = 0;
    rejects([&] { evaluateNativeScratchYoga(input, invalid, 2, {style}); }, "invalid actual layout constraints");
    rejects([&] { evaluateNativeScratchYoga(input, constraints(), 99, {style}); }, "scratch target unavailable");
    auto coupled = tree();
    coupled.children[0].children.clear();
    coupled.children[0].measure = [](float width, YGMeasureMode mode, float, YGMeasureMode, YGDirection) {
      const auto resolved = mode == YGMeasureModeUndefined ? 240 : std::min(width, 240.0f);
      return YGSize{resolved, resolved / 2 + 20};
    };
    auto autoSize = coupled.children[0].style;
    autoSize.setDimension(y::Dimension::Width, y::StyleSizeLength::ofAuto());
    autoSize.setDimension(y::Dimension::Height, y::StyleSizeLength::ofAuto());
    auto percentSize = autoSize;
    percentSize.setDimension(y::Dimension::Width, y::StyleSizeLength::percent(50));
    auto both = evaluateNativeScratchYoga(coupled, constraints(), 2, {autoSize, percentSize});
    near(both[0].frame[2], 240, "coupled auto width");
    near(both[0].frame[3], 140, "coupled auto height");
    near(both[1].frame[2], 200, "coupled percent width");
    near(both[1].frame[3], 120, "coupled remeasured height");
    auto logical = input.children[0].style;
    logical.setMargin(y::Edge::Start, y::StyleLength::points(12));
    near(evaluateNativeScratchYoga(input, constraints(), 2, {logical})[0].frame[0], 12, "LTR start margin");
    auto rtl = constraints(); rtl.direction = YGDirectionRTL;
    near(evaluateNativeScratchYoga(input, rtl, 2, {logical})[0].frame[0], 268, "RTL start margin");
    auto baselineTree = tree();
    baselineTree.style.setFlexDirection(y::FlexDirection::Row);
    baselineTree.style.setAlignItems(y::Align::Baseline);
    baselineTree.children[0].children.clear();
    baselineTree.children[0].baseline = [](float, float, const auto &, const auto &, YGDirection) { return 10.0f; };
    auto next = baselineTree.children[0]; next.tag = 4;
    next.baseline = [](float, float, const auto &, const auto &, YGDirection) { return 3.0f; };
    baselineTree.children.push_back(next);
    near(evaluateNativeScratchYoga(baselineTree, constraints(), 4, {next.style})[0].frame[1], 7, "owned baseline alignment");
    baselineTree.children[1].baseline = [](float, float, const auto &, const auto &, YGDirection) -> float { throw std::runtime_error("baseline retired"); };
    rejects([&] { evaluateNativeScratchYoga(baselineTree, constraints(), 4, {next.style}); }, "baseline retired");
    for (int i = 0; i < 200; i++) {
      near(evaluateNativeScratchYoga(input, constraints(), 2, {input.children[0].style})[0].frame[2], 120, "repeat allocation/retirement");
    }
    require(allocations > 0 && allocations == retirements, "all Yoga allocations retired on success/error");
    y::Event::reset();
    std::cout << "PASS " << assertions << " scratch Yoga assertions; " << allocations << " allocations and " << retirements << " retirements; actual pinned Yoga, synthetic input trees/intrinsic callbacks; no mounted native proof\n";
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n'; return 1;
  }
}
