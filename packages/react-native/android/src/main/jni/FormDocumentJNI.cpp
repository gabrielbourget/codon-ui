#include "FormDocumentJNI.h"
#include "FabricManager.h"
#include "../../../../cpp/form/FormDocumentQuery.h"
#include "../../../../cpp/form/FieldGroupQuery.h"

namespace jni = facebook::jni;
using namespace facebook::react;

static jni::local_ref<jstring> nativeFormDocument(
    jni::alias_ref<jclass>, jni::alias_ref<JFabricUIManager::javaobject> manager,
    jint surface, jint target, jlong session, jni::alias_ref<jstring> group) {
  if (!session) throw std::invalid_argument("Native form: current module identity required");
  return jni::make_jstring(codon::form::queryFabricFormDocument(
      *scopedManager(manager), surface, target, *reinterpret_cast<codon::form::NativeFormDocumentSession *>(session), {},
      group ? group->toStdString() : ""));
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
static jni::local_ref<jstring> nativeFieldGroupSelection(jni::alias_ref<jclass>,
    jni::alias_ref<jstring> document, jni::alias_ref<jstring> snapshot) {
  if (!document || !snapshot) throw std::invalid_argument("field-group-original-snapshot-required");
  return jni::make_jstring(folly::toJson(codon::form::fieldGroupSelection(
    folly::parseJson(document->toStdString()), folly::parseJson(snapshot->toStdString()))));
}

void registerFormDocumentNatives() {
  jni::findClassStatic("com/codonui/input/CUIFormDocumentModule")->registerNatives({
    makeNativeMethod("nativeFormDocument", nativeFormDocument),
    makeNativeMethod("nativeFormDocumentStamp", nativeFormDocumentStamp),
    makeNativeMethod("nativeFieldGroupSelection", nativeFieldGroupSelection),
    makeNativeMethod("nativeCreateFormSession", nativeCreateFormSession),
    makeNativeMethod("nativeRetireFormSession", nativeRetireFormSession)});
}
