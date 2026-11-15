#include <algorithm>
#include <cstdint>
#include <iostream>
#include <memory>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

// Opaque Fabric boundaries; the actual prepare/frames coordination bodies are extracted below.
struct Family { int id; };
struct ShadowNode { std::shared_ptr<Family> family; };
struct RootShadowNode {
  using Shared = std::shared_ptr<const RootShadowNode>;
  std::unordered_map<int, std::shared_ptr<ShadowNode>> nodes;
};
struct TStickyViewport { double tableX, tableY, viewportX, viewportY, viewportWidth, viewportHeight, scrollBelowTableX, scrollBelowTableY; };
std::shared_ptr<ShadowNode> findNode(const RootShadowNode &root, const Family &family) {
  const auto found = root.nodes.find(family.id); return found == root.nodes.end() ? nullptr : found->second;
}
class NativeTableStickyPresentation {
 public:
  struct Entry {
    std::weak_ptr<Family> family, rootFamily;
    int surface;
    double x{0}, y{0}, width{-1}, height{-1};
    bool active{false}, released{false}, restore{false};
  };
  struct FrameGeometry { double x, y, width, height; };
  std::mutex mutex_;
  std::unordered_map<std::string, Entry> entries_;
  std::unordered_map<int, RootShadowNode::Shared> roots;
  std::vector<std::shared_ptr<Family>> families;
  std::vector<int> commits;
  std::string failure_;
  bool closed_{false}, failGeometry{false}, advanceDuringGeometry{false}, failFlush{false};
  uint64_t mountedRevision_{0};
  int measurements{0}, retirements{0};
  uint64_t prepareFrames(const std::vector<std::string> &);
  bool frames(uint64_t, const std::vector<std::pair<std::string, TStickyViewport>> &);
  void flush(int surface) { if (failFlush) throw std::runtime_error("synchronous commit failed"); commits.push_back(surface); mountedRevision_++; }
  RootShadowNode::Shared mountedRoot(int surface) { return roots[surface]; }
  void retire(const std::string &lease) { auto &entry = entries_.at(lease); entry.released = true; entry.active = false; entry.restore = true; retirements++; flush(entry.surface); }
  std::optional<FrameGeometry> frameGeometry(const Entry &, const RootShadowNode &, const ShadowNode &, const ShadowNode &, const TStickyViewport &viewport) {
    measurements++;
    if (failGeometry) throw std::runtime_error("geometry error");
    if (advanceDuringGeometry) { mountedRevision_++; advanceDuringGeometry = false; }
    if (viewport.viewportWidth < 0) return std::nullopt;
    return FrameGeometry{viewport.tableX, viewport.tableY, viewport.viewportWidth, viewport.viewportHeight};
  }
  void add(const std::string &lease, int surface, int id) {
    auto root = roots.contains(surface) ? std::const_pointer_cast<RootShadowNode>(roots[surface]) : std::make_shared<RootShadowNode>();
    auto family = std::make_shared<Family>(Family{id}); auto table = std::make_shared<Family>(Family{100 + surface});
    families.push_back(family); families.push_back(table); root->nodes[id] = std::make_shared<ShadowNode>(ShadowNode{family}); root->nodes[100 + surface] = std::make_shared<ShadowNode>(ShadowNode{table});
    roots[surface] = root; entries_.emplace(lease, Entry{family, table, surface});
  }
};
#include "sticky-batch-owned.inc"
void check(bool value, const char *message) { if (!value) throw std::runtime_error(message); }
int main() {
  NativeTableStickyPresentation owner;
  const std::vector<std::string> leases{"selection", "name", "active", "draft"};
  for (size_t index = 0; index < leases.size(); index++) owner.add(leases[index], 1, static_cast<int>(index + 1));
  auto revision = owner.prepareFrames(leases);
  check(owner.commits.size() == 1 && owner.measurements == 0, "four activations must commit once before measurement");
  std::vector<std::pair<std::string, TStickyViewport>> frames;
  for (const auto &lease : leases) frames.push_back({lease, {2, 4, 0, 0, 20, 10, 0, 0}});
  check(owner.frames(revision, frames) && owner.commits.size() == 2, "four changed entries must commit once");
  revision = owner.prepareFrames(leases);
  check(owner.frames(revision, frames) && owner.commits.size() == 2, "unchanged entries must not commit");
  auto commits = owner.commits.size();
  check(!owner.frames(revision - 1, frames) && owner.commits.size() == commits, "stale measured geometry must not publish");
  owner.advanceDuringGeometry = true;
  check(!owner.frames(revision, frames) && owner.commits.size() == commits, "revision change during calculation must discard the complete batch");
  owner.failGeometry = true;
  try { owner.frames(owner.mountedRevision_, frames); throw std::runtime_error("missing error"); } catch (const std::runtime_error &error) { check(std::string(error.what()) == "geometry error", "calculation error must remain synchronous"); }
  check(owner.commits.size() == commits && owner.entries_.at("name").x == 2, "failure must not partially publish"); owner.failGeometry = false;
  owner.failure_ = "latched error";
  try { owner.prepareFrames(leases); throw std::runtime_error("missing error"); } catch (const std::runtime_error &error) { check(std::string(error.what()) == "latched error", "latched prepare error"); }
  try { owner.frames(owner.mountedRevision_, frames); throw std::runtime_error("missing error"); } catch (const std::runtime_error &error) { check(std::string(error.what()) == "latched error", "latched frames error"); }
  owner.failure_.clear();
  check(owner.prepareFrames({"unknown"}) == owner.mountedRevision_, "unknown lease must not activate or commit");
  auto root = std::const_pointer_cast<RootShadowNode>(owner.roots.at(1)); root->nodes.erase(1);
  check(!owner.frames(owner.mountedRevision_, frames) && owner.retirements == 1 && owner.entries_.at("selection").restore, "missing family must retire immediately");
  check(owner.commits.size() == commits + 1, "retirement restoration cannot be deferred to batch completion");
  NativeTableStickyPresentation missing; missing.add("pending", 1, 1); revision = missing.prepareFrames({"pending"}); missing.roots[1] = nullptr;
  check(missing.frames(revision, {{"pending", {0,0,0,0,1,1,0,0}}}) && missing.commits.size() == 1 && missing.entries_.at("pending").width == -1, "missing mounted root must remain pending");
  NativeTableStickyPresentation mixed; mixed.add("one", 1, 1); mixed.add("two", 2, 2); revision = mixed.prepareFrames({"one", "two"});
  check(!mixed.frames(revision, {{"one", {1,1,0,0,1,1,0,0}}, {"two", {1,1,0,0,1,1,0,0}}}) && mixed.commits.size() == 2 && mixed.entries_.at("one").width == -1, "mixed-surface measurement cannot cross emitted callbacks");
  NativeTableStickyPresentation failed; failed.add("one", 1, 1); failed.failFlush = true;
  try { failed.prepareFrames({"one"}); throw std::runtime_error("missing error"); } catch (const std::runtime_error &error) { check(std::string(error.what()) == "synchronous commit failed", "flush error must remain synchronous"); }
  std::cout << "{\"cases\":13,\"activationCommitsForFour\":1,\"changedCommitsForFour\":1,\"unchangedCommits\":0,\"nativeActions\":0}" << std::endl;
}
