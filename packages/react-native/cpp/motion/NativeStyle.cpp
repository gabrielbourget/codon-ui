// Adapted from RN0.86.3 YogaLayoutableShadowNode; see UPSTREAM.json and LICENSE.react-native.md.
#include "NativeStyle.h"

namespace codon::motion {
namespace yoga = facebook::yoga;
using facebook::react::YogaStylableProps;

yoga::Style copyNativeYogaStyle(const YogaStylableProps &props, bool swapLeftAndRight) {
  const auto &baseStyle = props.yogaStyle;
  yoga::Style result{baseStyle};

  // Aliases with precedence
  if (props.insetInlineEnd.isDefined()) {
    result.setPosition(yoga::Edge::End, props.insetInlineEnd);
  }
  if (props.insetInlineStart.isDefined()) {
    result.setPosition(yoga::Edge::Start, props.insetInlineStart);
  }
  if (props.marginInline.isDefined()) {
    result.setMargin(yoga::Edge::Horizontal, props.marginInline);
  }
  if (props.marginInlineStart.isDefined()) {
    result.setMargin(yoga::Edge::Start, props.marginInlineStart);
  }
  if (props.marginInlineEnd.isDefined()) {
    result.setMargin(yoga::Edge::End, props.marginInlineEnd);
  }
  if (props.marginBlock.isDefined()) {
    result.setMargin(yoga::Edge::Vertical, props.marginBlock);
  }
  if (props.paddingInline.isDefined()) {
    result.setPadding(yoga::Edge::Horizontal, props.paddingInline);
  }
  if (props.paddingInlineStart.isDefined()) {
    result.setPadding(yoga::Edge::Start, props.paddingInlineStart);
  }
  if (props.paddingInlineEnd.isDefined()) {
    result.setPadding(yoga::Edge::End, props.paddingInlineEnd);
  }
  if (props.paddingBlock.isDefined()) {
    result.setPadding(yoga::Edge::Vertical, props.paddingBlock);
  }

  // Aliases without precedence
  if (result.position(yoga::Edge::Bottom).isUndefined()) {
    result.setPosition(yoga::Edge::Bottom, props.insetBlockEnd);
  }
  if (result.position(yoga::Edge::Top).isUndefined()) {
    result.setPosition(yoga::Edge::Top, props.insetBlockStart);
  }
  if (result.margin(yoga::Edge::Top).isUndefined()) {
    result.setMargin(yoga::Edge::Top, props.marginBlockStart);
  }
  if (result.margin(yoga::Edge::Bottom).isUndefined()) {
    result.setMargin(yoga::Edge::Bottom, props.marginBlockEnd);
  }
  if (result.padding(yoga::Edge::Top).isUndefined()) {
    result.setPadding(yoga::Edge::Top, props.paddingBlockStart);
  }
  if (result.padding(yoga::Edge::Bottom).isUndefined()) {
    result.setPadding(yoga::Edge::Bottom, props.paddingBlockEnd);
  }

  return swapLeftAndRight ? swapNativeYogaStyle(result) : result;
}

yoga::Style swapNativeYogaStyle(yoga::Style yogaStyle) {
  // Swap Yoga node values, position, padding and margin.

  if (yogaStyle.position(yoga::Edge::Left).isDefined()) {
    yogaStyle.setPosition(
        yoga::Edge::Start, yogaStyle.position(yoga::Edge::Left));
    yogaStyle.setPosition(yoga::Edge::Left, yoga::StyleLength::undefined());
  }

  if (yogaStyle.position(yoga::Edge::Right).isDefined()) {
    yogaStyle.setPosition(
        yoga::Edge::End, yogaStyle.position(yoga::Edge::Right));
    yogaStyle.setPosition(yoga::Edge::Right, yoga::StyleLength::undefined());
  }

  if (yogaStyle.padding(yoga::Edge::Left).isDefined()) {
    yogaStyle.setPadding(
        yoga::Edge::Start, yogaStyle.padding(yoga::Edge::Left));
    yogaStyle.setPadding(yoga::Edge::Left, yoga::StyleLength::undefined());
  }

  if (yogaStyle.padding(yoga::Edge::Right).isDefined()) {
    yogaStyle.setPadding(yoga::Edge::End, yogaStyle.padding(yoga::Edge::Right));
    yogaStyle.setPadding(yoga::Edge::Right, yoga::StyleLength::undefined());
  }

  if (yogaStyle.margin(yoga::Edge::Left).isDefined()) {
    yogaStyle.setMargin(yoga::Edge::Start, yogaStyle.margin(yoga::Edge::Left));
    yogaStyle.setMargin(yoga::Edge::Left, yoga::StyleLength::undefined());
  }

  if (yogaStyle.margin(yoga::Edge::Right).isDefined()) {
    yogaStyle.setMargin(yoga::Edge::End, yogaStyle.margin(yoga::Edge::Right));
    yogaStyle.setMargin(yoga::Edge::Right, yoga::StyleLength::undefined());
  }

  if (yogaStyle.border(yoga::Edge::Left).isDefined()) {
    yogaStyle.setBorder(yoga::Edge::Start, yogaStyle.border(yoga::Edge::Left));
    yogaStyle.setBorder(yoga::Edge::Left, yoga::StyleLength::undefined());
  }

  if (yogaStyle.border(yoga::Edge::Right).isDefined()) {
    yogaStyle.setBorder(yoga::Edge::End, yogaStyle.border(yoga::Edge::Right));
    yogaStyle.setBorder(yoga::Edge::Right, yoga::StyleLength::undefined());
  }

  return yogaStyle;
}

} // namespace codon::motion
