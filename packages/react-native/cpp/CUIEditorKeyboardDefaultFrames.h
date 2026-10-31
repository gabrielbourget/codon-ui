#pragma once

#include <cstdint>
#include <mutex>
#include <string>
#include <vector>

namespace codon {
struct EditorKeyIdentity {
  std::string ownerId;
  std::string bindingId;
  std::string bindingRevision;
  int32_t target;
  std::string windowId;
  int64_t epoch;
  bool operator==(const EditorKeyIdentity &) const = default;
};
enum class EditorKeyDisposition { Allowed, Prevented, Unacknowledged, Retired };

// Authority exists only between begin/end on one original native dispatch stack.
class EditorKeyboardDefaultFrames final {
 public:
  uint64_t begin(const EditorKeyIdentity &identity, int64_t eventId, const std::string &phase) {
    std::lock_guard lock(mutex_);
    if (identity.ownerId.empty() || identity.bindingId.empty() || identity.bindingRevision.empty() ||
        identity.target <= 0 || identity.windowId.empty() || identity.epoch <= 0 ||
        eventId <= 0 || eventId > 9007199254740991LL ||
        (phase != "down" && phase != "up" && phase != "cancel")) return 0;
    const auto token = ++serial_;
    frames_.push_back({token, identity, eventId, phase, false, false, false});
    return token;
  }
  bool acknowledge(const EditorKeyIdentity &identity, int64_t eventId, const std::string &phase,
                   bool current, bool preventDefault) {
    std::lock_guard lock(mutex_);
    if (frames_.empty()) return false;
    auto &frame = frames_.back();
    if (frame.acknowledged || frame.identity != identity || frame.eventId != eventId || frame.phase != phase) return false;
    frame.acknowledged = true;
    frame.current = current;
    frame.preventDefault = current && phase != "cancel" && preventDefault;
    return true;
  }
  EditorKeyDisposition end(uint64_t token, bool originalStillCurrent) {
    std::lock_guard lock(mutex_);
    if (frames_.empty() || frames_.back().token != token) return EditorKeyDisposition::Retired;
    const auto frame = frames_.back();
    frames_.pop_back();
    if (!originalStillCurrent || (frame.acknowledged && !frame.current)) return EditorKeyDisposition::Retired;
    if (!frame.acknowledged) return EditorKeyDisposition::Unacknowledged;
    return frame.preventDefault ? EditorKeyDisposition::Prevented : EditorKeyDisposition::Allowed;
  }
  void retire() {
    std::lock_guard lock(mutex_);
    frames_.clear();
  }
 private:
  struct Frame {
    uint64_t token;
    EditorKeyIdentity identity;
    int64_t eventId;
    std::string phase;
    bool acknowledged;
    bool current;
    bool preventDefault;
  };
  std::mutex mutex_;
  std::vector<Frame> frames_;
  uint64_t serial_{0};
};
} // namespace codon
