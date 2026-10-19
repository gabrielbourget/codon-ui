// Native adapters of RN0.86.3 intrinsic algorithms; see UPSTREAM.json and LICENSE.react-native.md.
#include "NativeIntrinsics.h"

#include <react/featureflags/ReactNativeFeatureFlags.h>
#include <react/renderer/components/text/BaseTextShadowNode.h>
#include <react/renderer/components/text/ParagraphShadowNode.h>
#include <react/renderer/graphics/rounding.h>
#include <react/renderer/textlayoutmanager/TextLayoutManager.h>
#include <react/renderer/textlayoutmanager/TextLayoutManagerExtended.h>
#if defined(__ANDROID__)
#include <react/renderer/components/androidtextinput/AndroidTextInputShadowNode.h>
#else
#include <react/renderer/components/iostextinput/TextInputShadowNode.h>
#endif
#include <algorithm>
#include <cmath>
#include <limits>
#include <stdexcept>

namespace codon::motion {
using namespace facebook::react;
namespace {
#if defined(__ANDROID__)
using TEditor = AndroidTextInputShadowNode;
#else
using TEditor = TextInputShadowNode;
#endif

LayoutConstraints constraintsFor(float width, YGMeasureMode widthMode,
                                 float height, YGMeasureMode heightMode) {
  LayoutConstraints result;
  if (widthMode != YGMeasureModeUndefined) result.maximumSize.width = width;
  if (widthMode == YGMeasureModeExactly) result.minimumSize.width = width;
  if (heightMode != YGMeasureModeUndefined) result.maximumSize.height = height;
  if (heightMode == YGMeasureModeExactly) result.minimumSize.height = height;
  // RN's Yoga measure connector leaves layoutDirection undefined here.
  return result;
}

#if !defined(__ANDROID__)
ShadowView textParent(const ShadowNode &node) {
  auto result = ShadowView(node);
  result.props = nullptr; result.state = nullptr;
  return result;
}
#endif

AttributedString editorTree(const TEditor &node, const LayoutContext &context) {
  const auto &props = node.getConcreteProps();
  AttributedString result;
  BaseTextShadowNode::Attachments attachments;
#if defined(__ANDROID__)
  auto attributes = TextAttributes::defaultTextAttributes();
  attributes.fontSizeMultiplier = context.fontSizeMultiplier;
  attributes.apply(props.textAttributes);
  attributes.backgroundColor = HostPlatformColor::UndefinedColor;
  BaseTextShadowNode::buildAttributedString(attributes, node, result, attachments);
  result.setBaseTextAttributes(attributes);
  if (!props.text.empty()) {
    auto text = TextAttributes::defaultTextAttributes();
    text.apply(props.textAttributes); text.fontSizeMultiplier = context.fontSizeMultiplier;
    text.backgroundColor = clearColor();
    AttributedString::Fragment fragment;
    fragment.string = props.text; fragment.textAttributes = text;
    fragment.parentShadowView = ShadowView(node);
    result.prependFragment(std::move(fragment));
  }
#else
  auto attributes = props.getEffectiveTextAttributes(context.fontSizeMultiplier);
  AttributedString::Fragment fragment;
  fragment.string = props.text; fragment.textAttributes = attributes;
  fragment.parentShadowView = textParent(node);
  result.appendFragment(std::move(fragment));
  BaseTextShadowNode::buildAttributedString(attributes, node, result, attachments);
  result.setBaseTextAttributes(attributes);
#endif
  return result;
}

AttributedString editorPlaceholder(const TEditor &node, const LayoutContext &context) {
  const auto &props = node.getConcreteProps();
  AttributedString result;
  result.setBaseTextAttributes(props.getEffectiveTextAttributes(context.fontSizeMultiplier));
  if (!props.placeholder.empty()) {
    AttributedString::Fragment fragment;
    fragment.string = props.placeholder; fragment.textAttributes = result.getBaseTextAttributes();
    result.appendFragment(std::move(fragment));
  }
  return result;
}

AttributedString editorBaselineText(const TEditor &node, const LayoutContext &context) {
  auto tree = editorTree(node, context);
#if defined(__ANDROID__)
  const auto &state = node.getStateData();
  if (state.reactTreeAttributedString.compareTextAttributesWithoutFrame(tree))
    tree = state.attributedStringBox.getValue();
#endif
  return tree.isEmpty() ? editorPlaceholder(node, context) : tree;
}

AttributedStringBox editorMeasurementText(const TEditor &node, const LayoutContext &context) {
#if defined(__ANDROID__)
  return AttributedStringBox(editorBaselineText(node, context));
#else
  const auto &state = node.getStateData();
  const bool meaningful = node.getState() && node.getState()->getRevision() != State::initialRevisionValue &&
      state.reactTreeAttributedString.getBaseTextAttributes().fontSizeMultiplier == context.fontSizeMultiplier;
  if (meaningful && (state.attributedStringBox.getMode() == AttributedStringBox::Mode::OpaquePointer ||
                    !state.attributedStringBox.getValue().isEmpty())) return state.attributedStringBox;
  auto text = meaningful ? AttributedString{} : editorTree(node, context);
  if (text.isEmpty()) text = editorPlaceholder(node, context);
  return AttributedStringBox(std::move(text));
#endif
}

class TIntrinsicState : public std::enable_shared_from_this<TIntrinsicState> {
 public:
  TNativeFabricSnapshot snapshot;
  TNativeIsolatedIntrinsicServices services;
  TNativeFabricReadGuard check;
  // A request owns its C++ text caches; cached native editor data needs a service.
  std::shared_ptr<const TextLayoutManager> text;

