#pragma once

#include "FabricSnapshot.h"
#include "ScratchYoga.h"

namespace codon::motion {

struct TNativeScratchIntrinsic {
  std::function<YGSize(float, YGMeasureMode, float, YGMeasureMode)> measure;
  TNativeScratchBaseline baseline;
};

// Factories must capture audited immutable data/native measurement services.
// Calling measureContent/layout on the original node is not a safe default.
using TNativeScratchIntrinsicResolver = std::function<TNativeScratchIntrinsic(
    const facebook::react::ShadowNode &,
    const facebook::react::LayoutContext &)>;

struct TNativeScratchInput {
  TNativeFabricSnapshot source;
  TNativeScratchNode root;
  TNativeScratchConstraints constraints;
};

TNativeScratchInput createNativeScratchInput(
    const TNativeFabricSnapshot &snapshot,
    const TNativeScratchIntrinsicResolver &resolveIntrinsic = {});

} // namespace codon::motion
