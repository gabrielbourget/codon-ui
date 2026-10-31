#pragma once

#include <cstdint>
#include <mutex>
#include <string>
#include <vector>

namespace codon {
struct FieldInputRecordBatch {
  std::vector<std::string> records;
  uint64_t dropped{0};
};
// Receipts outlive an individual field, while staying bounded to its module.
class FieldInputRecords final {
 public:
  explicit FieldInputRecords(size_t limit = 256, size_t byteLimit = 2 * 1024 * 1024)
      : limit_(limit), byteLimit_(byteLimit) {}
  void append(std::string encoded) {
    std::lock_guard lock(mutex_);
    if (encoded.empty() || records_.size() >= limit_ || encoded.size() > byteLimit_ - bytes_) { ++dropped_; return; }
    bytes_ += encoded.size(); records_.push_back(std::move(encoded));
  }
  FieldInputRecordBatch take() {
    std::lock_guard lock(mutex_);
    FieldInputRecordBatch result{std::move(records_), dropped_};
    records_.clear(); bytes_ = 0; dropped_ = 0;
    return result;
  }
 private:
  const size_t limit_, byteLimit_;
  std::mutex mutex_;
  std::vector<std::string> records_;
  size_t bytes_{0};
  uint64_t dropped_{0};
};
} // namespace codon
