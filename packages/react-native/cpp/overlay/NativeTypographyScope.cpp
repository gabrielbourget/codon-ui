#include "NativeTypographyScope.h"
#include "NativeTypographySource.h"
#include <react/renderer/components/text/BaseParagraphProps.h>
#include <react/renderer/components/text/BaseTextProps.h>
#include <react/renderer/components/textinput/BaseTextInputProps.h>
#include <react/renderer/attributedstring/conversions.h>
#include <react/renderer/core/LayoutContext.h>
#include <react/renderer/core/PropsMacros.h>
#include <folly/json.h>
#include <stdexcept>
#include <typeinfo>
#include <utility>

namespace facebook::react {
namespace {
Props::Shared cloneTypographyProps(const ShadowNode &node, RawProps raw) {
  auto context = node.getContextContainer();
  if (!context) throw std::runtime_error("Native typography requires original Fabric props authority");
  auto props = node.getComponentDescriptor().cloneProps(PropsParserContext(node.getSurfaceId(), *context), node.getProps(), std::move(raw));
  if (props == node.getProps()) throw std::runtime_error("Native typography must not mutate shared original props");
  return props;
}
TextAttributes declaredAttributes(const BaseTextProps &props) {
  auto result = props.textAttributes;
  const TextAttributes defaults;
  const auto declared = [&](const char *field) { return (props.textStyleDeclaredFields & textStyleFieldBit(field)) != 0; };
  if (!declared("color")) result.foregroundColor = defaults.foregroundColor;
  if (!declared("fontFamily")) result.fontFamily = defaults.fontFamily;
  if (!declared("fontSize")) result.fontSize = defaults.fontSize;
  if (!declared("fontWeight")) { result.fontWeight = defaults.fontWeight; result.fontWeightScalar = defaults.fontWeightScalar; }
  if (!declared("fontStyle")) result.fontStyle = defaults.fontStyle;
  if (!declared("fontVariant")) result.fontVariant = defaults.fontVariant;
  if (!declared("letterSpacing")) result.letterSpacing = defaults.letterSpacing;
  if (!declared("lineHeight")) result.lineHeight = defaults.lineHeight;
  if (!declared("textAlign")) result.alignment = defaults.alignment;
  if (!declared("writingDirection")) result.baseWritingDirection = defaults.baseWritingDirection;
  if (!declared("textDecorationColor")) result.textDecorationColor = defaults.textDecorationColor;
  if (!declared("textDecorationLine")) result.textDecorationLineType = defaults.textDecorationLineType;
  if (!declared("textDecorationStyle")) result.textDecorationStyle = defaults.textDecorationStyle;
  if (!declared("textShadowColor")) result.textShadowColor = defaults.textShadowColor;
  if (!declared("textShadowOffset")) result.textShadowOffset = defaults.textShadowOffset;
  if (!declared("textShadowRadius")) result.textShadowRadius = defaults.textShadowRadius;
  if (!declared("textTransform")) result.textTransform = defaults.textTransform;
  if (!declared("fontSizeMultiplier")) result.fontSizeMultiplier = defaults.fontSizeMultiplier;
  if (!declared("allowFontScaling")) result.allowFontScaling = defaults.allowFontScaling;
  if (!declared("maxFontSizeMultiplier")) result.maxFontSizeMultiplier = defaults.maxFontSizeMultiplier;
  return result;
}
std::shared_ptr<const ShadowNode> materialize(const ShadowNode &node, const TextAttributes &inherited,
    folly::dynamic paragraph, const ShadowNode &owner, const std::string &window, uint64_t revision) {
  if (auto scope = dynamic_cast<const CUIKeyboardScopeProps *>(node.getProps().get());
      scope && !scope->nativeTypographyWindow.empty() && scope->nativeTypographyWindow != window) return node.clone({});
  if (auto nested = dynamic_cast<const CUIFocusViewProps *>(node.getProps().get()); nested && !nested->nativeTypographyStyle.empty())
    return node.clone({});
  Props::Shared props = node.getProps();
  TextAttributes effective = inherited;
  if (auto source = codon::typography::nativeTypographySource(node.getComponentHandle())) {
    props = source->typographyProps(node, {owner, inherited, paragraph, window, revision});
  } else if (dynamic_cast<const BaseTextInputProps *>(props.get())) {
    // A control's original defaults/declarations own its typography. Existing inherited-style
    // participants already supply those original props; other controls require declared cooperation.
    return node.clone({});
  } else if (auto text = dynamic_cast<const BaseTextProps *>(props.get())) {
    effective.apply(declaredAttributes(*text));
    folly::dynamic extra = folly::dynamic::object();
    for (const auto &entry : paragraph.items())
      if (!(text->textStyleDeclaredFields & textStyleFieldBit(entry.first.asString()))) extra[entry.first] = entry.second;
    props = cloneTypographyProps(node, RawProps(extra));
    auto mutableProps = std::const_pointer_cast<Props>(props);
    mutableProps->ensureUnsealed();
    auto target = dynamic_cast<BaseTextProps *>(mutableProps.get());
    if (!target) throw std::runtime_error("Native typography lost the original text receiver");
    target->textAttributes = effective;
    target->textStyleDeclaredFields = text->textStyleDeclaredFields;
    if (auto parent = dynamic_cast<const BaseParagraphProps *>(props.get())) {
      if (text->textStyleDeclaredFields & textStyleFieldBit("selectable")) paragraph["selectable"] = parent->isSelectable;
      if (text->textStyleDeclaredFields & textStyleFieldBit("includeFontPadding")) paragraph["includeFontPadding"] = parent->paragraphAttributes.includeFontPadding;
      if (text->textStyleDeclaredFields & textStyleFieldBit("textAlignVertical") && parent->paragraphAttributes.textAlignVertical) paragraph["textAlignVertical"] = toString(*parent->paragraphAttributes.textAlignVertical);
    }
  }
  auto children = std::make_shared<std::vector<std::shared_ptr<const ShadowNode>>>();
  children->reserve(node.getChildren().size());
  for (const auto &child : node.getChildren()) children->push_back(materialize(*child, effective, paragraph, owner, window, revision));
  auto result = node.clone({.props = props, .children = children});
  if (&result->getFamily() != &node.getFamily() || result->getState() != node.getState())
    throw std::runtime_error("Native typography must preserve original family and state");
  return result;
}
}
CUIOwnedTypographyFocusShadowNode::CUIOwnedTypographyFocusShadowNode(const ShadowNodeFragment &fragment,
    const ShadowNodeFamily::Shared &family, ShadowNodeTraits traits)
    : ConcreteViewShadowNode(fragment, family, traits), authoredChildren_(getChildren()) {}
CUIOwnedTypographyFocusShadowNode::CUIOwnedTypographyFocusShadowNode(const ShadowNode &source, const ShadowNodeFragment &fragment)
    : ConcreteViewShadowNode(source, fragment) {
  const auto &old = static_cast<const CUIOwnedTypographyFocusShadowNode &>(source);
  authoredChildren_ = fragment.children ? *fragment.children : old.authoredChildren_;
  if (!fragment.children) { prepared_ = old.prepared_; appliedStyle_ = old.appliedStyle_; appliedWindow_ = old.appliedWindow_; sourceRevision_ = old.sourceRevision_; }
}
void CUIOwnedTypographyFocusShadowNode::appendChild(const std::shared_ptr<const ShadowNode> &child) {
  authoredChildren_.push_back(child);
  ConcreteViewShadowNode::appendChild(child);
  prepared_ = false;
  prepareTypography();
}
void CUIOwnedTypographyFocusShadowNode::prepareTypography() {
  const auto &props = getConcreteProps();
  const auto revision = codon::typography::nativeTypographyRevision();
  if (!prepared_ || sourceRevision_ != revision || props.nativeTypographyStyle != appliedStyle_ || props.nativeTypographyWindow != appliedWindow_) {
    std::vector<std::shared_ptr<const ShadowNode>> children = authoredChildren_;
    if (!props.nativeTypographyStyle.empty()) {
      const auto raw = folly::parseJson(props.nativeTypographyStyle);
      if (!raw.isObject()) throw std::runtime_error("Native typography requires a complete owned style object");
      auto container = getContextContainer();
      if (!container) throw std::runtime_error("Native typography lost its original context");
      BaseTextProps text;
      const PropsParserContext parserContext(getSurfaceId(), *container);
      for (const auto &entry : raw.items()) {
        const auto &name = entry.first.getString();
        text.setProp(parserContext, RAW_PROPS_KEY_HASH(name), name.c_str(), RawValue(entry.second));
      }
      folly::dynamic paragraph = folly::dynamic::object();
      for (const auto *field : {"selectable", "includeFontPadding", "textAlignVertical"})
        if (raw.count(field)) paragraph[field] = raw[field];
      children.clear();
      for (const auto &child : authoredChildren_)
        children.push_back(materialize(*child, text.textAttributes, paragraph, *this, props.nativeTypographyWindow, revision));
    }
    if (revision != codon::typography::nativeTypographyRevision()) throw std::runtime_error("Native typography authority changed during the original commit");
    // Prepare before the enclosing Yoga pass measures these original text nodes.
    const auto current = getChildren();
    for (size_t index=0;index<children.size();index++) replaceChild(*current.at(index), children[index], index);
    prepared_ = true; sourceRevision_ = revision; appliedStyle_ = props.nativeTypographyStyle; appliedWindow_ = props.nativeTypographyWindow;
  }
}
}
