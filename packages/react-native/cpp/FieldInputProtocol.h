#pragma once

#include "FieldInputDispatchFrames.h"
#include <folly/json.h>
#include <stdexcept>
#include <cmath>

namespace codon {
inline int64_t fieldInputInteger(const folly::dynamic &value, bool tag = false) {
  if (!value.isNumber() || !std::isfinite(value.asDouble()) || value.asDouble() <= 0 ||
      value.asDouble() != std::floor(value.asDouble()) || value.asDouble() > (tag ? INT32_MAX : 9007199254740991.0))
    throw std::invalid_argument("field-input-integer-invalid");
  return static_cast<int64_t>(value.asDouble());
}
inline FieldInputIdentity decodeFieldInputIdentity(const folly::dynamic &value) {
  if (!value.isObject() || value.size() != 17) throw std::invalid_argument("field-input-identity-invalid");
  FieldInputIdentity identity{
    value.at("ownerId").asString(), value.at("bindingId").asString(), value.at("bindingRevision").asString(),
    static_cast<int32_t>(fieldInputInteger(value.at("metadataTarget"), true)),
    static_cast<int32_t>(fieldInputInteger(value.at("outerTarget"), true)),
    static_cast<int32_t>(fieldInputInteger(value.at("inputTarget"), true)),
    static_cast<int32_t>(fieldInputInteger(value.at("surfaceId"), true)),
    static_cast<int32_t>(fieldInputInteger(value.at("target"), true)),
    value.at("documentId").asString(), value.at("documentRevision").asString(), value.at("windowId").asString(),
    value.at("mountRevision").asString(), value.at("outerInstance").asString(), value.at("inputInstance").asString(),
    value.at("nativeInstance").asString(), value.at("editorInstance").asString(), fieldInputInteger(value.at("epoch"))};
  if (!identity.valid()) throw std::invalid_argument("field-input-identity-invalid");
  return identity;
}
inline folly::dynamic encodeFieldInputIdentity(const FieldInputIdentity &value) {
  return folly::dynamic::object("ownerId", value.ownerId)("bindingId", value.bindingId)("bindingRevision", value.bindingRevision)
    ("metadataTarget", value.metadataTarget)("outerTarget", value.outerTarget)("inputTarget", value.inputTarget)
    ("surfaceId", value.surfaceId)("target", value.target)("documentId", value.documentId)("documentRevision", value.documentRevision)
    ("windowId", value.windowId)("mountRevision", value.mountRevision)("outerInstance", value.outerInstance)
    ("inputInstance", value.inputInstance)("nativeInstance", value.nativeInstance)("editorInstance", value.editorInstance)("epoch", value.epoch);
}
inline bool settleFieldInput(FieldInputDispatchFrames &frames, const std::string &encoded) {
  try {
    const auto request = folly::parseJson(encoded);
    if (!request.isObject() || request.size() != 7 || !request.at("current").isBool() || !request.at("preventDefault").isBool()) return false;
    const auto identity = decodeFieldInputIdentity(request.at("identity"));
    std::optional<FieldInputFocusAction> focus;
    const auto &action = request.at("focus");
    if (!action.isNull()) {
      if (!action.isObject() || action.size() != 2) return false;
      focus = {static_cast<int32_t>(fieldInputInteger(action.at("groupTarget"), true)), action.at("kind").asString()};
    }
    return frames.acknowledge(fieldInputInteger(request.at("token")), identity, fieldInputInteger(request.at("eventId")),
      request.at("phase").asString(), request.at("current").asBool(), request.at("preventDefault").asBool(), std::move(focus));
  } catch (const std::exception &) { return false; }
}
inline bool acceptsFieldInput(FieldInputDispatchFrames &frames, const std::string &encoded) {
  try {
    const auto request = folly::parseJson(encoded);
    if (!request.isObject() || request.size() != 4) return false;
    return frames.accepts(fieldInputInteger(request.at("token")), decodeFieldInputIdentity(request.at("identity")),
      fieldInputInteger(request.at("eventId")), request.at("phase").asString());
  } catch (const std::exception &) { return false; }
}
inline std::string moveFieldInputFocus(FieldInputDispatchFrames &frames, const std::string &encoded) {
  FieldInputFocusResult result;
  try {
    const auto request = folly::parseJson(encoded);
    if (!request.isObject() || request.size() != 5 || !request.at("action").isObject() || request.at("action").size() != 2)
      throw std::invalid_argument("field-input-focus-request-invalid");
    const FieldInputFocusAction action{static_cast<int32_t>(fieldInputInteger(request.at("action").at("groupTarget"), true)),
      request.at("action").at("kind").asString()};
    result = frames.requestFocus(fieldInputInteger(request.at("token")), decodeFieldInputIdentity(request.at("identity")),
      fieldInputInteger(request.at("eventId")), request.at("phase").asString(), action);
  } catch (const std::exception &error) { result.error = error.what(); }
  return folly::toJson(folly::dynamic::object("requested", result.requested)("observed", result.observed)("current", result.current)
    ("target", result.target)("nativeInstance", result.nativeInstance)("editorInstance", result.editorInstance)("error", result.error));
}
} // namespace codon
