#include "FabricLayout.h"
#include "NativeStyle.h"

#include <react/featureflags/ReactNativeFeatureFlags.h>
#include <react/renderer/components/view/LayoutConformanceShadowNode.h>
#include <react/renderer/components/view/ViewProps.h>
#include <stdexcept>
#include <string>

namespace codon::motion {
using namespace facebook::react;

namespace {
TNativeScratchNode copyNode(
    const ShadowNode &source, const LayoutContext &context, bool swap,
    YGErrata inheritedErrata, const TNativeScratchIntrinsicResolver &resolveIntrinsic) {
  const auto *props = dynamic_cast<const YogaStylableProps *>(source.getProps().get());
  if (!props) throw std::runtime_error("Native motion: actual Yoga props unavailable");
  auto errata = inheritedErrata;
  if (const auto *conformance = dynamic_cast<const LayoutConformanceShadowNode *>(&source)) {
    errata = conformance->getConcreteProps().mode == LayoutConformance::Strict
        ? YGErrataNone : YGErrataAll;
  }
  TNativeScratchNode result{source.getTag(), copyNativeYogaStyle(*props, swap)};
  result.errata = errata;
  if (source.getTraits().check(ShadowNodeTraits::ViewKind)) {
    const auto &view = static_cast<const ViewProps &>(*props);
    result.formsContainingBlock = view.transform != Transform::Identity() || !view.filter.empty();
  }
  const bool measures = source.getTraits().check(ShadowNodeTraits::MeasurableYogaNode);
  const bool hasBaseline = source.getTraits().check(ShadowNodeTraits::BaselineYogaNode);
  if (measures || hasBaseline) {
    if (!resolveIntrinsic)
      throw std::runtime_error(std::string("Native motion: isolated intrinsic backend unavailable for ") +
                               source.getComponentName());
    auto intrinsic = resolveIntrinsic(source, context);
    if ((measures && !intrinsic.measure) || (hasBaseline && !intrinsic.baseline))
      throw std::runtime_error("Native motion: complete isolated intrinsic callbacks required");
    if (measures) result.measure = std::move(intrinsic.measure);
    if (hasBaseline) result.baseline = std::move(intrinsic.baseline);
  }
  if (!source.getTraits().check(ShadowNodeTraits::LeafYogaNode)) {
    for (const auto &child : source.getChildren()) {
      if (dynamic_cast<const YogaLayoutableShadowNode *>(child.get()))
        result.children.push_back(copyNode(*child, context, swap, errata, resolveIntrinsic));
    }
  }
  return result;
}
} // namespace

TNativeScratchNode copyNativeScratchSubtree(
    const ShadowNode &node, const LayoutContext &context,
    const LayoutConstraints &constraints,
    const TNativeScratchIntrinsicResolver &resolveIntrinsic) {
  const bool swap = context.swapLeftAndRightInRTL &&
      constraints.layoutDirection == LayoutDirection::RightToLeft;
  return copyNode(node, context, swap, YGErrataAll, resolveIntrinsic);
}

TNativeScratchInput createNativeScratchInput(
    const TNativeFabricSnapshot &snapshot,
    const TNativeScratchIntrinsicResolver &resolveIntrinsic) {
  if (!snapshot.root || !snapshot.target)
    throw std::invalid_argument("Native motion: actual Fabric snapshot required");
  const auto &context = snapshot.context;
  const auto &constraints = snapshot.constraints;
  const bool swap = context.swapLeftAndRightInRTL &&
      constraints.layoutDirection == LayoutDirection::RightToLeft;
  TNativeScratchConstraints scratch{
      static_cast<float>(constraints.minimumSize.width),
      static_cast<float>(constraints.minimumSize.height),
      static_cast<float>(constraints.maximumSize.width),
      static_cast<float>(constraints.maximumSize.height),
      static_cast<float>(context.pointScaleFactor),
      constraints.layoutDirection == LayoutDirection::LeftToRight ? YGDirectionLTR :
          constraints.layoutDirection == LayoutDirection::RightToLeft ? YGDirectionRTL : YGDirectionInherit,
      ReactNativeFeatureFlags::fixYogaFlexBasisFitContentInMainAxis()};
  return {snapshot, copyNode(*snapshot.root, context, swap, YGErrataAll, resolveIntrinsic), scratch};
}

} // namespace codon::motion
