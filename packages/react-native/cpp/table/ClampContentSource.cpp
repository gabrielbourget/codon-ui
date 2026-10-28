#include "ClampContentSource.h"

#include <atomic>
#include <mutex>
#include <stdexcept>
#include <unordered_map>

namespace codon::table {
using namespace facebook::react;
namespace {
std::mutex registryMutex;
std::unordered_map<const ShadowNodeFamily *, std::weak_ptr<CUIClampRegistration>> registry;
std::atomic<uint64_t> nextRegistration{1};
}

struct CUIClampRegistration::Impl {
  std::weak_ptr<ShadowNodeFamily> family;
  std::shared_ptr<CUIClampContentSource> source;
  std::atomic<bool> active{true};
  uint64_t identity{nextRegistration.fetch_add(1)};
  Impl(ShadowNodeFamily::Shared family, std::shared_ptr<CUIClampContentSource> source)
      : family(std::move(family)), source(std::move(source)) {}
};

CUIClampRegistration::CUIClampRegistration(ShadowNodeFamily::Shared family,
    std::shared_ptr<CUIClampContentSource> source) : impl_(std::make_shared<Impl>(std::move(family), std::move(source))) {}
CUIClampRegistration::~CUIClampRegistration() { dispose(); }
bool CUIClampRegistration::active() const { return impl_->active.load() && !impl_->family.expired(); }
void CUIClampRegistration::dispose() {
  if (impl_->active.exchange(false)) impl_->source->retireClampContent(impl_->identity);
}

std::shared_ptr<CUIClampRegistration> registerClampContentSource(
    ShadowNodeFamily::Shared family, std::shared_ptr<CUIClampContentSource> source) {
  if (!family || !source) throw std::invalid_argument("Table clamp requires an original native family/source");
  auto registration = std::shared_ptr<CUIClampRegistration>(new CUIClampRegistration(family, std::move(source)));
  std::shared_ptr<CUIClampRegistration> previous;
  {
    std::lock_guard lock(registryMutex);
    for (auto entry = registry.begin(); entry != registry.end();) {
      if (entry->second.expired()) entry = registry.erase(entry);
      else ++entry;
    }
    auto &entry = registry[family.get()];
    previous = entry.lock();
    entry = registration;
  }
  // Do not invoke a producer's native retirement callback under the registry lock.
  if (previous) previous->dispose();
  return registration;
}

bool hasClampContentSource(const ShadowNodeFamily &family) {
  std::lock_guard lock(registryMutex);
  auto entry = registry.find(&family);
  auto registration = entry == registry.end() ? nullptr : entry->second.lock();
  return registration && registration->active();
}

std::shared_ptr<ShadowNode> prepareClampContent(const ShadowNode &original, const LayoutContext &context, bool noWrap) {
  std::shared_ptr<CUIClampRegistration> registration;
  {
    std::lock_guard lock(registryMutex);
    auto entry = registry.find(&original.getFamily());
    if (entry != registry.end()) registration = entry->second.lock();
  }
  if (!registration || !registration->active()) throw std::runtime_error("Table clamp native flow source retired");
  auto clone = registration->impl_->source->prepareFlow(original, context, noWrap, registration->impl_->identity);
  if (!registration->active() || !clone || &clone->getFamily() != &original.getFamily() ||
      clone->getComponentHandle() != original.getComponentHandle() || clone->getProps() != original.getProps() ||
      clone->getState() != original.getState() || clone->getEventEmitter() != original.getEventEmitter())
    throw std::runtime_error("Table clamp native flow must retain original family, props, state and callbacks");
  return clone;
}

CUIClampCapture::~CUIClampCapture() { if (session_) session_->release(); }
void CUIClampCapture::check() const {
  check_();
  if (!registration_->active() || !session_ || !session_->current())
    throw std::runtime_error("Table clamp native content session retired");
}
codon::motion::TNativeScratchIntrinsic CUIClampCapture::callbacks() const {
  check();
  auto result = session_->callbacks();
  if (!result.measure || !result.baseline)
    throw std::runtime_error("Table clamp requires complete isolated native intrinsic callbacks");
  const auto current = [capture = shared_from_this()] { capture->check(); };
  return {
    [measure = std::move(result.measure), current](auto... arguments) {
      current(); auto value = measure(arguments...); current(); return value;
    },
    [baseline = std::move(result.baseline), current](auto... arguments) {
      current(); auto value = baseline(arguments...); current(); return value;
    }
  };
}
std::vector<TClampFragment> CUIClampCapture::fragments(facebook::react::Size selectedSize) const {
  check();
  auto result = session_->fragments(selectedSize);
  check();
  return result;
}
void CUIClampCapture::present(const TClampPresentation &presentation) {
  check();
  session_->present(presentation);
  check();
}
void CUIClampCapture::retire(uint64_t owner) noexcept {
  if (session_) session_->releasePresentation(owner);
}

std::shared_ptr<CUIClampCapture> captureClampContent(const TClampRequest &request) {
  if (!request.family || !request.props || !request.check || request.epoch.empty())
    throw std::invalid_argument("Table clamp requires complete original native request identity");
  request.check();
  auto captured = std::make_shared<CUIClampCapture>();
  {
    std::lock_guard lock(registryMutex);
    auto entry = registry.find(request.family.get());
    if (entry != registry.end()) captured->registration_ = entry->second.lock();
  }
  if (!captured->registration_ || !captured->registration_->active())
    throw std::runtime_error("Table clamp opaque native content source is unregistered");
  captured->check_ = request.check;
  auto selected = request;
  selected.registration = captured->registration_->impl_->identity;
  captured->session_ = captured->registration_->impl_->source->capture(selected);
  captured->check();
  return captured;
}

} // namespace codon::table
