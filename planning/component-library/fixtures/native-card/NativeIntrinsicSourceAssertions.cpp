#include "NativeIntrinsicSource.h"
#include <limits>
#include <stdexcept>

// Maintained native harness assertions. Compile now; execution needs a separately authorized
// matching harness with its actual original family/selected props/window guard.
namespace codon::motion {
namespace {
void requireIntrinsic(bool condition, const char *message) {
  if (!condition) throw std::runtime_error(message);
}
struct Counts { int captures{0}, releases{0}, measures{0}, baselines{0}; bool current{true}, invalid{false}; };
class Session final : public CUIIntrinsicSession {
 public:
  std::shared_ptr<Counts> counts;
  explicit Session(std::shared_ptr<Counts> source) : counts(std::move(source)) {}
  bool current() const override { return counts->current; }
  TNativeScratchIntrinsic callbacks() override {
    return {
      [state = counts](float width, YGMeasureMode, float height, YGMeasureMode, YGDirection direction) {
        state->measures++;
        return YGSize{state->invalid ? std::numeric_limits<float>::quiet_NaN() : width,
          height + (direction == YGDirectionRTL ? 1 : 0)};
      },
      [state = counts](float, float, const auto &border, const auto &padding, YGDirection) {
        state->baselines++; return 7 + border[1] + padding[1];
      }
    };
  }
  void release() noexcept override { counts->releases++; }
};
class Source final : public CUIIntrinsicSource {
 public:
  std::shared_ptr<Counts> counts;
  facebook::react::Props::Shared expected;
  Source(std::shared_ptr<Counts> source, facebook::react::Props::Shared props)
      : counts(std::move(source)), expected(std::move(props)) {}
  std::shared_ptr<CUIIntrinsicSession> capture(const TNativeIntrinsicRequest &request) override {
    requireIntrinsic(request.props == expected, "selected original typed props retained");
    request.check(); counts->captures++;
    return std::make_shared<Session>(counts);
  }
};
template<typename F> void rejectsIntrinsic(F operation) {
  bool rejected = false;
  try { operation(); } catch (const std::runtime_error &) { rejected = true; }
  requireIntrinsic(rejected, "retired/unregistered/nonfinite intrinsic rejected");
}
}

void assertNativeIntrinsicSourceOwnership(const TNativeIntrinsicRequest &request) {
  auto first = std::make_shared<Counts>();
  auto registration = registerNativeIntrinsicSource(request.family, std::make_shared<Source>(first, request.props));
  requireIntrinsic(registration->active() && hasNativeIntrinsicSource(*request.family), "exact original family registered");
  {
    auto callbacks = captureNativeIntrinsicSource(request);
    auto size = callbacks.measure(32.5f, YGMeasureModeAtMost, 40, YGMeasureModeExactly, YGDirectionRTL);
    requireIntrinsic(size.width == 32.5f && size.height == 41, "original fractional constraints/direction reach provider");
    requireIntrinsic(callbacks.baseline(32.5f, 41, {0,2,0,0}, {0,3,0,0}, YGDirectionRTL) == 12,
      "owned baseline retains border/padding");
    auto second = std::make_shared<Counts>();
    auto replacement = registerNativeIntrinsicSource(request.family, std::make_shared<Source>(second, request.props));
    requireIntrinsic(!registration->active(), "replacement retires earlier registration");
    rejectsIntrinsic([&] { callbacks.measure(1, YGMeasureModeExactly, 1, YGMeasureModeExactly, YGDirectionLTR); });
    auto current = captureNativeIntrinsicSource(request);
    second->invalid = true;
    rejectsIntrinsic([&] { current.measure(1, YGMeasureModeExactly, 1, YGMeasureModeExactly, YGDirectionLTR); });
    second->invalid = false; second->current = false;
    rejectsIntrinsic([&] { current.baseline(1, 1, {}, {}, YGDirectionLTR); });
    current = {};
    requireIntrinsic(second->captures == 1 && second->releases == 1, "replacement session releases exactly once");
    replacement->dispose();
    rejectsIntrinsic([&] { captureNativeIntrinsicSource(request); });
  }
  requireIntrinsic(first->captures == 1 && first->measures == 1 && first->baselines == 1 && first->releases == 1,
    "failed calls never enter original provider; request resources retire once");
}
} // namespace codon::motion
