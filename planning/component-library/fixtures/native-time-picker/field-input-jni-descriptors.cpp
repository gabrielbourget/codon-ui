#include "../../../../packages/react-native/android/src/main/jni/FormDocumentJNI.cpp"
#include <string_view>
#include "field-input-jni-descriptors.inc"

static_assert(std::string_view(facebook::jni::detail::makeDescriptor(&nativeEmitOwnedInput).c_str()) == ownedInputDescriptor,
  "Original owned-input JNI registration must match the compiled Java declaration");
static_assert(std::string_view(facebook::jni::detail::makeDescriptor(&nativeEmitFieldPointer).c_str()) == pointerDescriptor,
  "Original pointer JNI registration must match the compiled Java declaration");
