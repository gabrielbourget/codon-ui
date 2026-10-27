#include "NativeOverlayLayout.h"
#include "OwnedYogaLayout.h"

#include <react/renderer/components/view/ViewShadowNode.h>
#include <react/renderer/components/view/conversions.h>
#include <react/renderer/core/LayoutConstraints.h>
#include <react/renderer/core/LayoutContext.h>
#include <yoga/Yoga.h>
#include <algorithm>
#include <cmath>
#include <stdexcept>

namespace facebook::react {
namespace {

bool isFlowBody(const CUIOverlayHostProps &props) {
  return props.panelPosition == CUIOverlayHostPanelPosition::Relative || props.panelPosition == CUIOverlayHostPanelPosition::Static;
}

ShadowNodeFragment withoutChildren(const ShadowNodeFragment &fragment) {
  static const auto empty = ShadowNode::emptySharedShadowNodeSharedList();
  return {.props = fragment.props, .children = empty, .state = fragment.state,
      .runtimeShadowNodeReference = fragment.runtimeShadowNodeReference};
}

LayoutConstraints constraintsFor(Size size, LayoutDirection direction) {
  if (!std::isfinite(size.width) || !std::isfinite(size.height) || size.width < 0 || size.height < 0)
    throw std::runtime_error("Panel overlay requires an actual finite native window layout");
  return {.maximumSize = size, .layoutDirection = direction};
}

void publishRoot(LayoutContext context, LayoutableShadowNode &node) {
  if (context.affectedNodes) context.affectedNodes->push_back(&node);
}

template <typename T>
std::shared_ptr<T> cloneOwnedProps(const ShadowNode &node) {
  const auto context = node.getContextContainer();
  if (!context) throw std::runtime_error("Panel overlay requires its original Fabric props context");
  auto cloned = node.getComponentDescriptor().cloneProps(
      PropsParserContext(node.getSurfaceId(), *context), node.getProps(), RawProps{});
  if (cloned == node.getProps()) throw std::runtime_error("Panel layout must not mutate shared original props");
  auto typed = std::dynamic_pointer_cast<const T>(cloned);
  if (!typed) throw std::runtime_error("Panel overlay lost its original props type");
  auto result = std::const_pointer_cast<T>(typed);
  result->ensureUnsealed();
  return result;
}

void resolveOwnedRoot(yoga::Node &node, yoga::Config &config, Size containingBlock, LayoutDirection direction) {
  codon::overlay::layoutOwnedOverlayRoot(node, config, containingBlock.width, containingBlock.height,
      static_cast<yoga::Direction>(yogaDirectionFromLayoutDirection(direction)));
}

void applyRootMetrics(YogaLayoutableShadowNode &owner, yoga::Node &node, LayoutContext context) {
  auto metrics = layoutMetricsFromYogaNode(node);
  metrics.pointScaleFactor = context.pointScaleFactor;
  metrics.wasLeftAndRightSwapped = context.swapLeftAndRightInRTL && metrics.layoutDirection == LayoutDirection::RightToLeft;
  owner.setLayoutMetrics(metrics);
  node.setHasNewLayout(false);
}

std::shared_ptr<CUIOverlaySlotProps> planeProps(const ShadowNode &node, Rect frame, Size containingBlock, LayoutDirection direction) {
  auto result = cloneOwnedProps<CUIOverlaySlotProps>(node);
  auto &style = result->yogaStyle;
  style.setDisplay(yoga::Display::Flex);
  style.setPositionType(yoga::PositionType::Absolute);
  for (auto edge : yoga::ordinals<yoga::Edge>()) {
    style.setPosition(edge, yoga::StyleLength::undefined());
    style.setMargin(edge, yoga::StyleLength::points(0));
  }
  const auto inlineStart = direction == LayoutDirection::RightToLeft
      ? containingBlock.width - frame.origin.x - frame.size.width : frame.origin.x;
  style.setPosition(yoga::Edge::Start, yoga::StyleLength::points(inlineStart));
  style.setPosition(yoga::Edge::Top, yoga::StyleLength::points(frame.origin.y));
  style.setDimension(yoga::Dimension::Width, yoga::StyleSizeLength::points(frame.size.width));
  style.setDimension(yoga::Dimension::Height, yoga::StyleSizeLength::points(frame.size.height));
  return result;
}

void includeInk(Rect &bounds, const LayoutableShadowNode &child) {
  const auto &metrics = child.getLayoutMetrics();
  if (metrics.displayType == DisplayType::None) return;
  bounds.unionInPlace(insetBy(metrics.frame, metrics.overflowInset));
  const auto transform = child.getTransform();
  if (transform != Transform::Identity())
    bounds.unionInPlace(insetBy(metrics.frame * transform, metrics.overflowInset * transform));
}

void publishOverflow(LayoutableShadowNode &owner, const Rect &bounds) {
  auto metrics = owner.getLayoutMetrics();
  metrics.overflowInset = {
      .left = std::min(bounds.getMinX(), Float{0}),
      .top = std::min(bounds.getMinY(), Float{0}),
      .right = -std::max(bounds.getMaxX() - metrics.frame.size.width, Float{0}),
      .bottom = -std::max(bounds.getMaxY() - metrics.frame.size.height, Float{0}),
  };
  owner.setLayoutMetrics(metrics);
}

} // namespace

CUIOwnedOverlayHostShadowNode::CUIOwnedOverlayHostShadowNode(
    const ShadowNodeFragment &fragment, const ShadowNodeFamily::Shared &family, ShadowNodeTraits traits)
    : ConcreteViewShadowNode(withoutChildren(fragment), family, traits) {
  configureChildren(fragment.children ? *fragment.children : std::vector<std::shared_ptr<const ShadowNode>>{});
}

CUIOwnedOverlayHostShadowNode::CUIOwnedOverlayHostShadowNode(const ShadowNode &source, const ShadowNodeFragment &fragment)
    : ConcreteViewShadowNode(source, withoutChildren(fragment)) {
  configureChildren(fragment.children ? *fragment.children : source.getChildren());
}

void CUIOwnedOverlayHostShadowNode::configureChildren(const std::vector<std::shared_ptr<const ShadowNode>> &children) {
  if (isFlowBody(getConcreteProps())) traits_.unset(ShadowNodeTraits::Trait::LeafYogaNode);
  else traits_.set(ShadowNodeTraits::Trait::LeafYogaNode);
  for (const auto &child : children) appendChild(child);
  dirtyLayout();
}

void CUIOwnedOverlayHostShadowNode::prepareFlowChildren(LayoutContext context) {
  const auto children = getChildren();
  if (children.size() != 3) throw std::runtime_error("Panel flow requires its original three owned slots");
  const auto &props = getConcreteProps();
  for (size_t index = 0; index < children.size(); index++) {
    auto slotProps = cloneOwnedProps<CUIOverlaySlotProps>(*children[index]);
    const auto expectedRole = index == 0 ? CUIOverlaySlotSlotRole::Underlay
        : index == 1 ? CUIOverlaySlotSlotRole::Paint : CUIOverlaySlotSlotRole::Body;
    if (slotProps->slotRole != expectedRole) throw std::runtime_error("Panel flow must preserve its original slot roles");
    auto nested = std::make_shared<std::vector<std::shared_ptr<const ShadowNode>>>(children[index]->getChildren());
    if (index == 2) {
      slotProps->yogaStyle.setDisplay(yoga::Display::Contents);
      if (nested->size() != 1 || !dynamic_cast<const CUIFocusViewProps *>(nested->front()->getProps().get()))
        throw std::runtime_error("Panel flow must retain its original focus/drawing body");
      if (props.panelViewportHeight || props.panelViewportWidth) {
        auto bodyProps = cloneOwnedProps<CUIFocusViewProps>(*nested->front());
        if (props.panelViewportHeight)
          bodyProps->yogaStyle.setDimension(yoga::Dimension::Height, yoga::StyleSizeLength::points(context.viewportSize.height));
        if (props.panelViewportWidth)
          bodyProps->yogaStyle.setDimension(yoga::Dimension::Width, yoga::StyleSizeLength::points(
              context.viewportSize.width < 500 ? context.viewportSize.width * Float{0.8} : Float{300}));
        nested->front() = nested->front()->clone({.props = bodyProps});
      }
    } else {
      slotProps->yogaStyle.setDisplay(props.yogaStyle.display() == yoga::Display::Contents ? yoga::Display::None : yoga::Display::Flex);
      slotProps->yogaStyle.setDimension(yoga::Dimension::Width, yoga::StyleSizeLength::ofAuto());
      slotProps->yogaStyle.setDimension(yoga::Dimension::Height, yoga::StyleSizeLength::ofAuto());
    }
    auto child = children[index]->clone({.props = slotProps, .children = nested});
    replaceChild(*children[index], child, index);
  }
}

void CUIOwnedOverlayHostShadowNode::prepareFlowPaintBounds() {
  const auto children = getChildren();
  const auto &metrics = getLayoutMetrics();
  const bool rtl = metrics.layoutDirection == LayoutDirection::RightToLeft;
  for (size_t index = 0; index < 2; index++) {
    auto props = cloneOwnedProps<CUIOverlaySlotProps>(*children[index]);
    auto &style = props->yogaStyle;
    style.setPosition(yoga::Edge::Left, yoga::StyleLength::undefined());
    style.setPosition(yoga::Edge::Right, yoga::StyleLength::undefined());
    style.setPosition(yoga::Edge::Start, yoga::StyleLength::points(-(rtl ? metrics.borderWidth.right : metrics.borderWidth.left)));
    style.setPosition(yoga::Edge::End, yoga::StyleLength::points(-(rtl ? metrics.borderWidth.left : metrics.borderWidth.right)));
    style.setPosition(yoga::Edge::Top, yoga::StyleLength::points(-metrics.borderWidth.top));
    style.setPosition(yoga::Edge::Bottom, yoga::StyleLength::points(-metrics.borderWidth.bottom));
    auto child = children[index]->clone({.props = props});
    replaceChild(*children[index], child, index);
  }
}

ShadowNodeTraits CUIOwnedOverlayViewportShadowNode::BaseTraits() {
  auto traits = ConcreteViewShadowNode::BaseTraits();
  traits.set(ShadowNodeTraits::Trait::LeafYogaNode);
  return traits;
}

ShadowNodeTraits CUIOwnedOverlayHostShadowNode::BaseTraits() {
  auto traits = ConcreteViewShadowNode::BaseTraits();
  traits.set(ShadowNodeTraits::Trait::LeafYogaNode);
  return traits;
}

void CUIOwnedOverlayViewportShadowNode::completeClone(const ShadowNode &source, const ShadowNodeFragment &fragment) {
  YogaLayoutableShadowNode::completeClone(source, fragment);
  if (fragment.children) dirtyLayout();
}

void CUIOwnedOverlayHostShadowNode::completeClone(const ShadowNode &source, const ShadowNodeFragment &fragment) {
  YogaLayoutableShadowNode::completeClone(source, fragment);
  const auto &previous = static_cast<const CUIOwnedOverlayHostShadowNode &>(source).getConcreteProps();
  const auto &next = getConcreteProps();
  if (fragment.children || previous.panelPosition != next.panelPosition ||
      previous.panelViewportHeight != next.panelViewportHeight || previous.panelViewportWidth != next.panelViewportWidth ||
      previous.establishesContainingBlock != next.establishesContainingBlock) dirtyLayout();
}

void CUIOwnedOverlayViewportShadowNode::layout(LayoutContext context) {
  if (getConcreteProps().ownerId.empty()) throw std::runtime_error("Panel viewport requires its original overlay owner");
  const auto children = getChildren();
  if (children.size() != 1 || !dynamic_cast<const CUIOwnedOverlayHostShadowNode *>(children.front().get()))
    throw std::runtime_error("Panel viewport requires its one original owned overlay host");
  context.viewportSize = getLayoutMetrics().frame.size;
  context.viewportOffset = {};
  auto child = children.front()->clone({});
  auto &host = static_cast<CUIOwnedOverlayHostShadowNode &>(*child);
  replaceChild(*children.front(), child, 0);
  host.layoutTree(context, constraintsFor(context.viewportSize, getLayoutMetrics().layoutDirection));
  publishRoot(context, host);
  Rect ink{};
  includeInk(ink, host);
  publishOverflow(*this, ink);
}

void CUIOwnedOverlayHostShadowNode::layoutTree(LayoutContext context, LayoutConstraints constraints) {
  const bool flow = isFlowBody(getConcreteProps());
  if (flow) prepareFlowChildren(context);
  // Configure this original owned Yoga root through Fabric before resolving its
  // authored min/max against the viewport. A viewport is an owner size, not an
  // implicit CSS max-width/max-height on an explicitly oversized overlay.
  const auto authoredMinWidth = yogaNode_.style().minDimension(yoga::Dimension::Width);
  const auto authoredMinHeight = yogaNode_.style().minDimension(yoga::Dimension::Height);
  const auto authoredMaxWidth = yogaNode_.style().maxDimension(yoga::Dimension::Width);
  const auto authoredMaxHeight = yogaNode_.style().maxDimension(yoga::Dimension::Height);
  configuringRoot_ = true;
  YogaLayoutableShadowNode::layoutTree(context, constraints);
  configuringRoot_ = false;
  if (flow) prepareFlowPaintBounds();
  yogaNode_.style().setMinDimension(yoga::Dimension::Width, authoredMinWidth);
  yogaNode_.style().setMinDimension(yoga::Dimension::Height, authoredMinHeight);
  yogaNode_.style().setMaxDimension(yoga::Dimension::Width, authoredMaxWidth);
  yogaNode_.style().setMaxDimension(yoga::Dimension::Height, authoredMaxHeight);
  yogaNode_.markDirtyAndPropagate();
  resolveOwnedRoot(yogaNode_, yogaConfig_, context.viewportSize, constraints.layoutDirection);
  applyRootMetrics(*this, yogaNode_, context);
  layout(context);
}

void CUIOwnedOverlayHostShadowNode::layout(LayoutContext context) {
  if (configuringRoot_ || getLayoutMetrics().displayType == DisplayType::None) return;
  if (isFlowBody(getConcreteProps())) {
    YogaLayoutableShadowNode::layout(context);
    return;
  }
  const auto children = getChildren();
  if (children.size() != 3) throw std::runtime_error("Panel overlay requires its original underlay, paint and body planes");
  const auto &metrics = getLayoutMetrics();
  const auto &props = getConcreteProps();
  const bool contents = metrics.displayType == DisplayType::Contents;
  const bool fixed = props.panelPosition == CUIOverlayHostPanelPosition::Fixed;
  const bool absolute = props.panelPosition == CUIOverlayHostPanelPosition::Absolute;
  const bool containingBlock = !contents && props.establishesContainingBlock;
  const bool positioned = !contents && props.yogaStyle.positionType() != yoga::PositionType::Static;
  Rect body{{-metrics.frame.origin.x, -metrics.frame.origin.y}, context.viewportSize};
  if ((fixed && containingBlock) || (absolute && (positioned || containingBlock))) {
    body = {{metrics.borderWidth.left, metrics.borderWidth.top},
        {std::max(Float{0}, metrics.frame.size.width - metrics.borderWidth.left - metrics.borderWidth.right),
         std::max(Float{0}, metrics.frame.size.height - metrics.borderWidth.top - metrics.borderWidth.bottom)}};
  }
  Rect ink{};
  for (size_t index = 0; index < children.size(); index++) {
    const auto &original = children[index];
    const auto *slot = dynamic_cast<const CUIOwnedOverlaySlotShadowNode *>(original.get());
    if (!slot) throw std::runtime_error("Panel overlay planes must retain their original owned slot family");
    const auto expectedRole = index == 0 ? CUIOverlaySlotSlotRole::Underlay
        : index == 1 ? CUIOverlaySlotSlotRole::Paint : CUIOverlaySlotSlotRole::Body;
    if (slot->getConcreteProps().slotRole != expectedRole) throw std::runtime_error("Panel overlay slot roles must retain their original order");
    auto resolved = planeProps(*original, index == 2 ? body : Rect{{}, metrics.frame.size}, metrics.frame.size, metrics.layoutDirection);
    auto nested = std::make_shared<std::vector<std::shared_ptr<const ShadowNode>>>(original->getChildren());
    if (index < 2 && contents) resolved->yogaStyle.setDisplay(yoga::Display::None);
    if (index == 2) {
      if (nested->size() != 1) throw std::runtime_error("Panel body must retain its one original control family");
      const auto *originalProps = dynamic_cast<const CUIFocusViewProps *>(nested->front()->getProps().get());
      if (!originalProps) throw std::runtime_error("Panel body must retain its original native focus/drawing host");
      if (props.panelViewportHeight || props.panelViewportWidth) {
        auto bodyProps = cloneOwnedProps<CUIFocusViewProps>(*nested->front());
        if (props.panelViewportHeight)
          bodyProps->yogaStyle.setDimension(yoga::Dimension::Height, yoga::StyleSizeLength::points(context.viewportSize.height));
        if (props.panelViewportWidth)
          bodyProps->yogaStyle.setDimension(yoga::Dimension::Width, yoga::StyleSizeLength::points(
              context.viewportSize.width < 500 ? context.viewportSize.width * Float{0.8} : Float{300}));
        nested->front() = nested->front()->clone({.props = bodyProps});
      }
    }
    auto child = original->clone({.props = resolved, .children = nested});
    auto *layoutable = dynamic_cast<CUIOwnedOverlaySlotShadowNode *>(child.get());
    if (!layoutable) throw std::runtime_error("Panel overlay plane lost its native Yoga layout owner");
    replaceChild(*original, child, index);
    layoutable->layoutAt(context, metrics.frame.size, index == 2 ? body : Rect{{}, metrics.frame.size}, metrics.layoutDirection);
    publishRoot(context, *layoutable);
    includeInk(ink, *layoutable);
  }
  if (props.yogaStyle.overflow() == yoga::Overflow::Visible) publishOverflow(*this, ink);
  else {
    auto clipped = getLayoutMetrics();
    clipped.overflowInset = {};
    setLayoutMetrics(clipped);
  }
}

void CUIOwnedOverlaySlotShadowNode::layoutAt(LayoutContext context, Size containingBlock, Rect frame, LayoutDirection direction) {
  configuringRoot_ = true;
  YogaLayoutableShadowNode::layoutTree(context, constraintsFor(frame.size, direction));
  configuringRoot_ = false;
  // The slot keeps these explicit physical bounds. Its original children are laid
  // out by the SDK after the real owned containing block resolves its position.
  resolveOwnedRoot(yogaNode_, yogaConfig_, containingBlock, direction);
  applyRootMetrics(*this, yogaNode_, context);
  YogaLayoutableShadowNode::layout(context);
}

void CUIOwnedOverlaySlotShadowNode::layout(LayoutContext context) {
  if (!configuringRoot_) YogaLayoutableShadowNode::layout(context);
}

} // namespace facebook::react
