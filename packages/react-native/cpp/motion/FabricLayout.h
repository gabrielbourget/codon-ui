#pragma once

#include "FabricSnapshot.h"
#include "ScratchYoga.h"

namespace codon::motion {

struct TNativeScratchIntrinsic {
  TNativeScratchMeasure measure;
  TNativeScratchBaseline baseline;
};

// Factories must capture audited immutable data/native measurement services.
// Calling measureContent/layout on the original node is not a safe default.
using TNativeScratchIntrinsicResolver = std::function<TNativeScratchIntrinsic(
    const facebook::react::ShadowNode &,
    const facebook::react::LayoutContext &,
    const facebook::react::Props::Shared &)>;

// The query parses independent props for the same actual family. No node is
// cloned or adopted, and descendants retain their original props by default.
using TNativeScratchPropsResolver = std::function<facebook::react::Props::Shared(
    const facebook::react::ShadowNode &)>;

struct TNativeScratchInput {
  TNativeFabricSnapshot source;
  TNativeScratchNode root;
  TNativeScratchConstraints constraints;
};

TNativeScratchInput createNativeScratchInput(
    const TNativeFabricSnapshot &snapshot,
    const TNativeScratchIntrinsicResolver &resolveIntrinsic = {},
    const TNativeScratchPropsResolver &resolveProps = {},
    const TNativeFabricReadGuard &check = {});

TNativeScratchNode copyNativeScratchSubtree(
    const facebook::react::ShadowNode &node,
    const facebook::react::LayoutContext &context,
    const facebook::react::LayoutConstraints &constraints,
    const TNativeScratchIntrinsicResolver &resolveIntrinsic,
    const TNativeScratchPropsResolver &resolveProps = {},
    const TNativeFabricReadGuard &check = {});

} // namespace codon::motion
