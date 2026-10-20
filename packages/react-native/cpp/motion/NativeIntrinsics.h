#pragma once

#include "FabricLayout.h"
#include <react/utils/ContextContainer.h>

namespace codon::motion {

// Platform services must isolate mutable widget caches and cached editor spans.
// Missing services are errors, never a fallback to the original unsafe path.
struct TNativeIsolatedIntrinsicServices {
  std::function<facebook::react::Size(
      const facebook::react::ShadowNode &, const facebook::react::LayoutContext &,
      const facebook::react::LayoutConstraints &)> cachedEditor;
  std::function<facebook::react::Size(
      const facebook::react::ShadowNode &, const facebook::react::LayoutContext &,
      const facebook::react::LayoutConstraints &)> progress;
};

TNativeScratchIntrinsicResolver createNativeIntrinsicResolver(
    const TNativeFabricSnapshot &snapshot,
    std::shared_ptr<const facebook::react::ContextContainer> contextContainer,
    TNativeIsolatedIntrinsicServices services = {},
    TNativeFabricReadGuard check = {});

} // namespace codon::motion
