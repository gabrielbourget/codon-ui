#include <react/renderer/components/view/YogaStylableProps.h>
#include <react/renderer/core/Props.h>

template <typename T>
concept THasAuthoredRawProps = requires(const T &props) { props.rawProps; };

// Preserve the pre-marker finding: the resolved position and raw-map ABI alone
// cannot identify omission. The approved marker has separate parser controls.
static_assert(!THasAuthoredRawProps<facebook::react::Props>);
static_assert(!THasAuthoredRawProps<facebook::react::YogaStylableProps>);
static_assert(requires(const facebook::react::YogaStylableProps &props) { props.cuiHasAuthoredPosition; });

bool nativeTableResolvedPositionTypesAreEqual() {
  facebook::react::YogaStylableProps omitted;
  facebook::react::YogaStylableProps explicitRelative;
  explicitRelative.yogaStyle.setPositionType(facebook::yoga::PositionType::Relative);
  return omitted.yogaStyle.positionType() == explicitRelative.yogaStyle.positionType();
}
