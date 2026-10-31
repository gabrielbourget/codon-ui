#pragma once

#include "FabricLayout.h"
#include <react/renderer/attributedstring/AttributedStringBox.h>
#include <react/renderer/attributedstring/ParagraphAttributes.h>
#include <react/renderer/textlayoutmanager/TextLayoutManager.h>
#include <react/utils/ContextContainer.h>
#include <optional>

namespace codon::motion {

// Platform services must isolate mutable widget caches and cached editor spans.
// Missing services are errors, never a fallback to the original unsafe path.
struct TNativeIsolatedIntrinsicServices {
  std::function<facebook::react::AttributedStringBox(
      const facebook::react::AttributedStringBox &)> isolateEditorText;
  std::function<facebook::react::Size(
      const facebook::react::ShadowNode &, const facebook::react::AttributedStringBox &,
      const facebook::react::ParagraphAttributes &, const facebook::react::LayoutContext &,
      const facebook::react::LayoutConstraints &)> textMeasure;
  std::function<facebook::react::Float(
      const facebook::react::ShadowNode &, const facebook::react::AttributedStringBox &,
      const facebook::react::ParagraphAttributes &, const facebook::react::LayoutContext &,
      const facebook::react::Size &)> textBaseline;
  std::function<facebook::react::Size(
      const facebook::react::ShadowNode &, const facebook::react::LayoutContext &,
      const facebook::react::LayoutConstraints &,
      const facebook::react::Props::Shared &)> progress;
  std::function<facebook::react::AttributedStringBox(
      const facebook::react::ShadowNode &, const facebook::react::AttributedStringBox &)> editorText;
  std::function<facebook::react::LinesMeasurements(
      const facebook::react::ShadowNode &, const facebook::react::AttributedStringBox &,
      const facebook::react::ParagraphAttributes &, const facebook::react::Size &)> textLines;
  std::function<std::optional<TNativeScratchIntrinsic>(const facebook::react::ShadowNode &,
      const facebook::react::LayoutContext &, const facebook::react::Props::Shared &)> intrinsicOverride;
  std::function<bool(const facebook::react::ShadowNode &)> isolatedLeaf;
};

struct TNativeSubtreeIntrinsics {
  TNativeScratchIntrinsicResolver resolve;
  std::function<facebook::react::LinesMeasurements(
      const facebook::react::ShadowNode &, const facebook::react::LayoutContext &,
      const facebook::react::Size &, YGDirection)> paragraphLines;
};

// Independent layout of an immutable subtree; it neither adopts nodes nor publishes layout events.
TNativeSubtreeIntrinsics createNativeSubtreeIntrinsics(
    std::shared_ptr<const facebook::react::ShadowNode> target,
    facebook::react::ShadowTreeRevision::Number revision,
    TNativeIsolatedIntrinsicServices services = {}, TNativeFabricReadGuard check = {},
    TNativeScratchPropsResolver propsForNode = {});

TNativeScratchIntrinsicResolver createNativeIntrinsicResolver(
    const TNativeFabricSnapshot &snapshot,
    std::shared_ptr<const facebook::react::ContextContainer> contextContainer,
    TNativeIsolatedIntrinsicServices services = {},
    TNativeFabricReadGuard check = {},
    TNativeScratchPropsResolver propsForNode = {});

} // namespace codon::motion
