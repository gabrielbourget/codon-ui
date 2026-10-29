#pragma once
#include "../motion/NativeIntrinsics.h"

namespace codon::table {
// The two existing Android native libraries share the same pinned C++ runtime.
// This private dispatch keeps the established intrinsic registry in codon_motion.
struct TClampKernel {
  decltype(&codon::motion::createNativeSubtreeIntrinsics) intrinsics;
  decltype(&codon::motion::copyNativeScratchSubtree) copy;
  decltype(&codon::motion::evaluateNativeScratchStages) evaluate;
};
#if defined(__ANDROID__)
const TClampKernel &clampKernel();
#else
inline const TClampKernel &clampKernel() {
  static const TClampKernel kernel{codon::motion::createNativeSubtreeIntrinsics,
      codon::motion::copyNativeScratchSubtree, codon::motion::evaluateNativeScratchStages};
  return kernel;
}
#endif
}
