#pragma once
#include <react/renderer/core/ShadowNode.h>
#include <yoga/node/Node.h>
#include <memory>
#include <vector>

namespace codon::counter {
bool isNativeCounterEmptyElement(const facebook::react::ShadowNode &node);
void applyNativeCounterEmptyLayout(facebook::yoga::Node &owner,
    const std::vector<std::shared_ptr<const facebook::react::ShadowNode>> &children, bool enabled);
}
