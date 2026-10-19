#pragma once

#include <fbjni/fbjni.h>
#include "NativeIntrinsics.h"

namespace codon::motion {

TNativeScratchIntrinsicResolver createAndroidIntrinsicResolver(
    const TNativeFabricSnapshot &snapshot,
    std::shared_ptr<const facebook::react::ContextContainer> contextContainer,
    facebook::jni::alias_ref<jobject> actualThemedViewContext,
    TNativeFabricReadGuard check);

} // namespace codon::motion
