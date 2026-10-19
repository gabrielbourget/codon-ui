#import <CodonNativeInputSpec/CodonNativeInputSpec.h>
#import <React/RCTInvalidating.h>
#import <React/RCTAssert.h>
#import <React/RCTSurfacePresenter.h>
#import <React/RCTScheduler.h>
#import <React/RCTConversions.h>
#import "CUIFocusView.h"
#import "CUIMotionGeometryObserver.h"
#include "../cpp/motion/SnapshotQuery.h"
#include "../cpp/motion/PopFrame.h"
#include "../cpp/motion/PopPresentation.h"
#include "../cpp/motion/ViewportQuery.h"
#include "../cpp/motion/InitialValueQuery.h"
#include <react/renderer/uimanager/UIManagerBinding.h>
#include <folly/json.h>
#include <atomic>
#include <cmath>
#include <climits>
#include <stdexcept>
#include <iomanip>
#include <limits>
#include <locale>
#include <sstream>

@interface CUIMotionSnapshot : NativeCUIMotionSnapshotSpecBase <NativeCUIMotionSnapshotSpec, RCTInvalidating>
@end

struct CUIPopSession {
  std::mutex mutex;
  std::unique_ptr<codon::motion::NativePopPresentation> presentation;
  bool retired{false};
  void close() {
    std::lock_guard lock(mutex);
    retired = true;
    presentation.reset();
  }
};

// The generated Objective-C dispatch normally uses methodQueue. Frame capture
// must run inside getSnapshotBeforeUpdate, so this private method uses the
// serialized calling JSI runtime and reads immutable Fabric data directly.
class CUIMotionSnapshotJSI final : public facebook::react::NativeCUIMotionSnapshotSpecJSI {
 public:
  CUIMotionSnapshotJSI(const facebook::react::ObjCTurboModule::InitParams &params,
                      std::shared_ptr<std::atomic<bool>> valid, std::shared_ptr<CUIPopSession> pop)
      : NativeCUIMotionSnapshotSpecJSI(params), valid_(std::move(valid)), pop_(std::move(pop)) {
    methodMap_["getPopFrame"] = MethodMetadata{1, getPopFrame};
    methodMap_["getViewportSnapshot"] = MethodMetadata{1, getViewportSnapshot};
    methodMap_["popPresentation"] = MethodMetadata{1, popPresentation};
  }
 private:
  std::shared_ptr<std::atomic<bool>> valid_;
  std::shared_ptr<CUIPopSession> pop_;
  static facebook::jsi::Value popPresentation(
      facebook::jsi::Runtime &runtime, facebook::react::TurboModule &module,
      const facebook::jsi::Value *arguments, size_t count) {
    auto &self = static_cast<CUIMotionSnapshotJSI &>(module);
    if (count != 1 || !arguments[0].isString())
      throw facebook::jsi::JSError(runtime, "Native popLayout: string request required");
    try {
      const auto encoded = arguments[0].getString(runtime).utf8(runtime);
      const auto request = folly::parseJson(encoded);
      std::lock_guard lock(self.pop_->mutex);
      if (self.pop_->retired || !self.valid_->load()) {
        if (request.at("action").asString() == "release" && !self.pop_->presentation)
          return facebook::jsi::String::createFromUtf8(runtime,
              folly::toJson(folly::dynamic::object("lease", request.at("lease"))("released", true)));
        throw std::runtime_error("Native popLayout: module retired");
      }
      if (!self.pop_->presentation) {
        const auto binding = facebook::react::UIManagerBinding::getBinding(runtime);
        if (!binding) throw std::runtime_error("Native popLayout: calling Fabric binding unavailable");
        auto manager = std::shared_ptr<facebook::react::UIManager>(binding, &binding->getUIManager());
        self.pop_->presentation = std::make_unique<codon::motion::NativePopPresentation>(std::move(manager));
      }
      return facebook::jsi::String::createFromUtf8(runtime, self.pop_->presentation->request(encoded));
    } catch (const std::exception &failure) { throw facebook::jsi::JSError(runtime, failure.what()); }
  }
  static facebook::jsi::Value getPopFrame(
      facebook::jsi::Runtime &runtime, facebook::react::TurboModule &module,
      const facebook::jsi::Value *arguments, size_t count) {
    return readImmutableFrame(runtime, module, arguments, count, false);
  }
  static facebook::jsi::Value getViewportSnapshot(
      facebook::jsi::Runtime &runtime, facebook::react::TurboModule &module,
      const facebook::jsi::Value *arguments, size_t count) {
    return readImmutableFrame(runtime, module, arguments, count, true);
  }
  static facebook::jsi::Value readImmutableFrame(
      facebook::jsi::Runtime &runtime, facebook::react::TurboModule &module,
      const facebook::jsi::Value *arguments, size_t count, bool viewport) {
    const auto &self = static_cast<CUIMotionSnapshotJSI &>(module);
    if (!self.valid_->load() || count != 1 || !arguments[0].isString())
      throw facebook::jsi::JSError(runtime, "Native popLayout: active module/string request required");
    try {
      const auto binding = facebook::react::UIManagerBinding::getBinding(runtime);
      if (!binding) throw std::runtime_error("Native popLayout: calling Fabric binding unavailable");
      const auto encoded = arguments[0].getString(runtime).utf8(runtime);
      const auto response = viewport ? codon::motion::queryNativeViewport(binding->getUIManager(), encoded) :
          codon::motion::queryNativePopFrame(binding->getUIManager(), encoded);
      if (!self.valid_->load()) throw std::runtime_error("Native popLayout: module retired");
      return facebook::jsi::String::createFromUtf8(runtime, response);
    } catch (const std::exception &failure) {
      throw facebook::jsi::JSError(runtime, failure.what());
    }
  }
};

