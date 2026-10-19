#pragma once

#include <react/renderer/uimanager/UIManager.h>
#include <string>

namespace codon::motion {

std::string queryNativeFabricSnapshot(
    const facebook::react::UIManager &manager, int target,
    const std::string &owner, const std::string &binding,
    const std::string &nativeViewRevision);

} // namespace codon::motion
