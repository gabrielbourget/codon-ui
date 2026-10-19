#include "ScratchYoga.h"

#include <yoga/node/Node.h>
#include <cmath>
#include <exception>
#include <memory>
#include <stdexcept>
#include <unordered_map>

namespace codon::motion {
namespace yoga = facebook::yoga;
namespace {

struct TEntry {
  YGConfigRef config;
  YGNodeRef node;
  const TNativeScratchNode &input;
  std::exception_ptr &failure;
  TEntry(const TNativeScratchNode &source, std::exception_ptr &error)
      : config(YGConfigNew()), node(nullptr), input(source), failure(error) {}
  TEntry(const TEntry &) = delete;
  TEntry &operator=(const TEntry &) = delete;
  ~TEntry() {
    if (node) YGNodeFree(node);
    YGConfigFree(config);
  }
};

class TNodeArena {
 public:
  std::exception_ptr failure;
  std::unordered_map<int, YGNodeRef> tags;
  std::vector<std::unique_ptr<TEntry>> nodes;
  ~TNodeArena() {
    // Detach all ownership while every independently allocated node is alive.
    for (const auto &entry : nodes) YGNodeRemoveAllChildren(entry->node);
  }

  YGNodeRef append(const TNativeScratchNode &input,
                   const TNativeScratchConstraints &constraints,
                   int target, const yoga::Style &stage) {
    if (tags.contains(input.tag))
      throw std::invalid_argument("Native motion: duplicate scratch tag");
    if (input.measure && !input.children.empty())
      throw std::invalid_argument("Native motion: measured scratch leaf has children");
    auto entry = std::make_unique<TEntry>(input, failure);
    YGConfigSetErrata(entry->config, input.errata);
    YGConfigSetPointScaleFactor(entry->config, constraints.pointScaleFactor);
    YGConfigSetExperimentalFeatureEnabled(
        entry->config, YGExperimentalFeatureFixFlexBasisFitContent,
        constraints.fixFlexBasisFitContent);
    entry->node = YGNodeNewWithConfig(entry->config);
    const auto node = entry->node;
    static_cast<yoga::Node *>(node)->setStyle(input.tag == target ? stage : input.style);
    YGNodeSetAlwaysFormsContainingBlock(node, input.formsContainingBlock);
    YGNodeSetContext(node, entry.get());
    if (input.measure) YGNodeSetMeasureFunc(node, measure);
    if (input.baseline) YGNodeSetBaselineFunc(node, baseline);
    tags.emplace(input.tag, node);
    nodes.push_back(std::move(entry));
    for (const auto &child : input.children) {
      const auto childNode = append(child, constraints, target, stage);
      YGNodeInsertChild(node, childNode, YGNodeGetChildCount(node));
    }
    return node;
  }

 private:
  static YGSize measure(YGNodeConstRef node, float width, YGMeasureMode widthMode,
                        float height, YGMeasureMode heightMode) {
    auto &entry = *static_cast<TEntry *>(YGNodeGetContext(node));
    if (entry.failure) return {0, 0};
    try {
      const auto size = entry.input.measure(width, widthMode, height, heightMode, YGNodeLayoutGetDirection(node));
      if (!std::isfinite(size.width) || !std::isfinite(size.height) ||
          size.width < 0 || size.height < 0)
        throw std::runtime_error("Native motion: invalid intrinsic measurement");
      return size;
    } catch (...) {
      entry.failure = std::current_exception();
      return {0, 0};
    }
  }

  static float baseline(YGNodeConstRef node, float width, float height) {
    auto &entry = *static_cast<TEntry *>(YGNodeGetContext(node));
    if (entry.failure) return 0;
    try {
      std::array<float, 4> border{}, padding{};
      constexpr YGEdge edges[]{YGEdgeLeft, YGEdgeTop, YGEdgeRight, YGEdgeBottom};
      for (size_t index = 0; index < 4; index++) {
        border[index] = YGNodeLayoutGetBorder(node, edges[index]);
        padding[index] = YGNodeLayoutGetPadding(node, edges[index]);
      }
      const auto value = entry.input.baseline(width, height, border, padding, YGNodeLayoutGetDirection(node));
      if (!std::isfinite(value))
        throw std::runtime_error("Native motion: invalid intrinsic baseline");
      return value;
    } catch (...) {
      entry.failure = std::current_exception();
      return 0;
    }
  }
};

void validate(const TNativeScratchConstraints &constraints) {
  const auto axis = [](float minimum, float maximum) {
    return std::isfinite(minimum) && minimum >= 0 &&
        !std::isnan(maximum) && maximum >= minimum;
  };
  if (!axis(constraints.minimumWidth, constraints.maximumWidth) ||
      !axis(constraints.minimumHeight, constraints.maximumHeight) ||
      !std::isfinite(constraints.pointScaleFactor) || constraints.pointScaleFactor <= 0)
    throw std::invalid_argument("Native motion: invalid actual layout constraints");
}

} // namespace

std::vector<TNativeScratchMeasurement> evaluateNativeScratchYoga(
    const TNativeScratchNode &input, const TNativeScratchConstraints &constraints,
    int target, const std::vector<yoga::Style> &stages) {
  validate(constraints);
  std::vector<TNativeScratchMeasurement> results;
  for (const auto &stage : stages) {
    TNodeArena arena;
    const auto root = arena.append(input, constraints, target, stage);
    if (!arena.tags.contains(target))
      throw std::invalid_argument("Native motion: scratch target unavailable");
    auto &rootStyle = static_cast<yoga::Node *>(root)->style();
    rootStyle.setMinDimension(yoga::Dimension::Width,
                             yoga::StyleSizeLength::points(constraints.minimumWidth));
    rootStyle.setMinDimension(yoga::Dimension::Height,
                             yoga::StyleSizeLength::points(constraints.minimumHeight));
    rootStyle.setMaxDimension(yoga::Dimension::Width,
                             yoga::StyleSizeLength::points(constraints.maximumWidth));
    rootStyle.setMaxDimension(yoga::Dimension::Height,
                             yoga::StyleSizeLength::points(constraints.maximumHeight));
    YGNodeCalculateLayout(root,
        std::isfinite(constraints.maximumWidth) ? constraints.maximumWidth : YGUndefined,
        std::isfinite(constraints.maximumHeight) ? constraints.maximumHeight : YGUndefined,
        constraints.direction);
    if (arena.failure) std::rethrow_exception(arena.failure);
    const auto node = arena.tags.at(target);
    TNativeScratchMeasurement result{
        {YGNodeLayoutGetLeft(node), YGNodeLayoutGetTop(node),
         YGNodeLayoutGetWidth(node), YGNodeLayoutGetHeight(node)}, {}, {}};
    constexpr YGEdge edges[]{YGEdgeLeft, YGEdgeTop, YGEdgeRight, YGEdgeBottom};
    for (size_t index = 0; index < 4; index++) {
      result.border[index] = YGNodeLayoutGetBorder(node, edges[index]);
      result.padding[index] = YGNodeLayoutGetPadding(node, edges[index]);
      if (!std::isfinite(result.frame[index]) ||
          !std::isfinite(result.border[index]) || !std::isfinite(result.padding[index]))
        throw std::runtime_error("Native motion: non-finite scratch result");
    }
    results.push_back(result);
  }
  return results;
}

} // namespace codon::motion
