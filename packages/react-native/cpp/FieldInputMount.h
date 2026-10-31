#pragma once

#include "FieldInputDispatchFrames.h"
#include "form/FabricFormDocument.h"
#include <react/renderer/core/RawEvent.h>
#include <react/renderer/mounting/ShadowView.h>
#include <unordered_set>
#include <react/renderer/scheduler/Scheduler.h>
#include <react/renderer/runtimescheduler/RuntimeScheduler.h>
#include <react/renderer/uimanager/UIManager.h>

namespace codon {
inline bool isFieldInputMountEvent(facebook::react::UIManager &manager,
    const FieldInputDispatchFrames::Handle &ticket, const facebook::react::RawEvent &event) {
  const auto family = event.shadowNodeFamily.lock();
  if (!family || family->getSurfaceId() != ticket->identity.surfaceId || event.type == "topNativeFieldKey" ||
      event.type == "topNativeFieldPointer") return false;
  const auto document = form::captureFabricFormDocument(manager, ticket->identity.surfaceId);
  const auto position = document.positions.find(family->getTag());
  if (position == document.positions.end() || document.preorder[position->second].node->getFamilyShared() != family) return false;
  std::optional<size_t> index = position->second;
  while (index) {
    const auto &node = document.preorder[*index];
    for (const auto &scope : ticket->scopes) if (node.node->getTag() == scope.outerTarget) return true;
    index = node.parent;
  }
  return false;
}
inline bool isFieldInputCommandEvent(facebook::react::UIManager &manager,
    const FieldInputDispatchFrames::Handle &ticket, const facebook::react::RawEvent &event) {
  const bool inputNotification = event.type == "topFocus" || event.type == "topBlur" || event.type == "topChange" ||
    event.type == "topSelectionChange" || event.type == "topEndEditing" || event.type == "topSubmitEditing" ||
    event.type == "topKeyPress" || event.type == "topTextInput" || event.type == "topNativeSegmentInput" ||
    event.type == "topNativeFocusChange" || event.type == "topNativeFocusWithin";
  const auto family = event.shadowNodeFamily.lock();
  if (!inputNotification || event.isUnique || !family || family->getSurfaceId() != ticket->identity.surfaceId) return false;
  const auto document = form::captureFabricFormDocument(manager, ticket->identity.surfaceId);
  const auto found = document.positions.find(family->getTag());
  return found != document.positions.end() && document.preorder[found->second].node->getFamilyShared() == family;
}
inline std::shared_ptr<facebook::react::RuntimeScheduler> fieldInputRuntimeScheduler(
    facebook::react::UIManager &manager) {
  using namespace facebook::react;
  const auto scheduler = dynamic_cast<Scheduler *>(manager.getDelegate());
  if (!scheduler) return nullptr;
  const auto runtime = scheduler->getContextContainer()->find<std::weak_ptr<RuntimeScheduler>>(RuntimeSchedulerKey);
  return runtime ? runtime->lock() : nullptr;
}

struct FieldInputMountCursor {
  facebook::react::RootShadowNode::Shared appliedRoot;
};
inline bool fieldInputRootEffectsChanged(const facebook::react::RootShadowNode &before,
    const facebook::react::RootShadowNode &after, const std::vector<FieldInputIdentity> &scopes, int32_t commandTarget = 0) {
  using namespace facebook::react;
  std::unordered_set<Tag> roots;
  for (const auto &scope : scopes) roots.insert(scope.outerTarget);
  if (commandTarget > 0) roots.insert(commandTarget);
  const auto collect = [&](const RootShadowNode &root) {
    std::vector<std::pair<Tag, ShadowView>> result;
    const std::function<bool(const ShadowNode &, Tag, bool)> visit = [&](const ShadowNode &node, Tag parent, bool inside) {
      inside = inside || roots.contains(node.getTag());
      const auto position = result.size();
      if (inside) result.emplace_back(parent, ShadowView(node));
      bool containsScope = inside;
      for (const auto &child : node.getChildren()) containsScope = visit(*child, node.getTag(), inside) || containsScope;
      if (!inside && containsScope) result.insert(result.begin() + position, {parent, ShadowView(node)});
      return containsScope;
    };
    visit(root, 0, false);
    return result;
  };
  return collect(before) != collect(after);
}

// Consume genuine pending transactions through the existing platform delegate.
// The SDK witness is observed around that call; Android's later paint report
// remains untouched and is never manufactured to clear its async flag.
inline FieldInputMountResult mountFieldInputTransactions(facebook::react::UIManager &manager,
    const FieldInputDispatchFrames::Handle &ticket, FieldInputMountCursor &cursor,
    const std::function<std::string()> &nativeWitness, int32_t commandTarget = 0) {
  using namespace facebook::react;
  std::shared_ptr<const MountingCoordinator> coordinator;
  RootShadowNode::Shared currentRoot;
  manager.getShadowTreeRegistry().visit(ticket->identity.surfaceId, [&](const ShadowTree &tree) {
    coordinator = tree.getMountingCoordinator(); currentRoot = tree.getCurrentRevision().rootShadowNode;
  });
  if (!coordinator || !currentRoot) return {false, "field-input-mount-surface-retired"};
  const auto applied = cursor.appliedRoot;
  if (!applied) return {false, "field-input-mount-baseline-retired"};
  if (applied == currentRoot || !fieldInputRootEffectsChanged(*applied, *currentRoot, ticket->scopes, commandTarget)) {
    cursor.appliedRoot = currentRoot;
    return {};
  }
  const auto scheduler = dynamic_cast<Scheduler *>(manager.getDelegate());
  const auto platform = scheduler ? scheduler->getDelegate() : nullptr;
  if (!platform || !nativeWitness) return {false, "field-input-mount-delegate-retired"};
  const auto witness = nativeWitness();
  // The registry lock is released before callbacks can query the same surface.
  platform->schedulerShouldRenderTransactions(coordinator);
  if (witness == nativeWitness()) return {false, "field-input-original-transaction-not-observed"};
  cursor.appliedRoot = coordinator->getBaseRevision().rootShadowNode;
  return {true, ""};
}
} // namespace codon
