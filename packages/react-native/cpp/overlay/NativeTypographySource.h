#pragma once
#include <react/renderer/attributedstring/TextAttributes.h>
#include <react/renderer/core/ShadowNode.h>
#include <folly/dynamic.h>
#include <memory>
#include <string>

namespace codon::typography {
struct TNativeTypographyContext {
  const facebook::react::ShadowNode &owner;
  const facebook::react::TextAttributes &textAttributes;
  const folly::dynamic &paragraphStyle;
  std::string windowId;
  uint64_t sourceRevision;
};
// Native custom text owners clone only their original typed styling/metric props.
// They retain original families, state, values, selection, events/defaults, font assets and caches.
// Work is synchronous in the original Fabric commit. No deferred styling/input work is admitted.
class JSI_EXPORT TNativeTypographySource {
 public:
  virtual ~TNativeTypographySource() = default;
  virtual facebook::react::Props::Shared typographyProps(
      const facebook::react::ShadowNode &original, const TNativeTypographyContext &context) = 0;
  // Restore any provider-owned original font/metric presentation and invalidate its actual owners.
  // Invoked exactly once on replacement/disposal; provider owns native thread/window admission.
  // Registration or source changes must invalidate the actual original scope owners for a new commit.
  virtual void retireNativeTypography() noexcept = 0;
};
class JSI_EXPORT TNativeTypographyRegistration {
 public:
  ~TNativeTypographyRegistration();
  TNativeTypographyRegistration(const TNativeTypographyRegistration &) = delete;
  TNativeTypographyRegistration &operator=(const TNativeTypographyRegistration &) = delete;
  bool active() const;
  void dispose();
  facebook::react::Props::Shared typographyProps(
      const facebook::react::ShadowNode &node, const TNativeTypographyContext &context);
 private:
  friend std::shared_ptr<TNativeTypographyRegistration> registerNativeTypographySource(facebook::react::ComponentHandle, std::shared_ptr<TNativeTypographySource>);
  TNativeTypographyRegistration(facebook::react::ComponentHandle component, std::shared_ptr<TNativeTypographySource> source);
  facebook::react::ComponentHandle component_;
  std::shared_ptr<TNativeTypographySource> source_;
};
// Retain this token while the actual component descriptor/native renderer supplies typography.
JSI_EXPORT std::shared_ptr<TNativeTypographyRegistration> registerNativeTypographySource(
    facebook::react::ComponentHandle component, std::shared_ptr<TNativeTypographySource> source);
JSI_EXPORT std::shared_ptr<TNativeTypographyRegistration> nativeTypographySource(facebook::react::ComponentHandle component);
JSI_EXPORT uint64_t nativeTypographyRevision();
}
