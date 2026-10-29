#include "../../../../../cpp/table/ClampKernel.h"
#include <atomic>
#include <jni.h>
#include <stdexcept>

namespace codon::table {
namespace { std::atomic<const TClampKernel *> kernel{nullptr}; }
const TClampKernel &clampKernel() {
  const auto value = kernel.load();
  if (!value) throw std::runtime_error("Table clamp requires its original initialized intrinsic kernel");
  return *value;
}
void installClampKernel(const TClampKernel *value) {
  if (!value || !value->intrinsics || !value->copy || !value->evaluate)
    throw std::runtime_error("Table clamp requires the complete pinned intrinsic kernel");
  const TClampKernel *expected = nullptr;
  if (!kernel.compare_exchange_strong(expected,value) && expected != value)
    throw std::runtime_error("Table clamp cannot replace its original intrinsic kernel");
}
}
extern "C" JNIEXPORT void JNICALL Java_com_codonui_input_CUIClampText_nativeInstallKernel(
    JNIEnv *env, jclass, jlong value) {
  try { codon::table::installClampKernel(reinterpret_cast<const codon::table::TClampKernel *>(value)); }
  catch (const std::exception &failure) {
    auto type = env->FindClass("java/lang/IllegalStateException");
    if (type) env->ThrowNew(type,failure.what());
  }
}
