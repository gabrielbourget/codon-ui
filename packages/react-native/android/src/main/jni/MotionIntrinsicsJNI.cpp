#include "MotionIntrinsicsJNI.h"

#include <react/common/mapbuffer/JReadableMapBuffer.h>
#include <react/fabric/JFabricUIManager.h>
#include <react/featureflags/ReactNativeFeatureFlags.h>
#include <react/renderer/components/text/ParagraphShadowNode.h>
#include <react/jni/ReadableNativeMap.h>
#include <react/renderer/attributedstring/conversions.h>
#include <react/renderer/components/androidtextinput/AndroidTextInputShadowNode.h>
#include <react/renderer/components/progressbar/AndroidProgressBarShadowNode.h>
#include <react/renderer/components/progressbar/conversions.h>
#include <react/renderer/core/conversions.h>
#include <react/renderer/mapbuffer/MapBufferBuilder.h>
#include <stdexcept>

namespace codon::motion {
namespace jni = facebook::jni;
using namespace facebook::react;
namespace {
struct JIntrinsics : jni::JavaClass<JIntrinsics> {
  static constexpr auto kJavaDescriptor = "Lcom/codonui/input/CUIMotionIntrinsics;";
};
struct JContext : jni::JavaClass<JContext> {
  static constexpr auto kJavaDescriptor = "Landroid/content/Context;";
};

struct TServices {
  jni::global_ref<JIntrinsics::javaobject> service;
  TNativeFabricReadGuard check;
  TServices(jni::alias_ref<jobject> context, jni::alias_ref<jobject> manager, TNativeFabricReadGuard guard)
      : check(std::move(guard)) {
    if (!context || !manager || !check) throw std::invalid_argument("Native motion: actual guarded Android context required");
    check();
    static auto create = JIntrinsics::javaClassStatic()->getStaticMethod<JIntrinsics::javaobject(JContext::javaobject, JFabricUIManager::javaobject)>("create");
    auto typedContext = reinterpret_cast<JContext::javaobject>(context.get());
    service = jni::make_global(create(JIntrinsics::javaClassStatic(), typedContext, reinterpret_cast<JFabricUIManager::javaobject>(manager.get())));
    check();
  }

  jni::local_ref<JReadableMapBuffer::javaobject> attributed(
      const ShadowNode &source, const AttributedStringBox &content, bool cached) {
    if (cached) {
      const auto *node = dynamic_cast<const AndroidTextInputShadowNode *>(&source);
      if (node && node->getStateData().cachedAttributedStringId != 0) {
        MapBufferBuilder builder;
        builder.putInt(AS_KEY_CACHE_ID, static_cast<int32_t>(node->getStateData().cachedAttributedStringId));
        return JReadableMapBuffer::createWithContents(builder.build());
      }
    }
    if (content.getMode() != AttributedStringBox::Mode::Value)
      throw std::invalid_argument("Native motion: immutable Android attributed value required");
    auto value = toMapBuffer(content.getValue());
    return JReadableMapBuffer::createWithContents(std::move(value));
  }

  Size measureText(const ShadowNode &source, const AttributedStringBox &content,
      const ParagraphAttributes &attributes, const LayoutContext &, const LayoutConstraints &bounds) {
    check();
    auto text = attributed(source, content, true);
    auto paragraph = JReadableMapBuffer::createWithContents(toMapBuffer(attributes));
    static auto measure = JIntrinsics::javaClassStatic()->getMethod<jlong(
        JReadableMapBuffer::javaobject, JReadableMapBuffer::javaobject, jint, jint,
        jfloat, jfloat, jfloat, jfloat, jboolean)>("textMeasure");
    auto result = yogaMeassureToSize(measure(service, text.get(), paragraph.get(), source.getTag(), source.getSurfaceId(),
        bounds.minimumSize.width, bounds.maximumSize.width, bounds.minimumSize.height, bounds.maximumSize.height,
        dynamic_cast<const ParagraphShadowNode *>(&source) != nullptr && ReactNativeFeatureFlags::enablePreparedTextLayout()));
    check(); return result;
  }

  Float baseline(const ShadowNode &source, const AttributedStringBox &content,
      const ParagraphAttributes &attributes, const LayoutContext &, const Size &size) {
    check();
    // The original Android editor baseline uses its attributed value, not its cached measurement ID.
    auto text = attributed(source, content, false);
    auto paragraph = JReadableMapBuffer::createWithContents(toMapBuffer(attributes));
    static auto baseline = JIntrinsics::javaClassStatic()->getMethod<jfloat(
        JReadableMapBuffer::javaobject, JReadableMapBuffer::javaobject, jint, jint, jfloat, jfloat)>("textBaseline");
    auto result = baseline(service, text.get(), paragraph.get(), source.getTag(), source.getSurfaceId(), size.width, size.height);
    check(); return result;
  }

  Size progress(const ShadowNode &source, const LayoutContext &, const LayoutConstraints &bounds, const Props::Shared &selected) {
    check();
    const auto *node = dynamic_cast<const AndroidProgressBarShadowNode *>(&source);
    if (!node) throw std::invalid_argument("Native motion: actual Android progress node required");
    const auto *selectedProps = dynamic_cast<const AndroidProgressBarProps *>(selected.get());
    if (!selectedProps) throw std::invalid_argument("Native motion: actual selected progress props required");
    auto props = ReadableNativeMap::newObjectCxxArgs(toDynamic(*selectedProps));
    auto readable = jni::make_local(reinterpret_cast<ReadableMap::javaobject>(props.get()));
    static auto measure = JIntrinsics::javaClassStatic()->getMethod<jlong(
        ReadableMap::javaobject, jfloat, jfloat, jfloat, jfloat)>("progress");
    auto result = yogaMeassureToSize(measure(service, readable.get(), bounds.minimumSize.width,
        bounds.maximumSize.width, bounds.minimumSize.height, bounds.maximumSize.height));
    check(); return result;
  }
};
} // namespace

TNativeScratchIntrinsicResolver createAndroidIntrinsicResolver(
    const TNativeFabricSnapshot &snapshot, std::shared_ptr<const ContextContainer> contextContainer,
    jni::alias_ref<jobject> actualThemedViewContext, jni::alias_ref<jobject> actualFabricManager, TNativeFabricReadGuard check,
    TNativeScratchPropsResolver propsForNode) {
  auto state = std::make_shared<TServices>(actualThemedViewContext, actualFabricManager, check);
  TNativeIsolatedIntrinsicServices services{
      {},
      [state](const auto &node, const auto &content, const auto &attributes, const auto &context, const auto &bounds) {
        return state->measureText(node, content, attributes, context, bounds);
      },
      [state](const auto &node, const auto &content, const auto &attributes, const auto &context, const auto &size) {
        return state->baseline(node, content, attributes, context, size);
      },
      [state](const auto &node, const auto &context, const auto &bounds, const auto &props) { return state->progress(node, context, bounds, props); }};
  return createNativeIntrinsicResolver(snapshot, std::move(contextContainer), std::move(services), std::move(check), std::move(propsForNode));
}
} // namespace codon::motion
