#pragma once

#include "PositionOwnership.h"
#include <react/renderer/components/CodonNativeInputSpec/ComponentDescriptors.h>
#include <react/renderer/core/RawPropsParser.h>

namespace facebook::react {
// A one-key parser also observes position when RN's iterator setter is enabled.
struct CUIPositionPresenceProps : Props {
  CUIPositionPresenceProps() = default;
  CUIPositionPresenceProps(const PropsParserContext &, const CUIPositionPresenceProps &, const RawProps &raw) {
    raw.at("position", nullptr, nullptr);
  }
};

class CUIOwnedFocusViewComponentDescriptor final : public CUIFocusViewComponentDescriptor {
 public:
  explicit CUIOwnedFocusViewComponentDescriptor(const ComponentDescriptorParameters &parameters)
      : CUIFocusViewComponentDescriptor(parameters) {
    positionParser_.prepare<CUIPositionPresenceProps>();
  }

  Props::Shared cloneProps(const PropsParserContext &context, const Props::Shared &source, RawProps raw) const override {
    bool authored = false;
    if (source) {
      const auto presence = codon::input::nativePositionPresence(source);
      if (presence) authored = *presence;
      else if (source != CUIFocusViewShadowNode::defaultSharedProps())
        throw std::invalid_argument("Native position: original FocusView descriptor props required");
    }
    auto props = CUIFocusViewComponentDescriptor::cloneProps(context, source, RawProps(raw));
    if (!raw.isEmpty()) {
      raw.parse(positionParser_);
      if (const auto *position = raw.at("position", nullptr, nullptr)) authored = position->hasValue();
    }
    return codon::input::withNativePositionPresence(std::move(props), authored);
  }

 private:
  RawPropsParser positionParser_;
};

} // namespace facebook::react
