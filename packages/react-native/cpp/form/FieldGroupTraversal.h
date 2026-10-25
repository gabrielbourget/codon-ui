#pragma once

// Pinned FocusScope/useDatePickerGroup algorithms; Apache-2.0.
// Source identities: ../../src/date/entry/UPSTREAM.json.
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <limits>
#include <stdexcept>
#include <unordered_map>
#include <vector>

namespace codon::form {
struct TFieldGroupNode {
  int32_t target;
  int32_t parent;
  bool hidden{false};
};
struct TFieldGroupFocusable {
  int32_t target;
  bool placeholder{false};
  double left{0};
  bool tabStop{true};
};
struct TFieldGroupNativePosition {
  int32_t target;
  int32_t parent;
  std::vector<int32_t> order;
};

// Portal event ancestry remains in Fabric. Focus walking follows the mounted
// native tree; virtual nodes retain their source parents around ordinary views.
inline std::vector<TFieldGroupNode> fieldGroupPhysicalNodes(
    const std::vector<TFieldGroupNode> &logical, const std::vector<TFieldGroupNativePosition> &native) {
  if (logical.empty()) throw std::invalid_argument("field-group-physical-root-missing");
  std::unordered_map<int32_t, size_t> positions;
  for (size_t index = 0; index < logical.size(); ++index)
    if (!positions.emplace(logical[index].target, index).second)
      throw std::invalid_argument("field-group-physical-source-ambiguous");
  std::unordered_map<int32_t, const TFieldGroupNativePosition *> mounted;
  for (const auto &row : native) {
    if (!positions.contains(row.target) || (row.parent && !positions.contains(row.parent)) || row.target == row.parent ||
        std::any_of(row.order.begin(), row.order.end(), [](int32_t index) { return index < 0; }) ||
        !mounted.emplace(row.target, &row).second)
      throw std::invalid_argument("field-group-physical-native-invalid");
  }
  auto physical = logical;
  std::unordered_map<int32_t, std::vector<int32_t>> children;
  std::unordered_map<int32_t, bool> reordered;
  const auto root = logical.front().target;
  for (auto &row : physical) {
    if (row.target == root) { row.parent = 0; continue; }
    if (const auto found = mounted.find(row.target); found != mounted.end()) {
      auto ancestor = row.parent;
      std::unordered_map<int32_t, bool> visited;
      while (ancestor && !mounted.contains(ancestor)) {
        if (!positions.contains(ancestor) || !visited.emplace(ancestor, true).second)
          throw std::invalid_argument("field-group-physical-source-invalid");
        ancestor = logical[positions.at(ancestor)].parent;
      }
      const auto parent = found->second->parent ? found->second->parent : root;
      if (ancestor != parent) { row.parent = parent; reordered[parent] = true; }
    }
    if (!positions.contains(row.parent)) throw std::invalid_argument("field-group-physical-parent-missing");
    children[row.parent].push_back(row.target);
  }
  const auto anchor = [&](const auto &self, int32_t target, std::unordered_map<int32_t, bool> &visiting)
      -> const TFieldGroupNativePosition * {
    if (!visiting.emplace(target, true).second) throw std::invalid_argument("field-group-physical-cycle");
    const TFieldGroupNativePosition *result = nullptr;
    if (const auto found = mounted.find(target); found != mounted.end()) result = found->second;
    else if (const auto found = children.find(target); found != children.end())
      for (const auto child : found->second) {
        const auto candidate = self(self, child, visiting);
        if (candidate && (!result || candidate->order < result->order)) result = candidate;
      }
    visiting.erase(target);
    return result;
  };
  for (auto &[parent, siblings] : children) if (reordered[parent]) {
    std::unordered_map<int32_t, const TFieldGroupNativePosition *> anchors;
    for (const auto target : siblings) {
      std::unordered_map<int32_t, bool> visiting;
      const auto value = anchor(anchor, target, visiting);
      if (!value) throw std::invalid_argument("field-group-physical-order-unavailable");
      anchors.emplace(target, value);
    }
    std::stable_sort(siblings.begin(), siblings.end(), [&](int32_t first, int32_t second) {
      return anchors.at(first)->order < anchors.at(second)->order;
    });
  }
  std::vector<TFieldGroupNode> result;
  std::unordered_map<int32_t, bool> visited;
  const auto append = [&](const auto &self, int32_t target) -> void {
    if (!visited.emplace(target, true).second) throw std::invalid_argument("field-group-physical-cycle");
    result.push_back(physical[positions.at(target)]);
    if (const auto found = children.find(target); found != children.end())
      for (const auto child : found->second) self(self, child);
  };
  append(append, root);
  if (result.size() != logical.size()) throw std::invalid_argument("field-group-physical-disconnected");
  return result;
}

// Callers select logical Fabric or captured native order explicitly. Native SDK
// admission supplies the eligible originals; no JS ref registry participates.
class FieldGroupTraversal final {
 public:
  FieldGroupTraversal(std::vector<TFieldGroupNode> nodes, int32_t outer, int32_t input)
      : nodes_(std::move(nodes)), outer_(outer), input_(input) {
    std::vector<int32_t> path;
    for (size_t index = 0; index < nodes_.size(); ++index) {
      auto &node = nodes_[index];
      if (node.target <= 0 || !positions_.emplace(node.target, index).second)
        throw std::invalid_argument("field-group-ambiguous-document");
      if (index == 0) {
        if (node.parent != 0) throw std::invalid_argument("field-group-document-root-invalid");
      } else {
        const auto parent = std::find(path.begin(), path.end(), node.parent);
        if (parent == path.end()) throw std::invalid_argument("field-group-document-order-invalid");
        path.erase(parent + 1, path.end());
        node.hidden = node.hidden || nodes_[positions_.at(node.parent)].hidden;
      }
      path.push_back(node.target);
    }
    if (outer == input || !contains(outer) || !contains(input) || !descendant(input, outer))
      throw std::invalid_argument("field-group-roots-invalid");
  }
  bool contains(int32_t target) const { return positions_.contains(target); }
  size_t preorderPosition(int32_t target) const { return positions_.at(target); }
  bool descendant(int32_t target, int32_t ancestor) const {
    if (!contains(ancestor)) return false;
    while (contains(target)) {
      if (target == ancestor) return true;
      target = nodes_[positions_.at(target)].parent;
    }
    return false;
  }
  bool visible(int32_t target) const { return contains(target) && !nodes_[positions_.at(target)].hidden; }
  std::vector<int32_t> descendants() const {
    std::vector<int32_t> result;
    for (const auto &node : nodes_) if (node.target != outer_ && descendant(node.target, outer_)) result.push_back(node.target);
    return result;
  }
  std::vector<int32_t> groups(int32_t originalTarget) const {
    std::vector<int32_t> result;
    if (descendant(originalTarget, input_)) result.push_back(input_);
    if (descendant(originalTarget, outer_)) result.push_back(outer_);
    return result;
  }
  void admit(std::vector<TFieldGroupFocusable> originals) {
    size_t previous = 0;
    bool first = true;
    for (const auto &original : originals) {
      if (original.target == outer_ || !descendant(original.target, outer_) || !visible(original.target) ||
          !std::isfinite(original.left) || (!first && positions_.at(original.target) <= previous))
        throw std::invalid_argument("field-group-original-order-invalid");
      first = false;
      previous = positions_.at(original.target);
    }
    originals_ = std::move(originals);
  }
  int32_t first() const { return originals_.empty() ? 0 : originals_.front().target; }
  FieldGroupTraversal within(int32_t root) const {
    if (!descendant(root, input_)) throw std::invalid_argument("field-group-date-input-retired");
    auto result = *this;
    std::erase_if(result.originals_, [&](const auto &row) { return !descendant(row.target, root); });
    return result;
  }
  int32_t logical(int32_t current, int direction) const {
    validateDirection(direction);
    if (originals_.empty()) return 0;
    // The original walker starts at an actual non-focusable descendant too.
    if (!descendant(current, outer_)) return direction == 1 ? first() : originals_.back().target;
    const auto from = positions_.at(current);
    if (direction == 1) {
      for (const auto &original : originals_) if (positions_.at(original.target) > from) return original.target;
    } else {
      for (auto it = originals_.rbegin(); it != originals_.rend(); ++it)
        if (positions_.at(it->target) < from) return it->target;
    }
    return 0;
  }
  int32_t visual(double fromLeft, int direction) const {
    validateDirection(direction);
    if (!std::isfinite(fromLeft)) throw std::invalid_argument("field-group-geometry-invalid");
    int32_t selected = 0;
    double nearest = std::numeric_limits<double>::infinity();
    for (const auto &original : originals_) {
      if (!original.tabStop) continue;
      const auto distance = original.left - fromLeft;
      if ((direction == 1 ? distance > 0 : distance < 0) && std::abs(distance) < nearest) {
        nearest = std::abs(distance);
        selected = original.target;
      }
    }
    return selected;
  }
  int32_t press(int32_t originalTarget) const {
    if (!descendant(originalTarget, outer_)) throw std::invalid_argument("field-group-press-target-foreign");
    std::vector<TFieldGroupFocusable> tabbable;
    for (const auto &row : originals_) if (row.tabStop) tabbable.push_back(row);
    if (tabbable.empty()) return 0;
    int32_t predecessor = 0;
    for (const auto &row : tabbable)
      if (positions_.at(row.target) < positions_.at(originalTarget)) predecessor = row.target;
    // No predecessor starts at the end, including a press on the group itself.
    auto index = tabbable.size() - 1;
    if (predecessor) {
      const auto found = std::find_if(tabbable.begin(), tabbable.end(), [&](const auto &row) { return row.target == predecessor; });
      index = static_cast<size_t>(found - tabbable.begin());
    }
    while (index > 0 && tabbable[index].placeholder && tabbable[index - 1].placeholder) --index;
    return tabbable[index].target;
  }
 private:
  static void validateDirection(int direction) {
    if (direction != -1 && direction != 1) throw std::invalid_argument("field-group-direction-invalid");
  }
  std::vector<TFieldGroupNode> nodes_;
  std::unordered_map<int32_t, size_t> positions_;
  int32_t outer_, input_;
  std::vector<TFieldGroupFocusable> originals_;
};
} // namespace codon::form
