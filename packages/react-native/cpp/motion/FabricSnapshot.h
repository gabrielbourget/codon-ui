#pragma once

#include "NativeABI.h"

#include <react/renderer/components/root/RootShadowNode.h>
#include <react/renderer/core/LayoutContext.h>
#include <react/renderer/mounting/ShadowTreeRevision.h>
#include <react/renderer/uimanager/UIManager.h>
#include <functional>

namespace codon::motion {

// The platform facade supplies a synchronous read-only owner/props check and
// separately validates its actual ref/window lease. This is not a mount ack.
using TNativeFabricOwnerCheck =
    std::function<bool(const facebook::react::ShadowNode &)>;
using TNativeFabricReadGuard = std::function<void()>;

struct TNativeFabricSnapshot {
  std::shared_ptr<const facebook::react::RootShadowNode> root;
  std::shared_ptr<const facebook::react::ShadowNode> target;
  facebook::react::ShadowTreeRevision::Number revision;
  facebook::react::LayoutContext context;
  facebook::react::LayoutConstraints constraints;
};

TNativeFabricSnapshot captureNativeFabricSnapshot(
    const facebook::react::UIManager &manager,
    facebook::react::SurfaceId surface,
    facebook::react::Tag target,
    const TNativeFabricOwnerCheck &owns,
    const TNativeFabricReadGuard &check = {});

bool isNativeFabricSnapshotCurrent(
    const facebook::react::UIManager &manager,
    const TNativeFabricSnapshot &snapshot,
    const TNativeFabricOwnerCheck &owns);

} // namespace codon::motion
