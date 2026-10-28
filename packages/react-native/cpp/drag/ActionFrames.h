#pragma once

#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
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
struct WorkResult {
  bool performed{false};
  std::string error;
};
struct ActionResult {
  bool acknowledged{false}, returned{false}, phasesComplete{false}, current{false};
  std::string response, error;
};

// A separate drag domain: no editor ticket, input replay or runtime mutex.
// The UI stack services original native work while its JS task owns the runtime.
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
      : token(token), identity(std::move(identity)), deadline(deadline) {}
    std::thread::id nativeThread;
    bool started{false}, returned{false}, phases{false}, acknowledged{false}, closed{false}, failed{false};
    std::string response, error;
    std::function<WorkResult()> pending;
    std::function<void()> cancel;
    bool running{false};
    std::optional<WorkResult> completed;
  };
  using Handle = std::shared_ptr<Ticket>;

  Handle begin(const ActionIdentity &identity, bool pointer) {
    std::lock_guard lock(mutex_);
    if (!live_ || !identity.valid() || active_ || serial_ >= 9007199254740991ULL) return nullptr;
    auto ticket = Handle(new Ticket(++serial_, identity, Clock::now() + std::chrono::milliseconds(pointer ? 5000 : 1000)));
    ticket->nativeThread = std::this_thread::get_id(); active_ = ticket; return ticket;
  }
  bool start(const Handle &ticket) {
    std::lock_guard lock(mutex_);
    if (!current(ticket) || ticket->started) return false;
    ticket->started = true; return true;
  }
  bool accepts(const Handle &ticket) const {
    std::lock_guard lock(mutex_); return current(ticket);
  }
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
    if (!ticket || ticket->closed || ticket != active_) return;
    ticket->returned = true; failLocked(ticket, error); condition_.notify_all();
  }
  void finish(const Handle &ticket, std::string error = {}) {
    std::lock_guard lock(mutex_);
    if (!ticket || ticket->closed || ticket != active_) return;
    ticket->phases = true; failLocked(ticket, error); condition_.notify_all();
  }
  WorkResult request(const Handle &ticket, std::function<WorkResult()> operation, std::function<void()> cancel = {}) {
    std::unique_lock lock(mutex_);
    if (!current(ticket) || !ticket->started || ticket->pending || ticket->running || ticket->completed ||
        ticket->nativeThread == std::this_thread::get_id() || !operation) {
      lock.unlock(); if (cancel) cancel(); return {false, "native-drag-original-work-not-admitted"};
    }
    ticket->pending = std::move(operation); ticket->cancel = std::move(cancel); condition_.notify_all();
    condition_.wait_until(lock, ticket->deadline, [&] { return !current(ticket) || ticket->completed.has_value(); });
    if (ticket->completed) { auto result = std::move(*ticket->completed); ticket->completed.reset(); return result; }
    auto cancelled = std::move(ticket->cancel); ticket->pending = nullptr;
    failLocked(ticket, "native-drag-original-work-expired"); condition_.notify_all();
    lock.unlock(); if (cancelled) cancelled(); return {false, "native-drag-original-work-expired"};
  }
  ActionResult wait(const Handle &ticket, const std::function<bool()> &nativeCurrent) {
    if (!ticket || ticket->nativeThread != std::this_thread::get_id()) return {false, false, false, false, "", "native-drag-original-thread-required"};
    std::unique_lock lock(mutex_);
    while (current(ticket)) {
      if (ticket->pending) {
        auto work = std::move(ticket->pending); auto cancel = std::move(ticket->cancel); ticket->running = true;
        lock.unlock(); WorkResult result;
        try {
          if (!nativeCurrent || !nativeCurrent()) { if (cancel) cancel(); result.error = "native-drag-original-view-retired"; }
          else { result = work(); if (result.error.empty() && !nativeCurrent()) result.error = "native-drag-original-view-retired-after-work"; }
        } catch (const std::exception &error) { result.error = error.what(); }
        catch (...) { result.error = "native-drag-original-native-work-threw"; }
        lock.lock(); ticket->running = false; ticket->completed = result;
        failLocked(ticket, result.error); condition_.notify_all(); continue;
      }
      if (ticket->returned && ticket->phases) break;
      condition_.wait_until(lock, ticket->deadline);
    }
    const bool completed = current(ticket) && ticket->acknowledged && ticket->returned && ticket->phases;
    lock.unlock(); bool native = false;
    try { native = completed && nativeCurrent && nativeCurrent(); } catch (...) {}
    lock.lock();
    ActionResult result{ticket->acknowledged, ticket->returned, ticket->phases, completed && native && current(ticket),
      ticket->response, ticket->error};
    if (result.error.empty() && !result.current) result.error = !live_ ? "native-drag-module-retired" :
      Clock::now() >= ticket->deadline ? "native-drag-original-action-expired" :
      !ticket->acknowledged ? "native-drag-original-action-unacknowledged" : "native-drag-original-owner-retired";
    ticket->closed = true; auto cancel = std::move(ticket->cancel); ticket->pending = nullptr;
    if (active_ == ticket) active_.reset(); condition_.notify_all();
    lock.unlock(); if (cancel) cancel(); return result;
  }
  void close(const Handle &ticket, const std::string &error) {
    std::function<void()> cancel;
    {
      std::lock_guard lock(mutex_);
      if (!ticket || ticket != active_) return;
      failLocked(ticket, error); ticket->closed = true; cancel = std::move(ticket->cancel); ticket->pending = nullptr; active_.reset();
      condition_.notify_all();
    }
    if (cancel) cancel();
  }
  void retire() {
    std::function<void()> cancel;
    {
      std::lock_guard lock(mutex_); live_ = false;
      if (active_) { failLocked(active_, "native-drag-module-retired"); cancel = std::move(active_->cancel); active_->pending = nullptr; }
      condition_.notify_all();
    }
    if (cancel) cancel();
  }
 private:
  bool current(const Handle &ticket) const {
    return live_ && ticket && active_ == ticket && !ticket->closed && !ticket->failed && Clock::now() < ticket->deadline;
  }
  void failLocked(const Handle &ticket, const std::string &error) {
    if (!error.empty()) { ticket->failed = true; if (ticket->error.empty()) ticket->error = error; }
  }
  mutable std::mutex mutex_;
  std::condition_variable condition_;
  Handle active_;
  bool live_{true};
  uint64_t serial_{0};
};
} // namespace codon::drag
