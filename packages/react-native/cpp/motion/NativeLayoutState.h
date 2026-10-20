#pragma once

#include <yoga/style/Style.h>
#include <array>
#include <cmath>
#include <functional>
#include <memory>
#include <stdexcept>
#include <string_view>

namespace facebook::react {
class Props;
class ShadowNode;
}

namespace codon::motion {

enum class TNativeLayoutStateKind { Props, SafeAreaPadding, NativeViewport, AndroidEditor, SafeAreaContext, SvgFill, Portal };
enum class TNativeSafeAreaEdgeMode { Off, Additive, Maximum };
struct TNativeLayoutState {
  TNativeLayoutStateKind kind{TNativeLayoutStateKind::Props};
  std::shared_ptr<const facebook::react::Props> originalProps;
  // Physical left/top/right/bottom order; copied state contains no native cache.
  std::array<float, 4> insets{};
  std::array<float, 2> size{};
  std::array<float, 2> portalOffset{};
};

inline void requireNativeLayoutStateNumber(float value) {
  if (!std::isfinite(value)) throw std::runtime_error("Native motion: non-finite adopted layout state");
}

inline void requireNativeEditorLayoutAuthority(
    const facebook::yoga::Style &selected, const facebook::yoga::Style &original) {
  if (selected != original)
    throw std::runtime_error("Native motion: isolated editor layout props overrides are not permitted");
}

inline facebook::yoga::Style applyNativeViewportStyle(facebook::yoga::Style style, const std::array<float, 2> &size) {
  for (const auto value : size) {
    requireNativeLayoutStateNumber(value);
    if (value < 0) throw std::runtime_error("Native motion: invalid adopted viewport size");
  }
  style.setDimension(facebook::yoga::Dimension::Width, facebook::yoga::StyleSizeLength::points(size[0]));
  style.setDimension(facebook::yoga::Dimension::Height, facebook::yoga::StyleSizeLength::points(size[1]));
  style.setPositionType(facebook::yoga::PositionType::Absolute);
  return style;
}

inline facebook::yoga::Style applyNativeSafeAreaPadding(facebook::yoga::Style style, const std::array<float, 4> &padding) {
  constexpr facebook::yoga::Edge edges[]{facebook::yoga::Edge::Left, facebook::yoga::Edge::Top,
      facebook::yoga::Edge::Right, facebook::yoga::Edge::Bottom};
  for (size_t index = 0; index < padding.size(); index++) {
    requireNativeLayoutStateNumber(padding[index]);
    style.setPadding(edges[index], facebook::yoga::StyleLength::points(padding[index]));
  }
  return style;
}

// Pinned safe-area-context5.7.0 resolves raw physical/axis/all values before
// replacing them with points. Preserve its percent and logical-edge semantics.
inline facebook::yoga::Style applyNativeSafeAreaContext(
    facebook::yoga::Style style, const std::array<float, 4> &insets, bool padding,
    const std::array<TNativeSafeAreaEdgeMode, 4> &modes) {
  namespace y = facebook::yoga;
  constexpr y::Edge edges[]{y::Edge::Left, y::Edge::Top, y::Edge::Right, y::Edge::Bottom};
  for (size_t index = 0; index < insets.size(); index++) {
    requireNativeLayoutStateNumber(insets[index]);
    const auto edge = padding ? style.padding(edges[index]) : style.margin(edges[index]);
    const auto axisEdge = index == 0 || index == 2 ? y::Edge::Horizontal : y::Edge::Vertical;
    const auto axis = padding ? style.padding(axisEdge) : style.margin(axisEdge);
    const auto all = padding ? style.padding(y::Edge::All) : style.margin(y::Edge::All);
    const auto selected = edge.isDefined() ? edge : axis.isDefined() ? axis : all;
    const auto authored = selected.value().unwrapOrDefault(0);
    const auto value = modes[index] == TNativeSafeAreaEdgeMode::Off ? authored :
        modes[index] == TNativeSafeAreaEdgeMode::Maximum ? std::fmax(insets[index], authored) : insets[index] + authored;
    requireNativeLayoutStateNumber(value);
    if (padding) style.setPadding(edges[index], y::StyleLength::points(value));
    else style.setMargin(edges[index], y::StyleLength::points(value));
  }
  return style;
}

inline bool hasNativeSvgFillLayout(std::string_view name) {
  // ForeignObject explicitly uses YogaLayoutableShadowNode; Image and SvgView
  // use ordinary ConcreteViewShadowNode. Neither receives this constructor mask.
  constexpr std::string_view names[]{"RNSVGCircle", "RNSVGClipPath", "RNSVGDefs", "RNSVGEllipse", "RNSVGFeBlend",
      "RNSVGFeColorMatrix", "RNSVGFeComposite", "RNSVGFeFlood", "RNSVGFeGaussianBlur", "RNSVGFeMerge", "RNSVGFeOffset",
      "RNSVGFilter", "RNSVGGroup", "RNSVGLinearGradient", "RNSVGLine", "RNSVGMarker", "RNSVGMask", "RNSVGPath",
      "RNSVGPattern", "RNSVGRadialGradient", "RNSVGRect", "RNSVGSymbol", "RNSVGText", "RNSVGTextPath", "RNSVGTSpan", "RNSVGUse"};
  for (const auto candidate : names) if (candidate == name) return true;
  return false;
}

inline facebook::yoga::Style applyNativeSvgFillLayout(facebook::yoga::Style style) {
  namespace y = facebook::yoga;
  style.setPositionType(y::PositionType::Absolute);
  style.setPosition(y::Edge::All, y::StyleLength::points(0));
  style.setDimension(y::Dimension::Width, y::StyleSizeLength::percent(100));
  style.setDimension(y::Dimension::Height, y::StyleSizeLength::percent(100));
  return style;
}

inline facebook::yoga::Style applyNativePortalLayout(facebook::yoga::Style style, const std::array<float, 2> &size) {
  if (size[0] == 0 || size[1] == 0)
    throw std::runtime_error("Native motion: immutable portal host size unavailable");
  return applyNativeViewportStyle(std::move(style), size);
}

TNativeLayoutState captureNativeLayoutState(
    const facebook::react::ShadowNode &node, const std::function<void()> &check = {});

facebook::yoga::Style applyNativeLayoutState(
    const facebook::react::ShadowNode &source, const TNativeLayoutState &state,
    const std::shared_ptr<const facebook::react::Props> &selectedProps, bool swapLeftAndRight);

} // namespace codon::motion