  TIntrinsicState(const TNativeFabricSnapshot &source,
                  std::shared_ptr<const ContextContainer> context,
                  TNativeIsolatedIntrinsicServices platform, TNativeFabricReadGuard guard)
      : snapshot(source), services(std::move(platform)), check(std::move(guard)),
        text(std::make_shared<TextLayoutManager>(std::move(context))) {}

  void current() const { if (check) check(); }

  TNativeScratchIntrinsicResolver resolver() {
    return [self = shared_from_this()](const ShadowNode &node, const LayoutContext &context) {
      return self->resolve(node, context);
    };
  }

  AttributedString paragraphText(const ParagraphShadowNode &node,
      const LayoutContext &context, const LayoutConstraints &constraints, YGDirection direction) {
    current();
    auto attributes = TextAttributes::defaultTextAttributes();
    attributes.fontSizeMultiplier = context.fontSizeMultiplier;
    attributes.apply(node.getConcreteProps().textAttributes);
    attributes.layoutDirection = direction == YGDirectionRTL ? LayoutDirection::RightToLeft : LayoutDirection::LeftToRight;
    AttributedString result;
    BaseTextShadowNode::Attachments attachments;
    BaseTextShadowNode::buildAttributedString(attributes, node, result, attachments);
    result.setBaseTextAttributes(attributes);
    auto local = constraints; local.minimumSize = {0, 0};
    for (const auto &attachment : attachments) {
      current();
      if (!dynamic_cast<const LayoutableShadowNode *>(attachment.shadowNode)) continue;
      if (!dynamic_cast<const YogaLayoutableShadowNode *>(attachment.shadowNode))
        throw std::runtime_error("Native motion: isolated non-Yoga attachment measurement unavailable");
      auto input = copyNativeScratchSubtree(*attachment.shadowNode, context, local, resolver());
      TNativeScratchConstraints bounds{
          0, 0, static_cast<float>(local.maximumSize.width), static_cast<float>(local.maximumSize.height),
          static_cast<float>(context.pointScaleFactor),
          local.layoutDirection == LayoutDirection::RightToLeft ? YGDirectionRTL :
              local.layoutDirection == LayoutDirection::LeftToRight ? YGDirectionLTR : YGDirectionInherit,
          ReactNativeFeatureFlags::fixYogaFlexBasisFitContentInMainAxis()};
      const auto measured = evaluateNativeScratchYoga(input, bounds, input.tag, {input.style})[0];
      auto size = facebook::react::Size{measured.frame[2], measured.frame[3]};
      size.width += 0.01f; size.height += 0.01f;
      size = roundToPixel<&facebook::react::ceil>(size, context.pointScaleFactor);
      LayoutMetrics layout;
      layout.pointScaleFactor = context.pointScaleFactor; layout.frame.size = size;
      result.getFragments()[attachment.fragmentIndex].parentShadowView.layoutMetrics = layout;
    }
    return result;
  }

