#pragma once
#include "ActionRuntime.h"

namespace codon::drag {
// Only genuine pending SDK transactions are consumed. The original platform
// observer supplies its real mount witness; no paint/report flag is fabricated.
inline WorkResult mountTransactions(facebook::react::UIManager &manager, int32_t surface,
    facebook::react::RootShadowNode::Shared &applied, const std::function<std::string()> &witness) {
  using namespace facebook::react;
  std::shared_ptr<const MountingCoordinator> coordinator; RootShadowNode::Shared current;
  manager.getShadowTreeRegistry().visit(surface, [&](const ShadowTree &tree) {
    coordinator = tree.getMountingCoordinator(); current = tree.getCurrentRevision().rootShadowNode;
  });
  if (!coordinator || !current || !applied) return {false, "native-drag-original-surface-retired"};
  const auto base = coordinator->getBaseRevision().rootShadowNode;
  if (current == applied || current == base) { applied = current; return {}; }
  const auto scheduler = dynamic_cast<Scheduler *>(manager.getDelegate()); const auto platform = scheduler ? scheduler->getDelegate() : nullptr;
  if (!platform || !witness) return {false, "native-drag-original-mount-delegate-retired"};
  const auto before = witness(); platform->schedulerShouldRenderTransactions(coordinator);
  if (before == witness()) return {false, "native-drag-original-transaction-not-observed"};
  applied = coordinator->getBaseRevision().rootShadowNode; return {true, ""};
}
inline std::string run(const std::shared_ptr<ActionRuntime> &runtime, const std::shared_ptr<facebook::react::UIManager> &manager,
    const ActionIdentity &identity, folly::dynamic payload, bool pointer, const std::function<bool()> &current,
    const std::function<std::string()> &witness) {
  if (!runtime || !runtime->ready() || !manager || !current || !current()) throw std::runtime_error("native-drag-original-owner-unavailable");
  const auto ticket = runtime->frames.begin(identity, pointer);
  if (!ticket) throw std::runtime_error("native-drag-original-action-reentry-or-retirement");
  auto cursor = std::make_shared<facebook::react::RootShadowNode::Shared>(rootFor(*manager, identity.surfaceId));
  try {
    if (!runtime->schedule(ticket, manager, std::move(payload), [manager, cursor, identity, witness] {
      return mountTransactions(*manager, identity.surfaceId, *cursor, witness);
    })) throw std::runtime_error("native-drag-original-runtime-scheduler-unavailable");
    const auto result = runtime->frames.wait(ticket, current);
    if (!result.current || !result.error.empty()) throw std::runtime_error(result.error.empty() ? "native-drag-original-action-incomplete" : result.error);
    return result.response;
  } catch (...) { runtime->frames.close(ticket, "native-drag-original-action-failed"); throw; }
}
} // namespace codon::drag
