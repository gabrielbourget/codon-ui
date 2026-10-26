#include "StickyPresentation.h"
#include "StickyConstraints.h"
#include "../motion/FabricSnapshot.h"
#include "../motion/NativeStyle.h"
#include <folly/json.h>
#include <react/renderer/components/scrollview/ScrollViewShadowNode.h>
#include <react/renderer/core/ComponentDescriptor.h>
#include <react/renderer/core/LayoutableShadowNode.h>
#include <react/renderer/mounting/ShadowTree.h>
#include <algorithm>
#include <atomic>
#include <cmath>
#include <limits>
#include <stdexcept>

namespace codon::table {
using namespace facebook::react;
namespace {
std::atomic<uint64_t> sequence{0};
std::shared_ptr<const ShadowNode> findNode(const RootShadowNode &root, const ShadowNodeFamily &family) {
  const auto ancestors = family.getAncestors(root);
  if (ancestors.empty()) return nullptr;
  const auto &[parent, index] = ancestors.back();
  return parent.get().getChildren().at(index);
}
std::string text(const folly::dynamic &request, const char *key) {
  const auto &value = request.at(key);
  if (!value.isString() || value.asString().empty()) throw std::invalid_argument("Table sticky: identity required");
  return value.asString();
}
int tag(const folly::dynamic &request, const char *key) {
  const auto &value = request.at(key);
  if (!value.isInt() || value.asInt() < 1 || value.asInt() > std::numeric_limits<int>::max())
    throw std::invalid_argument("Table sticky: original native tag required");
  return static_cast<int>(value.asInt());
}
folly::dynamic nativeOverrides(const ShadowNodeFamily &family) {
  std::lock_guard lock(family.nativePropsMutex);
  folly::dynamic result = folly::dynamic::object();
  if (!family.nativeProps_DEPRECATED) return result;
  for (const auto &item : family.nativeProps_DEPRECATED->items()) {
    const auto name = item.first.asString();
    if (name == "position" || name == "transform" || name == "backgroundColor" || name == "zIndex" ||
        name == "left" || name == "right" || name == "top" || name == "bottom" || name == "start" || name == "end" ||
        name.starts_with("inset")) result[name] = item.second;
  }
  return result;
}
} // namespace

NativeTableStickyPresentation::NativeTableStickyPresentation(std::shared_ptr<UIManager> manager)
    : manager_(std::move(manager)) {
  if (!manager_) throw std::invalid_argument("Table sticky: Fabric manager required");
  manager_->registerCommitHook(*this);
  try { manager_->registerMountHook(*this); }
  catch (...) { manager_->unregisterCommitHook(*this); throw; }
}
NativeTableStickyPresentation::~NativeTableStickyPresentation() noexcept {
  try { close(); } catch (...) {}
}
void NativeTableStickyPresentation::setMountCallback(std::function<void()> callback) {
  std::lock_guard lock(mutex_);
  onMount_ = std::move(callback);
}

std::string NativeTableStickyPresentation::request(const std::string &encoded) {
  const auto request = folly::parseJson(encoded);
  const auto action = text(request, "action"), owner = text(request, "owner");
  if (action == "release" || action == "check") {
    const auto lease = text(request, "lease");
    std::lock_guard lock(mutex_);
    const auto found = entries_.find(lease);
    if (found != entries_.end() && found->second.owner != owner)
      throw std::runtime_error("Table sticky: foreign lease");
    if (action == "release") {
      if (found != entries_.end()) { found->second.released = true; found->second.active = false; found->second.restore = true; }
      return folly::toJson(folly::dynamic::object("lease", lease)("released", true));
    }
    if (!failure_.empty()) throw std::runtime_error(failure_);
    return folly::toJson(folly::dynamic::object("lease", lease)("owner", owner)
        ("current", !closed_ && found != entries_.end() && !found->second.released));
  }
  if (action != "register") throw std::invalid_argument("Table sticky: unknown operation");
  const auto requestId = text(request, "requestId");
  const auto target = tag(request, "target"), rootTag = tag(request, "containingRoot");
  const auto candidate = manager_->findShadowNodeByTag_DEPRECATED(target);
  if (!candidate) throw std::runtime_error("Table sticky: target unavailable");
  const auto family = candidate->getFamilyShared();
  auto snapshot = codon::motion::captureNativeFabricSnapshot(*manager_, candidate->getSurfaceId(), target,
      [family](const ShadowNode &node) { return node.getFamilyShared() == family; });
  nativeStickyViewProps(*snapshot.target, snapshot.target->getProps());
  ShadowNodeFamily::Shared rootFamily;
  for (const auto &[ancestor, index] : family->getAncestors(*snapshot.root)) {
    (void)index;
    if (ancestor.get().getTag() == rootTag) rootFamily = ancestor.get().getFamilyShared();
  }
  if (!rootFamily) throw std::runtime_error("Table sticky: original Table ancestor required");
  const auto &insets = request.at("insets");
  if (!insets.isObject() || !insets.count("top")) throw std::invalid_argument("Table sticky: root inset fallback required");
  const auto session = request.at("session");
  if (!session.isNull()) {
    if (!session.isObject()) throw std::invalid_argument("Table sticky: invalid source session");
    text(session, "scopeOwnerId"); text(session, "windowId");
    const auto &epoch = session.at("epoch");
    if (!epoch.isNumber() || !std::isfinite(epoch.asDouble()) || epoch.asDouble() < 1 ||
        std::floor(epoch.asDouble()) != epoch.asDouble())
      throw std::invalid_argument("Table sticky: invalid source epoch");
  }
  const auto lease = "native-table-presentation:" + std::to_string(++sequence);
  {
    std::lock_guard lock(mutex_);
    if (closed_) throw std::runtime_error("Table sticky: module retired");
    if (!failure_.empty()) throw std::runtime_error(failure_);
    for (const auto &[key, entry] : entries_) {
      (void)key;
      if (!entry.released && entry.family.lock() == family) throw std::runtime_error("Table sticky: family already owned");
    }
    entries_.emplace(lease, Entry{family, rootFamily, candidate->getSurfaceId(), target, rootTag, owner,
        folly::dynamic::object("top", insets.at("top"))("backgroundColor", request.at("backgroundColor")), session});
  }
  return folly::toJson(folly::dynamic::object("lease", lease)("registered", true)("owner", owner)
      ("requestId", requestId)("target", target)("containingRoot", rootTag));
}

std::vector<TStickyTarget> NativeTableStickyPresentation::targets() {
  std::lock_guard lock(mutex_);
  std::vector<TStickyTarget> result;
  if (closed_) return result;
  for (const auto &[lease, entry] : entries_)
    if (!entry.released) result.push_back({lease, entry.tag, entry.rootTag, entry.session});
  return result;
}

void NativeTableStickyPresentation::synchronize() {
  std::vector<int> surfaces;
  {
    std::lock_guard lock(mutex_);
    for (const auto &[lease, entry] : entries_) {
      (void)lease;
      if (entry.restore) surfaces.push_back(entry.surface);
    }
  }
  std::sort(surfaces.begin(), surfaces.end());
  surfaces.erase(std::unique(surfaces.begin(), surfaces.end()), surfaces.end());
  for (const auto surface : surfaces) {
    flush(surface, true);
    std::lock_guard lock(mutex_);
    for (auto &[lease, entry] : entries_) {
      (void)lease;
      if (entry.surface == surface && entry.released) entry.restore = false;
    }
    const bool active = std::any_of(entries_.begin(), entries_.end(), [surface](const auto &value) {
      return value.second.surface == surface && !value.second.released;
    });
    if (!active) mounted_.erase(surface);
  }
}

Props::Shared NativeTableStickyPresentation::authoredProps(const ShadowNode &node) {
  const auto incoming = node.getProps();
  std::optional<TStickyAuthoredStyle> style;
  {
    std::lock_guard lock(mutex_);
    const auto found = authored_.find(incoming.get());
    if (found != authored_.end() && found->second.presentation.lock() == incoming &&
        found->second.family.lock() == node.getFamilyShared()) style = found->second.style;
  }
  return style ? cloneNativeStickyStyle(node, incoming, style->fields, style->transform) : incoming;
}

RootShadowNode::Shared NativeTableStickyPresentation::mountedRoot(int surface) {
  {
    std::lock_guard lock(mutex_);
    const auto found = mounted_.find(surface);
    if (found != mounted_.end()) return found->second;
  }
  RootShadowNode::Shared root;
  manager_->getShadowTreeRegistry().visit(surface, [&](const ShadowTree &tree) {
    const auto coordinator = tree.getMountingCoordinator();
    if (!coordinator || coordinator->hasPendingTransactions()) return;
    const auto baseline = coordinator->getBaseRevision();
    if (!coordinator->hasPendingTransactions()) root = baseline.rootShadowNode;
  });
  return root;
}

bool NativeTableStickyPresentation::frame(const std::string &lease, const TStickyViewport &viewport) {
  Entry entry;
  bool activate = false;
  {
    std::lock_guard lock(mutex_);
    const auto found = entries_.find(lease);
    if (closed_ || found == entries_.end() || found->second.released) return false;
    if (!failure_.empty()) throw std::runtime_error(failure_);
    activate = !found->second.active;
    found->second.active = true;
    entry = found->second;
  }
  if (activate) flush(entry.surface);
  const auto root = mountedRoot(entry.surface);
  const auto family = entry.family.lock(), tableFamily = entry.rootFamily.lock();
  if (!root) return true;
  const auto node = family ? findNode(*root, *family) : nullptr;
  const auto table = tableFamily ? findNode(*root, *tableFamily) : nullptr;
  if (!node || !table) { retire(lease); return false; }
  const auto *tableLayout = dynamic_cast<const LayoutableShadowNode *>(table.get());
  const auto *layout = dynamic_cast<const LayoutableShadowNode *>(node.get());
  if (!tableLayout || !layout) throw std::runtime_error("Table sticky: actual layout unavailable");
  const auto relative = LayoutableShadowNode::computeRelativeLayoutMetrics(*family, *tableLayout,
      {.includeTransform = false, .includeViewportOffset = false});
  if (relative == EmptyLayoutMetrics) return true;
  const auto source = authoredProps(*node);
  const auto &props = nativeStickyViewProps(*node, source);
  double x = 0, y = 0;
  if (!props.cuiHasAuthoredPosition && props.yogaStyle.positionType() == facebook::yoga::PositionType::Relative) {
    const bool rtl = relative.layoutDirection == LayoutDirection::RightToLeft;
    const auto &context = root->getConcreteProps().layoutContext;
    const auto insets = nativeStickyInsets(props, entry.fallback, rtl, context.swapLeftAndRightInRTL,
        viewport.viewportWidth, viewport.viewportHeight);
    const auto tableMetrics = tableLayout->getLayoutMetrics();
    const auto normalX = viewport.tableX + relative.frame.origin.x - viewport.scrollBelowTableX;
    const auto normalY = viewport.tableY + relative.frame.origin.y - viewport.scrollBelowTableY;
    auto style = codon::motion::copyNativeYogaStyle(props, context.swapLeftAndRightInRTL);
    const auto direction = rtl ? facebook::yoga::Direction::RTL : facebook::yoga::Direction::LTR;
    double containingX = viewport.tableX, containingY = viewport.tableY;
    auto containingSize = tableMetrics.frame.size;
    if (std::string_view(table->getComponentName()) == "ScrollView") {
      const auto &scroll = static_cast<const ScrollViewShadowNode &>(*table);
      const auto size = scroll.getStateData().getContentSize();
      const auto origin = scroll.getContentOriginOffset(false);
      containingX += origin.x; containingY += origin.y;
      containingSize.width = std::max(containingSize.width, size.width);
      containingSize.height = std::max(containingSize.height, size.height);
    }
    const auto width = containingSize.width;
    x = nativeStickyAxisOffset({normalX, relative.frame.size.width, containingX, width,
        viewport.viewportX, viewport.viewportWidth,
        style.computeFlexStartMargin(facebook::yoga::FlexDirection::Row, direction, width),
        style.computeFlexEndMargin(facebook::yoga::FlexDirection::Row, direction, width),
        insets[0], insets[2], rtl});
    y = nativeStickyAxisOffset({normalY, relative.frame.size.height, containingY, containingSize.height,
        viewport.viewportY, viewport.viewportHeight,
        style.computeFlexStartMargin(facebook::yoga::FlexDirection::Column, direction, width),
        style.computeFlexEndMargin(facebook::yoga::FlexDirection::Column, direction, width), insets[1], insets[3]});
  }
  bool changed = false;
  {
    std::lock_guard lock(mutex_);
    const auto found = entries_.find(lease);
    if (closed_ || found == entries_.end() || found->second.released) return false;
    changed = found->second.x != x || found->second.y != y ||
        found->second.width != relative.frame.size.width || found->second.height != relative.frame.size.height;
    found->second.x = x; found->second.y = y;
    found->second.width = relative.frame.size.width; found->second.height = relative.frame.size.height;
  }
  if (changed) flush(entry.surface);
  return true;
}

void NativeTableStickyPresentation::flush(int surface, bool allowMissing, bool restoreBranches) {
  bool committed = false;
  const bool found = manager_->getShadowTreeRegistry().visit(surface, [&](const ShadowTree &tree) {
    const auto commit = [&](ShadowTreeCommitSource source, bool synchronous) {
      return tree.tryCommit([](const RootShadowNode &root) {
      return std::static_pointer_cast<RootShadowNode>(root.ShadowNode::clone({}));
      }, {.enableStateReconciliation = true, .mountSynchronously = synchronous,
          .source = source}) == ShadowTreeCommitStatus::Succeeded;
    };
    committed = commit(ShadowTreeCommitSource::Unknown, true);
    if (committed && restoreBranches && tree.getCurrentReactRevision())
      committed = commit(ShadowTreeCommitSource::React, false);
  });
  if (!found && allowMissing) return;
  std::lock_guard lock(mutex_);
  if (!failure_.empty()) throw std::runtime_error(failure_);
  if (!committed) throw std::runtime_error("Table sticky: synchronous presentation commit unavailable");
}

RootShadowNode::Unshared NativeTableStickyPresentation::shadowTreeWillCommit(
    const ShadowTree &tree, const RootShadowNode::Shared &oldRoot,
    const RootShadowNode::Unshared &nextRoot, const ShadowTreeCommitOptions &options) noexcept {
  std::lock_guard lock(mutex_);
  try {
    auto result = nextRoot;
    for (auto &[lease, entry] : entries_) {
      if (entry.surface != tree.getSurfaceId()) continue;
      const auto family = entry.family.lock();
      const auto node = family ? findNode(*result, *family) : nullptr;
      if (!node) { entry.released = true; entry.active = false; continue; }
      const auto knownStyle = [&](const Props::Shared &props) -> const Authored * {
        const auto found = authored_.find(props.get());
        return found != authored_.end() && found->second.presentation.lock() == props &&
            found->second.family.lock() == family ? &found->second : nullptr;
      };
      const auto known = knownStyle(node->getProps());
      if (!entry.active && (!known || known->lease != lease)) continue;
      auto source = node->getProps();
      if (known) source = cloneNativeStickyStyle(*node, source, known->style.fields, known->style.transform);
      else if (options.source != ShadowTreeCommitSource::React) {
        const auto oldNode = findNode(*oldRoot, *family);
        const auto previous = oldNode ? knownStyle(oldNode->getProps()) : nullptr;
        if (previous) source = cloneNativeStickyStyle(*node, source, previous->style.fields, previous->style.transform);
      }
      const auto native = nativeOverrides(*family);
      if (!native.empty()) source = node->getComponentDescriptor().cloneProps(
          {node->getSurfaceId(), *node->getContextContainer()}, source, RawProps(native));
      auto output = source;
      const auto &props = nativeStickyViewProps(*node, source);
      if (entry.active && !entry.released && !props.cuiHasAuthoredPosition &&
          props.yogaStyle.positionType() == facebook::yoga::PositionType::Relative) {
        const auto *layout = dynamic_cast<const LayoutableShadowNode *>(node.get());
        if (!layout) throw std::runtime_error("Table sticky: layout host required");
        const auto style = captureNativeStickyStyle(props);
        output = cloneNativeStickyStyle(*node, source,
            nativeStickyPresentationFields(props, entry.fallback, layout->getLayoutMetrics(), entry.x, entry.y),
            nativeStickyTransform(props.transform, entry.x, entry.y));
        authored_.insert_or_assign(output.get(), Authored{output, family, lease, style});
      }
      const auto cloned = result->cloneTree(*family, [&](const ShadowNode &current) {
        return current.getComponentDescriptor().cloneShadowNode(current, {.props = output});
      });
      if (!cloned) throw std::runtime_error("Table sticky: family clone unavailable");
      result = std::static_pointer_cast<RootShadowNode>(cloned);
    }
    std::erase_if(authored_, [](const auto &entry) { return entry.second.presentation.expired() || entry.second.family.expired(); });
    std::erase_if(entries_, [&](const auto &value) {
      if (!value.second.released || value.second.restore) return false;
      return std::none_of(authored_.begin(), authored_.end(), [&](const auto &item) { return item.second.lease == value.first; });
    });
    return result;
  } catch (const std::exception &error) {
    if (failure_.empty()) failure_ = error.what();
    for (auto &[lease, entry] : entries_) { (void)lease; entry.active = false; }
    return nextRoot;
  } catch (...) {
    if (failure_.empty()) failure_ = "Table sticky: native presentation failed";
    for (auto &[lease, entry] : entries_) { (void)lease; entry.active = false; }
    return nextRoot;
  }
}

void NativeTableStickyPresentation::retire(const std::string &lease) {
  {
    std::lock_guard lock(mutex_);
    const auto found = entries_.find(lease);
    if (found == entries_.end()) return;
    found->second.active = false; found->second.released = true; found->second.restore = true;
  }
  synchronize();
}
void NativeTableStickyPresentation::fail(const std::string &message) {
  std::lock_guard lock(mutex_);
  if (failure_.empty()) failure_ = message;
}
void NativeTableStickyPresentation::shadowTreeDidMount(const RootShadowNode::Shared &root, HighResTimeStamp) noexcept {
  std::function<void()> callback;
  { std::lock_guard lock(mutex_); if (closed_) return;
    const auto surface = root->getSurfaceId();
    if (std::any_of(entries_.begin(), entries_.end(), [surface](const auto &value) { return value.second.surface == surface && !value.second.released; }))
      mounted_[surface] = root;
    else mounted_.erase(surface);
    callback = onMount_; }
  if (callback) { try { callback(); } catch (...) {} }
}
void NativeTableStickyPresentation::shadowTreeDidUnmount(SurfaceId surface, HighResTimeStamp) noexcept {
  std::function<void()> callback;
  {
    std::lock_guard lock(mutex_);
    if (closed_) return;
    mounted_.erase(surface);
    std::erase_if(entries_, [surface](const auto &value) { return value.second.surface == surface; });
    std::erase_if(authored_, [surface](const auto &value) {
      const auto family = value.second.family.lock();
      return !family || family->getSurfaceId() == surface;
    });
    callback = onMount_;
  }
  if (callback) { try { callback(); } catch (...) {} }
}
void NativeTableStickyPresentation::close() {
  std::vector<int> surfaces;
  { std::lock_guard lock(mutex_); if (closed_) return; closed_ = true; onMount_ = {};
    for (auto &[lease, entry] : entries_) { (void)lease; entry.released = true; entry.active = false; surfaces.push_back(entry.surface); } }
  std::sort(surfaces.begin(), surfaces.end()); surfaces.erase(std::unique(surfaces.begin(), surfaces.end()), surfaces.end());
  for (const auto surface : surfaces) { try { flush(surface, true, true); } catch (...) {} }
  manager_->unregisterMountHook(*this);
  manager_->unregisterCommitHook(*this);
  std::lock_guard lock(mutex_);
  mounted_.clear(); authored_.clear(); entries_.clear();
}

} // namespace codon::table
