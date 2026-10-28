#include "NativeTypographySource.h"
#include <mutex>
#include <stdexcept>
#include <unordered_map>
#include <typeinfo>

namespace codon::typography {
namespace {
std::recursive_mutex mutex;
uint64_t revision = 0;
std::unordered_map<facebook::react::ComponentHandle, std::weak_ptr<TNativeTypographyRegistration>> sources;
}
TNativeTypographyRegistration::TNativeTypographyRegistration(
    facebook::react::ComponentHandle component, std::shared_ptr<TNativeTypographySource> source)
    : component_(component), source_(std::move(source)) {}
TNativeTypographyRegistration::~TNativeTypographyRegistration() { dispose(); }
bool TNativeTypographyRegistration::active() const {
  std::lock_guard<std::recursive_mutex> lock(mutex);
  const auto found = sources.find(component_);
  return source_ && found != sources.end() && found->second.lock().get() == this;
}
void TNativeTypographyRegistration::dispose() {
  std::shared_ptr<TNativeTypographySource> source;
  {
    std::lock_guard<std::recursive_mutex> lock(mutex);
    source = std::move(source_);
    if (source) revision++;
    const auto found = sources.find(component_);
    if (found != sources.end() && found->second.lock().get() == this) sources.erase(found);
  }
  if (source) source->retireNativeTypography();
}
facebook::react::Props::Shared TNativeTypographyRegistration::typographyProps(
    const facebook::react::ShadowNode &node, const TNativeTypographyContext &context) {
  std::shared_ptr<TNativeTypographySource> source;
  {
    std::lock_guard<std::recursive_mutex> lock(mutex);
    if (!active() || node.getComponentHandle() != component_) throw std::runtime_error("Native typography source retired or changed component");
    source = source_;
  }
  auto props = source->typographyProps(node, context);
  const auto *next = props.get(); const auto *original = node.getProps().get();
  if (!active() || !next || typeid(*next) != typeid(*original))
    throw std::runtime_error("Native typography source must retain its current original typed props");
  return props;
}
std::shared_ptr<TNativeTypographyRegistration> nativeTypographySource(facebook::react::ComponentHandle component) {
  std::lock_guard<std::recursive_mutex> lock(mutex);
  const auto found = sources.find(component);
  if (found == sources.end()) return nullptr;
  auto source = found->second.lock();
  if (!source) sources.erase(found);
  return source;
}
std::shared_ptr<TNativeTypographyRegistration> registerNativeTypographySource(
    facebook::react::ComponentHandle component, std::shared_ptr<TNativeTypographySource> source) {
  if (!component || !source) throw std::invalid_argument("Native typography requires original component/source authority");
  auto registration = std::shared_ptr<TNativeTypographyRegistration>(new TNativeTypographyRegistration(component, std::move(source)));
  std::shared_ptr<TNativeTypographyRegistration> old;
  {
    std::lock_guard<std::recursive_mutex> lock(mutex);
    old = nativeTypographySource(component);
    sources[component] = registration;
    revision++;
  }
  if (old) old->dispose();
  return registration;
}
uint64_t nativeTypographyRevision() {
  std::lock_guard<std::recursive_mutex> lock(mutex);
  return revision;
}
}
