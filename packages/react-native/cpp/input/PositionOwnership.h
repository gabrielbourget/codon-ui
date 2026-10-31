#pragma once

#include <memory>
#include <optional>
#include <stdexcept>

namespace facebook::react { class Props; }

namespace codon::input {

// Keep the generated final props object intact. Its owning control block carries
// the private presence bit; casts and weak references retain the same lifetime.
struct __attribute__((visibility("default"))) PositionOwnership final {
  std::shared_ptr<const facebook::react::Props> original;
  bool authored;
  void operator()(const facebook::react::Props *) noexcept { original.reset(); }
};

inline std::optional<bool> nativePositionPresence(
    const std::shared_ptr<const facebook::react::Props> &props) {
  const auto *ownership = std::get_deleter<PositionOwnership>(props);
  if (!ownership || ownership->original.get() != props.get()) return std::nullopt;
  return ownership->authored;
}

inline std::shared_ptr<const facebook::react::Props> withNativePositionPresence(
    std::shared_ptr<const facebook::react::Props> props, bool authored) {
  if (!props) throw std::invalid_argument("Native position: original props required");
  const auto existing = nativePositionPresence(props);
  if (existing && *existing == authored) return props;
  const auto *original = props.get();
  return {original, PositionOwnership{std::move(props), authored}};
}

inline bool requireNativePositionPresence(
    const std::shared_ptr<const facebook::react::Props> &props) {
  const auto presence = nativePositionPresence(props);
  if (!presence) throw std::invalid_argument(
      "Table sticky / Motion popLayout: use NativeFocusView as the actual root and forward its original props/ref");
  return *presence;
}

} // namespace codon::input
