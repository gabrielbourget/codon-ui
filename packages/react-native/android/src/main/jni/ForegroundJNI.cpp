#include "ForegroundJNI.h"
#include "../../../../cpp/overlay/ForegroundFilters.h"
#include <limits>
#include <cmath>
#include <stdexcept>

namespace {
jobject filter(JNIEnv *env, jclass, jbyteArray input, jint width, jint height, jdoubleArray encoded, jobject current) {
  try {
    if (!input || !encoded || !current || width <= 0 || height <= 0 ||
        static_cast<int64_t>(width)*height > std::numeric_limits<jsize>::max()/4 ||
        env->GetArrayLength(input) != static_cast<int64_t>(width)*height*4 || env->GetArrayLength(encoded)%8)
      throw std::invalid_argument("Native foreground: invalid capture or filter transport");
    std::vector<uint8_t> rgba(static_cast<size_t>(width)*height*4);
    env->GetByteArrayRegion(input, 0, static_cast<jsize>(rgba.size()), reinterpret_cast<jbyte *>(rgba.data()));
    std::vector<double> values(env->GetArrayLength(encoded));
    env->GetDoubleArrayRegion(encoded, 0, static_cast<jsize>(values.size()), values.data());
    if (env->ExceptionCheck()) return nullptr;
    std::vector<codon::overlay::TForegroundFilter> filters;
    for (size_t index = 0; index < values.size(); index += 8) {
      if (!std::isfinite(values[index]) || values[index] < 0 || values[index] > 9 || values[index] != static_cast<int>(values[index]))
        throw std::invalid_argument("Native foreground: invalid filter kind");
      filters.push_back({static_cast<codon::overlay::TForegroundFilterKind>(static_cast<int>(values[index])),
          values[index+1], values[index+2], values[index+3], {values[index+4],values[index+5],values[index+6],values[index+7]}});
    }
    jclass token = env->GetObjectClass(current);
    jmethodID get = env->GetMethodID(token, "get", "()Z"); env->DeleteLocalRef(token);
    if (!get || env->ExceptionCheck()) return nullptr;
    auto result = codon::overlay::filterForeground(rgba.data(), width, height, filters,
        [env,current,get] { return env->CallBooleanMethod(current,get) && !env->ExceptionCheck(); });
    if (result.rgba.size() > static_cast<size_t>(std::numeric_limits<jsize>::max()) || result.x < INT32_MIN ||
        result.x > INT32_MAX || result.y < INT32_MIN || result.y > INT32_MAX)
      throw std::invalid_argument("Native foreground: output exceeds native raster transport");
    jbyteArray pixels = env->NewByteArray(static_cast<jsize>(result.rgba.size()));
    if (!pixels) return nullptr;
    env->SetByteArrayRegion(pixels, 0, static_cast<jsize>(result.rgba.size()), reinterpret_cast<jbyte *>(result.rgba.data()));
    jclass type = env->FindClass("com/codonui/input/CUIForegroundRenderer$Result");
    if (!type || env->ExceptionCheck()) return nullptr;
    jmethodID constructor = env->GetMethodID(type, "<init>", "(IIII[B)V");
    jobject output = constructor ? env->NewObject(type, constructor, static_cast<jint>(result.x), static_cast<jint>(result.y),
        static_cast<jint>(result.width), static_cast<jint>(result.height), pixels) : nullptr;
    env->DeleteLocalRef(type); env->DeleteLocalRef(pixels); return output;
  } catch (const std::exception &error) {
    if (!env->ExceptionCheck()) {
      jclass type = env->FindClass("java/lang/IllegalStateException");
      if (type) { env->ThrowNew(type,error.what()); env->DeleteLocalRef(type); }
    }
    return nullptr;
  }
}
}
void registerForegroundNatives(JNIEnv *env) {
  jclass type = env->FindClass("com/codonui/input/CUIForegroundRenderer");
  if (!type) return;
  JNINativeMethod methods[] = {{const_cast<char *>("nativeFilter"),
      const_cast<char *>("([BII[DLjava/util/concurrent/atomic/AtomicBoolean;)Lcom/codonui/input/CUIForegroundRenderer$Result;"),
      reinterpret_cast<void *>(filter)}};
  env->RegisterNatives(type,methods,1); env->DeleteLocalRef(type);
}
