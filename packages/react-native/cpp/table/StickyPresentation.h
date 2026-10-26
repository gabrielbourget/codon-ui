#pragma once

#include "StickyStyle.h"
#include <react/renderer/uimanager/UIManagerCommitHook.h>
#include <react/renderer/uimanager/UIManagerMountHook.h>
#include <functional>
#include <mutex>
#include <unordered_map>

namespace codon::table {

struct TStickyTarget {
  std::string lease;
  int target;
  int containingRoot;
  folly::dynamic session;
};
struct TStickyViewport {
  double tableX, tableY;
  double viewportX, viewportY, viewportWidth, viewportHeight;
  double scrollBelowTableX, scrollBelowTableY;
};

class NativeTableStickyPresentation final : public facebook::react::UIManagerCommitHook,
    public facebook::react::UIManagerMountHook {
 public:
  explicit NativeTableStickyPresentation(std::shared_ptr<facebook::react::UIManager> manager);
  ~NativeTableStickyPresentation() noexcept override;
  std::string request(const std::string &encoded);
  std::vector<TStickyTarget> targets();
  void synchronize();
  bool frame(const std::string &lease, const TStickyViewport &viewport);
  void retire(const std::string &lease);
  void fail(const std::string &message);
  void close();
  void setMountCallback(std::function<void()> callback);
  void commitHookWasRegistered(const facebook::react::UIManager &) noexcept override {}
  void commitHookWasUnregistered(const facebook::react::UIManager &) noexcept override {}
  facebook::react::RootShadowNode::Unshared shadowTreeWillCommit(
      const facebook::react::ShadowTree &tree,
      const facebook::react::RootShadowNode::Shared &oldRoot,
      const facebook::react::RootShadowNode::Unshared &nextRoot,
      const facebook::react::ShadowTreeCommitOptions &options) noexcept override;
  void shadowTreeDidMount(const facebook::react::RootShadowNode::Shared &root,
      facebook::react::HighResTimeStamp time) noexcept override;
  void shadowTreeDidUnmount(facebook::react::SurfaceId surface,
      facebook::react::HighResTimeStamp time) noexcept override;

 private:
  struct Entry {
    facebook::react::ShadowNodeFamily::Weak family, rootFamily;
    int surface, tag, rootTag;
    std::string owner;
    folly::dynamic fallback, session;
    double x{0}, y{0};
    double width{-1}, height{-1};
    bool active{false}, released{false}, restore{false};
  };
  struct Authored {
    std::weak_ptr<const facebook::react::Props> presentation;
    facebook::react::ShadowNodeFamily::Weak family;
    std::string lease;
    TStickyAuthoredStyle style;
  };
  std::shared_ptr<facebook::react::UIManager> manager_;
  std::mutex mutex_;
  std::unordered_map<std::string, Entry> entries_;
  std::unordered_map<const facebook::react::Props *, Authored> authored_;
  std::unordered_map<int, facebook::react::RootShadowNode::Shared> mounted_;
  std::function<void()> onMount_;
  std::string failure_;
  bool closed_{false};
  facebook::react::Props::Shared authoredProps(const facebook::react::ShadowNode &node);
  facebook::react::RootShadowNode::Shared mountedRoot(int surface);
  void flush(int surface, bool allowMissing = false, bool restoreBranches = false);
};

} // namespace codon::table
