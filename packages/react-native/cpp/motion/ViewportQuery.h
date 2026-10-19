#pragma once

#include "FabricSnapshot.h"
#include <string>

namespace codon::motion {
std::string queryNativeViewport(
    const facebook::react::UIManager &manager, const std::string &request);
} // namespace codon::motion
