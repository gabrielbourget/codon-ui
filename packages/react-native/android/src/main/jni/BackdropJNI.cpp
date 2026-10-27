#include "BackdropJNI.h"
#include "../../../../cpp/backdrop/Gaussian.h"
#include <limits>
#include <stdexcept>

namespace {
jbyteArray blur(JNIEnv *env, jclass, jbyteArray input, jint width, jint height, jdouble sigma, jobject current) {
  jbyte *pixels = nullptr;
  try {
    if (!input || !current || width <= 0 || height <= 0 ||
        static_cast<int64_t>(width) * height > std::numeric_limits<jsize>::max() / 4 ||
        env->GetArrayLength(input) != static_cast<int64_t>(width) * height * 4)
      throw std::invalid_argument("Native backdrop: invalid capture pixels");
    const auto type = env->GetObjectClass(current);
    const auto get = env->GetMethodID(type, "get", "()Z");
    env->DeleteLocalRef(type);
    if (!get || env->ExceptionCheck()) return nullptr;
    pixels = env->GetByteArrayElements(input, nullptr);
    if (!pixels) return nullptr;
    auto result = codon::backdrop::gaussianBlur(reinterpret_cast<uint8_t *>(pixels), width, height, sigma,
        [env, current, get] { return env->CallBooleanMethod(current, get) && !env->ExceptionCheck(); });
    env->ReleaseByteArrayElements(input, pixels, JNI_ABORT); pixels = nullptr;
    jbyteArray output = env->NewByteArray(static_cast<jsize>(result.size()));
    if (output) env->SetByteArrayRegion(output, 0, static_cast<jsize>(result.size()), reinterpret_cast<jbyte *>(result.data()));
    return output;
  } catch (const std::exception &error) {
    if (pixels) env->ReleaseByteArrayElements(input, pixels, JNI_ABORT);
    if (!env->ExceptionCheck()) {
      const auto type = env->FindClass("java/lang/IllegalStateException");
      if (type) env->ThrowNew(type, error.what());
    }
    return nullptr;
  }
}
}
void registerBackdropNatives(JNIEnv *env) {
  const auto type = env->FindClass("com/codonui/input/CUIBackdropRenderer");
  if (!type) return;
  JNINativeMethod methods[] = {{const_cast<char *>("nativeBlur"),
      const_cast<char *>("([BIIDLjava/util/concurrent/atomic/AtomicBoolean;)[B"), reinterpret_cast<void *>(blur)}};
  env->RegisterNatives(type, methods, 1);
  env->DeleteLocalRef(type);
}
