#include "FormDocumentJNI.h"
#include "FabricManager.h"
#include "../../../../cpp/form/FormDocumentQuery.h"

namespace jni = facebook::jni;
using namespace facebook::react;

static jni::local_ref<jstring> nativeFormDocument(
    jni::alias_ref<jclass>, jni::alias_ref<JFabricUIManager::javaobject> manager,
    jint surface, jint target, jlong session) {
  if (!session) throw std::invalid_argument("Native form: current module identity required");
  return jni::make_jstring(codon::form::queryFabricFormDocument(
      *scopedManager(manager), surface, target, *reinterpret_cast<codon::form::NativeFormDocumentSession *>(session)));
}

static jlong nativeCreateFormSession(jni::alias_ref<jclass>, jni::alias_ref<jstring> identity) {
  if (!identity) throw std::invalid_argument("Native form: module identity required");
  return reinterpret_cast<jlong>(new codon::form::NativeFormDocumentSession(identity->toStdString()));
}
static jni::local_ref<jstring> nativeFormDocumentStamp(jni::alias_ref<jclass>,
    jni::alias_ref<JFabricUIManager::javaobject> manager, jint surface, jlong session) {
  if (!session) throw std::invalid_argument("Native form: current module identity required");
  return jni::make_jstring(codon::form::queryFabricFormDocumentStamp(*scopedManager(manager), surface,
      *reinterpret_cast<codon::form::NativeFormDocumentSession *>(session)));
}
static void nativeRetireFormSession(jni::alias_ref<jclass>, jlong session) {
  delete reinterpret_cast<codon::form::NativeFormDocumentSession *>(session);
}

void registerFormDocumentNatives() {
  jni::findClassStatic("com/codonui/input/CUIFormDocumentModule")->registerNatives({
    makeNativeMethod("nativeFormDocument", nativeFormDocument),
    makeNativeMethod("nativeFormDocumentStamp", nativeFormDocumentStamp),
    makeNativeMethod("nativeCreateFormSession", nativeCreateFormSession),
    makeNativeMethod("nativeRetireFormSession", nativeRetireFormSession)});
}
