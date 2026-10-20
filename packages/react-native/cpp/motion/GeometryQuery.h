#pragma once

#include "FabricLayout.h"
#include "InitialValueQuery.h"
#include <functional>

namespace codon::motion {

using TNativeGeometryIntrinsicFactory = std::function<TNativeScratchIntrinsicResolver(
    const TNativeFabricSnapshot &, const TNativeScratchPropsResolver &, const TNativeFabricReadGuard &)>;

// Platform facades validate the original view/window lease around this immutable
// query. Evaluated frames are never mounted geometry or paint acknowledgments.
std::string queryNativeEvaluatedLayout(
    const facebook::react::UIManager &manager, int target,
    const std::string &owner, const std::string &binding,
    const std::string &nativeViewRevision, const std::string &request,
    const TNativeGeometryIntrinsicFactory &intrinsicFactory,
    const TNativeInitialColorReader &readColor = {},
    const TNativeScratchPropsResolver &authoredProps = {});

} // namespace codon::motion
