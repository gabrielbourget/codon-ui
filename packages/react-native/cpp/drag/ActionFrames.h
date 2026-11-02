#pragma once

#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <functional>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <thread>
#include <utility>

namespace codon::drag {
struct ActionIdentity {
  std::string moduleId, ownerId, bindingId, revision, windowId, sessionId, kind;
  int32_t surfaceId{0}, scopeTarget{0}, rootTarget{0}, itemTarget{0};
  int64_t epoch{0};
  bool operator==(const ActionIdentity &) const = default;
  bool valid() const {
    return !moduleId.empty() && !ownerId.empty() && !bindingId.empty() && !revision.empty() &&
      !windowId.empty() && !sessionId.empty() && surfaceId > 0 && scopeTarget > 0 && rootTarget > 0 && itemTarget >= 0 &&
      epoch > 0 && epoch <= 9007199254740991LL &&
      (kind == "lift" || kind == "move" || kind == "target" || kind == "exit" || kind == "activate" || kind == "drop" || kind == "end");
  }
};
struct ActionResult {
  bool acknowledged{false}, returned{false}, current{false};
  std::string response, error;
};

// Native transfer negotiation waits only for its guarded JS response. React
// commits, commands and their native notifications use ordinary delivery.
class ActionFrames final {
 public:
  using Clock = std::chrono::steady_clock;
  struct Ticket {
    const uint64_t token;
    const ActionIdentity identity;
    const Clock::time_point deadline;
   private:
    friend class ActionFrames;
    Ticket(uint64_t token, ActionIdentity identity, Clock::time_point deadline)
      : token(token), identity(std::move(identity)), deadline(deadline), nativeThread(std::this_thread::get_id()) {}
    std::thread::id nativeThread;
    bool started{false}, returned{false}, acknowledged{false}, closed{false};
    std::string response, error;
  };
  using Handle = std::shared_ptr<Ticket>;
  Handle begin(const ActionIdentity &identity, bool pointer) {
    std::lock_guard lock(mutex_);
    if (!live_ || !identity.valid() || active_ || serial_ >= 9007199254740991ULL) return nullptr;
    auto ticket = Handle(new Ticket(++serial_, identity, Clock::now() + std::chrono::milliseconds(pointer ? 5000 : 1000)));
    active_ = ticket; return ticket;
  }
  bool start(const Handle &ticket) {
    std::lock_guard lock(mutex_);
    if (!current(ticket) || ticket->started) return false;
    ticket->started = true; return true;
  }
  bool accepts(const Handle &ticket) const { std::lock_guard lock(mutex_); return current(ticket); }
  bool accepts(uint64_t token, const ActionIdentity &identity) const {
    std::lock_guard lock(mutex_); return current(active_) && active_->token == token && active_->identity == identity;
  }
  bool acknowledge(uint64_t token, const ActionIdentity &identity, std::string response) {
    std::lock_guard lock(mutex_);
    if (!current(active_) || active_->token != token || active_->identity != identity || !active_->started || active_->acknowledged) return false;
    active_->response = std::move(response); active_->acknowledged = true; condition_.notify_all(); return true;
  }
  void returned(const Handle &ticket, std::string error = {}) {
    std::lock_guard lock(mutex_);
    if (!ticket || ticket->closed || ticket != active_ || ticket->returned) return;
    ticket->returned = true; ticket->error = std::move(error); condition_.notify_all();
  }
  ActionResult wait(const Handle &ticket, const std::function<bool()> &nativeCurrent) {
    if (!ticket || ticket->nativeThread != std::this_thread::get_id()) return {false, false, false, "", "native-drag-original-thread-required"};
    std::unique_lock lock(mutex_);
    condition_.wait_until(lock, ticket->deadline, [&] { return !current(ticket) || ticket->returned; });
    const bool completed = current(ticket) && ticket->acknowledged && ticket->returned;
    lock.unlock(); bool native = false;
    try { native = completed && nativeCurrent && nativeCurrent(); } catch (...) {}
    lock.lock();
    ActionResult result{ticket->acknowledged, ticket->returned, completed && native && current(ticket), ticket->response, ticket->error};
    if (result.error.empty() && !result.current) result.error = !live_ ? "native-drag-module-retired" :
      Clock::now() >= ticket->deadline ? "native-drag-original-action-expired" :
      !ticket->acknowledged ? "native-drag-original-action-unacknowledged" : "native-drag-original-owner-retired";
    ticket->closed = true; if (active_ == ticket) active_.reset(); condition_.notify_all(); return result;
  }
  void close(const Handle &ticket, const std::string &error) {
    std::lock_guard lock(mutex_);
    if (!ticket || ticket != active_) return;
    ticket->error = error; ticket->closed = true; active_.reset(); condition_.notify_all();
  }
  void retire() {
    std::lock_guard lock(mutex_); live_ = false;
    if (active_) active_->error = "native-drag-module-retired";
    condition_.notify_all();
  }
 private:
  bool current(const Handle &ticket) const {
    return live_ && ticket && active_ == ticket && !ticket->closed && ticket->error.empty() && Clock::now() < ticket->deadline;
  }
  mutable std::mutex mutex_;
  std::condition_variable condition_;
  Handle active_;
  bool live_{true};
  uint64_t serial_{0};
};
} // namespace codon::drag
