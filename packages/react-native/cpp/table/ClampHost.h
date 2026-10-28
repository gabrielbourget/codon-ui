#pragma once

#include "ClampContentSource.h"
#include <react/renderer/components/CodonNativeInputSpec/ShadowNodes.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>
#include <mutex>

namespace codon::table {

struct TClampParagraph {
  int tag;
  int lines;
  bool noWrap;
  facebook::react::Props::Shared props;
  facebook::react::State::Shared state;
  uintptr_t stateIdentity{0};
};
struct TClampParticipant {
  std::shared_ptr<CUIClampCapture> capture;
  facebook::react::Point origin;
};
class JSI_EXPORT CUIClampPlan {
 public:
  uint64_t owner{0};
  facebook::react::Size contentSize;
  facebook::react::Point contentOrigin;
  facebook::react::Size viewportSize;
  TClampViewport viewport;
  bool clipsContents{false};
  std::vector<TClampParagraph> paragraphs;
  std::vector<TClampParticipant> participants;
  void present(facebook::react::Point offset);
  void retire() noexcept;
};

JSI_EXPORT void presentClampPlan(uint64_t owner, facebook::react::Point offset);
JSI_EXPORT void retireClampPlan(uint64_t owner) noexcept;

struct TClampHostState {
  std::shared_ptr<CUIClampPlan> plan;
  TClampHostState() = default;
  explicit TClampHostState(std::shared_ptr<CUIClampPlan> plan) : plan(std::move(plan)) {}
#ifdef ANDROID
  TClampHostState(const TClampHostState &previous, const folly::dynamic &) : plan(previous.plan) {}
  folly::dynamic getDynamic() const;
#endif
};

} // namespace codon::table

namespace facebook::react {
class JSI_EXPORT CUIOwnedClampHostShadowNode final : public ConcreteViewShadowNode<
    CUIClampHostComponentName, CUIClampHostProps, CUIClampHostEventEmitter, codon::table::TClampHostState> {
 public:
  CUIOwnedClampHostShadowNode(const ShadowNodeFragment &fragment, const ShadowNodeFamily::Shared &family, ShadowNodeTraits traits);
  CUIOwnedClampHostShadowNode(const ShadowNode &source, const ShadowNodeFragment &fragment);
  void appendChild(const std::shared_ptr<const ShadowNode> &child) override;
  static ShadowNodeTraits BaseTraits();
  void completeClone(const ShadowNode &source, const ShadowNodeFragment &fragment) override;
  Size measureContent(const LayoutContext &context, const LayoutConstraints &constraints) const override;
  void layout(LayoutContext context) override;
 private:
  struct TContent;
  TContent resolveContent(const LayoutContext &context, const LayoutConstraints &constraints) const;
  std::vector<std::shared_ptr<const ShadowNode>> authoredChildren_;
};
using CUIOwnedClampHostComponentDescriptor = ConcreteComponentDescriptor<CUIOwnedClampHostShadowNode>;
} // namespace facebook::react
