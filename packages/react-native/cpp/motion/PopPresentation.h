#pragma once

#include "PopFrame.h"
#include <react/renderer/uimanager/UIManagerCommitHook.h>
#include <mutex>
#include <unordered_map>
#include <chrono>

namespace codon::motion {

class NativePopPresentation final : public facebook::react::UIManagerCommitHook {
 public:
  explicit NativePopPresentation(std::shared_ptr<facebook::react::UIManager> manager);
  ~NativePopPresentation() noexcept override;
  std::string request(const std::string &encoded);
  void close() noexcept;
  void commitHookWasRegistered(const facebook::react::UIManager &) noexcept override {}
  void commitHookWasUnregistered(const facebook::react::UIManager &) noexcept override {}
  facebook::react::RootShadowNode::Unshared shadowTreeWillCommit(
      const facebook::react::ShadowTree &tree,
      const facebook::react::RootShadowNode::Shared &oldRoot,
      const facebook::react::RootShadowNode::Unshared &nextRoot,
      const facebook::react::ShadowTreeCommitOptions &options) noexcept override;

 private:
  struct Authored {
    std::weak_ptr<const facebook::react::Props> presentation;
    facebook::react::ShadowNodeFamily::Weak family;
    std::string lease;
    folly::dynamic style;
  };
  struct Entry {
    facebook::react::ShadowNodeFamily::Weak family;
    facebook::react::ShadowNodeFamily::Weak parent;
    int surface;
    int tag;
    int containingRoot;
    std::string owner;
    std::chrono::steady_clock::time_point captured;
    double width, height, left, top, right, bottom;
    bool rtl;
    bool active{false};
    bool released{false};
    folly::dynamic style{folly::dynamic::object()};
  };
  std::shared_ptr<facebook::react::UIManager> manager_;
  std::mutex mutex_;
  std::unordered_map<std::string, Entry> entries_;
  std::unordered_map<const facebook::react::Props *, Authored> authored_;
  std::string failure_;
  bool closed_{false};
  void flush(int surface, bool allowMissing = false, bool restoreBranches = false);
  void prune();
};

} // namespace codon::motion
