#pragma once

#include <react/renderer/components/CodonNativeInputSpec/ShadowNodes.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>

namespace facebook::react {

class JSI_EXPORT CUIOwnedOverlayHostShadowNode final : public ConcreteViewShadowNode<
    CUIOverlayHostComponentName, CUIOverlayHostProps, CUIOverlayHostEventEmitter> {
 public:
  using ConcreteViewShadowNode::ConcreteViewShadowNode;
  static ShadowNodeTraits BaseTraits();
  void completeClone(const ShadowNode &source, const ShadowNodeFragment &fragment) override;
  void layoutTree(LayoutContext context, LayoutConstraints constraints) override;
  void layout(LayoutContext context) override;

 private:
  bool configuringRoot_{false};
};

class JSI_EXPORT CUIOwnedOverlaySlotShadowNode final : public ConcreteViewShadowNode<
    CUIOverlaySlotComponentName, CUIOverlaySlotProps, CUIOverlaySlotEventEmitter> {
 public:
  using ConcreteViewShadowNode::ConcreteViewShadowNode;
  void layoutAt(LayoutContext context, Size containingBlock, Rect frame, LayoutDirection direction);
  void layout(LayoutContext context) override;

 private:
  bool configuringRoot_{false};
};

class JSI_EXPORT CUIOwnedOverlayViewportShadowNode final : public ConcreteViewShadowNode<
    CUIOverlayViewportComponentName, CUIOverlayViewportProps, CUIOverlayViewportEventEmitter> {
 public:
  using ConcreteViewShadowNode::ConcreteViewShadowNode;
  static ShadowNodeTraits BaseTraits();
  void completeClone(const ShadowNode &source, const ShadowNodeFragment &fragment) override;
  void layout(LayoutContext context) override;
};

using CUIOwnedOverlayHostComponentDescriptor = ConcreteComponentDescriptor<CUIOwnedOverlayHostShadowNode>;
using CUIOwnedOverlayViewportComponentDescriptor = ConcreteComponentDescriptor<CUIOwnedOverlayViewportShadowNode>;
using CUIOwnedOverlaySlotComponentDescriptor = ConcreteComponentDescriptor<CUIOwnedOverlaySlotShadowNode>;

} // namespace facebook::react
