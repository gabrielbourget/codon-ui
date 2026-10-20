#include "GeometryQuery.h"
#include "NativeStyle.h"
#include "NativeMeasuredEdges.h"

#include <folly/json.h>
#include <react/renderer/components/CodonNativeInputSpec/Props.h>
#include <react/renderer/components/scrollview/ScrollViewState.h>
#include <react/renderer/core/ConcreteState.h>
#include <react/renderer/core/LayoutableShadowNode.h>
#include <react/renderer/core/RawProps.h>
#include <react/renderer/core/ShadowNodeFamily.h>
#include <chrono>
#include <cmath>
#include <mutex>
#include <unordered_map>
#include <unordered_set>

namespace codon::motion {
using namespace facebook::react;
namespace {
struct TObserved {
  std::shared_ptr<const ShadowNode> node;
  folly::dynamic imperative;
  Props::Shared props;
};
folly::dynamic nativeProps(const ShadowNodeFamily &family) {
  std::lock_guard lock(family.nativePropsMutex);
  return family.nativeProps_DEPRECATED ? *family.nativeProps_DEPRECATED : folly::dynamic::object();
}
double finite(double value) {
  if (!std::isfinite(value)) throw std::runtime_error("Native motion layout: non-finite evaluated metric");
  return value;
}
folly::dynamic array(const std::array<float, 4> &values) {
  return folly::dynamic::array(finite(values[0]), finite(values[1]), finite(values[2]), finite(values[3]));
}
LayoutMetrics metrics(const TNativeScratchNodeMeasurement &node) {
  LayoutMetrics result;
  result.frame = {{node.layout.frame[0], node.layout.frame[1]}, {node.layout.frame[2], node.layout.frame[3]}};
  result.borderWidth = {node.layout.border[1], node.layout.border[0], node.layout.border[3], node.layout.border[2]};
  result.contentInsets = {node.layout.padding[1] + node.layout.border[1], node.layout.padding[0] + node.layout.border[0],
      node.layout.padding[3] + node.layout.border[3], node.layout.padding[2] + node.layout.border[2]};
  result.layoutDirection = node.layout.direction == YGDirectionRTL ? LayoutDirection::RightToLeft : LayoutDirection::LeftToRight;
  return result;
}
using TLayouts = std::unordered_map<int, const TNativeScratchNodeMeasurement *>;
using TNodes = std::unordered_map<int, TObserved>;
const TNativeScratchNodeMeasurement &layoutFor(int tag, const TLayouts &layouts) {
  const auto found = layouts.find(tag);
  if (tag <= 0 || found == layouts.end())
    throw std::runtime_error("Native motion layout: evaluated ancestor unavailable");
  return *found->second;
}
const TObserved &nodeFor(int tag, const TNodes &nodes) {
  const auto found = nodes.find(tag);
  if (tag <= 0 || found == nodes.end())
    throw std::runtime_error("Native motion layout: immutable ancestor unavailable");
  return found->second;
}
int positionedParent(int target, const TLayouts &layouts, const TNodes &nodes) {
  auto parent = layoutFor(target, layouts).parentTag;
  std::unordered_set<int> visited;
  while (parent) {
    if (!visited.insert(parent).second)
      throw std::runtime_error("Native motion layout: cyclic positioned ancestry");
    const auto &layout = layoutFor(parent, layouts);
    const auto &node = nodeFor(parent, nodes);
    if (layout.display == YGDisplayNone)
      throw std::runtime_error("Native motion layout: positioned ancestor is not displayed");
    if (node.node->getTraits().check(ShadowNodeTraits::RootNodeKind) ||
        layout.positionType != YGPositionTypeStatic || layout.formsContainingBlock) return parent;
    parent = layout.parentTag;
  }
  throw std::runtime_error("Native motion layout: positioned native ancestor unavailable");
}
Transform transform(const TObserved &node, const TNativeScratchNodeMeasurement &layout) {
  if (node.node->getTraits().check(ShadowNodeTraits::RootNodeKind))
    return static_cast<const LayoutableShadowNode &>(*node.node).getTransform();
  if (const auto *props = dynamic_cast<const ViewProps *>(node.props.get()))
    return BaseViewProps::resolveTransform(metrics(layout).frame.size, props->transform, props->transformOrigin);
  const auto *source = dynamic_cast<const LayoutableShadowNode *>(node.node.get());
  if (!source) throw std::runtime_error("Native motion layout: non-layoutable stage ancestor");
  if (source->getLayoutMetrics().frame.size != metrics(layout).frame.size)
    throw std::runtime_error("Native motion layout: custom stage transform authority unavailable");
  return source->getTransform();
}
facebook::react::Rect rootBox(int target, const TLayouts &layouts, const TNodes &nodes, bool transforms) {
  auto result = metrics(layoutFor(target, layouts)).frame;
  result.origin = {0, 0};
  auto tag = target;
  bool first = true;
  std::unordered_set<int> visited;
  while (tag) {
    if (!visited.insert(tag).second) throw std::runtime_error("Native motion layout: cyclic evaluated ancestry");
    const auto &layout = layoutFor(tag, layouts);
    const auto &observed = nodeFor(tag, nodes);
    const bool root = observed.node->getTraits().check(ShadowNodeTraits::RootNodeKind);
    if (!root && !layout.parentTag) throw std::runtime_error("Native motion layout: evaluated root unavailable");
    if (layout.display == YGDisplayNone)
      throw std::runtime_error("Native motion layout: evaluated target is not displayed");
    auto frame = metrics(layout).frame;
    if (root) frame.origin = {0, 0};
    result.origin += frame.origin;
    if (transforms) {
      const auto currentTransform = transform(observed, layout);
      result = currentTransform.applyWithCenter(result, frame.getCenter());
      if (!first && std::string_view(observed.node->getComponentName()) == "ScrollView") {
        if (!observed.node->getState()) throw std::runtime_error("Native motion layout: actual scroll state unavailable");
        const auto &state = static_cast<const ConcreteState<ScrollViewState> &>(*observed.node->getState()).getData();
        const auto offset = currentTransform * Vector{.x = -state.contentOffset.x, .y = -state.contentOffset.y, .z = 0, .w = 1};
        result.origin += facebook::react::Point{offset.x, offset.y + static_cast<Float>(state.scrollAwayPaddingTop)};
      }
    }
    first = false;
    tag = root ? 0 : layout.parentTag;
  }
  finite(result.origin.x); finite(result.origin.y); finite(result.size.width); finite(result.size.height);
  return result;
}
facebook::yoga::StyleLength selectedPosition(const facebook::yoga::Style &style,
    bool horizontal, bool trailing, bool rightToLeft) {
  using facebook::yoga::Edge;
  // Pinned Style.h computeLeft/Top/Right/BottomEdge precedence, using only
  // public position getters. Avoid computePosition's unexported fatal branch.
  if (horizontal) {
    const auto logical = style.position(trailing != rightToLeft ? Edge::End : Edge::Start);
    if (logical.isDefined()) return logical;
  }
  const auto physical = style.position(horizontal ? (trailing ? Edge::Right : Edge::Left) :
      (trailing ? Edge::Bottom : Edge::Top));
  if (physical.isDefined()) return physical;
  const auto axis = style.position(horizontal ? Edge::Horizontal : Edge::Vertical);
  return axis.isDefined() ? axis : style.position(Edge::All);
}
double leadingInset(bool horizontal, int target, const TLayouts &layouts,
    const TNodes &nodes, bool swapLeftAndRight) {
  const auto &record = layoutFor(target, layouts);
  const auto *props = dynamic_cast<const ViewProps *>(nodeFor(target, nodes).props.get());
  if (!props) throw std::runtime_error("Native motion layout: actual inset props unavailable");
  if (record.positionType == YGPositionTypeStatic)
    throw std::runtime_error("Native motion layout: static computed inset unavailable");
  const auto parent = positionedParent(target, layouts, nodes);
  const auto &parentLayout = layoutFor(parent, layouts).layout;
  const auto leading = horizontal ? 0 : 1;
  if (record.positionType == YGPositionTypeAbsolute) {
    const auto childBox = rootBox(target, layouts, nodes, false);
    const auto parentBox = rootBox(parent, layouts, nodes, false);
    const auto distance = horizontal ? childBox.origin.x - parentBox.origin.x : childBox.origin.y - parentBox.origin.y;
    // Computed CSS insets exclude margins; native border-box frame offsets include them.
    return finite(distance - parentLayout.border[leading] - record.layout.margin[leading]);
  }
  // A relative node's flow position is not its computed inset. Resolve its
  // physical leading property against its immediate parent's content box.
  const auto &flowParent = layoutFor(record.parentTag, layouts).layout;
  const auto axisSize = flowParent.frame[leading + 2] - flowParent.border[leading] - flowParent.border[leading + 2] -
      flowParent.padding[leading] - flowParent.padding[leading + 2];
  const auto style = copyNativeYogaStyle(*props, swapLeftAndRight);
  if (record.layout.direction != YGDirectionLTR && record.layout.direction != YGDirectionRTL)
    throw std::runtime_error("Native motion layout: resolved inset direction unavailable");
  const bool rightToLeft = record.layout.direction == YGDirectionRTL;
  auto leadingValue = selectedPosition(style, horizontal, false, rightToLeft);
  if (leadingValue.isDefined() && !leadingValue.isAuto())
    return finite(leadingValue.resolve(axisSize).unwrapOrDefault(0));
  auto trailingValue = selectedPosition(style, horizontal, true, rightToLeft);
  if (trailingValue.isDefined() && !trailingValue.isAuto())
    return finite(-trailingValue.resolve(axisSize).unwrapOrDefault(0));
  throw std::runtime_error("Native motion layout: auto relative computed inset unavailable");
}
folly::dynamic metric(const std::string &name, int target, const TLayouts &layouts, const TNodes &nodes,
                      const TNativeInitialColorReader &readColor, bool swapLeftAndRight, bool swapLeftAndRightInRTL) {
  const auto &record = layoutFor(target, layouts);
  auto layout = metrics(record);
  // RN configures the whole Yoga tree from root constraints, but reports the
  // child layout flag from that child's resolved direction after layout.
  layout.wasLeftAndRightSwapped = swapLeftAndRightInRTL && layout.layoutDirection == LayoutDirection::RightToLeft;
  const auto &props = static_cast<const ViewProps &>(*nodes.at(target).props);
  if (const auto selected = nativeMeasuredEdgeSelection(name, "margin", "",
      layout.layoutDirection == LayoutDirection::RightToLeft, layout.wasLeftAndRightSwapped)) {
    const auto style = copyNativeYogaStyle(props, swapLeftAndRight);
    constexpr facebook::yoga::Edge edges[]{facebook::yoga::Edge::Left, facebook::yoga::Edge::Top,
        facebook::yoga::Edge::Right, facebook::yoga::Edge::Bottom};
    for (size_t index = 0; index < selected->size(); index++) {
      if (!(*selected)[index]) continue;
      const bool horizontal = index == 0 || index == 2;
      auto value = style.margin(edges[index]);
      if (horizontal) {
        const auto logical = style.margin((index == 2) != (layout.layoutDirection == LayoutDirection::RightToLeft)
            ? facebook::yoga::Edge::End : facebook::yoga::Edge::Start);
        if (logical.isDefined()) value = logical;
      }
      if (value.isUndefined()) value = style.margin(horizontal ? facebook::yoga::Edge::Horizontal : facebook::yoga::Edge::Vertical);
      if (value.isUndefined()) value = style.margin(facebook::yoga::Edge::All);
      if (value.isAuto()) throw std::runtime_error("Native motion layout: distributed auto margin authority unavailable");
    }
    return nativeMeasuredEdgeValue(record.layout.margin, *selected);
  }
  if (name == "width" || name == "height") {
    const auto box = rootBox(target, layouts, nodes, true);
    const bool width = name == "width";
    auto value = width ? box.size.width : box.size.height;
    if (props.yogaStyle.boxSizing() == facebook::yoga::BoxSizing::ContentBox) {
      const auto index = width ? 0 : 1;
      // Pinned positionalValues subtracts only computed padding, retaining borders.
      value -= record.layout.padding[index] + record.layout.padding[index + 2];
    }
    return finite(value);
  }
  if (name == "left" || name == "right" || name == "top" || name == "bottom" || name == "start" || name == "end" ||
      name == "insetInlineStart" || name == "insetInlineEnd" || name == "insetBlockStart" || name == "insetBlockEnd") {
    const bool horizontal = name != "top" && name != "bottom" && name != "insetBlockStart" && name != "insetBlockEnd";
    const auto leading = leadingInset(horizontal, target, layouts, nodes, swapLeftAndRight);
    const bool rtl = layout.layoutDirection == LayoutDirection::RightToLeft;
    const bool trailing = name == "right" || name == "bottom" || name == "insetBlockEnd" ||
        ((name == "start" || name == "insetInlineStart") && rtl) ||
        ((name == "end" || name == "insetInlineEnd") && !rtl);
    if (!trailing) return finite(leading);
    const auto visualBox = rootBox(target, layouts, nodes, true);
    // Motion's right/bottom are leading inset plus viewport span, not Yoga's trailing inset.
    return finite(leading + (horizontal ? visualBox.size.width : visualBox.size.height));
  }
  if (name == "transform") {
    const auto value = readNativeInitialViewValue(props, layout, "transformMatrix", readColor);
    return folly::dynamic::array(folly::dynamic::object("matrix", value));
  }
  return readNativeInitialViewValue(props, layout, name, readColor);
}
} // namespace

std::string queryNativeEvaluatedLayout(
    const UIManager &manager, int target, const std::string &owner, const std::string &binding,
    const std::string &revision, const std::string &encoded,
    const TNativeGeometryIntrinsicFactory &intrinsicFactory, const TNativeInitialColorReader &readColor,
    const TNativeScratchPropsResolver &authoredProps) {
  if (target <= 0 || owner.empty() || binding.empty() || !intrinsicFactory)
    throw std::invalid_argument("Native motion layout: actual owner and intrinsic factory required");
  const auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(5000);
  const auto check = [&] {
    if (std::chrono::steady_clock::now() >= deadline) throw std::runtime_error("Native motion layout: evaluated query exceeded 5000ms");
  };
  const auto request = folly::parseJson(encoded);
  const auto &properties = request.at("properties");
  const auto &requestedStages = request.at("stages");
  if (!properties.isArray() || properties.empty() || !requestedStages.isArray() || requestedStages.empty())
    throw std::invalid_argument("Native motion layout: ordered stages and properties required");
  std::unordered_set<std::string> names;
  for (const auto &name : properties) {
    if (!name.isString() || name.asString().empty() || !names.insert(name.asString()).second)
      throw std::invalid_argument("Native motion layout: unique property names required");
  }
  const auto candidate = manager.findShadowNodeByTag_DEPRECATED(target);
  if (!candidate) throw std::runtime_error("Native motion layout: actual Fabric owner unavailable");
  const auto family = candidate->getFamilyShared();
  const auto owns = [&](const ShadowNode &node) {
    if (node.getFamilyShared() != family || std::string_view(node.getComponentName()) != "CUIFocusView") return false;
    const auto &props = static_cast<const CUIFocusViewProps &>(*node.getProps());
    return props.ownerId == owner && props.nativeMotionGeometryBinding == binding && props.nativeMotionGeometryRevision == revision;
  };
  const auto snapshot = captureNativeFabricSnapshot(manager, candidate->getSurfaceId(), target, owns, check);
  TNodes observed;
  std::vector<std::shared_ptr<const ShadowNode>> pending{snapshot.root};
  while (!pending.empty()) {
    check(); auto node = pending.back(); pending.pop_back();
    auto native = nativeProps(node->getFamily());
    auto actual = authoredProps ? authoredProps(*node) : node->getProps();
    if (!actual) throw std::runtime_error("Native motion layout: actual authored props unavailable");
    if (!native.empty()) actual = node->getComponentDescriptor().cloneProps(
        {node->getSurfaceId(), *node->getContextContainer()}, actual, RawProps(native));
    if (!observed.emplace(node->getTag(), TObserved{node, std::move(native), std::move(actual)}).second)
      throw std::runtime_error("Native motion layout: duplicate actual Fabric tag");
    for (const auto &child : node->getChildren()) pending.push_back(child);
  }
  folly::dynamic results = folly::dynamic::array();
  for (size_t index = 0; index < requestedStages.size(); index++) {
    check(); const auto &stage = requestedStages[index];
    if (!stage.at("index").isInt() || stage.at("index").asInt() != static_cast<int64_t>(index) || !stage.at("nativeView").isObject())
      throw std::invalid_argument("Native motion layout: invalid ordered native stage");
    auto selected = observed;
    selected.at(target).props = snapshot.target->getComponentDescriptor().cloneProps(
        {snapshot.target->getSurfaceId(), *snapshot.target->getContextContainer()}, observed.at(target).props, RawProps(stage.at("nativeView")));
    TNativeScratchPropsResolver propsForNode = [&](const ShadowNode &node) { check(); return selected.at(node.getTag()).props; };
    const auto intrinsic = intrinsicFactory(snapshot, propsForNode, check);
    const auto input = createNativeScratchInput(snapshot, intrinsic, propsForNode, check);
    auto layouts = evaluateNativeScratchStages({{input.root, input.constraints}}, target).front();
    for (auto &layout : layouts) {
      const auto name = std::string_view(selected.at(layout.tag).node->getComponentName());
      if (layout.layout.direction != YGDirectionRTL) continue;
#if defined(__ANDROID__)
      if (name == "AndroidHorizontalScrollContentView" && layout.layout.frame[0] < 0)
        layout.layout.frame[0] = 0;
#else
      if (name == "ScrollView")
        for (auto &child : layouts) if (child.parentTag == layout.tag) child.layout.frame[0] = 0;
#endif
    }
    TLayouts byTag;
    for (const auto &layout : layouts) byTag.emplace(layout.tag, &layout);
    folly::dynamic values = folly::dynamic::object();
    for (const auto &name : names) { check(); values[name] = metric(name, target, byTag, selected, readColor,
        snapshot.context.swapLeftAndRightInRTL && snapshot.constraints.layoutDirection == LayoutDirection::RightToLeft,
        snapshot.context.swapLeftAndRightInRTL); }
    const auto &layout = byTag.at(target)->layout;
    results.push_back(folly::dynamic::object("index", static_cast<int64_t>(index))("metrics", std::move(values))
        ("evaluatedFrame", array(layout.frame))("evaluatedBorder", array(layout.border))
        ("evaluatedPadding", array(layout.padding))("evaluatedMargin", array(layout.margin)));
  }
  for (const auto &[tag, value] : observed) {
    check();
    if (nativeProps(value.node->getFamily()) != value.imperative)
      throw std::runtime_error("Native motion layout: imperative input retired");
  }
  if (!isNativeFabricSnapshotCurrent(manager, snapshot, owns))
    throw std::runtime_error("Native motion layout: Fabric input retired");
  return folly::toJson(folly::dynamic::object("kind", "evaluated-layout")("surfaceId", candidate->getSurfaceId())
      ("fabricRevision", std::to_string(snapshot.revision))("results", std::move(results)));
}

} // namespace codon::motion
