#include "PopStyle.h"

#include <array>
#include <iomanip>
#include <limits>
#include <sstream>
#include <locale>
#include <stdexcept>
#include <type_traits>

namespace codon::motion {
namespace y = facebook::yoga;
namespace {
constexpr std::array<const char *, 17> keys{
    "position", "width", "height", "boxSizing", "left", "top", "right", "bottom",
    "start", "end", "inset", "insetInline", "insetBlock",
    "insetInlineStart", "insetInlineEnd", "insetBlockStart", "insetBlockEnd"};
template <typename T> folly::dynamic encodeLength(T value) {
  if (value.isUndefined()) return nullptr;
  if (value.isAuto()) return "auto";
  if (value.isPoints()) return value.value().unwrap();
  if (value.isPercent()) {
    std::ostringstream encoded;
    encoded.imbue(std::locale::classic());
    encoded << std::setprecision(std::numeric_limits<float>::max_digits10)
            << value.value().unwrap() << '%';
    return encoded.str();
  }
  if constexpr (std::is_same_v<T, y::StyleSizeLength>) {
    if (value.isMaxContent()) return "max-content";
    if (value.isFitContent()) return "fit-content";
    if (value.isStretch() && value.value().isUndefined()) return "stretch";
  }
  throw std::runtime_error("Native popLayout: unsupported authored Yoga unit");
}
} // namespace

folly::dynamic captureNativePopStyle(const facebook::react::YogaStylableProps &props) {
  const auto &style = props.yogaStyle;
  const auto position = style.positionType();
  folly::dynamic result = folly::dynamic::object
      ("position", !props.cuiHasAuthoredPosition && position == y::PositionType::Relative ? folly::dynamic(nullptr) :
          folly::dynamic(position == y::PositionType::Absolute ? "absolute" :
              position == y::PositionType::Static ? "static" : "relative"))
      ("width", encodeLength(style.dimension(y::Dimension::Width)))
      ("height", encodeLength(style.dimension(y::Dimension::Height)))
      ("boxSizing", style.boxSizing() == y::BoxSizing::ContentBox ? "content-box" : "border-box");
  const std::pair<const char *, y::Edge> edges[]{
      {"left", y::Edge::Left}, {"top", y::Edge::Top}, {"right", y::Edge::Right},
      {"bottom", y::Edge::Bottom}, {"start", y::Edge::Start}, {"end", y::Edge::End},
      {"inset", y::Edge::All}, {"insetInline", y::Edge::Horizontal}, {"insetBlock", y::Edge::Vertical}};
  for (const auto &[name, edge] : edges) result[name] = encodeLength(style.position(edge));
  result["insetInlineStart"] = encodeLength(props.insetInlineStart);
  result["insetInlineEnd"] = encodeLength(props.insetInlineEnd);
  result["insetBlockStart"] = encodeLength(props.insetBlockStart);
  result["insetBlockEnd"] = encodeLength(props.insetBlockEnd);
  return result;
}

folly::dynamic filterNativePopStyle(const folly::dynamic &props) {
  folly::dynamic result = folly::dynamic::object();
  for (const auto key : keys)
    if (const auto *value = props.get_ptr(key)) result[key] = *value;
  return result;
}

folly::dynamic nativePopStyle(double width, double height, double x, double y,
    bool rightToLeft, bool anchorRight, bool anchorBottom) {
  folly::dynamic result = folly::dynamic::object();
  for (const auto key : keys) result[key] = nullptr;
  result["position"] = "absolute";
  result["boxSizing"] = "border-box";
  result["width"] = width;
  result["height"] = height;
  // Explicit logical edges avoid RN's additional left/right swap in RTL.
  const bool physicalRight = anchorRight != rightToLeft;
  result[physicalRight == rightToLeft ? "start" : "end"] = x;
  result[anchorBottom ? "bottom" : "top"] = y;
  return result;
}

} // namespace codon::motion
