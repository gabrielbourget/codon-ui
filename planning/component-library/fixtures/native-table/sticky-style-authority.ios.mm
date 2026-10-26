#include <react/renderer/components/view/YogaStylableProps.h>
#include <react/renderer/core/Props.h>

template <typename T>
concept THasAuthoredRawProps = requires(const T &props) { props.rawProps; };

// This is a deliberate unsupported-path probe for the current, unchanged iOS ABI.
// A future SDK change must replace this receipt, rather than inherit its result.
static_assert(!THasAuthoredRawProps<facebook::react::Props>);
static_assert(!THasAuthoredRawProps<facebook::react::YogaStylableProps>);

bool nativeTablePositionPresenceIsLost() {
  facebook::react::YogaStylableProps omitted;
  facebook::react::YogaStylableProps explicitRelative;
  explicitRelative.yogaStyle.setPositionType(facebook::yoga::PositionType::Relative);
  return omitted.yogaStyle.positionType() == explicitRelative.yogaStyle.positionType();
}