static BOOL CUISnapshotIdentityMatches(NSDictionary *request, NSDictionary *identity) {
  if (!identity) return NO;
  for (NSString *key in @[@"ownerId", @"bindingId", @"windowId", @"scopeOwnerId", @"nativeViewRevision"]) {
    if (![request[key] isKindOfClass:NSString.class] || ![request[key] isEqual:identity[key]]) return NO;
  }
  for (NSString *key in @[@"target", @"epoch", @"attachmentRevision"]) {
    id value = request[key];
    if (![value isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)value) == CFBooleanGetTypeID() || !std::isfinite([value doubleValue]) || ![value isEqual:identity[key]]) return NO;
  }
  return YES;
}

@implementation CUIMotionSnapshot {
  id<RCTSurfacePresenterStub> _presenter;
  std::shared_ptr<std::atomic<bool>> _valid;
  std::shared_ptr<CUIPopSession> _pop;
}
RCT_EXPORT_MODULE(CUIMotionSnapshot)
+ (BOOL)requiresMainQueueSetup { return NO; }
- (instancetype)init {
  if (self = [super init]) {
    _valid = std::make_shared<std::atomic<bool>>(true);
    _pop = std::make_shared<CUIPopSession>();
  }
  return self;
}
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }
- (void)setSurfacePresenter:(id<RCTSurfacePresenterStub>)presenter { _presenter = presenter; }
- (void)setBridge:(RCTBridge *)bridge { _presenter = bridge.surfacePresenter; }
- (void)invalidate { _valid->store(false); _pop->close(); }

- (void)getSnapshot:(NSString *)encoded resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [self readOwnedSnapshot:encoded initialValue:NO resolve:resolve reject:reject];
}

- (void)getInitialValue:(NSString *)encoded resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [self readOwnedSnapshot:encoded initialValue:YES resolve:resolve reject:reject];
}

