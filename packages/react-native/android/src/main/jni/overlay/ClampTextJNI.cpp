#include "../../../../../cpp/table/ClampText.h"
#include <react/common/mapbuffer/JReadableMapBuffer.h>
#include <react/fabric/JFabricUIManager.h>
#include <react/featureflags/ReactNativeFeatureFlags.h>
#include <react/renderer/attributedstring/conversions.h>
#include <react/renderer/components/androidtextinput/AndroidTextInputShadowNode.h>
#include <react/renderer/components/text/ParagraphShadowNode.h>
#include <react/renderer/core/conversions.h>
#include <react/renderer/mapbuffer/MapBufferBuilder.h>
#include <react/jni/NativeArray.h>
#include <fbjni/fbjni.h>
#include <stdexcept>

namespace codon::table {
using namespace facebook::react;
namespace jni = facebook::jni;
namespace {
struct JClampText : jni::JavaClass<JClampText> {
  static constexpr auto kJavaDescriptor = "Lcom/codonui/input/CUIClampText;";
};
struct TEditorPayload {
  jni::global_ref<jobject> text;
  explicit TEditorPayload(jni::alias_ref<jobject> value) : text(jni::make_global(value)) {}
};
struct TServices {
  jni::global_ref<JFabricUIManager::javaobject> manager;
  std::function<std::shared_ptr<const CuiTextSnapshot>(const ShadowNode &)> snapshot;
  explicit TServices(const ShadowNode &root, decltype(snapshot) snapshot) : snapshot(std::move(snapshot)) {
    const auto &original = root.getContextContainer()->at<jni::global_ref<jobject>>("FabricUIManager");
    manager = jni::make_global(reinterpret_cast<JFabricUIManager::javaobject>(original.get()));
  }
  auto attributed(const AttributedStringBox &text) const {
    if (text.getMode() != AttributedStringBox::Mode::Value)
      throw std::runtime_error("Table clamp requires immutable native attributed values");
    return JReadableMapBuffer::createWithContents(toMapBuffer(text.getValue()));
  }
  Size measure(const ShadowNode &source, const AttributedStringBox &text, const ParagraphAttributes &attributes,
      const LayoutContext &, const LayoutConstraints &bounds) {
    auto paragraph = JReadableMapBuffer::createWithContents(toMapBuffer(attributes));
    const auto *editor = dynamic_cast<const AndroidTextInputShadowNode *>(&source);
    if (editor && editor->getStateData().cachedAttributedStringId != 0) {
      const auto selected = snapshot(source);
      const auto payload = std::static_pointer_cast<const TEditorPayload>(selected->ownedPayload);
      if (!payload) throw std::runtime_error("Table clamp immutable editor payload retired");
      auto cached = JReadableMapBuffer::createWithContents(MapBufferBuilder().build());
      static const auto method = JClampText::javaClassStatic()->getStaticMethod<jlong(jobject,
          JReadableMapBuffer::javaobject,JReadableMapBuffer::javaobject,jfloat,jfloat,jfloat,jfloat)>("cached");
      return yogaMeassureToSize(method(JClampText::javaClassStatic(),payload->text.get(),cached.get(),paragraph.get(),
          bounds.minimumSize.width,bounds.maximumSize.width,bounds.minimumSize.height,bounds.maximumSize.height));
    }
    auto content = attributed(text);
    static const auto method = JClampText::javaClassStatic()->getStaticMethod<jlong(JFabricUIManager::javaobject,jint,
        JReadableMapBuffer::javaobject,JReadableMapBuffer::javaobject,jfloat,jfloat,jfloat,jfloat,jboolean)>("fresh");
    return yogaMeassureToSize(method(JClampText::javaClassStatic(),manager.get(),source.getTag(),content.get(),paragraph.get(),
        bounds.minimumSize.width,bounds.maximumSize.width,bounds.minimumSize.height,bounds.maximumSize.height,
        dynamic_cast<const ParagraphShadowNode *>(&source) && ReactNativeFeatureFlags::enablePreparedTextLayout()));
  }
  LinesMeasurements lines(const ShadowNode &source, const AttributedStringBox &text,
      const ParagraphAttributes &attributes, const Size &size) {
    auto content = attributed(text);
    auto paragraph = JReadableMapBuffer::createWithContents(toMapBuffer(attributes));
    static const auto method = JClampText::javaClassStatic()->getStaticMethod<NativeArray::javaobject(JFabricUIManager::javaobject,jint,
        JReadableMapBuffer::javaobject,JReadableMapBuffer::javaobject,jfloat,jfloat)>("lines");
    auto array = method(JClampText::javaClassStatic(),manager.get(),source.getTag(),content.get(),paragraph.get(),size.width,size.height);
    const auto data = cthis(array)->consume();
    LinesMeasurements result; result.reserve(data.size());
    for (const auto &line : data) result.emplace_back(line);
    return result;
  }
};
}
std::shared_ptr<const void> captureClampEditorText(std::shared_ptr<void>) {
  throw std::runtime_error("Table clamp Android editor capture requires its original UI cache producer");
}
void observeClampEditorText(int tag, uint64_t owner) {
  static const auto method = JClampText::javaClassStatic()->getStaticMethod<void(jint,jlong)>("observe");
  method(JClampText::javaClassStatic(),tag,owner);
}
void unobserveClampEditorText(int tag, uint64_t owner) noexcept {
  try {
    static const auto method = JClampText::javaClassStatic()->getStaticMethod<void(jint,jlong)>("unobserve");
    method(JClampText::javaClassStatic(),tag,owner);
  } catch (...) {}
}
codon::motion::TNativeIsolatedIntrinsicServices clampPlatformIntrinsicServices(
    const ShadowNode &root, std::function<std::shared_ptr<const CuiTextSnapshot>(const ShadowNode &)> snapshot) {
  auto state = std::make_shared<TServices>(root,std::move(snapshot));
  codon::motion::TNativeIsolatedIntrinsicServices services;
  services.textMeasure = [state](const auto &node, const auto &text, const auto &attrs, const auto &ctx, const auto &bounds) {
    return state->measure(node,text,attrs,ctx,bounds);
  };
  services.textLines = [state](const auto &node, const auto &text, const auto &attrs, const auto &size) {
    return state->lines(node,text,attrs,size);
  };
  services.textBaseline = [state](const auto &node, const auto &text, const auto &attrs, const auto &, const auto &size) {
    return LineMeasurement::baseline(state->lines(node,text,attrs,size));
  };
  return services;
}
} // namespace codon::table

extern "C" JNIEXPORT void JNICALL Java_com_codonui_input_CUIClampText_nativePublished(
    JNIEnv *env, jclass, jint tag, jlong owner, jobject text, jstring error) {
  try {
    std::string failure;
    if (error) {
      const char *message = env->GetStringUTFChars(error,nullptr);
      if (!message) return;
      failure = message; env->ReleaseStringUTFChars(error,message);
    }
    auto payload = text ? std::make_shared<const codon::table::TEditorPayload>(facebook::jni::wrap_alias(text)) : nullptr;
    facebook::react::publishCuiTextSnapshot(tag,owner,std::move(payload),std::move(failure));
  } catch (const std::exception &failure) {
    facebook::react::publishCuiTextSnapshot(tag,owner,{},failure.what());
  }
}
