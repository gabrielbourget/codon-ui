#pragma once

#include "FieldInputOwnedInput.h"
#include <exception>
#include <stdexcept>

namespace codon {
template <typename TDispatch, typename TReport>
bool dispatchFieldInputSubphase(FieldInputDispatchFrames &frames,
    const FieldInputDispatchFrames::Handle &parent, const FieldInputOwnedInput &context,
    const void *owner, TDispatch &&dispatch, TReport &&report) {
  if (context.owner.lock().get() != owner || !context.packet || !context.current || !context.current())
    throw std::runtime_error("field-input-captured-input-retired");
  const auto input = frames.beginInput(parent, context.identity, context.eventId, context.scopes);
  if (!input) throw std::runtime_error("field-input-subphase-admission-retired");
  bool delivered = false;
  std::string error;
  std::exception_ptr failure;
  try {
    if (!frames.startDelivery(input)) throw std::runtime_error("field-input-subphase-admission-retired");
    delivered = dispatch(input);
    if (!delivered) error = "field-input-original-event-dispatcher-retired";
  } catch (const std::exception &exception) { error = exception.what(); failure = std::current_exception(); }
  catch (...) { error = "field-input-original-subphase-threw"; failure = std::current_exception(); }
  const auto result = frames.finishInput(input, !delivered || !error.empty(), error);
  report(input, result);
  if (failure) std::rethrow_exception(failure);
  if (result.disposition != FieldInputDisposition::Allowed)
    throw std::runtime_error(result.error.empty() ? "field-input-subphase-unacknowledged-or-retired" : result.error);
  return delivered;
}
} // namespace codon
