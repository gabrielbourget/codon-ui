#include "FormDocumentQuery.h"
#include "FieldSemanticQuery.h"

#include <folly/json.h>
#include <react/renderer/components/CodonNativeInputSpec/Props.h>
#include <react/renderer/components/view/YogaStylableProps.h>
#include <react/renderer/mounting/ShadowTree.h>
#include <stdexcept>
#include <string_view>
#include <unordered_set>
#include <cmath>

namespace codon::form {
using namespace facebook::react;

static void validateOwnedDateField(const TFabricFormDocument &document, const CUIFieldBindingProps &field,
    Tag metadata, std::unordered_set<Tag> &editorTargets) {
  const auto binding = folly::parseJson(field.ownedEditorBinding);
  const auto fail = [] { throw std::runtime_error("Native form: invalid owned date field"); };
  const auto integer = [](const folly::dynamic &value, bool tag) {
    if (!value.isNumber()) return false;
    const auto number = value.asDouble();
    return std::isfinite(number) && number > 0 && std::floor(number) == number &&
      number <= (tag ? 2147483647.0 : 9007199254740991.0);
  };
  if (!binding.isObject() || binding["kind"] != "date-field" || !integer(binding["rootTarget"], true) ||
      !binding["segments"].isArray() || binding["segments"].empty()) fail();
  const auto root = static_cast<Tag>(binding["rootTarget"].asDouble());
  if (!document.positions.contains(root) || root == metadata || !isFormDocumentDescendant(document, metadata, root)) fail();
  const auto &segments = binding["segments"];
  if (!segments[0].isObject() || !segments[0]["ownerId"].isString() || segments[0]["ownerId"].asString().empty()) fail();
  const auto expectedOwner = segments[0]["ownerId"].asString();
  std::vector<Tag> originals;
  for (const auto &entry : document.preorder)
    if (std::string_view(entry.node->getComponentName()) == "CUIDateSegment" &&
        isFormDocumentDescendant(document, entry.node->getTag(), root) &&
        static_cast<const CUIDateSegmentProps *>(entry.node->getProps().get())->ownerId == expectedOwner)
      originals.push_back(entry.node->getTag());
  if (originals.size() != segments.size() || originals.empty() || originals.front() != field.editorTarget) fail();
  std::unordered_set<std::string> ids;
  std::string owner, window;
  for (size_t index = 0; index < originals.size(); ++index) {
    const auto &row = segments[index];
    if (!row.isObject() || row.size() != 8) fail();
    for (const auto key : {"ownerId", "segmentId", "bindingRevision", "nativeInstance", "windowId"})
      if (!row[key].isString() || row[key].asString().empty()) fail();
    if (!integer(row["target"], true) || !integer(row["surfaceId"], true) || !integer(row["epoch"], false) ||
        row["target"].asDouble() != originals[index] || row["surfaceId"].asDouble() != document.root->getSurfaceId() ||
        !editorTargets.insert(originals[index]).second || !ids.insert(row["segmentId"].asString()).second) fail();
    if (index && (owner != row["ownerId"].asString() || window != row["windowId"].asString())) fail();
    owner = row["ownerId"].asString(); window = row["windowId"].asString();
    const auto &node = document.preorder[document.positions.at(originals[index])].node;
    const auto &props = *static_cast<const CUIDateSegmentProps *>(node->getProps().get());
    if (props.ownerId != owner || props.segmentId != row["segmentId"].asString() ||
        props.bindingRevision != row["bindingRevision"].asString()) fail();
  }
}

std::string NativeFormDocumentSession::identityFor(const ShadowNodeFamily::Shared &family) {
  if (!family || identity_.empty()) throw std::runtime_error("Native form: retired document identity");
  std::lock_guard lock(mutex_);
  auto &document = documents_[family->getSurfaceId()];
  if (document.family.lock() != family) {
    document.family = family;
    document.identity = identity_ + ":" + std::to_string(++sequence_);
  }
  return document.identity;
}

std::string queryFabricFormDocumentStamp(const UIManager &manager, SurfaceId surface,
    NativeFormDocumentSession &session, const std::function<void()> &check) {
  if (surface <= 0) throw std::invalid_argument("Native form: current surface required");
  std::optional<std::string> result;
  manager.getShadowTreeRegistry().visit(surface, [&](const ShadowTree &tree) {
    if (check) check();
    const auto revision = tree.getCurrentRevision();
    const auto root = revision.rootShadowNode;
    if (!root || root->getSurfaceId() != surface) throw std::runtime_error("Native form: document unavailable");
    const auto identity = session.identityFor(root->getFamilyShared());
    const auto current = tree.getCurrentRevision();
    if (check) check();
    if (current.number != revision.number || current.rootShadowNode != root)
      throw std::runtime_error("Native form: document revision retired");
    result = folly::toJson(folly::dynamic::object("documentId", identity)("surfaceId", surface)
      ("rootTarget", root->getTag())("revision", std::to_string(revision.number)));
  });
  if (!result) throw std::runtime_error("Native form: document surface retired");
  return std::move(*result);
}

std::string queryFabricFormDocument(const UIManager &manager, SurfaceId surface, Tag target,
    NativeFormDocumentSession &session, const std::function<void()> &check) {
  if (target <= 0) throw std::invalid_argument("Native form: current target and document required");
  const auto document = surface == 0 ? captureFabricFormDocumentForTarget(manager, target, check) :
      captureFabricFormDocument(manager, surface, check);
  const auto documentId = session.identityFor(document.root->getFamilyShared());
  if (!document.positions.contains(target)) throw std::runtime_error("Native form: target outside current document");
  folly::dynamic nodes = folly::dynamic::array;
  folly::dynamic forms = folly::dynamic::array;
  folly::dynamic fields = folly::dynamic::array;
  std::unordered_set<std::string> descriptorIds;
  std::unordered_set<Tag> editorTargets, formTargets;
  for (size_t index = 0; index < document.preorder.size(); ++index) {
    if (check) check();
    const auto &entry = document.preorder[index];
    const auto &node = *entry.node;
    const auto *style = dynamic_cast<const YogaStylableProps *>(node.getProps().get());
    nodes.push_back(folly::dynamic::object("target", node.getTag())
      ("parent", entry.parent ? document.preorder[*entry.parent].node->getTag() : 0)
      ("component", node.getComponentName())
      ("nativeId", node.getProps()->nativeId)
      ("hidden", node.getTraits().check(ShadowNodeTraits::Trait::Hidden))
      ("displayNone", style && style->yogaStyle.display() == facebook::yoga::Display::None));
    const auto name = std::string_view(node.getComponentName());
    if (name == "CUIDateSegment") nodes[nodes.size() - 1]["dateSegmentOwner"] =
      static_cast<const CUIDateSegmentProps *>(node.getProps().get())->ownerId;
    // The generated app library owns custom prop vtables on Android. Resolve
    // its exact component identity before reading its generated prop type.
    const auto *form = name == "CUIFormRoot" ? static_cast<const CUIFormRootProps *>(node.getProps().get()) : nullptr;
    const auto *field = name == "CUIFieldBinding" ? static_cast<const CUIFieldBindingProps *>(node.getProps().get()) : nullptr;
    if (field) {
      nodes[nodes.size() - 1]["fieldSemantics"] = field->semanticBinding;
      if (!field->ownedEditorBinding.empty()) nodes[nodes.size() - 1]["ownedEditorBinding"] = field->ownedEditorBinding;
    }
    if (name == "CUIFocusView") nodes[nodes.size() - 1]["collectionBinding"] =
      static_cast<const CUIFocusViewProps *>(node.getProps().get())->nativeCollectionBinding;
    if (!form && !field) continue;
    const auto &owner = form ? form->ownerId : field->ownerId;
    const auto &id = form ? form->descriptorId : field->descriptorId;
    const auto &revision = form ? form->descriptorRevision : field->descriptorRevision;
    const auto original = form ? form->formTarget : field->editorTarget;
    if (owner.empty() || id.empty() || revision.empty() || !descriptorIds.insert(id).second || original <= 0 ||
        !document.positions.contains(original))
      throw std::runtime_error("Native form: incomplete or duplicate descriptor");
    folly::dynamic descriptor = folly::dynamic::object("ownerId", owner)("descriptorId", id)
      ("descriptorRevision", revision)("metadataTarget", node.getTag())("target", original)
      ("position", index)("formId", form ? form->formId : field->formId);
    if (form) {
      if (!formTargets.insert(original).second || !isFormDocumentDescendant(document, node.getTag(), original))
        throw std::runtime_error("Native form: invalid original form root");
      forms.push_back(std::move(descriptor));
    } else {
      if (!field->ownedEditorBinding.empty()) {
        validateOwnedDateField(document, *field, node.getTag(), editorTargets);
        descriptor["ownedEditorBinding"] = field->ownedEditorBinding;
      } else {
        const auto editorName = std::string_view(document.preorder[document.positions.at(original)].node->getComponentName());
        if (editorName != "TextInput" && editorName != "AndroidTextInput")
          throw std::runtime_error("Native form: original core editor required");
        if (!editorTargets.insert(original).second) throw std::runtime_error("Native form: duplicate editor binding");
      }
      descriptor["hasFormAssociation"] = field->hasFormAssociation;
      fields.push_back(std::move(descriptor));
    }
  }
  resolveFieldSemanticPlans(nodes);
  if (check) check();
  if (!isFabricFormDocumentCurrent(manager, document)) throw std::runtime_error("Native form: document revision retired");
  return folly::toJson(folly::dynamic::object("documentId", documentId)("surfaceId", document.root->getSurfaceId())
    ("rootTarget", document.root->getTag())("revision", std::to_string(document.revision))
    ("target", target)("nodes", std::move(nodes))("forms", std::move(forms))("fields", std::move(fields)));
}
} // namespace codon::form
