#import <CodonNativeInputSpec/CodonNativeInputSpec.h>
#import <React/RCTInvalidating.h>
#include "../cpp/CUIEditorKeyboardDefaultRegistry.h"
#include <folly/json.h>
#include <atomic>
#include <cmath>
#include <climits>

namespace {
struct EditorKeyboardModuleState {
  std::string lease{NSUUID.UUID.UUIDString.UTF8String};
  std::shared_ptr<codon::EditorKeyboardDefaultFrames> frames{std::make_shared<codon::EditorKeyboardDefaultFrames>()};
  std::atomic<bool> valid{true};
  EditorKeyboardModuleState() { codon::registerEditorKeyboardDefaults(lease, frames); }
  void retire() {
    valid.store(false);
    codon::unregisterEditorKeyboardDefaults(lease);
    frames->retire();
  }
};
class EditorKeyboardDefaultsJSI final : public facebook::react::NativeCUIEditorKeyboardDefaultsSpecJSI {
 public:
  EditorKeyboardDefaultsJSI(const facebook::react::ObjCTurboModule::InitParams &params,
                           std::shared_ptr<EditorKeyboardModuleState> state)
      : NativeCUIEditorKeyboardDefaultsSpecJSI(params), state_(std::move(state)) {
    // Do not queue a synchronous acknowledgement back onto its waiting UI thread.
    methodMap_["getLease"] = MethodMetadata{0, getLease};
    methodMap_["settle"] = MethodMetadata{1, settle};
  }
 private:
  std::shared_ptr<EditorKeyboardModuleState> state_;
  static facebook::jsi::Value getLease(facebook::jsi::Runtime &runtime, facebook::react::TurboModule &module,
                                     const facebook::jsi::Value *, size_t) {
    auto &self = static_cast<EditorKeyboardDefaultsJSI &>(module);
    return facebook::jsi::String::createFromUtf8(runtime, self.state_->valid.load() ? self.state_->lease : "");
  }
  static facebook::jsi::Value settle(facebook::jsi::Runtime &runtime, facebook::react::TurboModule &module,
                                   const facebook::jsi::Value *arguments, size_t count) {
    auto &self = static_cast<EditorKeyboardDefaultsJSI &>(module);
    if (!self.state_->valid.load() || count != 1 || !arguments[0].isString()) return false;
    try {
      const auto request = folly::parseJson(arguments[0].getString(runtime).utf8(runtime));
      for (const auto *name : {"ownerId", "bindingId", "bindingRevision", "windowId", "phase"})
        if (!request.at(name).isString()) return false;
      for (const auto *name : {"target", "epoch", "eventId"}) {
        const auto &value = request.at(name);
        if (!value.isNumber() || !std::isfinite(value.asDouble()) || value.asDouble() != std::floor(value.asDouble()) ||
            value.asDouble() <= 0 || value.asDouble() > 9007199254740991.0) return false;
      }
      if (request.at("target").asDouble() > INT_MAX || !request.at("current").isBool() ||
          !request.at("preventDefault").isBool()) return false;
      const codon::EditorKeyIdentity identity{request.at("ownerId").asString(), request.at("bindingId").asString(),
        request.at("bindingRevision").asString(), (int32_t)request.at("target").asDouble(),
        request.at("windowId").asString(), (int64_t)request.at("epoch").asDouble()};
      return self.state_->frames->acknowledge(identity, (int64_t)request.at("eventId").asDouble(),
        request.at("phase").asString(), request.at("current").asBool(), request.at("preventDefault").asBool());
    } catch (const std::exception &) { return false; }
  }
};
}

@interface CUIEditorKeyboardDefaults : NativeCUIEditorKeyboardDefaultsSpecBase <NativeCUIEditorKeyboardDefaultsSpec, RCTInvalidating>
@end
@implementation CUIEditorKeyboardDefaults {
  std::shared_ptr<EditorKeyboardModuleState> _state;
}
RCT_EXPORT_MODULE(CUIEditorKeyboardDefaults)
- (instancetype)init { if ((self = [super init])) _state = std::make_shared<EditorKeyboardModuleState>(); return self; }
- (NSString *)getLease { return _state->valid.load() ? @(_state->lease.c_str()) : @""; }
- (NSNumber *)settle:(NSString *)request { return @NO; }
- (void)invalidate { _state->retire(); }
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<EditorKeyboardDefaultsJSI>(params, _state);
}
@end
