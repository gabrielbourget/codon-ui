#include "SnapshotQuery.h"
#include "FabricSnapshot.h"

#include <iomanip>
#include <limits>
#include <locale>
#include <sstream>
#include <react/renderer/components/CodonNativeInputSpec/Props.h>
#include <react/renderer/core/LayoutableShadowNode.h>
#include <react/renderer/mounting/ShadowTree.h>
#include <cmath>
#include <chrono>
#include <optional>
#include <stdexcept>
#include <vector>

namespace codon::motion {
using namespace facebook::react;

std::string queryNativeFabricSnapshot(
    const UIManager &manager, int target, const std::string &owner,
    const std::string &binding, const std::string &nativeViewRevision) {
  if (target <= 0 || owner.empty() || binding.empty())
    throw std::invalid_argument("Native motion: actual observed owner required");
  const auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(5000);
  const auto check = [&] {
    if (std::chrono::steady_clock::now() >= deadline)
      throw std::runtime_error("Native motion: Fabric query exceeded its 5000ms limit");
  };
  const auto owns = [&](const ShadowNode &node) {
    if (std::string(node.getComponentName()) != "CUIFocusView") return false;
    // The owned component name selects this exact generated props class.
    // Field access needs no second generated props implementation/vtable.
    const auto &props = static_cast<const CUIFocusViewProps &>(*node.getProps());
    return props.ownerId == owner && props.nativeMotionGeometryBinding == binding &&
        props.nativeMotionGeometryRevision == nativeViewRevision;
  };
  std::optional<SurfaceId> surface;
  manager.getShadowTreeRegistry().enumerate([&](const ShadowTree &tree, bool &stop) {
    const auto revision = tree.getCurrentRevision();
    if (!revision.rootShadowNode) return;
    std::vector<std::shared_ptr<const ShadowNode>> pending{revision.rootShadowNode};
    while (!pending.empty()) {
      check();
      auto node = pending.back(); pending.pop_back();
      if (node->getTag() == target && owns(*node)) {
        surface = node->getSurfaceId(); stop = true; return;
      }
      for (const auto &child : node->getChildren()) pending.push_back(child);
    }
  });
  if (!surface) throw std::runtime_error("Native motion: matching Fabric owner unavailable");
  const auto snapshot = captureNativeFabricSnapshot(manager, *surface, target, owns, check);
  const auto *layout = dynamic_cast<const LayoutableShadowNode *>(snapshot.target.get());
  if (!layout) throw std::runtime_error("Native motion: actual Fabric layout unavailable");
  const auto frame = layout->getLayoutMetrics().frame;
  const double values[]{frame.origin.x, frame.origin.y, frame.size.width, frame.size.height};
  if (frame.size.width < 0 || frame.size.height < 0)
    throw std::runtime_error("Native motion: invalid Fabric size");
  std::ostringstream result;
  result.imbue(std::locale::classic());
  result << std::setprecision(std::numeric_limits<double>::max_digits10);
  result << "{\"kind\":\"fabric-input\",\"surfaceId\":" << *surface
         << ",\"fabricRevision\":\"" << snapshot.revision
         << "\",\"fabricTargetFrame\":[";
  for (size_t index = 0; index < 4; index++) {
    if (!std::isfinite(values[index])) throw std::runtime_error("Native motion: invalid Fabric layout");
    if (index) result << ',';
    result << values[index];
  }
  result << "]}";
  auto encoded = result.str();
  check();
  if (!isNativeFabricSnapshotCurrent(manager, snapshot, owns))
    throw std::runtime_error("Native motion: Fabric snapshot retired");
  return encoded;
}

} // namespace codon::motion
