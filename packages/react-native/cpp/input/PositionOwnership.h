#pragma once

#include <memory>
#include <optional>
#include <stdexcept>

namespace facebook::react { class Props; }

namespace codon::input {

// Allocation and lookup share one native implementation. Independent Android
// dlopen groups need not merge RTTI used by a shared_ptr's private deleter.
__attribute__((visibility("default"))) std::optional<bool> nativePositionPresence(
    const std::shared_ptr<const facebook::react::Props> &props);

__attribute__((visibility("default"))) std::shared_ptr<const facebook::react::Props> withNativePositionPresence(
    std::shared_ptr<const facebook::react::Props> props, bool authored);

inline bool requireNativePositionPresence(
    const std::shared_ptr<const facebook::react::Props> &props) {
  const auto presence = nativePositionPresence(props);
  if (!presence) throw std::invalid_argument(
      "Table sticky / Motion popLayout: use NativeFocusView as the actual root and forward its original props/ref");
  return *presence;
}

} // namespace codon::input
