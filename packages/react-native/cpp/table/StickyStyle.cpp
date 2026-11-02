#include "StickyStyle.h"
#include "../motion/NativeStyle.h"
#include "../motion/PopStyle.h"
#include <react/renderer/core/ComponentDescriptor.h>
#include <cmath>
#include <limits>
#include <stdexcept>
#include <typeinfo>

namespace codon::table {
using namespace facebook::react;
namespace y = facebook::yoga;
namespace {
constexpr std::array<const char *, 13> insetKeys{
    "left", "top", "right", "bottom", "start", "end", "inset", "insetInline", "insetBlock",
    "insetInlineStart", "insetInlineEnd", "insetBlockStart", "insetBlockEnd"};
Float nativeFloat(double value) {
  if (!std::isfinite(value) || std::abs(value) > std::numeric_limits<Float>::max())
    throw std::invalid_argument("Table sticky: finite representable native value required");
  return static_cast<Float>(value);
}
y::StyleLength selectedPosition(const y::Style &style,
    bool horizontal, bool trailing, bool rightToLeft) {
  // Match pinned Style.h edge precedence without its unexported fatal branch.
  if (horizontal) {
    const auto logical = style.position(trailing != rightToLeft ? y::Edge::End : y::Edge::Start);
    if (logical.isDefined()) return logical;
  }
  const auto physical = style.position(horizontal ? (trailing ? y::Edge::Right : y::Edge::Left) :
      (trailing ? y::Edge::Bottom : y::Edge::Top));
  if (physical.isDefined()) return physical;
  const auto axis = style.position(horizontal ? y::Edge::Horizontal : y::Edge::Vertical);
  return axis.isDefined() ? axis : style.position(y::Edge::All);
}
y::StyleLength fallbackInset(const folly::dynamic &value) {
  if (value.isNumber()) return y::StyleLength::points(nativeFloat(value.asDouble()));
  if (value.isString()) {
    const auto &text = value.asString();
    if (text == "auto") return y::StyleLength::ofAuto();
    if (!text.empty() && text.back() == '%') {
      size_t end;
      const auto number = std::stod(text.substr(0, text.size() - 1), &end);
      if (end != text.size() - 1) throw std::invalid_argument("Table sticky: invalid percentage");
      return y::StyleLength::percent(nativeFloat(number));
    }
  }
  throw std::invalid_argument("Table sticky: invalid fallback inset");
}
} // namespace

const BaseViewProps &nativeStickyViewProps(const ShadowNode &node, const Props::Shared &props) {
  const auto *selectedType = props.get();
  const auto *originalType = node.getProps().get();
  if (!props || !node.getTraits().check(ShadowNodeTraits::Trait::ViewKind) ||
      typeid(*selectedType) != typeid(*originalType))
    throw std::runtime_error("Table sticky: original view props authority unavailable");
  return static_cast<const BaseViewProps &>(*props);
}

TStickyAuthoredStyle captureNativeStickyStyle(const BaseViewProps &props, bool authoredPosition) {
  const auto source = codon::motion::captureNativePopStyle(props, authoredPosition);
  folly::dynamic fields = folly::dynamic::object();
  for (const auto key : insetKeys) fields[key] = source.at(key);
  if (!props.backgroundColor) fields["backgroundColor"] = nullptr;
  if (!props.zIndex) fields["zIndex"] = nullptr;
#ifdef RN_SERIALIZABLE_STATE
  const auto *transform = props.rawProps.get_ptr("transform");
  fields["transform"] = transform ? *transform : folly::dynamic(nullptr);
#endif
  return {std::move(fields), props.transform};
}

Props::Shared cloneNativeStickyStyle(const ShadowNode &node, const Props::Shared &source,
    const folly::dynamic &fields, const Transform &transform) {
  nativeStickyViewProps(node, source);
  auto result = node.getComponentDescriptor().cloneProps(
      {node.getSurfaceId(), *node.getContextContainer()}, source, RawProps(fields));
  const auto *resultType = result.get();
  const auto *sourceType = source.get();
  if (!result || result == source || typeid(*resultType) != typeid(*sourceType))
    throw std::runtime_error("Table sticky: fresh same-component props required");
  // The pinned ConcreteShadowNode::Props factory allocates mutable PropsT.
  // Initialize only this unpublished clone, following Sealable's public contract.
  auto mutableProps = std::const_pointer_cast<Props>(result);
  mutableProps->ensureUnsealed();
  static_cast<BaseViewProps &>(*mutableProps).transform = transform;
  return result;
}

Transform nativeStickyTransform(const Transform &authored, double x, double y) {
  auto result = authored;
  if (x != 0 || y != 0)
    result.operations.insert(result.operations.begin(), TransformOperation{
        .type = TransformOperationType::Translate,
        .x = ValueUnit(nativeFloat(x), UnitType::Point),
        .y = ValueUnit(nativeFloat(y), UnitType::Point),
        .z = ValueUnit(0, UnitType::Point)});
  return result;
}

folly::dynamic nativeStickyPresentationFields(const BaseViewProps &props,
    const folly::dynamic &fallback, const LayoutMetrics &metrics, double x, double y) {
  folly::dynamic fields = folly::dynamic::object();
  for (const auto key : insetKeys) fields[key] = nullptr;
  if (!props.backgroundColor) fields["backgroundColor"] = fallback.at("backgroundColor");
  if (!props.zIndex) fields["zIndex"] = 3;
#ifdef RN_SERIALIZABLE_STATE
  // Android's ordinary mounting path also consumes the raw style map. Keep its
  // current-size matrix equal to the typed symbolic transform used by Fabric.
  const auto projected = nativeStickyTransform(props.transform, x, y);
  const auto matrix = BaseViewProps::resolveTransform(metrics.frame.size, projected, TransformOrigin{});
  fields["transform"] = folly::dynamic::array(folly::dynamic::object("matrix", static_cast<folly::dynamic>(matrix)));
#else
  (void)metrics;
  (void)x;
  (void)y;
#endif
  return fields;
}

std::array<std::optional<double>, 4> nativeStickyInsets(const BaseViewProps &props,
    const folly::dynamic &fallback, bool rightToLeft, bool swapLeftAndRight,
    double viewportWidth, double viewportHeight) {
  auto style = codon::motion::copyNativeYogaStyle(props, swapLeftAndRight);
  if (!selectedPosition(style, false, false, rightToLeft).isDefined())
    style.setPosition(y::Edge::Top, fallbackInset(fallback.at("top")));
  const auto inset = [&](bool horizontal, bool trailing, double size) -> std::optional<double> {
    auto value = selectedPosition(style, horizontal, trailing, rightToLeft);
    if (!value.isDefined() || value.isAuto()) return std::nullopt;
    return nativeFloat(value.resolve(nativeFloat(size)).unwrapOrDefault(0.0f));
  };
  return {inset(true, false, viewportWidth), inset(false, false, viewportHeight),
      inset(true, true, viewportWidth), inset(false, true, viewportHeight)};
}

} // namespace codon::table
