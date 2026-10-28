#pragma once

#include "../motion/NativeIntrinsics.h"
#include <react/renderer/components/textinput/CuiTextSnapshot.h>
#include <atomic>
#include <mutex>
#include <unordered_map>

namespace codon::table {

// Retained by the original host family and its native plans, never by an editor callback.
class CUIClampTextScope final : public std::enable_shared_from_this<CUIClampTextScope> {
 public:
  explicit CUIClampTextScope(std::string identity);
  ~CUIClampTextScope();
  void prepare(const facebook::react::ShadowNode &root);
  void active(bool active);
  codon::motion::TNativeIsolatedIntrinsicServices services(
      const facebook::react::ShadowNode &root, std::function<void()> &check);
 private:
  struct TEntry;
  std::string identity_;
  std::atomic<bool> active_{true};
  std::atomic<uint64_t> epoch_{1};
  std::mutex mutex_;
  std::unordered_map<int, std::shared_ptr<TEntry>> entries_;
};

// Platform capture is invoked only by the registered original UI producer.
std::shared_ptr<const void> captureClampEditorText(std::shared_ptr<void> original);
void observeClampEditorText(int tag, uint64_t owner);
void unobserveClampEditorText(int tag, uint64_t owner) noexcept;
codon::motion::TNativeIsolatedIntrinsicServices clampPlatformIntrinsicServices(
    const facebook::react::ShadowNode &root,
    std::function<std::shared_ptr<const facebook::react::CuiTextSnapshot>(const facebook::react::ShadowNode &)> snapshot);

} // namespace codon::table
