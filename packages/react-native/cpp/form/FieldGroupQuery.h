#pragma once

#include "FieldGroupTraversal.h"
#include <folly/json.h>
#include <optional>

namespace codon::form {
inline int32_t fieldGroupTarget(const folly::dynamic &value) {
  if (!value.isNumber() || !std::isfinite(value.asDouble()) || value.asDouble() <= 0 ||
      value.asDouble() > INT32_MAX || value.asDouble() != std::floor(value.asDouble()))
    throw std::invalid_argument("field-group-target-invalid");
  return static_cast<int32_t>(value.asDouble());
}

// The plan is structural evidence only. The SDK resolver must still admit the
// exact mounted metadata, whole original segment set, roots and window.
inline folly::dynamic fieldGroupPlan(const folly::dynamic &document, const folly::dynamic &request) {
  if (!request.isObject() || request.size() != 3 || !request.at("mount").isObject())
    throw std::invalid_argument("field-group-request-invalid");
  const auto outer = fieldGroupTarget(request.at("outerTarget"));
  const auto input = fieldGroupTarget(request.at("inputTarget"));
  const auto &mount = request.at("mount");
  const auto metadata = fieldGroupTarget(mount.at("target"));
  std::vector<TFieldGroupNode> nodes;
  std::unordered_map<int32_t, const folly::dynamic *> byTarget;
  for (const auto &node : document.at("nodes")) {
    const auto target = fieldGroupTarget(node.at("target"));
    nodes.push_back({target, static_cast<int32_t>(node.at("parent").asInt()),
      node.at("hidden").asBool() || node.at("displayNone").asBool()});
    byTarget.emplace(target, &node);
  }
  FieldGroupTraversal traversal(std::move(nodes), outer, input);
  const folly::dynamic *field = nullptr;
  for (const auto &candidate : document.at("fields")) if (candidate.at("metadataTarget") == metadata) {
    if (field) throw std::invalid_argument("field-group-descriptor-ambiguous");
    field = &candidate;
  }
  if (!field || !field->get_ptr("ownedEditorBinding") ||
      !traversal.descendant(metadata, outer) || !traversal.visible(outer) || !traversal.visible(input))
    throw std::invalid_argument("field-group-owned-descriptor-required");
  for (const auto *key : {"ownerId", "descriptorId", "descriptorRevision"})
    if (field->at(key) != mount.at(key)) throw std::invalid_argument("field-group-descriptor-retired");
  if (field->at("target") != mount.at("originalTarget") || document.at("surfaceId") != mount.at("surfaceId") ||
      !mount.at("complete").asBool() || !mount.at("active").asBool() || !mount.at("attached").asBool())
    throw std::invalid_argument("field-group-mount-retired");
  const auto owned = folly::parseJson(field->at("ownedEditorBinding").asString());
  if (fieldGroupTarget(owned.at("rootTarget")) != outer)
    throw std::invalid_argument("field-group-original-root-retired");
  for (const auto &segment : owned.at("segments"))
    if (!traversal.descendant(fieldGroupTarget(segment.at("target")), input))
      throw std::invalid_argument("field-group-input-does-not-contain-owner");
  folly::dynamic descendants = folly::dynamic::array;
  for (const auto target : traversal.descendants()) {
    auto row = *byTarget.at(target);
    row["visible"] = traversal.visible(target);
    folly::dynamic groups = folly::dynamic::array;
    for (const auto group : traversal.groups(target)) groups.push_back(group);
    row["groups"] = std::move(groups);
    descendants.push_back(std::move(row));
  }
  return folly::dynamic::object("outerTarget", outer)("inputTarget", input)("field", *field)
    ("mount", mount)("nodes", std::move(descendants));
}
inline folly::dynamic fieldGroupSelection(const folly::dynamic &document, const folly::dynamic &snapshot) {
  const auto &plan = document.at("fieldGroup");
  std::vector<TFieldGroupNode> nodes;
  for (const auto &node : document.at("nodes")) nodes.push_back({fieldGroupTarget(node.at("target")),
    static_cast<int32_t>(node.at("parent").asInt()), node.at("hidden").asBool() || node.at("displayNone").asBool()});
  FieldGroupTraversal traversal(std::move(nodes), fieldGroupTarget(plan.at("outerTarget")), fieldGroupTarget(plan.at("inputTarget")));
  std::vector<TFieldGroupFocusable> originals;
  const auto focused = static_cast<int32_t>(snapshot.at("focusedTarget").asInt());
  std::optional<double> focusedLeft;
  for (const auto &row : snapshot.at("originals")) {
    const auto target = fieldGroupTarget(row.at("target"));
    if (target == focused) focusedLeft = row.at("rect").at("x").asDouble();
    if (row.at("eligible").asBool()) originals.push_back({target, row.at("placeholder").asBool(),
      row.at("rect").at("x").asDouble(), row.at("tabStop").asBool()});
  }
  traversal.admit(std::move(originals));
  return folly::dynamic::object("first", traversal.first())("next", traversal.logical(focused, 1))
    ("previous", traversal.logical(focused, -1))("physicalLeft", focusedLeft ? traversal.visual(*focusedLeft, -1) : 0)
    ("physicalRight", focusedLeft ? traversal.visual(*focusedLeft, 1) : 0);
}
} // namespace codon::form
