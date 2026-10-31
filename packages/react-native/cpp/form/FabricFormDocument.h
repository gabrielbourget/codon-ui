#pragma once

#include "../motion/NativeABI.h"
#include <react/renderer/components/root/RootShadowNode.h>
#include <react/renderer/mounting/ShadowTreeRevision.h>
#include <react/renderer/uimanager/UIManager.h>
#include <functional>
#include <optional>
#include <unordered_map>
#include <vector>

namespace codon::form {

struct TFormDocumentNode {
  std::shared_ptr<const facebook::react::ShadowNode> node;
  std::optional<size_t> parent;
};

struct TFabricFormDocument {
  std::shared_ptr<const facebook::react::RootShadowNode> root;
  facebook::react::ShadowTreeRevision::Number revision;
  std::vector<TFormDocumentNode> preorder;
  std::unordered_map<facebook::react::Tag, size_t> positions;
};

// A request owns the immutable revision. Modal roots and hidden retained nodes
// remain in this document; physical mount/visibility admission is separate.
TFabricFormDocument captureFabricFormDocument(
    const facebook::react::UIManager &manager,
    facebook::react::SurfaceId surface,
    const std::function<void()> &check = {});

TFabricFormDocument captureFabricFormDocumentForTarget(
    const facebook::react::UIManager &manager,
    facebook::react::Tag target,
    const std::function<void()> &check = {});

bool isFabricFormDocumentCurrent(
    const facebook::react::UIManager &manager,
    const TFabricFormDocument &document);

bool isFormDocumentDescendant(
    const TFabricFormDocument &document,
    facebook::react::Tag target,
    facebook::react::Tag ancestor);

} // namespace codon::form
