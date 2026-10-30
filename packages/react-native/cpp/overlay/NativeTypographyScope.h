#pragma once
#include <react/renderer/components/CodonNativeInputSpec/ShadowNodes.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>

namespace facebook::react {
class JSI_EXPORT CUIOwnedTypographyFocusShadowNode final : public ConcreteViewShadowNode<
    CUIFocusViewComponentName, CUIFocusViewProps, CUIFocusViewEventEmitter> {
 public:
  CUIOwnedTypographyFocusShadowNode(const ShadowNodeFragment &fragment, const ShadowNodeFamily::Shared &family, ShadowNodeTraits traits);
  CUIOwnedTypographyFocusShadowNode(const ShadowNode &source, const ShadowNodeFragment &fragment);
  void appendChild(const std::shared_ptr<const ShadowNode> &child) override;
  void prepareTypography();
 private:
  std::vector<std::shared_ptr<const ShadowNode>> authoredChildren_;
  std::string appliedStyle_;
  std::string appliedWindow_;
  bool prepared_{false};
  bool appliedCounterEmptyChildren_{false};
  uint64_t sourceRevision_{0};
};
class CUIOwnedTypographyFocusComponentDescriptor final : public ConcreteComponentDescriptor<CUIOwnedTypographyFocusShadowNode> {
 public:
  using ConcreteComponentDescriptor::ConcreteComponentDescriptor;
 protected:
  void adopt(ShadowNode &node) const override {
    ConcreteComponentDescriptor::adopt(node);
    static_cast<CUIOwnedTypographyFocusShadowNode &>(node).prepareTypography();
  }
};
}
