#include "ClampText.h"
#include "ClampContentSource.h"
#if defined(__ANDROID__)
#include <react/renderer/components/androidtextinput/AndroidTextInputShadowNode.h>
#else
#include <react/renderer/components/iostextinput/TextInputShadowNode.h>
#endif
#include <stdexcept>
#include <vector>
#include <unordered_set>

namespace codon::table {
using namespace facebook::react;
namespace {
std::atomic<uint64_t> nextTextOwner{1};
bool editor(const ShadowNode &node) {
#if defined(__ANDROID__)
  return dynamic_cast<const AndroidTextInputShadowNode *>(&node) != nullptr;
#else
  return dynamic_cast<const TextInputShadowNode *>(&node) != nullptr;
#endif
}
}
struct CUIClampTextScope::TEntry {
  ShadowNodeFamily::Shared family;
  uint64_t owner;
  std::shared_ptr<CuiTextSnapshotRegistration> registration;
  TEntry(ShadowNodeFamily::Shared family, uint64_t owner,
      std::shared_ptr<CuiTextSnapshotRegistration> registration)
      : family(std::move(family)), owner(owner), registration(std::move(registration)) {}
  ~TEntry() {
    registration->dispose();
    unobserveClampEditorText(family->getTag(), owner);
  }
};
CUIClampTextScope::CUIClampTextScope(std::string identity) : identity_(std::move(identity)) {}
CUIClampTextScope::~CUIClampTextScope() { active(false); }
void CUIClampTextScope::active(bool value) {
  if (active_.exchange(value) != value) epoch_.fetch_add(1);
}
void CUIClampTextScope::prepare(const ShadowNode &root) {
  std::lock_guard lock(mutex_);
  std::unordered_set<int> visited;
  const auto visit = [&](const auto &self, const ShadowNode &node) -> void {
    if (hasClampContentSource(node.getFamily())) return;
    if (editor(node)) {
      visited.insert(node.getTag());
      auto &entry = entries_[node.getTag()];
      if (!entry || &node.getFamily() != entry->family.get()) {
        const auto owner = nextTextOwner.fetch_add(1);
        auto registered = registerCuiTextSnapshotSource(node.getTag(), owner, captureClampEditorText);
        entry = std::make_shared<TEntry>(node.getFamilyShared(), owner, std::move(registered));
        observeClampEditorText(node.getTag(), owner);
      }
    }
    for (const auto &child : node.getChildren()) self(self, *child);
  };
  visit(visit, root);
  for (auto entry = entries_.begin(); entry != entries_.end();) {
    if (!visited.contains(entry->first)) entry = entries_.erase(entry);
    else ++entry;
  }
}
codon::motion::TNativeIsolatedIntrinsicServices CUIClampTextScope::services(
    const ShadowNode &root, std::function<void()> &check) {
  auto self = shared_from_this();
  const auto epoch = epoch_.load();
  auto selected = std::make_shared<std::unordered_map<int,
      std::pair<std::shared_ptr<const CuiTextSnapshotSource>, std::shared_ptr<const CuiTextSnapshot>>>>();
  check = [self, epoch, selected] {
    if (self->identity_.empty() || !self->active_.load() || self->epoch_.load() != epoch)
      throw std::runtime_error("Table clamp editor window/epoch retired");
    for (const auto &[tag, value] : *selected)
      if (!value.first->current(value.second)) throw std::runtime_error("Table clamp editor publication changed during sizing");
  };
  const auto snapshot = [self, selected, check](const ShadowNode &node) {
    check();
    auto found = selected->find(node.getTag());
    if (found != selected->end()) return found->second.second;
    std::shared_ptr<TEntry> entry;
    {
      std::lock_guard lock(self->mutex_);
      const auto current = self->entries_.find(node.getTag());
      if (current != self->entries_.end()) entry = current->second;
    }
    if (!entry || entry->family.get() != &node.getFamily())
      throw std::runtime_error("Table clamp editor has no exact original family registration");
    auto source = entry->registration->source();
#if defined(__ANDROID__)
    const auto *original = dynamic_cast<const AndroidTextInputShadowNode *>(&node);
#else
    const auto *original = dynamic_cast<const TextInputShadowNode *>(&node);
#endif
    if (!original) throw std::runtime_error("Table clamp native snapshot requires an original editor");
    const auto &data = original->getStateData();
    if (data.cuiTextSnapshotSource && data.cuiTextSnapshotSource != source)
      throw std::runtime_error("Table clamp editor state belongs to a retired native producer");
    auto value = source->read();
    selected->emplace(node.getTag(), std::make_pair(source, value));
    check();
    return value;
  };
  return clampPlatformIntrinsicServices(root, snapshot);
}
} // namespace codon::table