  TNativeScratchIntrinsic resolve(const ShadowNode &node, const LayoutContext &context) {
    current();
    auto self = shared_from_this();
    const auto *source = &node;
    if (const auto *paragraph = dynamic_cast<const ParagraphShadowNode *>(source)) {
      return {
        [self, paragraph, context](float width, YGMeasureMode widthMode, float height, YGMeasureMode heightMode, YGDirection direction) {
          auto constraints = constraintsFor(width, widthMode, height, heightMode);
          auto content = self->paragraphText(*paragraph, context, constraints, direction);
          const auto &attributes = paragraph->getConcreteProps().paragraphAttributes;
          TextLayoutContext layout{.pointScaleFactor = context.pointScaleFactor, .surfaceId = paragraph->getSurfaceId()};
          facebook::react::Size size;
          if constexpr (TextLayoutManagerExtended::supportsPreparedTextLayout()) {
            if (ReactNativeFeatureFlags::enablePreparedTextLayout()) {
              TextLayoutManagerExtended extended(*self->text);
              auto prepared = extended.prepareLayout(content, attributes, layout, constraints);
              size = extended.measurePreparedLayout(prepared, layout, constraints).size;
            } else size = self->text->measure(AttributedStringBox(content), attributes, layout, constraints).size;
          } else size = self->text->measure(AttributedStringBox(content), attributes, layout, constraints).size;
          self->current(); return YGSize{static_cast<float>(size.width), static_cast<float>(size.height)};
        },
        [self, paragraph, context](float width, float height, const auto &, const auto &, YGDirection direction) {
          LayoutConstraints bounds{{width, height}, {width, height}, direction == YGDirectionRTL ? LayoutDirection::RightToLeft : LayoutDirection::LeftToRight};
          auto content = self->paragraphText(*paragraph, context, bounds, direction);
          TextLayoutManagerExtended extended(*self->text);
          Float baseline = 0;
          if constexpr (TextLayoutManagerExtended::supportsLineMeasurement())
            baseline = LineMeasurement::baseline(extended.measureLines(AttributedStringBox(content), paragraph->getConcreteProps().paragraphAttributes, {width, height}));
          self->current(); return static_cast<float>(baseline);
        },
      };
    }
    if (const auto *editor = dynamic_cast<const TEditor *>(source)) {
      return {
        [self, editor, context](float width, YGMeasureMode widthMode, float height, YGMeasureMode heightMode, YGDirection) {
          self->current();
          auto bounds = constraintsFor(width, widthMode, height, heightMode);
          auto textBounds = bounds;
          if (!editor->getConcreteProps().multiline) textBounds.maximumSize.width = std::numeric_limits<Float>::infinity();
          facebook::react::Size size;
#if defined(__ANDROID__)
          if (editor->getStateData().cachedAttributedStringId != 0) {
            if (!self->services.cachedEditor) throw std::runtime_error("Native motion: isolated cached editor service unavailable");
            size = self->services.cachedEditor(*editor, context, textBounds);
          } else
#endif
          size = self->text->measure(editorMeasurementText(*editor, context), editor->getConcreteProps().paragraphAttributes,
              {.pointScaleFactor = context.pointScaleFactor, .surfaceId = editor->getSurfaceId()}, textBounds).size;
          size = bounds.clamp(size); self->current();
          return YGSize{static_cast<float>(size.width), static_cast<float>(size.height)};
        },
        [self, editor, context](float width, float height, const auto &border, const auto &padding, YGDirection) {
          self->current();
          auto content = editorBaselineText(*editor, context);
          TextLayoutManagerExtended extended(*self->text);
          Float baseline = 0;
          if constexpr (TextLayoutManagerExtended::supportsLineMeasurement())
            baseline = LineMeasurement::baseline(extended.measureLines(AttributedStringBox(content), editor->getConcreteProps().paragraphAttributes, {width, height}));
          self->current(); return static_cast<float>(baseline + border[1] + padding[1]);
        },
      };
    }
    const auto component = std::string(node.getComponentName());
    const auto *layoutable = dynamic_cast<const LayoutableShadowNode *>(source);
    if (layoutable && (component == "Switch" || component == "AndroidSwitch" || component == "AndroidProgressBar")) {
      return {
        [self, source, layoutable, context, component](float width, YGMeasureMode widthMode, float height, YGMeasureMode heightMode, YGDirection) {
          self->current();
          auto bounds = constraintsFor(width, widthMode, height, heightMode);
          facebook::react::Size size;
          if (component == "AndroidProgressBar") {
            if (!self->services.progress) throw std::runtime_error("Native motion: isolated progress service unavailable");
            size = self->services.progress(*source, context, bounds);
          } else size = layoutable->measureContent(context, bounds); // Audited switch-only, never a generic fallback.
          self->current(); return YGSize{static_cast<float>(size.width), static_cast<float>(size.height)};
        }, {},
      };
    }
    throw std::runtime_error("Native motion: isolated intrinsic provider unavailable for " + component);
  }
};
} // namespace

TNativeScratchIntrinsicResolver createNativeIntrinsicResolver(
    const TNativeFabricSnapshot &snapshot,
    std::shared_ptr<const ContextContainer> contextContainer,
    TNativeIsolatedIntrinsicServices services, TNativeFabricReadGuard check) {
  if (!snapshot.root || !snapshot.target || !contextContainer)
    throw std::invalid_argument("Native motion: actual native intrinsic context required");
  return std::make_shared<TIntrinsicState>(snapshot, std::move(contextContainer), std::move(services), std::move(check))->resolver();
}

} // namespace codon::motion
