#pragma once

#include <deque>
#include <functional>
#include <vector>

namespace codon {
// JS-thread owned. Pop before calling the receiver so a reentrant focus action
// drains older SDK notifications before producing its own newer notifications.
template <typename TEvent>
class FieldInputOriginalEvents final {
 public:
  void append(std::vector<TEvent> events) {
    for (auto &event : events) events_.push_back(std::move(event));
  }
  bool drain(const std::function<bool(const TEvent &)> &deliver) {
    bool delivered = true;
    while (!events_.empty()) {
      auto event = std::move(events_.front()); events_.pop_front();
      delivered = deliver(event) && delivered;
    }
    return delivered;
  }
 private:
  std::deque<TEvent> events_;
};
} // namespace codon
