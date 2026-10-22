#pragma once

#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <memory>
#include <functional>
#include <mutex>
#include <optional>
#include <string>
#include <vector>

namespace codon {
struct FieldInputIdentity {
  std::string ownerId, bindingId, bindingRevision;
  int32_t metadataTarget, outerTarget, inputTarget, surfaceId, target;
  std::string documentId, documentRevision, windowId, mountRevision;
  std::string outerInstance, inputInstance, nativeInstance, editorInstance;
  int64_t epoch;
  bool operator==(const FieldInputIdentity &) const = default;
  bool valid() const {
    if (metadataTarget <= 0 || outerTarget <= 0 || inputTarget <= 0 || outerTarget == inputTarget ||
        surfaceId <= 0 || target <= 0 || epoch <= 0 || epoch > 9007199254740991LL) return false;
    for (const auto *value : {&ownerId, &bindingId, &bindingRevision, &documentId, &documentRevision, &windowId,
        &mountRevision, &outerInstance, &inputInstance, &nativeInstance, &editorInstance})
      if (value->empty()) return false;
    return true;
  }
};
struct FieldInputFocusAction {
  int32_t groupTarget;
  std::string kind;
  bool operator==(const FieldInputFocusAction &) const = default;
};
struct FieldInputFocusResult {
  bool requested{false}, observed{false}, current{false};
  int32_t target{0};
  std::string nativeInstance, editorInstance, error;
};
enum class FieldInputDisposition { Allowed, Prevented, Unacknowledged, TimedOut, Failed, Retired };
struct FieldInputDecision {
  FieldInputDisposition disposition;
  std::optional<FieldInputFocusAction> focus;
  bool deliveryStarted;
  bool deliveryReturned;
  std::string error{};
};

// A frame is live only on its original native dispatch stack. Acknowledging
// does not release the UI thread while original React handlers are still running.
class FieldInputDispatchFrames final {
 public:
  using Clock = std::chrono::steady_clock;
  struct Ticket {
    const uint64_t token;
    const FieldInputIdentity identity;
    const int64_t eventId;
    const std::string phase;
    const Clock::time_point deadline;
   private:
    friend class FieldInputDispatchFrames;
    bool started{false}, returned{false}, acknowledged{false}, current{false}, prevented{false};
    bool retired{false}, failed{false}, expired{false};
    std::optional<FieldInputFocusAction> focus;
    std::string error;
    uint64_t focusSerial{0};
    bool focusRunning{false};
    std::optional<FieldInputFocusAction> pendingFocus;
    std::optional<FieldInputFocusResult> focusResult;
    Ticket(uint64_t serial, FieldInputIdentity value, int64_t event, std::string stage, Clock::time_point end)
        : token(serial), identity(std::move(value)), eventId(event), phase(std::move(stage)), deadline(end) {}
  };
  using Handle = std::shared_ptr<Ticket>;

