#include "MotionDrawingJNI.h"

namespace codon::motion {
namespace {
jclass viewGroupClass;
jmethodID dispatchDrawMethod;

void dispatchChildren(JNIEnv *env, jclass, jobject host, jobject canvas) {
  // ViewGroup.dispatchDraw is the documented protected framework extension point.
  // The nonvirtual call bypasses only ReactViewGroup's scalar-radius clipping;
  // Android's traversal still calls this host's virtual drawChild/order methods.
  env->CallNonvirtualVoidMethod(host, viewGroupClass, dispatchDrawMethod, canvas);
}
}

void registerMotionDrawingNatives(JNIEnv *env) {
  jclass localViewGroup = env->FindClass("android/view/ViewGroup");
  if (localViewGroup == nullptr) return;
  viewGroupClass = static_cast<jclass>(env->NewGlobalRef(localViewGroup));
  env->DeleteLocalRef(localViewGroup);
  if (viewGroupClass == nullptr) return;
  dispatchDrawMethod = env->GetMethodID(viewGroupClass, "dispatchDraw", "(Landroid/graphics/Canvas;)V");
  if (dispatchDrawMethod == nullptr) return;
  jclass receiver = env->FindClass("com/codonui/input/CUIMotionDrawingDispatch");
  if (receiver == nullptr) return;
  JNINativeMethod methods[] = {{const_cast<char *>("dispatchChildren"), const_cast<char *>("(Landroid/view/ViewGroup;Landroid/graphics/Canvas;)V"), reinterpret_cast<void *>(dispatchChildren)}};
  env->RegisterNatives(receiver, methods, 1);
  env->DeleteLocalRef(receiver);
}
}
