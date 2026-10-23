#pragma once

#include "FieldGroupQuery.h"
#include "../FieldInputRuntime.h"
#include <unordered_set>

namespace codon::form {
struct TFieldInputBinding {
  std::string ownerId, bindingId, bindingRevision, moduleLease;
  int32_t outerTarget, inputTarget;
};
inline TFieldInputBinding decodeFieldInputBinding(const std::string &encoded) {
  const auto value = folly::parseJson(encoded);
  if (!value.isObject() || value.size() != 7 || value.at("version") != 1)
    throw std::invalid_argument("field-input-binding-invalid");
  TFieldInputBinding result{value.at("ownerId").asString(), value.at("bindingId").asString(),
    value.at("bindingRevision").asString(), value.at("moduleLease").asString(),
    fieldGroupTarget(value.at("outerTarget")), fieldGroupTarget(value.at("inputTarget"))};
  if (result.ownerId.empty() || result.bindingId.empty() || result.bindingRevision.empty() || result.moduleLease.empty() ||
      result.outerTarget == result.inputTarget) throw std::invalid_argument("field-input-binding-invalid");
  return result;
}
inline TFieldInputBinding fieldInputBinding(const folly::dynamic &document) {
  const auto &plan = document.at("fieldGroup"), &field = plan.at("field");
  const folly::dynamic *metadata = nullptr;
  for (const auto &node : document.at("nodes")) if (node.at("target") == field.at("metadataTarget")) metadata = &node;
  if (!metadata) throw std::invalid_argument("field-input-metadata-retired");
  const auto binding = decodeFieldInputBinding(metadata->at("fieldGroupBinding").asString());
  if (binding.ownerId != field.at("ownerId") || binding.outerTarget != plan.at("outerTarget") || binding.inputTarget != plan.at("inputTarget"))
    throw std::invalid_argument("field-input-original-roots-retired");
  return binding;
}
inline const folly::dynamic &fieldInputOriginal(const folly::dynamic &snapshot, int32_t target) {
  for (const auto &row : snapshot.at("originals")) if (row.at("target") == target) return row;
  throw std::invalid_argument("field-input-original-target-retired");
}
inline FieldInputIdentity fieldInputIdentity(const folly::dynamic &document, const folly::dynamic &snapshot,
    const TFieldInputBinding &binding, int32_t target, int64_t epoch) {
  const auto &original = fieldInputOriginal(snapshot, target), &field = document.at("fieldGroup").at("field");
  return {binding.ownerId, binding.bindingId, binding.bindingRevision,
    fieldGroupTarget(field.at("metadataTarget")), binding.outerTarget, binding.inputTarget,
    fieldGroupTarget(document.at("surfaceId")), target, document.at("documentId").asString(), document.at("revision").asString(),
    snapshot.at("windowId").asString(), snapshot.at("mount").at("mountRevision").asString(),
    snapshot.at("outerInstance").asString(), snapshot.at("inputInstance").asString(),
    original.at("nativeInstance").asString(), original.at("editorInstance").asString(), epoch};
}
inline bool fieldInputScopeCurrent(const FieldInputIdentity &expected, const folly::dynamic &document,
    const folly::dynamic &snapshot, int64_t epoch) {
  const auto binding = fieldInputBinding(document);
  return fieldInputIdentity(document, snapshot, binding, expected.target, epoch).sameScope(expected);
}
inline folly::dynamic fieldInputPacket(const FieldInputDispatchFrames::Handle &ticket, const TFieldInputBinding &binding,
    const folly::dynamic &groups) {
  return folly::dynamic::object("moduleLease", binding.moduleLease)("token", ticket->token)("eventId", ticket->eventId)
    ("phase", ticket->phase)("identity", encodeFieldInputIdentity(ticket->identity))("groups", groups);
}
inline FieldGroupTraversal fieldInputTraversal(const folly::dynamic &document, const folly::dynamic &snapshot) {
  const auto &plan = document.at("fieldGroup");
  std::vector<TFieldGroupNode> nodes;
  for (const auto &row : document.at("nodes")) nodes.push_back({fieldGroupTarget(row.at("target")),
    static_cast<int32_t>(row.at("parent").asInt()), row.at("hidden").asBool() || row.at("displayNone").asBool()});
  FieldGroupTraversal traversal(std::move(nodes), fieldGroupTarget(plan.at("outerTarget")), fieldGroupTarget(plan.at("inputTarget")));
  std::vector<TFieldGroupFocusable> originals;
  for (const auto &row : snapshot.at("originals")) if (row.at("eligible").asBool()) originals.push_back({fieldGroupTarget(row.at("target")),
    row.at("placeholder").asBool(), row.at("rect").at("x").asDouble(), row.at("tabStop").asBool()});
  traversal.admit(std::move(originals));
  return traversal;
}
inline int32_t fieldInputFocusTarget(const folly::dynamic &document, const folly::dynamic &snapshot,
    const FieldInputFocusAction &action, int32_t originalHit = 0) {
  const auto &plan = document.at("fieldGroup");
  if (action.groupTarget != fieldGroupTarget(plan.at("outerTarget")))
    throw std::invalid_argument("field-input-focus-scope-not-current");
  const auto traversal = fieldInputTraversal(document, snapshot);
  const auto focused = static_cast<int32_t>(snapshot.at("focusedTarget").asInt());
  if (action.kind == "first") return traversal.first();
  if (action.kind == "next") return traversal.logical(focused, 1);
  if (action.kind == "previous") return traversal.logical(focused, -1);
  if (action.kind == "press") return traversal.press(originalHit);
  if (action.kind == "physical-left" || action.kind == "physical-right") {
    if (!focused) return 0;
    const auto &from = fieldInputOriginal(snapshot, focused);
    return traversal.visual(from.at("rect").at("x").asDouble(), action.kind == "physical-left" ? -1 : 1);
  }
  throw std::invalid_argument("field-input-focus-kind-invalid");
}
inline const char *fieldInputDispositionName(FieldInputDisposition value) {
  switch (value) {
    case FieldInputDisposition::Allowed: return "allowed";
    case FieldInputDisposition::Prevented: return "prevented";
    case FieldInputDisposition::Unacknowledged: return "unacknowledged";
    case FieldInputDisposition::TimedOut: return "timed-out";
    case FieldInputDisposition::Failed: return "failed";
    case FieldInputDisposition::Retired: return "retired";
  }
  throw std::invalid_argument("field-input-disposition-invalid");
}
inline folly::dynamic orderedFieldInputGroups(const folly::dynamic &document,
    const std::vector<TFieldInputBinding> &bindings, int32_t originalTarget) {
  std::unordered_map<int32_t, int32_t> parents;
  for (const auto &node : document.at("nodes")) parents.emplace(fieldGroupTarget(node.at("target")), static_cast<int32_t>(node.at("parent").asInt()));
  std::unordered_map<int32_t, size_t> ancestry;
  int32_t target = originalTarget;
  while (target && parents.contains(target)) { ancestry.emplace(target, ancestry.size()); target = parents.at(target); }
  struct Group { int32_t target; const TFieldInputBinding *binding; size_t distance; };
  std::vector<Group> groups;
  std::unordered_set<int32_t> originals;
  for (const auto &binding : bindings) {
    if (!ancestry.contains(binding.inputTarget) && !ancestry.contains(binding.outerTarget)) continue;
    const folly::dynamic *committed = nullptr;
    for (const auto &node : document.at("nodes")) {
      const auto encoded = node.get_ptr("fieldGroupBinding");
      if (!encoded || encoded->asString().empty()) continue;
      const auto candidate = decodeFieldInputBinding(encoded->asString());
      if (candidate.ownerId != binding.ownerId || candidate.bindingId != binding.bindingId) continue;
      if (committed || candidate.bindingRevision != binding.bindingRevision || candidate.moduleLease != binding.moduleLease ||
          candidate.outerTarget != binding.outerTarget || candidate.inputTarget != binding.inputTarget)
        throw std::invalid_argument("field-input-original-group-descriptor-retired");
      committed = &node;
    }
    if (!committed) throw std::invalid_argument("field-input-original-group-descriptor-unavailable");
    for (const auto root : {binding.inputTarget, binding.outerTarget}) {
      if (!ancestry.contains(root)) continue;
      if (!originals.insert(root).second) throw std::invalid_argument("field-input-original-group-ambiguous");
      groups.push_back({root, &binding, ancestry.at(root)});
    }
  }
  std::sort(groups.begin(), groups.end(), [](const auto &left, const auto &right) { return left.distance < right.distance; });
  folly::dynamic result = folly::dynamic::array;
  for (const auto &group : groups) result.push_back(folly::dynamic::object("target", group.target)
    ("bindingId", group.binding->bindingId)("bindingRevision", group.binding->bindingRevision)("scopeTarget", group.binding->outerTarget));
  return result;
}
} // namespace codon::form
