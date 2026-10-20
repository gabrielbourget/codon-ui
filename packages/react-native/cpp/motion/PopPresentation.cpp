#include "PopPresentation.h"
#include "PopStyle.h"

#include <folly/json.h>
#include <react/renderer/core/ComponentDescriptor.h>
#include <react/renderer/mounting/ShadowTree.h>
#include <algorithm>
#include <atomic>
#include <limits>
#include <stdexcept>
#include <unordered_set>

namespace codon::motion {
using namespace facebook::react;
namespace {
std::atomic<uint64_t> sequence{0};
std::shared_ptr<const ShadowNode> nodeIn(const RootShadowNode &root, const ShadowNodeFamily &family) {
  const auto ancestors = family.getAncestors(root);
  if (ancestors.empty()) return nullptr;
  const auto &[parent, index] = ancestors.back();
  return parent.get().getChildren().at(index);
}
int readTag(const folly::dynamic &request, const char *key, bool zero = false) {
  const auto &value = request.at(key);
  if (!value.isInt() || value.asInt() < (zero ? 0 : 1) || value.asInt() > std::numeric_limits<int>::max())
    throw std::invalid_argument("Native popLayout: actual tag required");
  return static_cast<int>(value.asInt());
}
std::string readString(const folly::dynamic &request, const char *key) {
  const auto &value = request.at(key);
  if (!value.isString() || value.asString().empty())
    throw std::invalid_argument("Native popLayout: request identity required");
  return value.asString();
}
Props::Shared patch(const ShadowNode &node, const Props::Shared &source, const folly::dynamic &style) {
  return node.getComponentDescriptor().cloneProps(
      {node.getSurfaceId(), *node.getContextContainer()}, source, RawProps(style));
}
} // namespace

NativePopPresentation::NativePopPresentation(std::shared_ptr<UIManager> manager) : manager_(std::move(manager)) {
  if (!manager_) throw std::invalid_argument("Native popLayout: manager required");
  manager_->registerCommitHook(*this);
}
NativePopPresentation::~NativePopPresentation() noexcept { close(); }

Props::Shared NativePopPresentation::authoredProps(const ShadowNode &node) {
  std::lock_guard lock(mutex_);
  if (closed_) throw std::runtime_error("Native motion layout: presentation session retired");
  if (!failure_.empty()) throw std::runtime_error(failure_);
  const auto incoming = node.getProps();
  const auto found = authored_.find(incoming.get());
  if (found == authored_.end() || found->second.presentation.lock() != incoming ||
      found->second.family.lock() != node.getFamilyShared()) return incoming;
  // Restore only the style fields owned by this presentation lease into a
  // separate props object. Children, editor state and mounted props stay intact.
  return patch(node, incoming, found->second.style);
}

void NativePopPresentation::prune() {
  const auto now = std::chrono::steady_clock::now();
  std::unordered_set<std::string> retained;
  std::erase_if(authored_, [](const auto &value) {
    return value.second.presentation.expired() || value.second.family.expired();
  });
  for (const auto &[props, value] : authored_) retained.insert(value.lease);
  for (auto iterator = entries_.begin(); iterator != entries_.end();) {
    auto &entry = iterator->second;
    if (entry.family.expired() || (!entry.active && !retained.contains(iterator->first) &&
        (entry.released || now - entry.captured > std::chrono::seconds(5)))) iterator = entries_.erase(iterator);
    else ++iterator;
  }
}

void NativePopPresentation::flush(int surface, bool allowMissing, bool restoreBranches) {
  bool committed = false;
  const bool found = manager_->getShadowTreeRegistry().visit(surface, [&](const ShadowTree &tree) {
    const auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(5000);
    const auto commit = [&](ShadowTreeCommitSource source) {
      for (int attempt = 0; attempt < 8; attempt++) {
        if (std::chrono::steady_clock::now() >= deadline) break;
        const auto result = tree.tryCommit([](const RootShadowNode &root) {
          return std::static_pointer_cast<RootShadowNode>(root.ShadowNode::clone({}));
        }, {.enableStateReconciliation = true, .mountSynchronously = false, .source = source});
        if (result == ShadowTreeCommitStatus::Succeeded) return true;
        if (result == ShadowTreeCommitStatus::Cancelled) break;
      }
      return false;
    };
    committed = commit(ShadowTreeCommitSource::Unknown);
    // A retiring module cannot leave a frozen node in RN's pending React
    // branch to be promoted after this hook has been unregistered.
    if (committed && restoreBranches && tree.getCurrentReactRevision())
      committed = commit(ShadowTreeCommitSource::React);
  });
  if (!found && allowMissing) return;
  std::lock_guard lock(mutex_);
  if (!failure_.empty()) throw std::runtime_error(failure_);
  if (!committed) throw std::runtime_error("Native popLayout: presentation commit unavailable");
}

std::string NativePopPresentation::request(const std::string &encoded) {
  const auto request = folly::parseJson(encoded);
  const auto action = readString(request, "action");
  const auto owner = readString(request, "owner");
  {
    std::lock_guard lock(mutex_);
    if (closed_) throw std::runtime_error("Native popLayout: session retired");
    if (!failure_.empty() && action != "release") throw std::runtime_error(failure_);
    prune();
  }
  if (action == "capture") {
    const auto root = readTag(request, "containingRoot", true);
    auto frame = captureNativePopFrame(*manager_, readTag(request, "target"), root);
    const auto family = frame.snapshot.target->getFamilyShared();
    const auto *props = dynamic_cast<const YogaStylableProps *>(frame.snapshot.target->getProps().get());
    if (!props) throw std::runtime_error("Native popLayout: actual style props unavailable");
    captureNativePopStyle(*props);
    auto response = encodeNativePopFrame(frame);
    response["requestId"] = readString(request, "requestId");
    const auto lease = std::to_string(++sequence);
    response["lease"] = lease;
    std::lock_guard lock(mutex_);
    if (closed_) throw std::runtime_error("Native popLayout: session retired");
    for (auto &[key, entry] : entries_)
      if (entry.family.lock() == family) {
        if (entry.active) throw std::runtime_error("Native popLayout: family already has an active presentation owner");
        entry.released = true;
      }
    entries_.emplace(lease, Entry{family, frame.positionedParent->getFamilyShared(),
        family->getSurfaceId(), family->getTag(), root, owner, std::chrono::steady_clock::now(),
        frame.width, frame.height, frame.left, frame.top, frame.right, frame.bottom, frame.rightToLeft});
    return folly::toJson(response);
  }
  const auto lease = readString(request, "lease");
  int surface;
  std::shared_ptr<ShadowNodeFamily> family, parent;
  int target, root;
  {
    std::lock_guard lock(mutex_);
    const auto found = entries_.find(lease);
    // Cleanup is idempotent after an unmount/expired pending capture.
    if (action == "release" && found == entries_.end())
      return folly::toJson(folly::dynamic::object("lease", lease)("released", true));
    if (found == entries_.end() || found->second.owner != owner)
      throw std::runtime_error("Native popLayout: foreign or retired presentation lease");
    auto &entry = found->second;
    surface = entry.surface; target = entry.tag; root = entry.containingRoot;
    family = entry.family.lock(); parent = entry.parent.lock();
    if (action == "release") { entry.active = false; entry.released = true; }
    else if (action != "activate" || entry.released || !family || !parent ||
        std::chrono::steady_clock::now() - entry.captured > std::chrono::seconds(5))
      throw std::runtime_error("Native popLayout: invalid presentation activation");
  }
  if (action == "activate") {
    const auto current = captureNativePopFrame(*manager_, target, root);
    if (current.snapshot.target->getFamilyShared() != family || current.positionedParent->getFamilyShared() != parent)
      throw std::runtime_error("Native popLayout: original family or containing block retired");
    const auto anchorX = readString(request, "anchorX"), anchorY = readString(request, "anchorY");
    if ((anchorX != "left" && anchorX != "right") || (anchorY != "top" && anchorY != "bottom"))
      throw std::invalid_argument("Native popLayout: invalid anchors");
    std::lock_guard lock(mutex_);
    auto &entry = entries_.at(lease);
    if (closed_ || entry.released) throw std::runtime_error("Native popLayout: activation retired");
    for (const auto &[key, other] : entries_)
      if (key != lease && other.family.lock() == family && other.active)
        throw std::runtime_error("Native popLayout: family already has an active presentation owner");
    const bool physicalRight = (anchorX == "right") != entry.rtl;
    entry.style = nativePopStyle(entry.width, entry.height,
        physicalRight ? entry.right : entry.left, anchorY == "bottom" ? entry.bottom : entry.top,
        entry.rtl, anchorX == "right", anchorY == "bottom");
    entry.active = true;
  }
  flush(surface, action == "release");
  return folly::toJson(folly::dynamic::object("lease", lease)("released", action == "release"));
}

RootShadowNode::Unshared NativePopPresentation::shadowTreeWillCommit(
    const ShadowTree &tree, const RootShadowNode::Shared &oldRoot,
    const RootShadowNode::Unshared &nextRoot, const ShadowTreeCommitOptions &options) noexcept {
  std::lock_guard lock(mutex_);
  try {
    auto result = nextRoot;
    for (auto &[lease, entry] : entries_) {
      if (entry.surface != tree.getSurfaceId()) continue;
      const auto family = entry.family.lock();
      if (!family) continue;
      const auto node = nodeIn(*result, *family);
      if (!node) { entry.active = false; entry.released = true; continue; }
      const auto incoming = node->getProps();
      const auto findAuthored = [&](const Props::Shared &props) -> const Authored * {
        const auto found = authored_.find(props.get());
        return found != authored_.end() && found->second.presentation.lock() == props && found->second.family.lock() == family
            ? &found->second : nullptr;
      };
      const auto known = findAuthored(incoming);
      if (!entry.active && (!known || known->lease != lease)) continue;
      auto authored = incoming;
      if (known) authored = patch(*node, incoming, known->style);
      else if (options.source != ShadowTreeCommitSource::React) {
        const auto oldNode = nodeIn(*oldRoot, *family);
        if (oldNode) {
          const auto previous = findAuthored(oldNode->getProps());
          if (previous) authored = patch(*node, incoming, previous->style);
        }
      }
      // RN exposes this map for its imperative updates. Copy only our style
      // keys; the original family map and all unrelated props remain untouched.
      folly::dynamic native = folly::dynamic::object();
      {
        std::lock_guard nativeLock(family->nativePropsMutex);
        if (family->nativeProps_DEPRECATED) native = filterNativePopStyle(*family->nativeProps_DEPRECATED);
      }
      if (!native.empty()) authored = patch(*node, authored, native);
      auto output = authored;
      if (entry.active) {
        const auto *props = dynamic_cast<const YogaStylableProps *>(authored.get());
        if (!props) throw std::runtime_error("Native popLayout: style family changed");
        const auto style = captureNativePopStyle(*props);
        output = patch(*node, authored, entry.style);
        authored_.insert_or_assign(output.get(), Authored{output, family, lease, style});
      }
      auto cloned = result->cloneTree(*family, [&](const ShadowNode &current) {
        return current.getComponentDescriptor().cloneShadowNode(current, {.props = output});
      });
      if (!cloned) throw std::runtime_error("Native popLayout: family clone unavailable");
      result = std::static_pointer_cast<RootShadowNode>(cloned);
    }
    prune();
    return result;
  } catch (const std::exception &failure) {
    failure_ = failure.what();
    for (auto &[lease, entry] : entries_) if (entry.surface == tree.getSurfaceId()) entry.active = false;
    return nextRoot;
  } catch (...) {
    failure_ = "Native popLayout: presentation commit failed";
    for (auto &[lease, entry] : entries_) if (entry.surface == tree.getSurfaceId()) entry.active = false;
    return nextRoot;
  }
}

void NativePopPresentation::close() noexcept {
  std::vector<int> surfaces;
  {
    std::lock_guard lock(mutex_);
    if (closed_) return;
    closed_ = true;
    for (auto &[lease, entry] : entries_) {
      entry.active = false; entry.released = true;
      if (std::find(surfaces.begin(), surfaces.end(), entry.surface) == surfaces.end()) surfaces.push_back(entry.surface);
    }
  }
  for (const auto surface : surfaces) {
    try { flush(surface, true, true); } catch (...) {}
  }
  manager_->unregisterCommitHook(*this);
}

} // namespace codon::motion
