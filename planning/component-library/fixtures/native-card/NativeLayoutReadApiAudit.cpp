#include <react/renderer/components/view/YogaStylableProps.h>
#include <react/renderer/core/LayoutableShadowNode.h>
#include <react/renderer/core/LayoutContext.h>
#include <react/renderer/core/ShadowNodeFragment.h>
#include <type_traits>

// Declaration/ownership audit only. No tree is cloned, laid out, mounted,
// measured at runtime or certified as an isolated native layout backend.
namespace codon::motion::audit {
using namespace facebook::react;

template <typename T>
concept FragmentCanReplaceEventEmitter = requires(T fragment) {
  fragment.eventEmitter;
};
static_assert(!FragmentCanReplaceEventEmitter<ShadowNodeFragment>);
static_assert(std::is_copy_constructible_v<facebook::yoga::Style>);

facebook::yoga::Style copyNativeYogaStyle(const YogaStylableProps &props) {
  return props.yogaStyle;
}
facebook::react::Size readNativeIntrinsicMeasurement(
    const LayoutableShadowNode &node,
    const LayoutContext &context,
    const LayoutConstraints &constraints) {
  return node.measureContent(context, constraints);
}
} // namespace codon::motion::audit
