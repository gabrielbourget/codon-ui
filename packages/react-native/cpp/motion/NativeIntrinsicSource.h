#pragma once

#ifdef __cplusplus

#include <react/renderer/core/ShadowNode.h>
#include <react/renderer/core/LayoutContext.h>
#include <react/renderer/mounting/ShadowTreeRevision.h>
#include <yoga/Yoga.h>
#include <array>
#include <functional>
#include <memory>

namespace codon::motion {

struct TNativeScratchIntrinsic {
  std::function<YGSize(float, YGMeasureMode, float, YGMeasureMode, YGDirection)> measure;
  std::function<float(float, float, const std::array<float, 4> &,
      const std::array<float, 4> &, YGDirection)> baseline;
};

// Shared native Fabric contract on iOS and Android. Capture selects original immutable
// inputs; the returned session measures only independently owned resources.
struct TNativeIntrinsicRequest {
  facebook::react::ShadowNodeFamily::Shared family;
  facebook::react::Props::Shared props;
  facebook::react::State::Shared state;
  facebook::react::LayoutContext context;
  facebook::react::ShadowTreeRevision::Number revision;
  std::function<void()> check;
};

class JSI_EXPORT CUIIntrinsicSession {
 public:
  virtual ~CUIIntrinsicSession() = default;
  virtual bool current() const = 0;
  virtual TNativeScratchIntrinsic callbacks() = 0;
  // Exactly once, including failure. Must not throw or touch original mounted state.
  virtual void release() noexcept = 0;
};

class JSI_EXPORT CUIIntrinsicSource {
 public:
  virtual ~CUIIntrinsicSource() = default;
  virtual std::shared_ptr<CUIIntrinsicSession> capture(const TNativeIntrinsicRequest &request) = 0;
};

class JSI_EXPORT CUIIntrinsicRegistration {
 public:
  ~CUIIntrinsicRegistration();
  CUIIntrinsicRegistration(const CUIIntrinsicRegistration &) = delete;
  CUIIntrinsicRegistration &operator=(const CUIIntrinsicRegistration &) = delete;
  void dispose();
  bool active() const;
 private:
  friend std::shared_ptr<CUIIntrinsicRegistration> registerNativeIntrinsicSource(
      facebook::react::ShadowNodeFamily::Shared, std::shared_ptr<CUIIntrinsicSource>);
  friend TNativeScratchIntrinsic captureNativeIntrinsicSource(const TNativeIntrinsicRequest &);
  CUIIntrinsicRegistration(facebook::react::ShadowNodeFamily::Shared, std::shared_ptr<CUIIntrinsicSource>);
  struct Impl;
  std::shared_ptr<Impl> impl_;
};

// Retain the token for the original family lifetime; dispose on replacement/window teardown.
// Registration is exact-family, never a tag lookup or a component-wide mutable fallback.
JSI_EXPORT std::shared_ptr<CUIIntrinsicRegistration> registerNativeIntrinsicSource(
    facebook::react::ShadowNodeFamily::Shared family, std::shared_ptr<CUIIntrinsicSource> source);
JSI_EXPORT bool hasNativeIntrinsicSource(const facebook::react::ShadowNodeFamily &family);
JSI_EXPORT TNativeScratchIntrinsic captureNativeIntrinsicSource(const TNativeIntrinsicRequest &request);

} // namespace codon::motion

#endif
