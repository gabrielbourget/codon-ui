#include "../input/PositionOwnership.h"

namespace codon::input {
namespace {
// Keep the generated final props object intact. Its owning control block carries
// the private presence bit; casts and weak references retain the same lifetime.
struct PositionOwnership final {
  std::shared_ptr<const facebook::react::Props> original;
  bool authored;
  void operator()(const facebook::react::Props *) noexcept { original.reset(); }
};
} // namespace

std::optional<bool> nativePositionPresence(
    const std::shared_ptr<const facebook::react::Props> &props) {
  const auto *ownership = std::get_deleter<PositionOwnership>(props);
  if (!ownership || ownership->original.get() != props.get()) return std::nullopt;
  return ownership->authored;
}

std::shared_ptr<const facebook::react::Props> withNativePositionPresence(
    std::shared_ptr<const facebook::react::Props> props, bool authored) {
  if (!props) throw std::invalid_argument("Native position: original props required");
  const auto existing = nativePositionPresence(props);
  if (existing && *existing == authored) return props;
  const auto *original = props.get();
  return {original, PositionOwnership{std::move(props), authored}};
}

} // namespace codon::input
