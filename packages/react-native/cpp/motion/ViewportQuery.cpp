// Immutable traversal adapted from RN0.86.3 LayoutableShadowNode and its
// IntersectionObserver. See UPSTREAM.json and LICENSE.react-native.md.
#include "ViewportQuery.h"

#include <folly/json.h>
#include <react/renderer/components/CodonNativeInputSpec/Props.h>
#include <react/renderer/components/view/YogaStylableProps.h>
#include <react/renderer/core/LayoutableShadowNode.h>
#include <react/timing/primitives.h>
#include <chrono>
#include <cmath>
#include <limits>
#include <optional>
#include <stdexcept>
#include <vector>

namespace codon::motion {
using namespace facebook::react;
using Rect = facebook::react::Rect;
namespace {
std::string text(const folly::dynamic &request, const char *key, bool allowEmpty = false) {
  const auto &value = request.at(key);
  if (!value.isString() || (!allowEmpty && value.asString().empty()))
    throw std::invalid_argument("Native viewport: request identity required");
  return value.asString();
}
int tag(const folly::dynamic &request, const char *key, bool zero = false) {
  const auto &value = request.at(key);
  if (!value.isInt() || value.asInt() < (zero ? 0 : 1) || value.asInt() > std::numeric_limits<int>::max())
    throw std::invalid_argument("Native viewport: actual native tag required");
  return static_cast<int>(value.asInt());
}
std::optional<Rect> intersect(const Rect &first, const Rect &second) {
  const auto left = std::max(first.getMinX(), second.getMinX());
  const auto top = std::max(first.getMinY(), second.getMinY());
  const auto right = std::min(first.getMaxX(), second.getMaxX());
  const auto bottom = std::min(first.getMaxY(), second.getMaxY());
  if (left > right || top > bottom) return std::nullopt;
  return Rect{{left, top}, {right - left, bottom - top}};
}
struct TBox { Rect rect; bool displayed; bool intersects; };
TBox mappedBox(const ShadowNode &node, const RootShadowNode &root,
    const ShadowNodeFamily *clipRoot, bool paddingBox, bool clipping,
    const TNativeFabricReadGuard &check) {
  const auto *target = dynamic_cast<const LayoutableShadowNode *>(&node);
  if (!target) throw std::runtime_error("Native viewport: actual layout node required");
  std::vector<const ShadowNode *> chain{&node};
  if (!ShadowNode::sameFamily(node, root)) {
    const auto ancestors = node.getFamily().getAncestors(root);
    if (ancestors.empty()) throw std::runtime_error("Native viewport: family disconnected");
    for (auto iterator = ancestors.rbegin(); iterator != ancestors.rend(); ++iterator)
      chain.push_back(&iterator->first.get());
  }
  const auto metrics = target->getLayoutMetrics();
  auto rect = paddingBox ? metrics.getPaddingFrame() : Rect{{0, 0}, metrics.frame.size};
  bool belowRoot = true, hasIntersection = true;
  for (size_t index = 0; index < chain.size(); index++) {
    check();
    const auto *current = dynamic_cast<const LayoutableShadowNode *>(chain[index]);
    if (!current) throw std::runtime_error("Native viewport: actual ancestor layout required");
    const auto layout = current->getLayoutMetrics();
    if (layout == EmptyLayoutMetrics || layout.displayType == DisplayType::None) return {{}, false, false};
    auto frame = layout.frame;
    if (index == chain.size() - 1) frame.origin = {0, 0};
    rect.origin += frame.origin;
    rect = current->getTransform().applyWithCenter(rect, frame.getCenter());
    if (index) rect.origin += current->getContentOriginOffset(true);
    if (&current->getFamily() == clipRoot) belowRoot = false;
    // The explicit root's clip is represented by the margin-expanded root
    // rectangle. Its outer ancestors do not further clip an explicit root.
    if (clipping && index && belowRoot && hasIntersection) {
      const auto overflow = insetBy(frame * current->getTransform(), layout.overflowInset);
      const auto clipped = intersect(rect, overflow);
      if (!clipped) hasIntersection = false;
      else rect = *clipped;
    }
  }
  return {rect, true, hasIntersection};
}
folly::dynamic encode(const Rect &rect) {
  const double values[]{rect.origin.x, rect.origin.y, rect.size.width, rect.size.height};
  for (const auto value : values)
    if (!std::isfinite(value)) throw std::runtime_error("Native viewport: non-finite native geometry");
  return folly::dynamic::array(values[0], values[1], values[2], values[3]);
}
} // namespace

std::string queryNativeViewport(const UIManager &manager, const std::string &encoded) {
  const auto request = folly::parseJson(encoded);
  const auto targetTag = tag(request, "target"), rootTag = tag(request, "root", true);
  const auto owner = text(request, "ownerId"), binding = text(request, "bindingId"),
      nativeRevision = text(request, "nativeViewRevision", true);
  const auto candidate = manager.findShadowNodeByTag_DEPRECATED(targetTag);
  if (!candidate) throw std::runtime_error("Native viewport: actual target unavailable");
  const auto family = candidate->getFamilyShared();
  const auto owns = [&](const ShadowNode &node) {
    if (node.getFamilyShared() != family || std::string(node.getComponentName()) != "CUIFocusView") return false;
    const auto &props = static_cast<const CUIFocusViewProps &>(*node.getProps());
    return props.ownerId == owner && props.nativeMotionGeometryBinding == binding &&
        props.nativeMotionGeometryRevision == nativeRevision;
  };
  const auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(5000);
  const auto check = [&] {
    if (std::chrono::steady_clock::now() >= deadline)
      throw std::runtime_error("Native viewport: immutable query exceeded 5000ms");
  };
  const auto snapshot = captureNativeFabricSnapshot(manager, candidate->getSurfaceId(), targetTag, owns, check);
  std::shared_ptr<const ShadowNode> root = snapshot.root;
  if (rootTag && rootTag != root->getTag()) {
    root = manager.findShadowNodeByTag_DEPRECATED(rootTag);
    if (!root || root->getSurfaceId() != snapshot.target->getSurfaceId())
      throw std::runtime_error("Native viewport: root belongs to a different native surface");
    const auto ancestors = root->getFamily().getAncestors(*snapshot.root);
    if (ancestors.empty()) throw std::runtime_error("Native viewport: root disconnected");
    const auto &[parent, index] = ancestors.back();
    root = parent.get().getChildren().at(index);
  }
  const auto *rootProps = dynamic_cast<const YogaStylableProps *>(root->getProps().get());
  const bool paddingBox = rootTag && rootProps && rootProps->yogaStyle.overflow() != facebook::yoga::Overflow::Visible;
  const auto rootBox = mappedBox(*root, *snapshot.root, nullptr, paddingBox, false, check);
  auto rootRect = rootBox.rect;
  const auto &margins = request.at("margins");
  if (!margins.isArray() || margins.size() != 4) throw std::invalid_argument("Native viewport: four margins required");
  double resolved[4];
  for (size_t index = 0; index < 4; index++) {
    const auto &margin = margins[index];
    if (!margin.at("value").isNumber() || !margin.at("percent").isBool())
      throw std::invalid_argument("Native viewport: invalid margin");
    resolved[index] = margin.at("value").asDouble() *
        (margin.at("percent").asBool() ? rootRect.size.width / 100.0 : 1);
    if (!std::isfinite(resolved[index])) throw std::invalid_argument("Native viewport: non-finite margin");
  }
  rootRect.origin.x -= resolved[3]; rootRect.origin.y -= resolved[0];
  const bool invertedRoot = rootRect.size.width + resolved[1] + resolved[3] < 0 ||
      rootRect.size.height + resolved[0] + resolved[2] < 0;
  rootRect.size.width = std::max(0.0, static_cast<double>(rootRect.size.width) + resolved[1] + resolved[3]);
  rootRect.size.height = std::max(0.0, static_cast<double>(rootRect.size.height) + resolved[0] + resolved[2]);
  const auto target = mappedBox(*snapshot.target, *snapshot.root, nullptr, false, false, check);
  const auto clipped = mappedBox(*snapshot.target, *snapshot.root, &root->getFamily(), false, true, check);
  const bool descendant = !rootTag || ShadowNode::sameFamily(*snapshot.target, *root) ||
      !snapshot.target->getFamily().getAncestors(*root).empty();
  const auto intersection = !invertedRoot && rootBox.displayed && target.displayed && clipped.intersects && descendant
      ? intersect(rootRect, clipped.rect) : std::nullopt;
  const double area = target.rect.size.width * target.rect.size.height;
  const double ratio = intersection ? area == 0 ? 1 :
      std::min(1.0, static_cast<double>(intersection->size.width * intersection->size.height) / area) : 0;
  folly::dynamic result = folly::dynamic::object("kind", "native-viewport")
      ("requestId", text(request, "requestId"))("target", targetTag)("root", rootTag)
      ("surfaceId", snapshot.target->getSurfaceId())("fabricRevision", std::to_string(snapshot.revision))
      ("ownerId", owner)("bindingId", binding)("nativeViewRevision", nativeRevision)
      ("rootBounds", encode(rootRect))("boundingClientRect", encode(target.rect))
      ("intersectionRect", encode(intersection.value_or(Rect{})))
      ("isIntersecting", intersection.has_value())("intersectionRatio", ratio)
      ("time", HighResTimeStamp::now().toDOMHighResTimeStamp());
  check();
  if (!isNativeFabricSnapshotCurrent(manager, snapshot, owns))
    throw std::runtime_error("Native viewport: Fabric revision retired");
  return folly::toJson(result);
}
} // namespace codon::motion
