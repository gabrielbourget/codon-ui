#include "InitialValueQuery.h"
#include "FabricSnapshot.h"
#include "NativeStyle.h"

#include <folly/json.h>
#include <react/renderer/attributedstring/conversions.h>
#include <react/renderer/components/CodonNativeInputSpec/Props.h>
#include <react/renderer/components/text/ParagraphShadowNode.h>
#include <react/renderer/core/ComponentDescriptor.h>
#include <react/renderer/core/LayoutableShadowNode.h>
#include <react/renderer/dom/DOM.h>
#include <chrono>
#include <cmath>
#include <iomanip>
#include <limits>
#include <locale>
#include <mutex>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <unordered_set>
#include <vector>

namespace codon::motion {
using namespace facebook::react;
namespace {
using TImperativeSnapshot = std::pair<ShadowNodeFamily::Shared, folly::dynamic>;
folly::dynamic imperativeProps(const ShadowNodeFamily &family) {
  std::lock_guard lock(family.nativePropsMutex);
  return family.nativeProps_DEPRECATED ? *family.nativeProps_DEPRECATED : folly::dynamic::object();
}
[[noreturn]] void unavailable(const std::string &name, const char *reason) {
  throw std::runtime_error("Native motion initial value: " + name + ": " + reason);
}
folly::dynamic finite(double value, const std::string &name) {
  if (!std::isfinite(value)) unavailable(name, "native-font-metric-unavailable");
  return value;
}
folly::dynamic color(SharedColor value, const std::string &name, const TNativeInitialColorReader &readColor) {
  if (!value) unavailable(name, "native-color-authority-unavailable");
  if (readColor) return readColor(value);
#if !defined(__ANDROID__)
  unavailable(name, "actual-native-color-reader-unavailable");
#else
  const auto components = colorComponentsFromColor(value);
  std::ostringstream encoded;
  encoded.imbue(std::locale::classic());
  encoded << std::setprecision(std::numeric_limits<double>::max_digits10)
      << "rgba(" << components.red * 255 << ", " << components.green * 255
      << ", " << components.blue * 255 << ", " << components.alpha << ')';
  return encoded.str();
#endif
}
folly::dynamic textValue(const TextAttributes &attributes, const BaseParagraphProps &props, const std::string &name,
    const TNativeInitialColorReader &readColor) {
  if (name == "color") return color(attributes.foregroundColor, name, readColor);
  if (name == "textDecorationColor") return color(attributes.textDecorationColor ? attributes.textDecorationColor : attributes.foregroundColor, name, readColor);
  if (name == "textShadowColor") return color(attributes.textShadowColor, name, readColor);
  if (name == "fontSize") return finite(attributes.fontSize, name);
  if (name == "fontFamily") {
    if (attributes.fontFamily.empty()) unavailable(name, "native-font-family-unavailable");
    return attributes.fontFamily;
  }
  if (name == "fontWeight") return toString(attributes.fontWeight.value_or(FontWeight::Regular));
  if (name == "fontStyle") return toString(attributes.fontStyle.value_or(FontStyle::Normal));
  if (name == "letterSpacing") return finite(attributes.letterSpacing, name);
  if (name == "lineHeight") return finite(attributes.lineHeight, name);
  if (name == "textShadowRadius") return finite(attributes.textShadowRadius, name);
  if (name == "textShadowOffset") {
    if (!attributes.textShadowOffset) unavailable(name, "no-native-text-shadow");
    return folly::dynamic::object("width", finite(attributes.textShadowOffset->width, name))
        ("height", finite(attributes.textShadowOffset->height, name));
  }
  if (name == "textAlign") return toString(attributes.alignment.value_or(TextAlignment::Natural));
  if (name == "writingDirection") return toString(attributes.baseWritingDirection.value_or(WritingDirection::Natural));
  if (name == "textDecorationLine") return toString(attributes.textDecorationLineType.value_or(TextDecorationLineType::None));
  if (name == "textDecorationStyle") return toString(attributes.textDecorationStyle.value_or(TextDecorationStyle::Solid));
  if (name == "textTransform") return toString(attributes.textTransform.value_or(TextTransform::None));
  if (name == "includeFontPadding") {
#if defined(__ANDROID__)
    return props.paragraphAttributes.includeFontPadding;
#else
    unavailable(name, "platform-does-not-render-font-padding");
#endif
  }
  if (name == "textAlignVertical" || name == "verticalAlign") {
    const auto value = props.paragraphAttributes.textAlignVertical.value_or(TextAlignmentVertical::Auto);
    return name == "verticalAlign" && value == TextAlignmentVertical::Center ? "middle" : toString(value);
  }
  if (name == "userSelect") return props.isSelectable ? "text" : "none";
  if (name == "fontVariant") {
    static constexpr const char *variants[]{"small-caps", "oldstyle-nums", "lining-nums", "tabular-nums", "proportional-nums",
        "stylistic-one", "stylistic-two", "stylistic-three", "stylistic-four", "stylistic-five", "stylistic-six", "stylistic-seven",
        "stylistic-eight", "stylistic-nine", "stylistic-ten", "stylistic-eleven", "stylistic-twelve", "stylistic-thirteen",
        "stylistic-fourteen", "stylistic-fifteen", "stylistic-sixteen", "stylistic-seventeen", "stylistic-eighteen", "stylistic-nineteen", "stylistic-twenty"};
    auto result = folly::dynamic::array();
    const auto bits = static_cast<unsigned>(attributes.fontVariant.value_or(FontVariant::Default));
    for (size_t index = 0; index < std::size(variants); index++) if (bits & (1u << (index + 1))) result.push_back(variants[index]);
    return result;
  }
  unavailable(name, "unsupported-native-text-field");
}
bool isTextField(const std::string &name) {
  static const std::unordered_set<std::string> fields{
      "color", "fontFamily", "fontSize", "fontStyle", "fontWeight", "fontVariant", "letterSpacing", "lineHeight",
      "textAlign", "textAlignVertical", "verticalAlign", "includeFontPadding", "textDecorationLine", "textDecorationStyle",
      "textDecorationColor", "textShadowColor", "textShadowOffset", "textShadowRadius", "textTransform", "writingDirection", "userSelect"};
  return fields.contains(name);
}
folly::dynamic readText(const ShadowNode &target, const std::string &name, const TNativeFabricReadGuard &check,
    std::vector<TImperativeSnapshot> &imperative, const TNativeInitialColorReader &readColor) {
  std::optional<folly::dynamic> value;
  const auto accept = [&](folly::dynamic candidate) {
    if (value && *value != candidate) unavailable(name, "ambiguous-rendered-text-value");
    value = std::move(candidate);
  };
  // Only immediate native Paragraphs are a text authority for this host. We
  // never traverse another view, motion owner or editor, or invoke text layout.
  for (const auto &child : target.getChildren()) {
    check();
    const auto *paragraph = dynamic_cast<const ParagraphShadowNode *>(child.get());
    if (!paragraph) continue;
    auto native = imperativeProps(paragraph->getFamily());
    imperative.emplace_back(paragraph->getFamilyShared(), native);
    if (!native.empty()) unavailable(name, "imperative-text-style-authority-unavailable");
    auto inlineNodes = paragraph->getChildren();
    for (size_t index = 0; index < inlineNodes.size(); index++) {
      check();
      const auto &inlineNode = inlineNodes[index];
      const auto component = std::string(inlineNode->getComponentName());
      if (component != "Text" && component != "RawText") continue;
      auto inlineNative = imperativeProps(inlineNode->getFamily());
      imperative.emplace_back(inlineNode->getFamilyShared(), inlineNative);
      if (!inlineNative.empty()) unavailable(name, "imperative-text-style-authority-unavailable");
      const auto children = inlineNode->getChildren();
      inlineNodes.insert(inlineNodes.end(), children.begin(), children.end());
    }
    if (!paragraph->getState()) unavailable(name, "actual-rendered-text-state-unavailable");
    const auto &state = paragraph->getStateData();
    const auto &props = paragraph->getConcreteProps();
    accept(textValue(state.attributedString.getBaseTextAttributes(), props, name, readColor));
    for (const auto &fragment : state.attributedString.getFragments()) {
      check();
      if (!fragment.isAttachment()) accept(textValue(fragment.textAttributes, props, name, readColor));
    }
  }
  if (!value) unavailable(name, "actual-rendered-text-authority-unavailable");
  return std::move(*value);
}
folly::dynamic readInset(const TNativeFabricSnapshot &snapshot, const LayoutMetrics &metrics, const std::string &name) {
  const auto offset = dom::getOffset(snapshot.root, *snapshot.target);
  const auto *parent = dynamic_cast<const LayoutableShadowNode *>(offset.offsetParent.get());
  if (!parent || parent->getLayoutMetrics() == EmptyLayoutMetrics) unavailable(name, "positioned-native-ancestor-unavailable");
  const auto parentMetrics = parent->getLayoutMetrics();
  const auto right = parentMetrics.frame.size.width - parentMetrics.borderWidth.left - parentMetrics.borderWidth.right - metrics.frame.size.width - offset.left;
  const auto bottom = parentMetrics.frame.size.height - parentMetrics.borderWidth.top - parentMetrics.borderWidth.bottom - metrics.frame.size.height - offset.top;
  const bool rtl = metrics.layoutDirection == LayoutDirection::RightToLeft;
  if (name == "left") return finite(metrics.wasLeftAndRightSwapped ? right : offset.left, name);
  if (name == "right") return finite(metrics.wasLeftAndRightSwapped ? offset.left : right, name);
  if (name == "top" || name == "insetBlockStart") return finite(offset.top, name);
  if (name == "bottom" || name == "insetBlockEnd") return finite(bottom, name);
  if (name == "start" || name == "insetInlineStart") return finite(rtl ? right : offset.left, name);
  if (name == "end" || name == "insetInlineEnd") return finite(rtl ? offset.left : right, name);
  if (name == "insetInline" || name == "inset") {
    if (offset.left != right) unavailable(name, "ambiguous-native-shorthand");
    if (name == "insetInline") return finite(offset.left, name);
  }
  if (offset.top != bottom || (name == "inset" && offset.top != offset.left)) unavailable(name, "ambiguous-native-shorthand");
  return finite(offset.top, name);
}
} // namespace

std::string queryNativeInitialValue(const UIManager &manager, int target, const std::string &owner,
    const std::string &binding, const std::string &nativeViewRevision, const std::string &name,
    const TNativeInitialColorReader &readColor) {
  if (target <= 0 || owner.empty() || binding.empty() || name.empty() || name.size() > 128)
    throw std::invalid_argument("Native motion initial value: actual observed owner and field required");
  const auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(5000);
  const auto check = [&] {
    if (std::chrono::steady_clock::now() >= deadline)
      throw std::runtime_error("Native motion initial value: Fabric read exceeded 5000ms");
  };
  const auto candidate = manager.findShadowNodeByTag_DEPRECATED(target);
  check();
  if (!candidate) unavailable(name, "native-target-unavailable");
  const auto family = candidate->getFamilyShared();
  const auto owns = [&](const ShadowNode &node) {
    if (node.getFamilyShared() != family || std::string(node.getComponentName()) != "CUIFocusView") return false;
    const auto &props = static_cast<const CUIFocusViewProps &>(*node.getProps());
    return props.ownerId == owner && props.nativeMotionGeometryBinding == binding &&
        props.nativeMotionGeometryRevision == nativeViewRevision;
  };
  const auto snapshot = captureNativeFabricSnapshot(manager, candidate->getSurfaceId(), target, owns, check);
  const auto *layout = dynamic_cast<const LayoutableShadowNode *>(snapshot.target.get());
  if (!layout || layout->getLayoutMetrics() == EmptyLayoutMetrics) unavailable(name, "actual-displayed-layout-required");
  const auto native = imperativeProps(*family);
  std::vector<TImperativeSnapshot> imperative{{family, native}};
  auto actualProps = snapshot.target->getProps();
  if (!native.empty()) {
    // RN retains setNativeProps on the exact family. Parsing a copied map into
    // independent immutable props preserves that authority without a commit.
    actualProps = snapshot.target->getComponentDescriptor().cloneProps(
        {snapshot.target->getSurfaceId(), *snapshot.target->getContextContainer()}, actualProps, RawProps(native));
  }
  // The exact component and its descriptor select this generated props class.
  const auto &props = static_cast<const CUIFocusViewProps &>(*actualProps);
  if (props.ownerId != owner || props.nativeMotionGeometryBinding != binding ||
      props.nativeMotionGeometryRevision != nativeViewRevision) unavailable(name, "imperative-owner-identity-mismatch");
  const auto metrics = layout->getLayoutMetrics();
  const auto &committedProps = static_cast<const CUIFocusViewProps &>(*snapshot.target->getProps());
  const bool layoutSensitive = name == "width" || name == "height" || name == "direction" || name.starts_with("padding") ||
      name.starts_with("inset") || name == "left" || name == "right" || name == "top" || name == "bottom" || name == "start" || name == "end" ||
      name.starts_with("border") || name.starts_with("origin") || name == "x" || name == "y" || name == "z" || name.starts_with("translate") || name == "transformMatrix";
  if (layoutSensitive && copyNativeYogaStyle(props, metrics.wasLeftAndRightSwapped) !=
      copyNativeYogaStyle(committedProps, metrics.wasLeftAndRightSwapped)) unavailable(name, "imperative-layout-revision-unavailable");
  folly::dynamic value;
  if (isTextField(name)) value = readText(*snapshot.target, name, check, imperative, readColor);
  else if (name == "left" || name == "top" || name == "right" || name == "bottom" || name == "start" || name == "end" ||
      name == "inset" || name == "insetInline" || name == "insetBlock" || name == "insetInlineStart" ||
      name == "insetInlineEnd" || name == "insetBlockStart" || name == "insetBlockEnd")
    value = readInset(snapshot, metrics, name);
  else value = readNativeInitialViewValue(props, metrics, name, readColor);
  check();
  for (const auto &[observedFamily, observed] : imperative)
    if (imperativeProps(*observedFamily) != observed) unavailable(name, "imperative-value-retired");
  if (!isNativeFabricSnapshotCurrent(manager, snapshot, owns)) unavailable(name, "Fabric-value-retired");
  return folly::toJson(folly::dynamic::object("kind", "native-initial-value")("surfaceId", candidate->getSurfaceId())
      ("fabricRevision", std::to_string(snapshot.revision))("name", name)("value", std::move(value)));
}

} // namespace codon::motion
