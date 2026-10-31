#include "../../../../../cpp/table/ClampHost.h"
#include <jni.h>
#include <stdexcept>
#include <string>

namespace {
uint64_t ownerId(JNIEnv *env, jstring owner) {
  if (!owner) throw std::invalid_argument("Table clamp original owner required");
  const char *value = env->GetStringUTFChars(owner, nullptr);
  if (!value) throw std::runtime_error("Table clamp owner unavailable");
  std::string copied(value);
  env->ReleaseStringUTFChars(owner,value);
  size_t end = 0;
  const auto result = std::stoull(copied,&end);
  if (!result || end != copied.size()) throw std::invalid_argument("Invalid Table clamp owner");
  return result;
}
void failure(JNIEnv *env, const std::exception &error) {
  if (env->ExceptionCheck()) return;
  auto type = env->FindClass("java/lang/IllegalStateException");
  if (type) env->ThrowNew(type,error.what());
}
}

extern "C" JNIEXPORT void JNICALL Java_com_codonui_input_CUIClampHost_nativePresent(
    JNIEnv *env, jclass, jstring owner, jdouble x, jdouble y) {
  try { codon::table::presentClampPlan(ownerId(env,owner),{static_cast<facebook::react::Float>(x),static_cast<facebook::react::Float>(y)}); }
  catch (const std::exception &error) { failure(env,error); }
}
extern "C" JNIEXPORT void JNICALL Java_com_codonui_input_CUIClampHost_nativeRetire(
    JNIEnv *env, jclass, jstring owner) {
  try { codon::table::retireClampPlan(ownerId(env,owner)); }
  catch (const std::exception &error) { failure(env,error); }
}
extern "C" JNIEXPORT void JNICALL Java_com_codonui_input_CUIClampHost_nativeActive(
    JNIEnv *env, jclass, jstring owner, jboolean active) {
  try { codon::table::setClampPlanActive(ownerId(env,owner),active); }
  catch (const std::exception &error) { failure(env,error); }
}
