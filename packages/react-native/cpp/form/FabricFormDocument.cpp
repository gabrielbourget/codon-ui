#include "FabricFormDocument.h"

#include <react/renderer/mounting/ShadowTree.h>
#include <stdexcept>
#include <unordered_set>

namespace codon::form {
using namespace facebook::react;

TFabricFormDocument captureFabricFormDocument(
    const UIManager &manager, SurfaceId surface,
    const std::function<void()> &check) {
  if (surface <= 0) throw std::invalid_argument("Native form: current surface required");
  std::optional<TFabricFormDocument> result;
  manager.getShadowTreeRegistry().visit(surface, [&](const ShadowTree &tree) {
    if (check) check();
    const auto revision = tree.getCurrentRevision();
    if (!revision.rootShadowNode || revision.rootShadowNode->getSurfaceId() != surface)
      throw std::runtime_error("Native form: document unavailable");
    TFabricFormDocument document{revision.rootShadowNode, revision.number, {}, {}};
    std::vector<TFormDocumentNode> pending{{revision.rootShadowNode, std::nullopt}};
    std::unordered_set<const ShadowNodeFamily *> families;
    while (!pending.empty()) {
      if (check) check();
      auto entry = std::move(pending.back());
      pending.pop_back();
      const auto &node = entry.node;
      if (!node || node->getTag() <= 0 || node->getSurfaceId() != surface ||
          !families.insert(&node->getFamily()).second ||
          !document.positions.emplace(node->getTag(), document.preorder.size()).second)
        throw std::runtime_error("Native form: ambiguous or foreign document node");
      const auto index = document.preorder.size();
      const auto &children = node->getChildren();
      // The stack reverses insertion, so visit original child order. Do not use
      // z-order, layout coordinates, native subviews or registry/effect order.
      for (auto child = children.rbegin(); child != children.rend(); ++child)
        pending.push_back({*child, index});
      document.preorder.push_back(std::move(entry));
    }
    if (check) check();
    const auto current = tree.getCurrentRevision();
    if (current.number != revision.number || current.rootShadowNode != revision.rootShadowNode)
      throw std::runtime_error("Native form: document revision retired");
    result = std::move(document);
  });
  if (!result) throw std::runtime_error("Native form: document surface retired");
  return std::move(*result);
}

TFabricFormDocument captureFabricFormDocumentForTarget(
    const UIManager &manager, Tag target, const std::function<void()> &check) {
  if (target <= 0) throw std::invalid_argument("Native form: original target required");
  std::optional<SurfaceId> surface;
  manager.getShadowTreeRegistry().enumerate([&](const ShadowTree &tree, bool &) {
    const auto revision = tree.getCurrentRevision();
    if (!revision.rootShadowNode) return;
    std::vector<std::shared_ptr<const ShadowNode>> pending{revision.rootShadowNode};
    while (!pending.empty()) {
      if (check) check();
      const auto node = pending.back();
      pending.pop_back();
      if (node->getTag() == target) {
        if (surface) throw std::runtime_error("Native form: ambiguous target document");
        surface = node->getSurfaceId();
      }
      for (const auto &child : node->getChildren()) pending.push_back(child);
    }
  });
  if (!surface) throw std::runtime_error("Native form: original target retired");
  auto document = captureFabricFormDocument(manager, *surface, check);
  if (!document.positions.contains(target)) throw std::runtime_error("Native form: original target retired");
  return document;
}

bool isFabricFormDocumentCurrent(const UIManager &manager, const TFabricFormDocument &document) {
  if (!document.root) return false;
  bool current = false;
  manager.getShadowTreeRegistry().visit(document.root->getSurfaceId(), [&](const ShadowTree &tree) {
    const auto revision = tree.getCurrentRevision();
    current = revision.rootShadowNode == document.root && revision.number == document.revision;
  });
  return current;
}

bool isFormDocumentDescendant(const TFabricFormDocument &document, Tag target, Tag ancestor) {
  const auto child = document.positions.find(target), parent = document.positions.find(ancestor);
  if (child == document.positions.end() || parent == document.positions.end()) return false;
  auto index = std::optional<size_t>(child->second);
  while (index && *index < document.preorder.size()) {
    if (*index == parent->second) return true;
    index = document.preorder[*index].parent;
  }
  return false;
}

} // namespace codon::form
