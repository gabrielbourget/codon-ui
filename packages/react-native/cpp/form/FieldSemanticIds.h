#pragma once

#include <cstdint>
#include <set>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace codon::form {
struct TFieldSemanticIdNode { int32_t target; std::string nativeId; };

// One immutable Fabric document supplies every target. Duplicate IDs remain
// ambiguous; registration order and another physical window cannot pick one.
class FieldSemanticIds {
 public:
  explicit FieldSemanticIds(const std::vector<TFieldSemanticIdNode> &nodes) {
    for (const auto &node : nodes) {
      if (node.target <= 0 || !targets_.insert(node.target).second)
        throw std::invalid_argument("field-semantic-document-target-invalid");
      if (!node.nativeId.empty()) ids_[node.nativeId].insert(node.target);
    }
  }
  void addAlias(const std::string &id, int32_t target) {
    if (id.empty() || !targets_.contains(target)) throw std::invalid_argument("field-semantic-alias-outside-document");
    ids_[id].insert(target);
  }
  int32_t resolve(const std::string &id) const {
    const auto found = ids_.find(id);
    if (id.empty() || found == ids_.end() || found->second.size() != 1)
      throw std::invalid_argument("field-semantic-id-unavailable-or-ambiguous");
    return *found->second.begin();
  }
 private:
  std::unordered_set<int32_t> targets_;
  std::unordered_map<std::string, std::set<int32_t>> ids_;
};
} // namespace codon::form
