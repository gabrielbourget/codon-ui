#pragma once
#include "ClampContentSource.h"
#include "ClampText.h"
#include <react/renderer/components/CodonNativeInputSpec/Props.h>

namespace codon::table {
facebook::react::Size measureClampContent(
    std::shared_ptr<const facebook::react::ShadowNode> root,
    const facebook::react::CUIClampHostProps &props,
    const facebook::react::LayoutContext &context,
    const facebook::react::LayoutConstraints &constraints,
    const std::shared_ptr<CUIClampTextScope> &textScope);
}
