#include "CodonNativeOverlay.h"

namespace facebook::react {
std::shared_ptr<TurboModule> CodonNativeOverlay_ModuleProvider(
    const std::string &name, const JavaTurboModule::InitParams &params) {
  return CodonNativeInputSpec_ModuleProvider(name, params);
}
}
