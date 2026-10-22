#pragma once

#include "FieldSemanticIds.h"
#include <folly/json.h>
#include <array>
#include <limits>

namespace codon::form {
inline int32_t fieldSemanticTarget(const folly::dynamic &value) {
  if (!value.isInt() || value.asInt() <= 0 || value.asInt() > std::numeric_limits<int32_t>::max())
    throw std::invalid_argument("field-semantic-target-invalid");
  return static_cast<int32_t>(value.asInt());
}

inline void resolveFieldSemanticPlans(folly::dynamic &nodes) {
  std::vector<TFieldSemanticIdNode> values;
  std::unordered_map<int32_t, size_t> positions;
  for (size_t index = 0; index < nodes.size(); ++index) {
    const auto &node = nodes[index];
    const auto target = fieldSemanticTarget(node.at("target"));
    values.push_back({target, node.at("nativeId").asString()}); positions.emplace(target, index);
  }
  FieldSemanticIds ids(values);
  std::unordered_map<size_t, folly::dynamic> bindings;
  constexpr std::array flags = {"disabled", "readOnly", "required", "invalid", "expanded"};
  constexpr std::array relations = {"labelledBy", "describedBy", "errorMessageBy", "detailsBy", "controls"};
  constexpr std::array captions = {"role", "state", "expanded", "collapsed", "required", "invalid", "readOnly", "disabled", "yes", "no", "options", "activeOption", "autocomplete", "list", "details"};
  for (size_t index = 0; index < nodes.size(); ++index) {
    auto &node = nodes[index];
    const auto encoded = node.get_ptr("fieldSemantics");
    if (!encoded || !encoded->isString() || encoded->asString().empty()) continue;
    try {
      auto binding = folly::parseJson(encoded->asString());
      const bool dateField = binding.isObject() && binding.get_ptr("dateField");
      if (!binding.isObject() || binding.size() != (dateField ? 15 : 14) || !binding.at("revision").isString() || binding.at("revision").asString().empty() ||
          !binding.at("aliases").isArray() || !binding.at("labels").isObject() || binding.at("labels").size() != captions.size())
        throw std::invalid_argument("field-semantic-binding-invalid");
      for (const auto key : flags) if (!binding.at(key).isBool()) throw std::invalid_argument("field-semantic-flag-invalid");
      for (const auto key : captions) if (!binding.at("labels").at(key).isString()) throw std::invalid_argument("field-semantic-caption-invalid");
      for (const auto key : relations) {
        if (!binding.at(key).isArray()) throw std::invalid_argument("field-semantic-relation-invalid");
        for (const auto &id : binding.at(key)) if (!id.isString() || id.asString().empty()) throw std::invalid_argument("field-semantic-id-invalid");
      }
      if (dateField) {
        const auto &date = binding.at("dateField");
        if (!date.isObject() || date.size() != 1 || binding.at("expanded").asBool() ||
            !binding.at("controls").empty() || !binding.at("activeDescendant").isNull())
          throw std::invalid_argument("date-field-semantic-binding-invalid");
        const auto target = fieldSemanticTarget(date.at("firstEditableTarget"));
        if (!positions.contains(target) || nodes[positions.at(target)].at("component") != "CUIDateSegment")
          throw std::invalid_argument("date-field-semantic-editor-invalid");
        const auto encodedOwned = node.get_ptr("ownedEditorBinding");
        if (!encodedOwned || !encodedOwned->isString() || encodedOwned->asString().empty())
          throw std::invalid_argument("date-field-semantic-owner-required");
        const auto owned = folly::parseJson(encodedOwned->asString());
        bool member = false;
        for (const auto &segment : owned.at("segments")) if (fieldSemanticTarget(segment.at("target")) == target) member = true;
        if (!member) throw std::invalid_argument("date-field-semantic-editor-outside-owner");
      }
      // Validate all aliases before publishing any contribution from this field.
      for (const auto &alias : binding.at("aliases")) {
        if (!alias.isObject() || alias.size() != 2 || !alias.at("id").isString() || alias.at("id").asString().empty() ||
            !positions.contains(fieldSemanticTarget(alias.at("target")))) throw std::invalid_argument("field-semantic-alias-invalid");
      }
      const auto &active = binding.at("activeDescendant");
      if (!active.isNull() && (!active.isObject() || active.size() != 2 || !positions.contains(fieldSemanticTarget(active.at("target"))) ||
          !active.at("binding").isString() || active.at("binding").asString().empty()))
        throw std::invalid_argument("field-semantic-option-invalid");
      if (!active.isNull()) {
        const auto &option = nodes[positions.at(fieldSemanticTarget(active.at("target")))];
        if (option.at("component") != "CUIFocusView" || option.at("collectionBinding") != active.at("binding"))
          throw std::invalid_argument("field-semantic-option-retired");
      }
      for (const auto &alias : binding.at("aliases")) ids.addAlias(alias.at("id").asString(), fieldSemanticTarget(alias.at("target")));
      bindings.emplace(index, std::move(binding));
    } catch (const std::exception &) { node["semanticError"] = "field-semantic-binding-invalid"; }
  }
  for (auto &[index, binding] : bindings) {
    auto &node = nodes[index];
    try {
      folly::dynamic plan = folly::dynamic::object("revision", binding.at("revision"))("labels", binding.at("labels"));
      for (const auto key : flags) plan[key] = binding.at(key);
      for (const auto key : relations) {
        folly::dynamic targets = folly::dynamic::array;
        for (const auto &id : binding.at(key)) targets.push_back(ids.resolve(id.asString()));
        plan[key] = std::move(targets);
      }
      plan["activeDescendant"] = binding.at("activeDescendant");
      if (const auto date = binding.get_ptr("dateField")) plan["dateField"] = *date;
      node["semanticPlan"] = std::move(plan);
    } catch (const std::exception &) { node["semanticError"] = "field-semantic-id-unavailable-or-ambiguous"; }
  }
}
} // namespace codon::form
