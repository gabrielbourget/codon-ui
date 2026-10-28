#pragma once

#include "FabricLayout.h"
#include <react/renderer/attributedstring/AttributedStringBox.h>
#include <react/renderer/attributedstring/ParagraphAttributes.h>
#include <react/utils/ContextContainer.h>

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
};

TNativeScratchIntrinsicResolver createNativeIntrinsicResolver(
    const TNativeFabricSnapshot &snapshot,
    std::shared_ptr<const facebook::react::ContextContainer> contextContainer,
    TNativeIsolatedIntrinsicServices services = {},
    TNativeFabricReadGuard check = {},
    TNativeScratchPropsResolver propsForNode = {});

} // namespace codon::motion
