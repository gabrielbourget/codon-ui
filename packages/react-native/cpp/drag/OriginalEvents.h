#pragma once
#include <functional>
#include <mutex>
#include <utility>
#include <vector>

namespace codon::drag {
// Native work can finish after its drag frame retires. Its real notifications
// still get one ordinary first delivery, without reviving the expired action.
template <typename TRecord> class OriginalEvents final {
 public:
  explicit OriginalEvents(std::function<void(std::vector<TRecord>)> late) : late_(std::move(late)) {}
  void publish(std::vector<TRecord> records) {
    bool late;
    {
      std::lock_guard lock(mutex_);
      if (completed_) return;
      completed_ = true; late = closed_;
      if (!late) records_ = std::move(records);
    }
    if (late && !records.empty() && late_) late_(std::move(records));
  }
  std::vector<TRecord> take() {
    std::lock_guard lock(mutex_);
    if (closed_) return {};
    closed_ = true; return completed_ ? std::move(records_) : std::vector<TRecord>{};
  }
 private:
  std::mutex mutex_;
  std::vector<TRecord> records_;
  std::function<void(std::vector<TRecord>)> late_;
  bool completed_{false}, closed_{false};
};
} // namespace codon::drag
