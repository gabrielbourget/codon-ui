#include "../../../../cpp/table/ClampKernel.h"
#include <jni.h>

extern "C" JNIEXPORT jlong JNICALL Java_com_codonui_input_CUIMotionSnapshotModule_clampKernel(
    JNIEnv *, jclass) {
  static const codon::table::TClampKernel kernel{codon::motion::createNativeSubtreeIntrinsics,
      codon::motion::copyNativeScratchSubtree, codon::motion::evaluateNativeScratchStages};
  return reinterpret_cast<jlong>(&kernel);
}
