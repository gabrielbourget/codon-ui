#include "ClampSizing.h"
#include "ClampHost.h"
#include "ClampKernel.h"
#include <react/featureflags/ReactNativeFeatureFlags.h>
#include <react/renderer/components/text/ParagraphShadowNode.h>
#include <react/renderer/core/ComponentDescriptor.h>
#include <algorithm>
#include <cmath>
#include <limits>
#include <stdexcept>
#include <string_view>
#include <unordered_map>

namespace codon::table {
using namespace facebook::react;
using namespace codon::motion;
namespace {
int lineLimit(const CUIClampHostProps &props) {
  return props.hasClamp && std::isfinite(props.maximumLines) && props.maximumLines > 0 &&
      props.maximumLines <= std::numeric_limits<int>::max() && std::floor(props.maximumLines) == props.maximumLines
      ? static_cast<int>(props.maximumLines) : 0;
}
bool separateWindow(const ShadowNode &node) {
  const auto name = std::string_view(node.getComponentName());
  return name == "PortalView" || name == "ModalHostView" || name == "InputAccessoryView";
}
}
Size measureClampContent(std::shared_ptr<const ShadowNode> root, const CUIClampHostProps &props,
    const LayoutContext &context, const LayoutConstraints &constraints,
    const std::shared_ptr<CUIClampTextScope> &textScope) {
  if (!root || !textScope) throw std::runtime_error("Table clamp requires its original content/text owner");
  textScope->prepare(*root);
  TNativeFabricReadGuard check;
  auto services = textScope->services(*root, check);
  std::unordered_map<int, Props::Shared> selected;
  const auto select = [&](const ShadowNode &node) -> Props::Shared {
    const auto found = selected.find(node.getTag());
    if (found != selected.end()) return found->second;
    auto value = node.getProps();
    if (props.noWrap && dynamic_cast<const ParagraphShadowNode *>(&node) && !hasClampContentSource(node.getFamily())) {
      const auto container = node.getContextContainer();
      value = node.getComponentDescriptor().cloneProps(
          PropsParserContext(node.getSurfaceId(), *container), value, RawProps{});
      if (value == node.getProps()) throw std::runtime_error("Table clamp must independently select paragraph flow props");
      auto paragraph = std::const_pointer_cast<ParagraphProps>(std::dynamic_pointer_cast<const ParagraphProps>(value));
      if (!paragraph) throw std::runtime_error("Table clamp original Paragraph props type changed");
      paragraph->ensureUnsealed();
      paragraph->paragraphAttributes.maximumNumberOfLines = 1;
    }
    selected.emplace(node.getTag(), value);
    return value;
  };
  const auto revision = root->getState() ? root->getState()->getRevision() : State::initialRevisionValue;
  std::unordered_map<int, std::shared_ptr<CUIClampCapture>> captures;
  const auto capture = [&](const ShadowNode &node) {
    const auto found = captures.find(node.getTag());
    if (found != captures.end()) return found->second;
    const auto *layout = dynamic_cast<const LayoutableShadowNode *>(&node);
    auto result = captureClampContent({node.getFamilyShared(), node.getProps(), node.getState(), context,
        layout ? layout->getLayoutMetrics() : LayoutMetrics{}, constraints,
        static_cast<uint64_t>(revision), props.noWrap, props.windowId, props.epoch, check});
    captures.emplace(node.getTag(), result);
    return result;
  };
  services.isolatedLeaf = [](const ShadowNode &node) { return hasClampContentSource(node.getFamily()) || separateWindow(node); };
  services.intrinsicOverride = [&](const ShadowNode &node, const LayoutContext &ctx, const Props::Shared &) -> std::optional<TNativeScratchIntrinsic> {
    if (hasClampContentSource(node.getFamily())) return capture(node)->callbacks();
    if (separateWindow(node)) return TNativeScratchIntrinsic{[](auto...) { return YGSize{0, 0}; }, {}};
    if (const auto *nested = dynamic_cast<const CUIOwnedClampHostShadowNode *>(&node)) {
      return TNativeScratchIntrinsic{[nested, ctx](float width, YGMeasureMode wm, float height, YGMeasureMode hm, YGDirection direction) {
        LayoutConstraints bounds;
        if (wm != YGMeasureModeUndefined) bounds.maximumSize.width = width;
        if (wm == YGMeasureModeExactly) bounds.minimumSize.width = width;
        if (hm != YGMeasureModeUndefined) bounds.maximumSize.height = height;
        if (hm == YGMeasureModeExactly) bounds.minimumSize.height = height;
        bounds.layoutDirection = direction == YGDirectionRTL ? LayoutDirection::RightToLeft : LayoutDirection::LeftToRight;
        const auto size = nested->measureContent(ctx, bounds);
        return YGSize{static_cast<float>(size.width), static_cast<float>(size.height)};
      }, {}};
    }
    return std::nullopt;
  };
  auto intrinsic = clampKernel().intrinsics(root, revision, std::move(services), check, select);
  const auto &resolver = intrinsic.resolve;
  auto bounds = constraints;
  bounds.minimumSize.height = 0;
  bounds.maximumSize.height = std::numeric_limits<Float>::infinity();
  auto scratch = clampKernel().copy(*root, context, bounds, resolver, select, check,
      [](const ShadowNode &node) { return hasClampContentSource(node.getFamily()) || separateWindow(node); });
  // Opaque producers own a complete independent leaf even when their original node is a container.
  const auto prepare = [&](const auto &self, TNativeScratchNode &node, const ShadowNode &original) -> void {
    if (hasClampContentSource(original.getFamily())) {
      auto callbacks = capture(original)->callbacks();
      node.measure = std::move(callbacks.measure); node.baseline = std::move(callbacks.baseline);
      node.children.clear();
      return;
    }
    if (separateWindow(original)) { node.children.clear(); return; }
    for (auto &child : node.children) {
      const auto found = std::find_if(original.getChildren().begin(), original.getChildren().end(),
          [&](const auto &candidate) { return candidate->getTag() == child.tag; });
      if (found == original.getChildren().end()) throw std::runtime_error("Table clamp lost an original scratch child");
      self(self, child, **found);
    }
  };
  prepare(prepare, scratch, *root);
  TNativeScratchConstraints scratchBounds{static_cast<float>(bounds.minimumSize.width),0,
      static_cast<float>(bounds.maximumSize.width),std::numeric_limits<float>::infinity(),
      static_cast<float>(context.pointScaleFactor),
      bounds.layoutDirection == LayoutDirection::RightToLeft ? YGDirectionRTL :
          bounds.layoutDirection == LayoutDirection::LeftToRight ? YGDirectionLTR : YGDirectionInherit,
      ReactNativeFeatureFlags::fixYogaFlexBasisFitContentInMainAxis()};
  const auto measured = clampKernel().evaluate({{std::move(scratch), scratchBounds}}, root->getTag()).front();
  if (!lineLimit(props) && !props.noWrap) {
    check();
    const auto &layout = measured.front().layout;
    return constraints.clamp({layout.frame[2],layout.frame[3]});
  }
  std::unordered_map<int, const ShadowNode *> originals;
  const auto remember = [&](const auto &self, const ShadowNode &node) -> void {
    originals.emplace(node.getTag(), &node);
    for (const auto &child : node.getChildren()) self(self, *child);
  };
  remember(remember, *root);
  std::unordered_map<int, facebook::react::Point> positions;
  std::unordered_map<int, bool> excluded;
  std::vector<TClampFragment> fragments;
  Size natural;
  for (const auto &result : measured) {
    check();
    const auto &layout = result.layout;
    const auto &node = *originals.at(result.tag);
    auto origin = result.parentTag == 0 ? facebook::react::Point{} : positions.at(result.parentTag);
    if (result.parentTag) origin += facebook::react::Point{layout.frame[0], layout.frame[1]};
    positions.emplace(result.tag, origin);
    const bool hidden = result.display == YGDisplayNone || result.positionType == YGPositionTypeAbsolute ||
        separateWindow(node) || (result.parentTag && excluded.at(result.parentTag));
    excluded.emplace(result.tag, hidden);
    if (!result.parentTag) natural = {layout.frame[2], layout.frame[3]};
    if (hidden) continue;
    const Size size{layout.frame[2], layout.frame[3]};
    if (hasClampContentSource(node.getFamily())) {
      auto supplied = capture(node)->fragments(size);
      for (auto &fragment : supplied) {
        if (fragment.tag != node.getTag()) throw std::runtime_error("Table clamp isolated fragment belongs to another original view");
        fragment.frame.origin += origin; fragment.baseline += origin.y;
        fragments.push_back(std::move(fragment));
      }
    } else if (dynamic_cast<const ParagraphShadowNode *>(&node)) {
      const float left = layout.border[0] + layout.padding[0], top = layout.border[1] + layout.padding[1];
      const Size contentSize{std::max(Float{0},size.width-left-layout.border[2]-layout.padding[2]),
          std::max(Float{0},size.height-top-layout.border[3]-layout.padding[3])};
      const auto lines = intrinsic.paragraphLines(node, context, contentSize, layout.direction);
      for (size_t index=0;index<lines.size();index++) {
        auto frame = lines[index].frame;
        frame.origin += origin + facebook::react::Point{left,top};
        fragments.push_back({frame,frame.origin.y+lines[index].ascender,node.getTag(),static_cast<int>(index),
            static_cast<uint64_t>(node.getTag()),ClampFragmentKind::Line});
      }
    } else {
      const bool hasChildren = std::any_of(measured.begin(), measured.end(), [&](const auto &child) { return child.parentTag == result.tag; });
      if (!hasChildren && (size.width > 0 || size.height > 0)) {
        Float baseline = size.height;
        if (node.getTraits().check(ShadowNodeTraits::BaselineYogaNode)) {
          const auto callbacks = resolver(node, context, select(node));
          baseline = callbacks.baseline(size.width,size.height,layout.border,layout.padding,layout.direction);
        }
        fragments.push_back({{origin,size},origin.y+baseline,node.getTag(),0,
            static_cast<uint64_t>(node.getTag()),ClampFragmentKind::Atomic});
      }
    }
  }
  check();
  const auto viewport = resolveClampViewport(fragments,natural.height,lineLimit(props),context.pointScaleFactor);
  return constraints.clamp({natural.width,static_cast<Float>(viewport.height)});
}
} // namespace codon::table
