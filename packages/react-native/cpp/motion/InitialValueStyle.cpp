#include "InitialValueQuery.h"
#include "NativeYogaNames.h"
#include "NativeStyle.h"
#include "NativeTransformValue.h"

#include <react/renderer/graphics/BlendMode.h>
#include <cmath>
#include <iomanip>
#include <limits>
#include <locale>
#include <sstream>
#include <stdexcept>
#include <type_traits>

namespace codon::motion {
using namespace facebook::react;
namespace y = facebook::yoga;
namespace {
[[noreturn]] void unavailable(const std::string &name, const char *reason) {
  throw std::runtime_error("Native motion initial value: " + name + ": " + reason);
}
double finite(double value) {
  if (!std::isfinite(value)) throw std::runtime_error("Native motion initial value: non-finite native value");
  return value;
}
std::string unitString(double value, const char *unit) {
  std::ostringstream result;
  result.imbue(std::locale::classic());
  result << std::setprecision(std::numeric_limits<double>::max_digits10) << finite(value) << unit;
  return result.str();
}
folly::dynamic valueUnit(ValueUnit value, bool defaultCenter = false) {
  if (value.unit == UnitType::Undefined) return defaultCenter ? folly::dynamic("50%") : folly::dynamic(0);
  return value.unit == UnitType::Percent ? folly::dynamic(unitString(value.value, "%")) : folly::dynamic(finite(value.value));
}
template <typename T> folly::dynamic length(T value, const std::string &name, bool zeroDefault = false) {
  if (value.isUndefined()) {
    if (zeroDefault) return 0;
    unavailable(name, "no-native-value");
  }
  if (value.isAuto()) return "auto";
  if (value.isPoints()) return finite(value.value().unwrap());
  if (value.isPercent()) return unitString(value.value().unwrap(), "%");
  if constexpr (std::is_same_v<T, y::StyleSizeLength>) {
    if (value.isMaxContent()) return "max-content";
    if (value.isFitContent()) return "fit-content";
    if (value.isStretch() && value.value().isUndefined()) return "stretch";
  }
  unavailable(name, "unsupported-native-unit");
}
folly::dynamic color(SharedColor value, const TNativeInitialColorReader &readColor, bool transparentDefault = false) {
  if (!value && !transparentDefault)
    throw std::runtime_error("Native motion initial value: native-color-authority-unavailable");
  if (readColor) return readColor(value);
#if !defined(__ANDROID__)
  throw std::runtime_error("Native motion initial value: actual native color reader unavailable");
#else
  const auto components = colorComponentsFromColor(value);
  return "rgba(" + unitString(components.red * 255, "") + ", " +
      unitString(components.green * 255, "") + ", " + unitString(components.blue * 255, "") +
      ", " + unitString(components.alpha, "") + ")";
#endif
}
template <typename T> T unanimous(std::initializer_list<T> values, const std::string &name) {
  const auto first = *values.begin();
  for (const auto &value : values) if (value != first) unavailable(name, "ambiguous-native-shorthand");
  return first;
}
folly::dynamic offset(facebook::react::Size value) {
  return folly::dynamic::object("width", finite(value.width))("height", finite(value.height));
}
folly::dynamic transformArray(const Transform &transform) {
  auto result = folly::dynamic::array();
  for (const auto &operation : transform.operations) {
    const auto add = [&](const char *key, folly::dynamic value) {
      result.push_back(folly::dynamic::object(key, std::move(value)));
    };
    switch (operation.type) {
      case TransformOperationType::Identity: break;
      case TransformOperationType::Arbitrary: {
        auto matrix = folly::dynamic::array();
        for (const auto item : transform.matrix) matrix.push_back(finite(item));
        add("matrix", std::move(matrix)); break;
      }
      case TransformOperationType::Perspective: add("perspective", finite(operation.x.value)); break;
      case TransformOperationType::Scale:
        add("scaleX", finite(operation.x.value)); add("scaleY", finite(operation.y.value));
        if (operation.z.value != 1) {
          auto matrix = folly::dynamic::array(1, 0, 0, 0, 0, 1, 0, 0, 0, 0,
              finite(operation.z.value), 0, 0, 0, 0, 1);
          add("matrix", std::move(matrix));
        }
        break;
      case TransformOperationType::Translate:
        add("translateX", valueUnit(operation.x)); add("translateY", valueUnit(operation.y));
        if (operation.z.value != 0)
          add("matrix", folly::dynamic::array(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, finite(operation.z.value), 1));
        break;
      case TransformOperationType::Rotate:
        if (operation.x.value != 0) add("rotateX", unitString(operation.x.value, "rad"));
        if (operation.y.value != 0) add("rotateY", unitString(operation.y.value, "rad"));
        if (operation.z.value != 0) add("rotateZ", unitString(operation.z.value, "rad"));
        break;
      case TransformOperationType::Skew:
        if (operation.x.value != 0) add("skewX", unitString(operation.x.value, "rad"));
        if (operation.y.value != 0) add("skewY", unitString(operation.y.value, "rad"));
        break;
    }
  }
  return result;
}
folly::dynamic transformComponent(const ViewProps &props, const LayoutMetrics &metrics, const std::string &name) {
  const bool nativeRotationAlias = name == "pathRotation" || name == "rotation";
  if (!hasNativeMotionMatrixScalar(name) && !nativeRotationAlias && name != "transformPerspective") return nullptr;
  const auto matrix = BaseViewProps::resolveTransform(metrics.frame.size, props.transform, {}).matrix;
  // These three native aliases are not parser keys in pinned Motion. Retain
  // the native perspective coefficient and existing Z-rotation alias contract.
  if (name == "transformPerspective") return matrix[11] == 0 ? 0 : finite(-1 / matrix[11]);
  const auto result = readNativeMotionMatrixScalar(matrix, nativeRotationAlias ? std::string_view("rotateZ") : std::string_view(name));
  return result ? folly::dynamic(finite(*result)) : folly::dynamic(nullptr);
}
folly::dynamic gradientStops(const std::vector<ColorStop> &stops, const TNativeInitialColorReader &readColor) {
  auto result = folly::dynamic::array();
  for (const auto &stop : stops) {
    folly::dynamic item = folly::dynamic::object("color", color(stop.color, readColor));
    if (stop.position.unit != UnitType::Undefined) {
      auto positions = folly::dynamic::array();
      positions.push_back(stop.position.unit == UnitType::Percent ? unitString(stop.position.value, "%") : unitString(stop.position.value, "px"));
      item["positions"] = std::move(positions);
    }
    result.push_back(std::move(item));
  }
  return result;
}
template <typename T> folly::dynamic backgroundPosition(const T &position) {
  folly::dynamic result = folly::dynamic::object();
  if (position.top) result["top"] = valueUnit(*position.top);
  if (position.bottom) result["bottom"] = valueUnit(*position.bottom);
  if (position.left) result["left"] = valueUnit(*position.left);
  if (position.right) result["right"] = valueUnit(*position.right);
  return result;
}
} // namespace

folly::dynamic readNativeInitialViewValue(const ViewProps &props, const LayoutMetrics &metrics, const std::string &name,
    const TNativeInitialColorReader &readColor) {
  if (metrics == EmptyLayoutMetrics) unavailable(name, "actual-displayed-layout-required");
  const auto &style = props.yogaStyle;
  const bool rtl = metrics.layoutDirection == LayoutDirection::RightToLeft;
  if (metrics.layoutDirection != LayoutDirection::LeftToRight && !rtl) unavailable(name, "resolved-direction-required");
  const auto physical = [&](const auto &edges, bool end) { return end != rtl ? edges.right : edges.left; };
  const auto dimensionSize = style.boxSizing() == y::BoxSizing::ContentBox ? metrics.getContentFrame().size : metrics.frame.size;
  if (name == "width") return finite(dimensionSize.width);
  if (name == "height") return finite(dimensionSize.height);
  if (name == "opacity") return finite(props.opacity);
  if (name == "zIndex") return props.zIndex.value_or(0);
  if (name == "outlineWidth") return finite(props.outlineWidth);
  if (name == "outlineOffset") return finite(props.outlineOffset);
  if (name == "outlineStyle") return props.outlineStyle == OutlineStyle::Dotted ? "dotted" : props.outlineStyle == OutlineStyle::Dashed ? "dashed" : "solid";
  if (name == "shadowOffset") return offset(props.shadowOffset);
  if (name == "shadowRadius") return finite(props.shadowRadius);
  if (name == "shadowOpacity") return finite(props.shadowOpacity);
  if (name == "backgroundColor") return color(props.backgroundColor, readColor, true);
  if (name == "outlineColor") return color(props.outlineColor, readColor);
  if (name == "shadowColor") return color(props.shadowColor, readColor);
  if (name == "backfaceVisibility") return props.backfaceVisibility == BackfaceVisibility::Hidden ? "hidden" : "visible";
  if (name == "pointerEvents") return props.pointerEvents == PointerEventsMode::None ? "none" : props.pointerEvents == PointerEventsMode::BoxNone ? "box-none" : props.pointerEvents == PointerEventsMode::BoxOnly ? "box-only" : "auto";
  if (name == "isolation") return props.isolation == Isolation::Isolate ? "isolate" : "auto";
  if (name == "mixBlendMode") return toString(props.mixBlendMode);
  if (name == "cursor") {
    if (props.cursor != Cursor::Auto && props.cursor != Cursor::Pointer) unavailable(name, "native-cursor-not-in-style-contract");
    return props.cursor == Cursor::Pointer ? "pointer" : "auto";
  }
  if (name == "elevation") {
#if defined(__ANDROID__)
    return finite(props.elevation);
#else
    unavailable(name, "platform-does-not-render-elevation");
#endif
  }
  if (name == "direction") return rtl ? "rtl" : "ltr";
  if (name == "boxSizing") return nativeYogaEnumName(y::unscopedEnum(style.boxSizing()));
  if (name == "position") return nativeYogaEnumName(y::unscopedEnum(style.positionType()));
  if (name == "display") return nativeYogaEnumName(y::unscopedEnum(style.display()));
  if (name == "overflow") return nativeYogaEnumName(y::unscopedEnum(style.overflow()));
  if (name == "flexDirection") return nativeYogaEnumName(y::unscopedEnum(style.flexDirection()));
  if (name == "flexWrap") return nativeYogaEnumName(y::unscopedEnum(style.flexWrap()));
  if (name == "justifyContent") return nativeYogaEnumName(y::unscopedEnum(style.justifyContent()));
  if (name == "alignItems") return nativeYogaEnumName(y::unscopedEnum(style.alignItems()));
  if (name == "alignSelf") return nativeYogaEnumName(y::unscopedEnum(style.alignSelf()));
  if (name == "alignContent") return nativeYogaEnumName(y::unscopedEnum(style.alignContent()));
  if (name == "flex") return finite(style.flex().unwrapOrDefault(0));
  if (name == "flexGrow") return finite(style.flexGrow().unwrapOrDefault(style.flex().unwrapOrDefault(0) > 0 ? style.flex().unwrap() : y::Style::DefaultFlexGrow));
  if (name == "flexShrink") return finite(style.flexShrink().unwrapOrDefault(style.flex().unwrapOrDefault(0) < 0 ? -style.flex().unwrap() : y::Style::DefaultFlexShrink));
  if (name == "flexBasis") return style.flexBasis().isUndefined() || style.flexBasis().isAuto() ? (style.flex().unwrapOrDefault(0) > 0 ? folly::dynamic(0) : folly::dynamic("auto")) : length(style.flexBasis(), name);
  if (name == "aspectRatio") {
    if (style.aspectRatio().isUndefined()) unavailable(name, "no-native-value");
    return finite(style.aspectRatio().unwrap());
  }
  if (name == "minWidth") return length(style.minDimension(y::Dimension::Width), name);
  if (name == "maxWidth") return length(style.maxDimension(y::Dimension::Width), name);
  if (name == "minHeight") return length(style.minDimension(y::Dimension::Height), name);
  if (name == "maxHeight") return length(style.maxDimension(y::Dimension::Height), name);
  const auto gutter = [&](y::Gutter key) {
    const auto specific = style.gap(key);
    return length(specific.isDefined() ? specific : style.gap(y::Gutter::All), name, true);
  };
  if (name == "rowGap") return gutter(y::Gutter::Row);
  if (name == "columnGap") return gutter(y::Gutter::Column);
  if (name == "gap") return unanimous<folly::dynamic>({gutter(y::Gutter::Row), gutter(y::Gutter::Column)}, name);
  const auto effective = copyNativeYogaStyle(props, metrics.wasLeftAndRightSwapped);
  const auto margin = [&](y::Edge edge) {
    const bool horizontal = edge == y::Edge::Left || edge == y::Edge::Right;
    if (horizontal) {
      const auto logical = effective.margin((edge == y::Edge::Right) != rtl ? y::Edge::End : y::Edge::Start);
      if (logical.isDefined()) return length(logical, name);
    }
    const auto specific = effective.margin(edge);
    if (specific.isDefined()) return length(specific, name);
    const auto axis = effective.margin(horizontal ? y::Edge::Horizontal : y::Edge::Vertical);
    return length(axis.isDefined() ? axis : effective.margin(y::Edge::All), name, true);
  };
  if (name == "marginLeft") return margin(metrics.wasLeftAndRightSwapped ? y::Edge::Right : y::Edge::Left);
  if (name == "marginRight") return margin(metrics.wasLeftAndRightSwapped ? y::Edge::Left : y::Edge::Right);
  if (name == "marginTop" || name == "marginBlockStart") return margin(y::Edge::Top);
  if (name == "marginBottom" || name == "marginBlockEnd") return margin(y::Edge::Bottom);
  if (name == "marginStart" || name == "marginInlineStart") return margin(rtl ? y::Edge::Right : y::Edge::Left);
  if (name == "marginEnd" || name == "marginInlineEnd") return margin(rtl ? y::Edge::Left : y::Edge::Right);
  if (name == "marginHorizontal" || name == "marginInline") return unanimous<folly::dynamic>({margin(y::Edge::Left), margin(y::Edge::Right)}, name);
  if (name == "marginVertical" || name == "marginBlock") return unanimous<folly::dynamic>({margin(y::Edge::Top), margin(y::Edge::Bottom)}, name);
  if (name == "margin") return unanimous<folly::dynamic>({margin(y::Edge::Left), margin(y::Edge::Right), margin(y::Edge::Top), margin(y::Edge::Bottom)}, name);
  const EdgeInsets padding{metrics.contentInsets.left - metrics.borderWidth.left,
      metrics.contentInsets.top - metrics.borderWidth.top, metrics.contentInsets.right - metrics.borderWidth.right,
      metrics.contentInsets.bottom - metrics.borderWidth.bottom};
  const auto edgeValue = [&](const auto &edges, const std::string &prefix, const std::string &suffix) -> folly::dynamic {
    if (name == prefix + "Left" + suffix) return finite(metrics.wasLeftAndRightSwapped ? edges.right : edges.left);
    if (name == prefix + "Right" + suffix) return finite(metrics.wasLeftAndRightSwapped ? edges.left : edges.right);
    if (name == prefix + "Top" + suffix || name == prefix + "BlockStart" + suffix) return finite(edges.top);
    if (name == prefix + "Bottom" + suffix || name == prefix + "BlockEnd" + suffix) return finite(edges.bottom);
    if (name == prefix + "Start" + suffix || name == prefix + "InlineStart" + suffix) return finite(physical(edges, false));
    if (name == prefix + "End" + suffix || name == prefix + "InlineEnd" + suffix) return finite(physical(edges, true));
    if (name == prefix + "Horizontal" + suffix || name == prefix + "Inline" + suffix) return finite(unanimous<double>({edges.left, edges.right}, name));
    if (name == prefix + "Vertical" + suffix || name == prefix + "Block" + suffix) return finite(unanimous<double>({edges.top, edges.bottom}, name));
    if (name == prefix + suffix) return finite(unanimous<double>({edges.left, edges.top, edges.right, edges.bottom}, name));
    return nullptr;
  };
  if (auto value = edgeValue(padding, "padding", ""); !value.isNull()) return value;
  if (auto value = edgeValue(metrics.borderWidth, "border", "Width"); !value.isNull()) return value;
  const auto borders = props.resolveBorderMetrics(metrics);
  const auto &colors = borders.borderColors;
  if (name == "borderColor") return color(unanimous<SharedColor>({colors.left, colors.top, colors.right, colors.bottom}, name), readColor);
  if (name == "borderLeftColor") return color(colors.left, readColor);
  if (name == "borderRightColor") return color(colors.right, readColor);
  if (name == "borderTopColor" || name == "borderBlockStartColor") return color(colors.top, readColor);
  if (name == "borderBottomColor" || name == "borderBlockEndColor") return color(colors.bottom, readColor);
  if (name == "borderStartColor") return color(physical(colors, false), readColor);
  if (name == "borderEndColor") return color(physical(colors, true), readColor);
  if (name == "borderBlockColor") return color(unanimous<SharedColor>({colors.top, colors.bottom}, name), readColor);
  if (name == "borderStyle") {
    const auto value = unanimous<BorderStyle>({borders.borderStyles.left, borders.borderStyles.top, borders.borderStyles.right, borders.borderStyles.bottom}, name);
    return value == BorderStyle::Dashed ? "dashed" : value == BorderStyle::Dotted ? "dotted" : "solid";
  }
  if (name == "borderCurve") {
    const auto value = unanimous<BorderCurve>({borders.borderCurves.topLeft, borders.borderCurves.topRight, borders.borderCurves.bottomLeft, borders.borderCurves.bottomRight}, name);
    return value == BorderCurve::Continuous ? "continuous" : "circular";
  }
  const auto &radii = borders.borderRadii;
  const auto scalarRadius = [&](const CornerRadii &radius) { return finite(unanimous<double>({radius.horizontal, radius.vertical}, name)); };
  if (name == "borderRadius") return unanimous<double>({scalarRadius(radii.topLeft), scalarRadius(radii.topRight), scalarRadius(radii.bottomLeft), scalarRadius(radii.bottomRight)}, name);
  if (name == "borderTopLeftRadius") return scalarRadius(radii.topLeft);
  if (name == "borderTopRightRadius") return scalarRadius(radii.topRight);
  if (name == "borderBottomLeftRadius") return scalarRadius(radii.bottomLeft);
  if (name == "borderBottomRightRadius") return scalarRadius(radii.bottomRight);
  if (name == "borderTopStartRadius" || name == "borderStartStartRadius") return scalarRadius(rtl ? radii.topRight : radii.topLeft);
  if (name == "borderTopEndRadius" || name == "borderStartEndRadius") return scalarRadius(rtl ? radii.topLeft : radii.topRight);
  if (name == "borderBottomStartRadius" || name == "borderEndStartRadius") return scalarRadius(rtl ? radii.bottomRight : radii.bottomLeft);
  if (name == "borderBottomEndRadius" || name == "borderEndEndRadius") return scalarRadius(rtl ? radii.bottomLeft : radii.bottomRight);
  if (name == "transform") return transformArray(props.transform);
  if (name == "transformMatrix") {
    auto result = folly::dynamic::array();
    for (const auto item : BaseViewProps::resolveTransform(metrics.frame.size, props.transform, {}).matrix) result.push_back(finite(item));
    return result;
  }
  if (name == "transformOrigin") return folly::dynamic::array(valueUnit(props.transformOrigin.xy[0], true), valueUnit(props.transformOrigin.xy[1], true), finite(props.transformOrigin.z));
  if (name == "originZ") return finite(props.transformOrigin.z);
  if (name == "originX" || name == "originY") {
    const auto index = name == "originX" ? 0 : 1;
    const auto origin = props.transformOrigin.xy[index];
    if (origin.unit == UnitType::Undefined) return 0.5;
    if (origin.unit == UnitType::Percent) return unitString(origin.value, "%");
    const auto dimension = index == 0 ? metrics.frame.size.width : metrics.frame.size.height;
    if (dimension == 0) unavailable(name, "zero-size-origin-fraction-unavailable");
    return finite(origin.value / dimension);
  }
  if (auto value = transformComponent(props, metrics, name); !value.isNull()) return value;
  if (name == "boxShadow") {
    auto result = folly::dynamic::array();
    for (const auto &shadow : props.boxShadow)
      result.push_back(folly::dynamic::object("offsetX", finite(shadow.offsetX))("offsetY", finite(shadow.offsetY))
          ("blurRadius", finite(shadow.blurRadius))("spreadDistance", finite(shadow.spreadDistance))("inset", shadow.inset)("color", color(shadow.color, readColor)));
    return result;
  }
  if (name == "filter") {
    auto result = folly::dynamic::array();
    for (const auto &filter : props.filter) {
      folly::dynamic value;
      if (const auto *scalar = std::get_if<Float>(&filter.parameters)) value = finite(*scalar);
      else {
        const auto &shadow = std::get<DropShadowParams>(filter.parameters);
        value = folly::dynamic::object("offsetX", finite(shadow.offsetX))("offsetY", finite(shadow.offsetY))
            ("standardDeviation", finite(shadow.standardDeviation))("color", color(shadow.color, readColor));
      }
      result.push_back(folly::dynamic::object(toString(filter.type), std::move(value)));
    }
    return result;
  }
  if (name == "experimental_backgroundSize") {
    auto result = folly::dynamic::array();
    for (const auto &size : props.backgroundSize) {
      if (const auto *keyword = std::get_if<BackgroundSizeKeyword>(&size)) result.push_back(*keyword == BackgroundSizeKeyword::Cover ? "cover" : "contain");
      else {
        const auto &value = std::get<BackgroundSizeLengthPercentage>(size);
        result.push_back(folly::dynamic::object("x", value.isXAuto() ? folly::dynamic("auto") : valueUnit(std::get<ValueUnit>(value.x)))
            ("y", value.isYAuto() ? folly::dynamic("auto") : valueUnit(std::get<ValueUnit>(value.y))));
      }
    }
    return result;
  }
  if (name == "experimental_backgroundPosition") {
    auto result = folly::dynamic::array();
    for (const auto &position : props.backgroundPosition) result.push_back(backgroundPosition(position));
    return result;
  }
  if (name == "experimental_backgroundRepeat") {
    const auto repeat = [](BackgroundRepeatStyle value) { return value == BackgroundRepeatStyle::Repeat ? "repeat" : value == BackgroundRepeatStyle::Space ? "space" : value == BackgroundRepeatStyle::Round ? "round" : "no-repeat"; };
    auto result = folly::dynamic::array();
    for (const auto &value : props.backgroundRepeat) result.push_back(folly::dynamic::object("x", repeat(value.x))("y", repeat(value.y)));
    return result;
  }
  if (name == "experimental_backgroundImage") {
    auto result = folly::dynamic::array();
    for (const auto &image : props.backgroundImage) {
      if (const auto *linear = std::get_if<LinearGradient>(&image)) {
        std::string direction;
        if (const auto *angle = std::get_if<Float>(&linear->direction)) direction = unitString(*angle, "deg");
        else {
          const auto keyword = std::get<GradientKeyword>(linear->direction);
          direction = keyword == GradientKeyword::ToTopRight ? "to top right" : keyword == GradientKeyword::ToTopLeft ? "to top left" : keyword == GradientKeyword::ToBottomRight ? "to bottom right" : "to bottom left";
        }
        result.push_back(folly::dynamic::object("type", "linear-gradient")("direction", direction)("colorStops", gradientStops(linear->colorStops, readColor)));
      } else {
        const auto &gradient = std::get<RadialGradient>(image);
        folly::dynamic size;
        if (const auto *dimensions = std::get_if<RadialGradientSize::Dimensions>(&gradient.size.value))
          size = folly::dynamic::object("x", valueUnit(dimensions->x))("y", valueUnit(dimensions->y));
        else {
          const auto keyword = std::get<RadialGradientSize::SizeKeyword>(gradient.size.value);
          size = keyword == RadialGradientSize::SizeKeyword::ClosestSide ? "closest-side" : keyword == RadialGradientSize::SizeKeyword::FarthestSide ? "farthest-side" : keyword == RadialGradientSize::SizeKeyword::ClosestCorner ? "closest-corner" : "farthest-corner";
        }
        result.push_back(folly::dynamic::object("type", "radial-gradient")("shape", gradient.shape == RadialGradientShape::Circle ? "circle" : "ellipse")
            ("size", std::move(size))("position", backgroundPosition(gradient.position))("colorStops", gradientStops(gradient.colorStops, readColor)));
      }
    }
    return result;
  }
  unavailable(name, "unsupported-native-view-field");
}

} // namespace codon::motion
