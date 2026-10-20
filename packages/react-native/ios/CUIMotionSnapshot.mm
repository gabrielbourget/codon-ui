#import <CodonNativeInputSpec/CodonNativeInputSpec.h>
#import <React/RCTInvalidating.h>
#import <React/RCTAssert.h>
#import <React/RCTSurfacePresenter.h>
#import <React/RCTScheduler.h>
#import "CUIFocusView.h"
#import "CUIMotionGeometryObserver.h"
#include "../cpp/motion/SnapshotQuery.h"
#include <atomic>
#include <cmath>
#include <climits>
#include <stdexcept>

@interface CUIMotionSnapshot : NativeCUIMotionSnapshotSpecBase <NativeCUIMotionSnapshotSpec, RCTInvalidating>
@end

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
  std::atomic<bool> _valid;
}
RCT_EXPORT_MODULE(CUIMotionSnapshot)
+ (BOOL)requiresMainQueueSetup { return NO; }
- (instancetype)init { if (self = [super init]) _valid.store(true); return self; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }
- (void)setSurfacePresenter:(id<RCTSurfacePresenterStub>)presenter { _presenter = presenter; }
- (void)setBridge:(RCTBridge *)bridge { _presenter = bridge.surfacePresenter; }
- (void)invalidate { _valid.store(false); }

- (void)getSnapshot:(NSString *)encoded resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  RCTAssertMainQueue();
  @try {
    if (!_valid.load() || ![(id)_presenter isKindOfClass:RCTSurfacePresenter.class]) @throw [NSException exceptionWithName:@"CUI.MotionSnapshot" reason:@"motion-module-unavailable" userInfo:nil];
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
      auto result = codon::motion::queryNativeFabricSnapshot(*manager, [rawTarget intValue],
          [identity[@"ownerId"] UTF8String], [identity[@"bindingId"] UTF8String], [identity[@"nativeViewRevision"] UTF8String]);
      if (!_valid.load() || [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[rawTarget integerValue]] != view || !CUISnapshotIdentityMatches(identity, [(CUIFocusView *)view motionSnapshotIdentity])) throw std::runtime_error("motion-owner-retired");
      NSData *data = [[NSString stringWithUTF8String:result.c_str()] dataUsingEncoding:NSUTF8StringEncoding];
      NSMutableDictionary *response = [[NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingMutableContainers error:&parseError] mutableCopy];
      if (!response || parseError) throw std::runtime_error("motion-snapshot-invalid");
      [response addEntriesFromDictionary:identity]; response[@"requestId"] = nonce;
      NSData *serialized = [NSJSONSerialization dataWithJSONObject:response options:NSJSONWritingSortedKeys error:&parseError];
      if (!serialized || parseError) throw std::runtime_error("motion-snapshot-invalid");
      resolve([[NSString alloc] initWithData:serialized encoding:NSUTF8StringEncoding]);
    } catch (const std::exception &failure) { reject(@"E_CUI_MOTION_SNAPSHOT", [NSString stringWithUTF8String:failure.what()], nil); }
  } @catch (NSException *failure) { reject(@"E_CUI_MOTION_SNAPSHOT", failure.reason, nil); }
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeCUIMotionSnapshotSpecJSI>(params);
}

- (void)getTargetGeometry:(NSString *)encoded resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  RCTAssertMainQueue();
  @try {
    if (!_valid.load() || ![(id)_presenter isKindOfClass:RCTSurfacePresenter.class]) @throw [NSException exceptionWithName:@"CUI.MotionGeometry" reason:@"motion-module-unavailable" userInfo:nil];
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
    if (!_valid.load() || [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[request[@"target"] integerValue]] != owner || [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[request[@"sampleTarget"] integerValue]] != target || !target.window || target.window != owner.window || !CUISnapshotIdentityMatches(identity, [(CUIFocusView *)owner motionSnapshotIdentity])) @throw [NSException exceptionWithName:@"CUI.MotionGeometry" reason:@"motion-target-retired" userInfo:nil];
    NSMutableDictionary *result = [identity mutableCopy];
    [result addEntriesFromDictionary:@{@"kind": @"native-target-geometry", @"requestId": nonce, @"sampleTarget": request[@"sampleTarget"], @"nativeOwnerIdentity": nativeOwnerIdentity, @"ownerSnapshot": ownerSnapshot, @"targetSnapshot": targetSnapshot, @"observedAt": @(NSProcessInfo.processInfo.systemUptime * 1000)}];
    NSData *data = [NSJSONSerialization isValidJSONObject:result] ? [NSJSONSerialization dataWithJSONObject:result options:NSJSONWritingSortedKeys error:&error] : nil;
    if (!data || error) @throw [NSException exceptionWithName:@"CUI.MotionGeometry" reason:@"motion-geometry-invalid" userInfo:nil];
    resolve([[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]);
  } @catch (NSException *failure) { reject(@"E_CUI_MOTION_TARGET_GEOMETRY", failure.reason, nil); }
}
@end
