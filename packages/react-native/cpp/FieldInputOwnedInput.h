#pragma once

#include "FieldInputDispatchFrames.h"
#include <functional>
#include <string>

namespace codon {
// Fresh native identities travel with this original record. The capability is
// allocated only at first JS delivery and inherits the exact parent deadline.
struct FieldInputOwnedInput {
  FieldInputIdentity identity;
  int64_t eventId;
  std::vector<FieldInputIdentity> scopes;
  std::weak_ptr<void> owner;
  std::function<std::string(const FieldInputDispatchFrames::Handle &)> packet;
  std::function<bool()> current;
};
} // namespace codon
