#pragma once

#include <fbjni/fbjni.h>
#include "NativeIntrinsics.h"

namespace codon::motion {

TNativeScratchIntrinsicResolver createAndroidIntrinsicResolver(
    const TNativeFabricSnapshot &snapshot,
    std::shared_ptr<const facebook::react::ContextContainer> contextContainer,
    facebook::jni::alias_ref<jobject> actualThemedViewContext,
    facebook::jni::alias_ref<jobject> actualFabricManager,
    TNativeFabricReadGuard check,
    TNativeScratchPropsResolver propsForNode = {});

} // namespace codon::motion
