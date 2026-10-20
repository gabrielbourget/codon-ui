#include "PopFrame.h"

#include <folly/json.h>
#include <react/renderer/core/LayoutableShadowNode.h>
#include <react/renderer/dom/DOM.h>
#include <chrono>
#include <cmath>
#include <limits>
#include <stdexcept>

namespace codon::motion {
using namespace facebook::react;

TNativePopFrame captureNativePopFrame(
    const UIManager &manager, int target, int containingRoot) {
  if (target <= 0 || containingRoot < 0)
    throw std::invalid_argument("Native popLayout: invalid native target");
  const auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(5000);
  const auto check = [&] {
    if (std::chrono::steady_clock::now() >= deadline)
      throw std::runtime_error("Native popLayout: Fabric read exceeded 5000ms");
  };
  const auto candidate = manager.findShadowNodeByTag_DEPRECATED(target);
  check();
  if (!candidate) throw std::runtime_error("Native popLayout: native target unavailable");
  const auto family = candidate->getFamilyShared();
  const auto owns = [family](const ShadowNode &node) {
    return node.getFamilyShared() == family;
  };
  auto snapshot = captureNativeFabricSnapshot(
      manager, candidate->getSurfaceId(), target, owns, check);
  const auto *layout = dynamic_cast<const LayoutableShadowNode *>(snapshot.target.get());
  if (!layout || layout->getLayoutMetrics() == EmptyLayoutMetrics)
    throw std::runtime_error("Native popLayout: actual displayed layout required");
  const auto ancestors = family->getAncestors(*snapshot.root);
  if (ancestors.empty()) throw std::runtime_error("Native popLayout: connected descendant required");
  if (containingRoot && containingRoot != target) {
    bool found = false;
    for (const auto &[ancestor, index] : ancestors) {
      check();
      if (ancestor.get().getTag() == containingRoot) found = true;
    }
    if (!found) throw std::runtime_error("Native popLayout: native style root is not an ancestor");
  }
  const auto offset = dom::getOffset(snapshot.root, *snapshot.target);
  const auto *parent = dynamic_cast<const LayoutableShadowNode *>(offset.offsetParent.get());
  if (!parent || parent->getLayoutMetrics() == EmptyLayoutMetrics)
    throw std::runtime_error("Native popLayout: positioned native ancestor unavailable");
  const auto metrics = layout->getLayoutMetrics();
  const auto parentMetrics = parent->getLayoutMetrics();
  if (metrics.layoutDirection != LayoutDirection::LeftToRight &&
      metrics.layoutDirection != LayoutDirection::RightToLeft)
    throw std::runtime_error("Native popLayout: resolved layout direction required");
  const auto width = metrics.frame.size.width;
  const auto height = metrics.frame.size.height;
  // Yoga's absolute insets start inside the containing block's border.
  const auto innerWidth = parentMetrics.frame.size.width -
      parentMetrics.borderWidth.left - parentMetrics.borderWidth.right;
  const auto innerHeight = parentMetrics.frame.size.height -
      parentMetrics.borderWidth.top - parentMetrics.borderWidth.bottom;
  const auto right = innerWidth - width - offset.left;
  const auto bottom = innerHeight - height - offset.top;
  const double values[]{width, height, offset.left, offset.top, right, bottom, innerWidth, innerHeight};
  for (const auto value : values)
    if (!std::isfinite(value)) throw std::runtime_error("Native popLayout: non-finite native layout");
  if (width < 0 || height < 0 || innerWidth < 0 || innerHeight < 0)
    throw std::runtime_error("Native popLayout: invalid native dimensions");
  check();
  if (!isNativeFabricSnapshotCurrent(manager, snapshot, owns))
    throw std::runtime_error("Native popLayout: Fabric frame retired");
  return {std::move(snapshot), offset.offsetParent, width, height, offset.left,
      offset.top, right, bottom, metrics.layoutDirection == LayoutDirection::RightToLeft};
}

folly::dynamic encodeNativePopFrame(const TNativePopFrame &frame) {
  return folly::dynamic::object("kind", "native-pop-frame")
      ("target", frame.snapshot.target->getTag())
      ("surfaceId", frame.snapshot.target->getSurfaceId())
      ("fabricRevision", std::to_string(frame.snapshot.revision))
      ("positionedParent", frame.positionedParent->getTag())
      ("width", frame.width)("height", frame.height)
      ("left", frame.left)("top", frame.top)("right", frame.right)("bottom", frame.bottom)
      ("direction", frame.rightToLeft ? "rtl" : "ltr");
}

std::string queryNativePopFrame(const UIManager &manager, const std::string &encoded) {
  const auto request = folly::parseJson(encoded);
  const auto readTag = [&](const char *key, bool allowZero) {
    const auto &value = request.at(key);
    if (!value.isInt() || value.asInt() < (allowZero ? 0 : 1) ||
        value.asInt() > std::numeric_limits<int>::max())
      throw std::invalid_argument("Native popLayout: invalid native tag");
    return static_cast<int>(value.asInt());
  };
  const auto &nonce = request.at("requestId");
  if (!nonce.isString() || nonce.asString().empty())
    throw std::invalid_argument("Native popLayout: request identity required");
  auto response = encodeNativePopFrame(captureNativePopFrame(
      manager, readTag("target", false), readTag("containingRoot", true)));
  response["requestId"] = nonce;
  return folly::toJson(response);
}

} // namespace codon::motion
