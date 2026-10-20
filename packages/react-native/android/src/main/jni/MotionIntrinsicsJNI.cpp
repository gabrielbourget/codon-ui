#include "MotionIntrinsicsJNI.h"

#include <react/common/mapbuffer/JReadableMapBuffer.h>
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
  TServices(jni::alias_ref<jobject> context, TNativeFabricReadGuard guard)
      : check(std::move(guard)) {
    if (!context || !check) throw std::invalid_argument("Native motion: actual guarded Android context required");
    check();
    static auto create = JIntrinsics::javaClassStatic()->getStaticMethod<JIntrinsics::javaobject(JContext::javaobject)>("create");
    auto typedContext = reinterpret_cast<JContext::javaobject>(context.get());
    service = jni::make_global(create(JIntrinsics::javaClassStatic(), typedContext));
    check();
  }

  Size cached(const ShadowNode &source, const LayoutContext &, const LayoutConstraints &bounds, const Props::Shared &selected) {
    check();
    const auto *node = dynamic_cast<const AndroidTextInputShadowNode *>(&source);
    if (!node || node->getStateData().cachedAttributedStringId == 0)
      throw std::invalid_argument("Native motion: actual cached Android editor required");
    MapBufferBuilder attributed;
    attributed.putInt(AS_KEY_CACHE_ID, static_cast<int32_t>(node->getStateData().cachedAttributedStringId));
    auto text = JReadableMapBuffer::createWithContents(attributed.build());
    const auto *selectedProps = dynamic_cast<const AndroidTextInputProps *>(selected.get());
    if (!selectedProps) throw std::invalid_argument("Native motion: actual selected editor props required");
    auto paragraph = JReadableMapBuffer::createWithContents(toMapBuffer(selectedProps->paragraphAttributes));
    static auto measure = JIntrinsics::javaClassStatic()->getMethod<jlong(
        JReadableMapBuffer::javaobject, JReadableMapBuffer::javaobject, jfloat, jfloat, jfloat, jfloat)>("cachedEditor");
    auto result = yogaMeassureToSize(measure(service, text.get(), paragraph.get(), bounds.minimumSize.width,
        bounds.maximumSize.width, bounds.minimumSize.height, bounds.maximumSize.height));
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
    jni::alias_ref<jobject> actualThemedViewContext, TNativeFabricReadGuard check,
    TNativeScratchPropsResolver propsForNode) {
  auto state = std::make_shared<TServices>(actualThemedViewContext, check);
  TNativeIsolatedIntrinsicServices services{
      [state](const auto &node, const auto &context, const auto &bounds, const auto &props) { return state->cached(node, context, bounds, props); },
      [state](const auto &node, const auto &context, const auto &bounds, const auto &props) { return state->progress(node, context, bounds, props); }};
  return createNativeIntrinsicResolver(snapshot, std::move(contextContainer), std::move(services), std::move(check), std::move(propsForNode));
}
} // namespace codon::motion