- (void)readOwnedSnapshot:(NSString *)encoded initialValue:(BOOL)initialValue resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  RCTAssertMainQueue();
  @try {
    if (!_valid->load() || ![(id)_presenter isKindOfClass:RCTSurfacePresenter.class]) @throw [NSException exceptionWithName:@"CUI.MotionSnapshot" reason:@"motion-module-unavailable" userInfo:nil];
    NSError *parseError = nil;
    id request = [NSJSONSerialization JSONObjectWithData:[encoded dataUsingEncoding:NSUTF8StringEncoding] options:0 error:&parseError];
    if (parseError || ![request isKindOfClass:NSDictionary.class]) @throw [NSException exceptionWithName:@"CUI.MotionSnapshot" reason:@"motion-request-invalid" userInfo:nil];
    id rawTarget = request[@"target"], nonce = request[@"requestId"];
    if (![rawTarget isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)rawTarget) == CFBooleanGetTypeID() || !std::isfinite([rawTarget doubleValue]) || [rawTarget doubleValue] <= 0 || [rawTarget doubleValue] > INT_MAX || [rawTarget doubleValue] != std::floor([rawTarget doubleValue]) || ![nonce isKindOfClass:NSString.class] || ![nonce length]) @throw [NSException exceptionWithName:@"CUI.MotionSnapshot" reason:@"motion-request-invalid" userInfo:nil];
    RCTSurfacePresenter *presenter = (RCTSurfacePresenter *)_presenter;
    UIView *view = [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[rawTarget integerValue]];
    if (![view isKindOfClass:CUIFocusView.class]) @throw [NSException exceptionWithName:@"CUI.MotionSnapshot" reason:@"motion-actual-view-unavailable" userInfo:nil];
    NSDictionary *identity = [(CUIFocusView *)view motionSnapshotIdentity];
    if (!CUISnapshotIdentityMatches(request, identity)) @throw [NSException exceptionWithName:@"CUI.MotionSnapshot" reason:@"motion-owner-mismatch" userInfo:nil];
    RCTScheduler *scheduler = presenter.scheduler;
    if (!scheduler) @throw [NSException exceptionWithName:@"CUI.MotionSnapshot" reason:@"motion-scheduler-unavailable" userInfo:nil];
    auto manager = scheduler.uiManager;
    if (!manager) @throw [NSException exceptionWithName:@"CUI.MotionSnapshot" reason:@"motion-Fabric-unavailable" userInfo:nil];
    try {
      NSString *name = initialValue ? request[@"name"] : nil;
      if (initialValue && (![name isKindOfClass:NSString.class] || !name.length)) throw std::invalid_argument("motion-value-name-invalid");
      __block std::string result;
      if (initialValue) {
        [view.traitCollection performAsCurrentTraitCollection:^{
          const auto readColor = [view](facebook::react::SharedColor color) -> folly::dynamic {
            UIColor *source = color ? RCTUIColorFromSharedColor(color) : UIColor.clearColor;
            UIColor *resolved = [source resolvedColorWithTraitCollection:view.traitCollection];
            CGFloat red, green, blue, alpha;
            const BOOL available = resolved && [resolved getRed:&red green:&green blue:&blue alpha:&alpha];
            const BOOL wide = resolved && CGColorSpaceIsWideGamutRGB(CGColorGetColorSpace(resolved.CGColor));
            if (!available || wide || !std::isfinite(red) || !std::isfinite(green) || !std::isfinite(blue) || !std::isfinite(alpha) ||
                red < 0 || red > 1 || green < 0 || green > 1 || blue < 0 || blue > 1 || alpha < 0 || alpha > 1)
              throw std::runtime_error(wide ? "unsupported-native-color-space" : "unresolved-native-color");
            std::ostringstream encodedColor;
            encodedColor.imbue(std::locale::classic());
            encodedColor << std::setprecision(std::numeric_limits<CGFloat>::max_digits10)
                << "rgba(" << red * 255 << ", " << green * 255 << ", " << blue * 255 << ", " << alpha << ')';
            return encodedColor.str();
          };
          result = codon::motion::queryNativeInitialValue(*manager, [rawTarget intValue],
              [identity[@"ownerId"] UTF8String], [identity[@"bindingId"] UTF8String], [identity[@"nativeViewRevision"] UTF8String], [name UTF8String], readColor);
        }];
      } else {
        result = codon::motion::queryNativeFabricSnapshot(*manager, [rawTarget intValue],
            [identity[@"ownerId"] UTF8String], [identity[@"bindingId"] UTF8String], [identity[@"nativeViewRevision"] UTF8String]);
      }
      if (!_valid->load() || [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[rawTarget integerValue]] != view || !CUISnapshotIdentityMatches(identity, [(CUIFocusView *)view motionSnapshotIdentity])) throw std::runtime_error("motion-owner-retired");
      NSData *data = [[NSString stringWithUTF8String:result.c_str()] dataUsingEncoding:NSUTF8StringEncoding];
      NSMutableDictionary *response = [[NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingMutableContainers error:&parseError] mutableCopy];
      if (!response || parseError) throw std::runtime_error("motion-snapshot-invalid");
      [response addEntriesFromDictionary:identity]; response[@"requestId"] = nonce;
      NSData *serialized = [NSJSONSerialization dataWithJSONObject:response options:NSJSONWritingSortedKeys error:&parseError];
      if (!serialized || parseError) throw std::runtime_error("motion-snapshot-invalid");
      resolve([[NSString alloc] initWithData:serialized encoding:NSUTF8StringEncoding]);
    } catch (const std::exception &failure) { reject(initialValue ? @"E_CUI_MOTION_INITIAL_VALUE" : @"E_CUI_MOTION_SNAPSHOT", [NSString stringWithUTF8String:failure.what()], nil); }
  } @catch (NSException *failure) { reject(initialValue ? @"E_CUI_MOTION_INITIAL_VALUE" : @"E_CUI_MOTION_SNAPSHOT", failure.reason, nil); }
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<CUIMotionSnapshotJSI>(params, _valid, _pop);
}

