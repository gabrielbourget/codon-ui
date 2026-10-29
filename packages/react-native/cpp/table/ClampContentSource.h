#pragma once

#include "ClampFlow.h"
#if __has_include("../motion/NativeIntrinsicSource.h")
#include "../motion/NativeIntrinsicSource.h"
#else
#include <CodonNativeInput/NativeIntrinsicSource.h>
#endif
#include <react/renderer/core/LayoutContext.h>
#include <react/renderer/core/LayoutConstraints.h>
#include <react/renderer/core/ShadowNode.h>
#include <functional>
#include <memory>
#include <string>

namespace codon::table {

struct TClampRequest {
  facebook::react::ShadowNodeFamily::Shared family;
  facebook::react::Props::Shared props;
  facebook::react::State::Shared state;
  facebook::react::LayoutContext context;
  facebook::react::LayoutMetrics metrics;
  facebook::react::LayoutConstraints constraints;
  uint64_t revision{0};
  bool noWrap{false};
  std::string windowId;
  std::string epoch;
  std::function<void()> check;
  uint64_t registration{0};
};

struct TClampPresentation {
  uint64_t owner{0};
  facebook::react::Rect viewport;
  facebook::react::Point contentOffset;
  std::vector<TClampFragment> lastLine;
  bool clipped{false};
  bool clipsContents{false};
};

// An opaque producer owns both its exact flow snapshot and original native paint.
// Capture is synchronous in Fabric; present/releasePresentation run on the UI thread.
class JSI_EXPORT CUIClampSession {
 public:
  virtual ~CUIClampSession() = default;
  virtual bool current() const = 0;
  virtual codon::motion::TNativeScratchIntrinsic callbacks() = 0;
  virtual std::vector<TClampFragment> fragments(facebook::react::Size selectedSize) const = 0;
  virtual void present(const TClampPresentation &presentation) = 0;
  virtual void releasePresentation(uint64_t owner) noexcept = 0;
  virtual void release() noexcept = 0;
};

class JSI_EXPORT CUIClampContentSource {
 public:
  virtual ~CUIClampContentSource() = default;
  // Prepare a same-family clone's owned native flow flag before normal Fabric layout.
  // Keep the original props/state/event emitter; never write a mounted control.
  virtual std::shared_ptr<facebook::react::ShadowNode> prepareFlow(
      const facebook::react::ShadowNode &original, const facebook::react::LayoutContext &context,
      bool noWrap, uint64_t registration) = 0;
  virtual std::shared_ptr<CUIClampSession> capture(const TClampRequest &request) = 0;
  virtual void retireClampContent(uint64_t registration) noexcept = 0;
};

class JSI_EXPORT CUIClampRegistration {
 public:
  ~CUIClampRegistration();
  CUIClampRegistration(const CUIClampRegistration &) = delete;
  CUIClampRegistration &operator=(const CUIClampRegistration &) = delete;
  bool active() const;
  void dispose();
 private:
  struct Impl;
  std::shared_ptr<Impl> impl_;
  CUIClampRegistration(facebook::react::ShadowNodeFamily::Shared family, std::shared_ptr<CUIClampContentSource> source);
  friend std::shared_ptr<CUIClampRegistration> registerClampContentSource(
      facebook::react::ShadowNodeFamily::Shared, std::shared_ptr<CUIClampContentSource>);
  friend class CUIClampCapture;
  friend std::shared_ptr<class CUIClampCapture> captureClampContent(const TClampRequest &);
  friend std::shared_ptr<facebook::react::ShadowNode> prepareClampContent(
      const facebook::react::ShadowNode &, const facebook::react::LayoutContext &, bool);
};

class JSI_EXPORT CUIClampCapture : public std::enable_shared_from_this<CUIClampCapture> {
 public:
  CUIClampCapture() = default;
  CUIClampCapture(const CUIClampCapture &) = delete;
  CUIClampCapture &operator=(const CUIClampCapture &) = delete;
  ~CUIClampCapture();
  codon::motion::TNativeScratchIntrinsic callbacks() const;
  std::vector<TClampFragment> fragments(facebook::react::Size selectedSize) const;
  void present(const TClampPresentation &presentation);
  void retire(uint64_t owner) noexcept;
  void check() const;
 private:
  std::shared_ptr<CUIClampRegistration> registration_;
  std::shared_ptr<CUIClampSession> session_;
  std::function<void()> check_;
  friend std::shared_ptr<CUIClampCapture> captureClampContent(const TClampRequest &);
};

JSI_EXPORT std::shared_ptr<CUIClampRegistration> registerClampContentSource(
    facebook::react::ShadowNodeFamily::Shared family, std::shared_ptr<CUIClampContentSource> source);
JSI_EXPORT bool hasClampContentSource(const facebook::react::ShadowNodeFamily &family);
JSI_EXPORT std::shared_ptr<CUIClampCapture> captureClampContent(const TClampRequest &request);
JSI_EXPORT std::shared_ptr<facebook::react::ShadowNode> prepareClampContent(
    const facebook::react::ShadowNode &original, const facebook::react::LayoutContext &context, bool noWrap);

} // namespace codon::table
