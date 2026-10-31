#include "NativeIntrinsicSource.h"

#include <atomic>
#include <cmath>
#include <mutex>
#include <stdexcept>
#include <unordered_map>

namespace codon::motion {
using namespace facebook::react;
namespace {
std::mutex registryMutex;
std::unordered_map<const ShadowNodeFamily *, std::weak_ptr<CUIIntrinsicRegistration>> registry;
}

struct CUIIntrinsicRegistration::Impl {
  std::weak_ptr<ShadowNodeFamily> family;
  std::shared_ptr<CUIIntrinsicSource> source;
  std::atomic<bool> active{true};
  Impl(ShadowNodeFamily::Shared original, std::shared_ptr<CUIIntrinsicSource> provider)
      : family(std::move(original)), source(std::move(provider)) {}
};

CUIIntrinsicRegistration::CUIIntrinsicRegistration(ShadowNodeFamily::Shared family,
    std::shared_ptr<CUIIntrinsicSource> source) : impl_(std::make_shared<Impl>(family, std::move(source))) {}
CUIIntrinsicRegistration::~CUIIntrinsicRegistration() { dispose(); }
bool CUIIntrinsicRegistration::active() const { return impl_->active.load() && !impl_->family.expired(); }
void CUIIntrinsicRegistration::dispose() {
  impl_->active.store(false);
}

std::shared_ptr<CUIIntrinsicRegistration> registerNativeIntrinsicSource(
    ShadowNodeFamily::Shared family, std::shared_ptr<CUIIntrinsicSource> source) {
  if (!family || !source) throw std::invalid_argument("Native motion: original intrinsic family/source required");
  auto result = std::shared_ptr<CUIIntrinsicRegistration>(new CUIIntrinsicRegistration(family, std::move(source)));
  std::lock_guard lock(registryMutex);
  for (auto entry = registry.begin(); entry != registry.end();) {
    if (entry->second.expired()) entry = registry.erase(entry);
    else ++entry;
  }
  auto &entry = registry[family.get()];
  if (auto previous = entry.lock()) previous->impl_->active.store(false);
  entry = result;
  return result;
}

bool hasNativeIntrinsicSource(const ShadowNodeFamily &family) {
  std::lock_guard lock(registryMutex);
  auto entry = registry.find(&family);
  if (entry == registry.end()) return false;
  auto registration = entry->second.lock();
  return registration && registration->active();
}

TNativeScratchIntrinsic captureNativeIntrinsicSource(const TNativeIntrinsicRequest &request) {
  if (!request.family || !request.props || !request.check)
    throw std::invalid_argument("Native motion: complete guarded intrinsic request required");
  request.check();
  std::shared_ptr<CUIIntrinsicRegistration> registration;
  {
    std::lock_guard lock(registryMutex);
    auto entry = registry.find(request.family.get());
    if (entry != registry.end()) registration = entry->second.lock();
  }
  if (!registration || !registration->active())
    throw std::runtime_error("Native motion: isolated intrinsic source unregistered");
  struct Captured {
    std::shared_ptr<CUIIntrinsicRegistration> registration;
    std::shared_ptr<CUIIntrinsicSession> session;
    std::function<void()> guard;
    ~Captured() { if (session) session->release(); }
    void check() const {
      guard();
      if (!registration->active() || !session || !session->current())
        throw std::runtime_error("Native motion: isolated intrinsic source retired");
    }
  };
  auto captured = std::make_shared<Captured>();
  captured->registration = registration; captured->guard = request.check;
  captured->session = registration->impl_->source->capture(request);
  captured->check();
  auto callbacks = captured->session->callbacks();
  captured->check();
  if (!callbacks.measure || !callbacks.baseline)
    throw std::runtime_error("Native motion: complete isolated measure/baseline session required");
  return {
    [captured, measure = std::move(callbacks.measure)](float width, YGMeasureMode widthMode,
        float height, YGMeasureMode heightMode, YGDirection direction) {
      captured->check();
      auto result = measure(width, widthMode, height, heightMode, direction);
      captured->check();
      if (!std::isfinite(result.width) || !std::isfinite(result.height) || result.width < 0 || result.height < 0)
        throw std::runtime_error("Native motion: invalid isolated intrinsic size");
      return result;
    },
    [captured, baseline = std::move(callbacks.baseline)](float width, float height,
        const auto &border, const auto &padding, YGDirection direction) {
      captured->check();
      auto result = baseline(width, height, border, padding, direction);
      captured->check();
      if (!std::isfinite(result)) throw std::runtime_error("Native motion: invalid isolated intrinsic baseline");
      return result;
    }
  };
}
} // namespace codon::motion