- (NSString *)getPopFrame:(NSString *)request {
  @throw [NSException exceptionWithName:@"CUI.PopFrame" reason:@"getPopFrame requires its calling JSI runtime" userInfo:nil];
}
- (NSString *)popPresentation:(NSString *)request {
  @throw [NSException exceptionWithName:@"CUI.PopPresentation" reason:@"popPresentation requires its calling JSI runtime" userInfo:nil];
}
- (NSString *)getViewportSnapshot:(NSString *)request {
  @throw [NSException exceptionWithName:@"CUI.Viewport" reason:@"getViewportSnapshot requires its calling JSI runtime" userInfo:nil];
}

- (void)getTargetGeometry:(NSString *)encoded resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  RCTAssertMainQueue();
  @try {
    if (!_valid->load() || ![(id)_presenter isKindOfClass:RCTSurfacePresenter.class]) @throw [NSException exceptionWithName:@"CUI.MotionGeometry" reason:@"motion-module-unavailable" userInfo:nil];
    NSError *error = nil;
    id request = [NSJSONSerialization JSONObjectWithData:[encoded dataUsingEncoding:NSUTF8StringEncoding] options:0 error:&error];
    if (error || ![request isKindOfClass:NSDictionary.class]) @throw [NSException exceptionWithName:@"CUI.MotionGeometry" reason:@"motion-request-invalid" userInfo:nil];
    for (NSString *key in @[@"target", @"sampleTarget"]) {
      id value = request[key];
      if (![value isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)value) == CFBooleanGetTypeID() || !std::isfinite([value doubleValue]) || [value doubleValue] <= 0 || [value doubleValue] > INT_MAX || [value doubleValue] != std::floor([value doubleValue])) @throw [NSException exceptionWithName:@"CUI.MotionGeometry" reason:@"motion-target-invalid" userInfo:nil];
    }
    id nonce = request[@"requestId"];
    if (![nonce isKindOfClass:NSString.class] || ![nonce length]) @throw [NSException exceptionWithName:@"CUI.MotionGeometry" reason:@"motion-request-invalid" userInfo:nil];
    RCTSurfacePresenter *presenter = (RCTSurfacePresenter *)_presenter;
    UIView *owner = [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[request[@"target"] integerValue]];
    UIView *target = [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[request[@"sampleTarget"] integerValue]];
    if (![owner isKindOfClass:CUIFocusView.class] || !target.window || target.window != owner.window) @throw [NSException exceptionWithName:@"CUI.MotionGeometry" reason:@"motion-actual-target-window-unavailable" userInfo:nil];
    NSDictionary *identity = [(CUIFocusView *)owner motionSnapshotIdentity];
    if (!CUISnapshotIdentityMatches(request, identity)) @throw [NSException exceptionWithName:@"CUI.MotionGeometry" reason:@"motion-owner-mismatch" userInfo:nil];
    NSDictionary *ownerSnapshot = [CUIMotionGeometryObserver querySnapshotForView:owner], *targetSnapshot = [CUIMotionGeometryObserver querySnapshotForView:target];
    NSString *nativeOwnerIdentity = [ownerSnapshot[@"ancestors"] firstObject][@"identity"];
    if (![request[@"nativeOwnerIdentity"] isKindOfClass:NSString.class] || ![request[@"nativeOwnerIdentity"] isEqual:nativeOwnerIdentity]) @throw [NSException exceptionWithName:@"CUI.MotionGeometry" reason:@"motion-owner-retired" userInfo:nil];
    if (!_valid->load() || [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[request[@"target"] integerValue]] != owner || [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[request[@"sampleTarget"] integerValue]] != target || !target.window || target.window != owner.window || !CUISnapshotIdentityMatches(identity, [(CUIFocusView *)owner motionSnapshotIdentity])) @throw [NSException exceptionWithName:@"CUI.MotionGeometry" reason:@"motion-target-retired" userInfo:nil];
    NSMutableDictionary *result = [identity mutableCopy];
    [result addEntriesFromDictionary:@{@"kind": @"native-target-geometry", @"requestId": nonce, @"sampleTarget": request[@"sampleTarget"], @"nativeOwnerIdentity": nativeOwnerIdentity, @"ownerSnapshot": ownerSnapshot, @"targetSnapshot": targetSnapshot, @"observedAt": @(NSProcessInfo.processInfo.systemUptime * 1000)}];
    NSData *data = [NSJSONSerialization isValidJSONObject:result] ? [NSJSONSerialization dataWithJSONObject:result options:NSJSONWritingSortedKeys error:&error] : nil;
    if (!data || error) @throw [NSException exceptionWithName:@"CUI.MotionGeometry" reason:@"motion-geometry-invalid" userInfo:nil];
    resolve([[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]);
  } @catch (NSException *failure) { reject(@"E_CUI_MOTION_TARGET_GEOMETRY", failure.reason, nil); }
}
@end
