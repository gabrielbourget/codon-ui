#include "FabricSnapshot.h"

#include <react/renderer/mounting/ShadowTree.h>
#include <optional>
#include <stdexcept>
#include <vector>

namespace codon::motion {
using namespace facebook::react;

TNativeFabricSnapshot captureNativeFabricSnapshot(
    const UIManager &manager, SurfaceId surface, Tag tag,
    const TNativeFabricOwnerCheck &owns, const TNativeFabricReadGuard &check) {
  if (surface <= 0 || tag <= 0 || !owns)
    throw std::invalid_argument("Native motion: actual Fabric owner required");
  std::optional<TNativeFabricSnapshot> result;
  manager.getShadowTreeRegistry().visit(surface, [&](const ShadowTree &tree) {
    const auto revision = tree.getCurrentRevision();
    if (!revision.rootShadowNode) return;
    std::vector<std::shared_ptr<const ShadowNode>> pending{revision.rootShadowNode};
    while (!pending.empty()) {
      if (check) check();
      const auto node = pending.back();
      pending.pop_back();
      if (node->getTag() == tag) {
        if (node->getSurfaceId() != surface || !owns(*node))
          throw std::runtime_error("Native motion: Fabric owner mismatch");
        const auto &props = revision.rootShadowNode->getConcreteProps();
        auto context = props.layoutContext;
        // This pointer belongs to RN's original layout pass, not our request.
        context.affectedNodes = nullptr;
        result = TNativeFabricSnapshot{
            revision.rootShadowNode, node, revision.number,
            context, props.layoutConstraints};
        const auto current = tree.getCurrentRevision();
        if (current.number != revision.number ||
            current.rootShadowNode != revision.rootShadowNode)
          throw std::runtime_error("Native motion: Fabric revision retired");
        return;
      }
      for (const auto &child : node->getChildren()) pending.push_back(child);
    }
  });
  if (!result) throw std::runtime_error("Native motion: actual Fabric target unavailable");
  return std::move(*result);
}

bool isNativeFabricSnapshotCurrent(
    const UIManager &manager, const TNativeFabricSnapshot &snapshot,
    const TNativeFabricOwnerCheck &owns) {
  if (!snapshot.root || !snapshot.target || !owns) return false;
  bool current = false;
  manager.getShadowTreeRegistry().visit(
      snapshot.root->getSurfaceId(), [&](const ShadowTree &tree) {
        const auto revision = tree.getCurrentRevision();
        current = revision.number == snapshot.revision &&
            revision.rootShadowNode == snapshot.root && owns(*snapshot.target);
      });
  return current;
}

} // namespace codon::motion