  Handle begin(const FieldInputIdentity &identity, int64_t eventId, const std::string &phase,
      std::chrono::milliseconds timeout) {
    std::lock_guard lock(mutex_);
    if (!live_ || serial_ >= 9007199254740991ULL || !identity.valid() || eventId <= 0 || eventId > 9007199254740991LL ||
        (phase != "down" && phase != "up" && phase != "cancel" && phase != "pointer-start" &&
          phase != "pointer-end" && phase != "pointer-cancel") || timeout.count() <= 0 || timeout.count() > 1000)
      return nullptr;
    auto ticket = Handle(new Ticket(++serial_, identity, eventId, phase, Clock::now() + timeout));
    frames_.push_back(ticket);
    return ticket;
  }
  bool startDelivery(const Handle &ticket) {
    std::lock_guard lock(mutex_);
    if (!current(ticket) || ticket->started || Clock::now() >= ticket->deadline) return false;
    ticket->started = true;
    return true;
  }
  bool acknowledge(uint64_t token, const FieldInputIdentity &identity, int64_t eventId, const std::string &phase,
      bool originalCurrent, bool preventDefault, std::optional<FieldInputFocusAction> focus) {
    std::lock_guard lock(mutex_);
    if (frames_.empty()) return false;
    const auto &ticket = frames_.back();
    if (!current(ticket) || ticket->token != token || !ticket->started || ticket->returned || ticket->acknowledged ||
        ticket->identity != identity || ticket->eventId != eventId || ticket->phase != phase ||
        Clock::now() >= ticket->deadline) return false;
    const bool cancel = phase == "cancel" || phase == "pointer-cancel";
    if (focus && (cancel || (focus->groupTarget != identity.outerTarget && focus->groupTarget != identity.inputTarget) ||
        (focus->kind != "first" && focus->kind != "next" && focus->kind != "previous" &&
          focus->kind != "physical-left" && focus->kind != "physical-right" && focus->kind != "press"))) return false;
    ticket->acknowledged = true;
    ticket->current = originalCurrent;
    ticket->prevented = originalCurrent && !cancel && preventDefault;
    if (originalCurrent) ticket->focus = std::move(focus);
    condition_.notify_all();
    return true;
  }
  bool accepts(uint64_t token, const FieldInputIdentity &identity, int64_t eventId, const std::string &phase) {
    std::lock_guard lock(mutex_);
    if (frames_.empty()) return false;
    const auto &ticket = frames_.back();
    return current(ticket) && ticket->token == token && ticket->started && !ticket->returned && !ticket->acknowledged &&
      ticket->identity == identity && ticket->eventId == eventId && ticket->phase == phase && Clock::now() < ticket->deadline;
  }
  FieldInputFocusResult requestFocus(uint64_t token, const FieldInputIdentity &identity, int64_t eventId,
      const std::string &phase, const FieldInputFocusAction &action) {
    std::unique_lock lock(mutex_);
    const auto failure = [](const std::string &error) { FieldInputFocusResult value; value.error = error; return value; };
    if (frames_.empty()) return failure("field-input-focus-frame-retired");
    const auto ticket = frames_.back();
    if (!current(ticket) || ticket->token != token || ticket->identity != identity || ticket->eventId != eventId ||
        ticket->phase != phase || !ticket->started || ticket->returned || ticket->acknowledged ||
        ticket->pendingFocus || ticket->focusRunning || Clock::now() >= ticket->deadline ||
        phase == "cancel" || phase == "pointer-cancel" ||
        (action.groupTarget != identity.outerTarget && action.groupTarget != identity.inputTarget) ||
        (action.kind != "first" && action.kind != "next" && action.kind != "previous" &&
          action.kind != "physical-left" && action.kind != "physical-right" && action.kind != "press"))
      return failure("field-input-focus-request-retired");
    const auto serial = ++ticket->focusSerial;
    ticket->focusResult.reset();
    ticket->pendingFocus = action;
    condition_.notify_all();
    condition_.wait_until(lock, ticket->deadline, [&] {
      return !current(ticket) || ticket->returned || (ticket->focusSerial == serial && ticket->focusResult.has_value());
    });
    if (!current(ticket) || ticket->returned) return failure("field-input-focus-frame-retired");
    if (Clock::now() >= ticket->deadline || !ticket->focusResult) {
      ticket->expired = true;
      ticket->pendingFocus.reset();
      condition_.notify_all();
      return failure("field-input-focus-timed-out");
    }
    return *ticket->focusResult;
  }
  void finishDelivery(const Handle &ticket, bool failed, const std::string &error = "") {
    std::lock_guard lock(mutex_);
    if (!ticket || !ticket->started || ticket->returned) return;
    ticket->returned = true;
    ticket->failed |= failed;
    if (ticket->error.empty()) ticket->error = error;
    condition_.notify_all();
  }
  FieldInputDecision wait(const Handle &ticket,
      const std::function<FieldInputFocusResult(const FieldInputFocusAction &)> &serviceFocus = {}) {
    std::unique_lock lock(mutex_);
    if (!ticket) return {FieldInputDisposition::Retired, {}, false, false};
    while (current(ticket) && !ticket->returned && Clock::now() < ticket->deadline) {
      condition_.wait_until(lock, ticket->deadline, [&] { return !current(ticket) || ticket->returned || ticket->pendingFocus.has_value(); });
      if (!current(ticket) || ticket->returned || !ticket->pendingFocus) continue;
      const auto action = *ticket->pendingFocus;
      ticket->pendingFocus.reset(); ticket->focusRunning = true;
      const auto serial = ticket->focusSerial;
      lock.unlock();
      FieldInputFocusResult result;
      try {
        if (serviceFocus) result = serviceFocus(action);
        else result.error = "field-input-focus-service-unavailable";
      } catch (const std::exception &error) { result.error = error.what(); }
      catch (...) { result.error = "field-input-focus-service-threw"; }
      lock.lock();
      ticket->focusRunning = false;
      if (!result.error.empty()) { ticket->failed = true; if (ticket->error.empty()) ticket->error = result.error; }
      if (current(ticket) && ticket->focusSerial == serial && Clock::now() < ticket->deadline)
        ticket->focusResult = std::move(result);
      condition_.notify_all();
    }
    if (ticket->expired) return decision(ticket, FieldInputDisposition::TimedOut);
    if (!current(ticket)) return decision(ticket, FieldInputDisposition::Retired);
    if (!ticket->returned) {
      ticket->expired = true;
      ticket->focus.reset();
      return decision(ticket, FieldInputDisposition::TimedOut);
    }
    if (Clock::now() >= ticket->deadline) {
      ticket->expired = true;
      ticket->focus.reset();
      return decision(ticket, FieldInputDisposition::TimedOut);
    }
    if (ticket->failed) return decision(ticket, FieldInputDisposition::Failed);
    if (!ticket->acknowledged) return decision(ticket, FieldInputDisposition::Unacknowledged);
    if (!ticket->current) return decision(ticket, FieldInputDisposition::Retired);
    return decision(ticket, ticket->prevented ? FieldInputDisposition::Prevented : FieldInputDisposition::Allowed);
  }
  FieldInputDecision end(const Handle &ticket, bool originalCurrent) {
    std::lock_guard lock(mutex_);
    if (!ticket || frames_.empty() || frames_.back() != ticket) return {FieldInputDisposition::Retired, {}, false, false};
    auto result = decision(ticket, FieldInputDisposition::Retired);
    if (live_ && originalCurrent && !ticket->retired) {
      if (ticket->expired || Clock::now() >= ticket->deadline) result = decision(ticket, FieldInputDisposition::TimedOut);
      else if (ticket->failed) result = decision(ticket, FieldInputDisposition::Failed);
      else if (!ticket->returned || !ticket->acknowledged) result = decision(ticket, FieldInputDisposition::Unacknowledged);
      else if (ticket->current) result = decision(ticket, ticket->prevented ? FieldInputDisposition::Prevented : FieldInputDisposition::Allowed);
    }
    ticket->retired = true;
    frames_.pop_back();
    condition_.notify_all();
    return result;
  }
  void retire() {
    std::lock_guard lock(mutex_);
    live_ = false;
    for (const auto &ticket : frames_) { ticket->retired = true; ticket->focus.reset(); }
    frames_.clear();
    condition_.notify_all();
  }
  void retireBinding(const std::string &owner, const std::string &binding) {
    std::lock_guard lock(mutex_);
    for (const auto &ticket : frames_) if (ticket->identity.ownerId == owner && ticket->identity.bindingId == binding) {
      ticket->retired = true; ticket->focus.reset(); ticket->pendingFocus.reset();
    }
    condition_.notify_all();
  }
 private:
  bool current(const Handle &ticket) const {
    return live_ && ticket && !ticket->retired && !ticket->expired && !frames_.empty() && frames_.back() == ticket;
  }
  static FieldInputDecision decision(const Handle &ticket, FieldInputDisposition disposition) {
    const bool admitted = disposition == FieldInputDisposition::Allowed || disposition == FieldInputDisposition::Prevented;
    return {disposition, admitted ? ticket->focus : std::nullopt, ticket->started, ticket->returned, ticket->error};
  }
  std::mutex mutex_;
  std::condition_variable condition_;
  std::vector<Handle> frames_;
  uint64_t serial_{0};
  bool live_{true};
};
class FieldInputFrameLifetime final {
 public:
  FieldInputFrameLifetime(FieldInputDispatchFrames &frames, FieldInputDispatchFrames::Handle ticket)
      : frames_(frames), ticket_(std::move(ticket)) {}
  ~FieldInputFrameLifetime() { try { frames_.end(ticket_, false); } catch (...) {} }
 private:
  FieldInputDispatchFrames &frames_;
  FieldInputDispatchFrames::Handle ticket_;
};
} // namespace codon
