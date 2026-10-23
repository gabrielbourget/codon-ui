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
#include <algorithm>
#include <unordered_set>

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
  bool sameScope(const FieldInputIdentity &other) const {
    // Value/focus commits may advance the document/mount receipt while the
    // original owner, complete binding and actual native objects remain live.
    auto left = *this, right = other;
    left.documentRevision.clear(); right.documentRevision.clear();
    left.mountRevision.clear(); right.mountRevision.clear();
    return left == right;
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
struct FieldInputMountResult {
  bool mounted{false};
  std::string error;
};
struct FieldInputCommandResult {
  bool callbackCompleted{false};
  std::string error;
};
struct FieldInputCommandAction {
  int32_t surfaceId, target;
  std::string name;
  std::function<FieldInputCommandResult()> perform;
  std::function<void()> cancel;
  std::function<bool()> current{};
};
using FieldInputCommand = std::shared_ptr<const FieldInputCommandAction>;

enum class FieldInputDisposition { Allowed, Prevented, Unacknowledged, TimedOut, Failed, Retired };
struct FieldInputDecision {
  FieldInputDisposition disposition;
  std::optional<FieldInputFocusAction> focus;
  bool deliveryStarted;
  bool deliveryReturned;
  std::string error{};
  bool originalDefaultPrevented{false};
  bool phasesComplete{false};
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
    const std::vector<FieldInputIdentity> scopes;
    const FieldInputIdentity *scopeFor(int32_t outerTarget) const {
      const auto found = std::find_if(scopes.begin(), scopes.end(), [&](const auto &scope) { return scope.outerTarget == outerTarget; });
      return found == scopes.end() ? nullptr : &*found;
    }
   private:
    friend class FieldInputDispatchFrames;
    bool started{false}, returned{false}, acknowledged{false}, current{false}, prevented{false};
    bool retired{false}, failed{false}, expired{false};
    bool closed{false}, phasesComplete{false}, originalDefaultPrevented{false};
    bool pendingMount{false}, mountRunning{false};
    int32_t pendingMountTarget{0}, activeMountTarget{0};
    std::optional<FieldInputMountResult> mountResult;
    FieldInputCommand pendingCommand, activeCommand;
    bool commandRunning{false};
    uint64_t commandSerial{0};
    std::optional<FieldInputCommandResult> commandResult;
    std::optional<FieldInputFocusAction> focus;
    std::string error;
    uint64_t focusSerial{0};
    bool focusRunning{false};
    std::optional<FieldInputFocusAction> pendingFocus;
    std::optional<FieldInputFocusResult> focusResult;
    Ticket(uint64_t serial, FieldInputIdentity value, int64_t event, std::string stage, Clock::time_point end,
        std::vector<FieldInputIdentity> admitted)
        : token(serial), identity(std::move(value)), eventId(event), phase(std::move(stage)), deadline(end), scopes(std::move(admitted)) {}
  };
  using Handle = std::shared_ptr<Ticket>;

  Handle begin(const FieldInputIdentity &identity, int64_t eventId, const std::string &phase,
      std::chrono::milliseconds timeout, std::vector<FieldInputIdentity> scopes = {}) {
    std::lock_guard lock(mutex_);
    if (!live_ || serial_ >= 9007199254740991ULL || !identity.valid() || eventId <= 0 || eventId > 9007199254740991LL ||
        (phase != "down" && phase != "up" && phase != "cancel" && phase != "pointer-start" &&
          phase != "pointer-end" && phase != "pointer-cancel" && phase != "input") || timeout.count() <= 0 || timeout.count() > 1000)
      return nullptr;
    if (scopes.empty()) scopes.push_back(identity);
    bool hasOriginal = false;
    std::unordered_set<int32_t> roots, metadata;
    for (const auto &scope : scopes) {
      if (!scope.valid() || scope.surfaceId != identity.surfaceId || scope.target != identity.target ||
          scope.documentId != identity.documentId || scope.documentRevision != identity.documentRevision ||
          scope.windowId != identity.windowId || scope.nativeInstance != identity.nativeInstance ||
          scope.editorInstance != identity.editorInstance || !metadata.insert(scope.metadataTarget).second ||
          !roots.insert(scope.outerTarget).second || !roots.insert(scope.inputTarget).second) return nullptr;
      hasOriginal |= scope == identity;
    }
    if (!hasOriginal) return nullptr;
    auto ticket = Handle(new Ticket(++serial_, identity, eventId, phase, Clock::now() + timeout, std::move(scopes)));
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
    if (phase == "input" && preventDefault) return false;
    const bool cancel = phase == "cancel" || phase == "pointer-cancel";
    if (focus && (cancel || !ticket->scopeFor(focus->groupTarget) ||
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
        ticket->pendingFocus || ticket->focusRunning || ticket->pendingCommand || ticket->commandRunning || Clock::now() >= ticket->deadline ||
        phase == "cancel" || phase == "pointer-cancel" ||
        !ticket->scopeFor(action.groupTarget) ||
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
  void finishHandler(const Handle &ticket, bool failed, const std::string &error = "") {
    std::unique_lock lock(mutex_);
    if (!ticket || !ticket->started || ticket->returned || ticket->closed) return;
    ticket->returned = true;
    ticket->originalDefaultPrevented = !failed && ticket->acknowledged && ticket->current && ticket->prevented &&
      Clock::now() < ticket->deadline;
    ticket->failed |= failed;
    if (ticket->error.empty()) ticket->error = error;
    auto pending = failed ? ticket->pendingCommand : nullptr;
    auto active = failed ? ticket->activeCommand : nullptr;
    condition_.notify_all();
    lock.unlock();
    if (pending) pending->cancel();
    if (active) active->cancel();
  }
  void finishDelivery(const Handle &ticket, bool failed, const std::string &error = "") {
    finishHandler(ticket, failed, error);
    finishPhases(ticket, failed, error);
  }
  void finishPhases(const Handle &ticket, bool failed = false, const std::string &error = "") {
    std::unique_lock lock(mutex_);
    if (!ticket || !ticket->returned || ticket->closed || ticket->phasesComplete) return;
    if (ticket->pendingCommand || ticket->commandRunning) {
      failed = true;
      if (ticket->error.empty()) ticket->error = error.empty() ? "field-input-command-phase-incomplete" : error;
    }
    ticket->phasesComplete = true;
    ticket->failed |= failed;
    if (ticket->error.empty()) ticket->error = error;
    auto pending = ticket->pendingCommand, active = ticket->activeCommand;
    condition_.notify_all();
    lock.unlock();
    if (pending) pending->cancel();
    if (active) active->cancel();
  }
  FieldInputMountResult requestMount(const Handle &ticket, int32_t commandTarget = 0) {
    std::unique_lock lock(mutex_);
    if (commandTarget < 0 || !phaseActive(ticket) || ticket->failed || !ticket->started || (!ticket->returned && commandTarget <= 0) ||
        (commandTarget > 0 && !current(ticket)) || ticket->phasesComplete || ticket->pendingMount || ticket->mountRunning ||
        ticket->pendingCommand || ticket->commandRunning ||
        Clock::now() >= ticket->deadline) return {false, "field-input-mount-frame-retired"};
    ticket->mountResult.reset(); ticket->pendingMount = true; ticket->pendingMountTarget = commandTarget;
    condition_.notify_all();
    condition_.wait_until(lock, ticket->deadline, [&] { return !phaseActive(ticket) || ticket->mountResult.has_value(); });
    if (!phaseActive(ticket)) return {false, "field-input-mount-frame-retired"};
    if (Clock::now() >= ticket->deadline || !ticket->mountResult) {
      ticket->expired = true; ticket->pendingMount = false;
      condition_.notify_all();
      return {false, "field-input-mount-timed-out"};
    }
    return *ticket->mountResult;
  }
  int32_t mountTarget(const Handle &ticket) {
    std::lock_guard lock(mutex_);
    return ticket && ticket->mountRunning ? ticket->activeMountTarget : 0;
  }
  FieldInputCommandResult requestCommand(const Handle &ticket, FieldInputCommand command) {
    std::unique_lock lock(mutex_);
    const auto fail = [&](const std::string &error) {
      lock.unlock();
      if (command && command->cancel) command->cancel();
      return FieldInputCommandResult{false, error};
    };
    if (!command || !command->perform || !command->cancel || command->target <= 0 || command->name.empty() ||
        !current(ticket) || ticket->failed || !ticket->started || ticket->phasesComplete ||
        command->surfaceId != ticket->identity.surfaceId || ticket->pendingCommand || ticket->commandRunning ||
        ticket->pendingFocus || ticket->focusRunning || ticket->pendingMount || ticket->mountRunning ||
        Clock::now() >= ticket->deadline) return fail("field-input-command-frame-retired");
    const auto serial = ++ticket->commandSerial;
    ticket->commandResult.reset(); ticket->pendingCommand = command;
    condition_.notify_all();
    condition_.wait_until(lock, ticket->deadline, [&] {
      return !current(ticket) || ticket->failed || ticket->phasesComplete ||
        (ticket->commandSerial == serial && ticket->commandResult.has_value());
    });
    if (!current(ticket) || ticket->failed || ticket->phasesComplete)
      return fail(ticket->error.empty() ? "field-input-command-frame-retired" : ticket->error);
    if (Clock::now() >= ticket->deadline || !ticket->commandResult) {
      ticket->expired = true; ticket->pendingCommand.reset(); condition_.notify_all();
      return fail("field-input-command-timed-out");
    }
    return *ticket->commandResult;
  }
  bool isCurrent(const Handle &ticket) {
    std::lock_guard lock(mutex_);
    return current(ticket) && Clock::now() < ticket->deadline;
  }
  bool canFinishPhases(const Handle &ticket) {
    std::lock_guard lock(mutex_);
    return phaseActive(ticket) && ticket->returned && !ticket->phasesComplete && Clock::now() < ticket->deadline;
  }
  FieldInputDecision wait(const Handle &ticket,
      const std::function<FieldInputFocusResult(const FieldInputFocusAction &)> &serviceFocus = {},
      const std::function<FieldInputMountResult()> &serviceMount = {},
      const std::function<FieldInputCommandResult(const FieldInputCommandAction &)> &serviceCommand = {}) {
    std::unique_lock lock(mutex_);
    if (!ticket) return {FieldInputDisposition::Retired, {}, false, false};
    while (phaseActive(ticket) && !ticket->phasesComplete && Clock::now() < ticket->deadline) {
      condition_.wait_until(lock, ticket->deadline, [&] {
        return !phaseActive(ticket) || ticket->phasesComplete || ticket->pendingFocus.has_value() || ticket->pendingMount || ticket->pendingCommand;
      });
      if (!phaseActive(ticket) || ticket->phasesComplete) continue;
      if (ticket->pendingCommand) {
        auto command = std::move(ticket->pendingCommand);
        ticket->commandRunning = true; ticket->activeCommand = command;
        const bool allowed = current(ticket) && !ticket->failed && Clock::now() < ticket->deadline;
        const auto serial = ticket->commandSerial;
        lock.unlock();
        FieldInputCommandResult result;
        try {
          if (!allowed) result.error = "field-input-command-frame-retired";
          else if (serviceCommand) result = serviceCommand(*command);
          else result.error = "field-input-command-service-unavailable";
        } catch (const std::exception &error) { result.error = error.what(); }
        catch (...) { result.error = "field-input-command-service-threw"; }
        command->cancel();
        lock.lock();
        ticket->commandRunning = false; ticket->activeCommand.reset();
        if (!result.callbackCompleted && result.error.empty()) result.error = "field-input-command-callback-not-completed";
        if (!result.error.empty()) { ticket->failed = true; if (ticket->error.empty()) ticket->error = result.error; }
        if (current(ticket) && !ticket->phasesComplete && ticket->commandSerial == serial && Clock::now() < ticket->deadline)
          ticket->commandResult = std::move(result);
        condition_.notify_all();
        continue;
      }
      if (ticket->pendingMount) {
        ticket->pendingMount = false; ticket->mountRunning = true;
        ticket->activeMountTarget = ticket->pendingMountTarget; ticket->pendingMountTarget = 0;
        lock.unlock();
        FieldInputMountResult result;
        try {
          if (serviceMount) result = serviceMount();
          else result.error = "field-input-mount-service-unavailable";
        } catch (const std::exception &error) { result.error = error.what(); }
        catch (...) { result.error = "field-input-mount-service-threw"; }
        lock.lock();
        ticket->mountRunning = false; ticket->activeMountTarget = 0;
        if (!result.error.empty()) { ticket->failed = true; if (ticket->error.empty()) ticket->error = result.error; }
        if (phaseActive(ticket) && Clock::now() < ticket->deadline) ticket->mountResult = std::move(result);
        condition_.notify_all();
        continue;
      }
      if (!ticket->pendingFocus) continue;
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
    if (!ticket->phasesComplete) {
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
    std::unique_lock lock(mutex_);
    if (!ticket || ticket->closed || (!frames_.empty() && frames_.back() != ticket))
      return {FieldInputDisposition::Retired, {}, false, false};
    auto result = decision(ticket, FieldInputDisposition::Retired);
    if (live_ && originalCurrent && !ticket->retired) {
      if (ticket->expired || Clock::now() >= ticket->deadline) result = decision(ticket, FieldInputDisposition::TimedOut);
      else if (ticket->failed) result = decision(ticket, FieldInputDisposition::Failed);
      else if (!ticket->phasesComplete || !ticket->acknowledged) result = decision(ticket, FieldInputDisposition::Unacknowledged);
      else if (ticket->current) result = decision(ticket, ticket->prevented ? FieldInputDisposition::Prevented : FieldInputDisposition::Allowed);
    }
    ticket->retired = true; ticket->closed = true;
    auto command = std::move(ticket->pendingCommand), active = std::move(ticket->activeCommand);
    if (!frames_.empty()) frames_.pop_back();
    condition_.notify_all();
    lock.unlock();
    if (command) command->cancel();
    if (active) active->cancel();
    return result;
  }
  void retire() {
    std::vector<FieldInputCommand> commands;
    {
      std::lock_guard lock(mutex_);
      live_ = false;
      for (const auto &ticket : frames_) {
        ticket->retired = true; ticket->focus.reset();
        if (ticket->pendingCommand) commands.push_back(std::move(ticket->pendingCommand));
        if (ticket->activeCommand) commands.push_back(std::move(ticket->activeCommand));
      }
      frames_.clear(); condition_.notify_all();
    }
    for (const auto &command : commands) command->cancel();
  }
  void retireBinding(const std::string &owner, const std::string &binding) {
    std::vector<FieldInputCommand> commands;
    {
      std::lock_guard lock(mutex_);
      for (const auto &ticket : frames_) if (std::any_of(ticket->scopes.begin(), ticket->scopes.end(), [&](const auto &scope) {
        return scope.ownerId == owner && scope.bindingId == binding;
      })) {
        ticket->retired = true; ticket->focus.reset(); ticket->pendingFocus.reset();
        if (ticket->pendingCommand) commands.push_back(std::move(ticket->pendingCommand));
        if (ticket->activeCommand) commands.push_back(std::move(ticket->activeCommand));
      }
      condition_.notify_all();
    }
    for (const auto &command : commands) command->cancel();
  }

 private:
  bool phaseActive(const Handle &ticket) const {
    return live_ && ticket && !ticket->closed && !ticket->expired && (!ticket->retired || ticket->started) &&
      !frames_.empty() && frames_.back() == ticket;
  }
  bool current(const Handle &ticket) const {
    return phaseActive(ticket) && !ticket->retired;
  }
  static FieldInputDecision decision(const Handle &ticket, FieldInputDisposition disposition) {
    const bool admitted = disposition == FieldInputDisposition::Allowed || disposition == FieldInputDisposition::Prevented;
    return {disposition, admitted ? ticket->focus : std::nullopt, ticket->started, ticket->returned, ticket->error,
      ticket->originalDefaultPrevented, ticket->phasesComplete};
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
