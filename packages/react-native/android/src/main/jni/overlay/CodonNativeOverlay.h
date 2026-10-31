#pragma once

#include <CodonNativeInputSpec.h>
#include <react/renderer/components/CodonNativeOverlay/ComponentDescriptors.h>

namespace facebook::react {
JSI_EXPORT std::shared_ptr<TurboModule> CodonNativeOverlay_ModuleProvider(
    const std::string &name, const JavaTurboModule::InitParams &params);
}
