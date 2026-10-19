#import <CodonNativeInputSpec/CodonNativeInputSpec.h>
#import <React/RCTInvalidating.h>
#import <React/RCTAssert.h>
#import <React/RCTSurfacePresenter.h>
#import <React/RCTScheduler.h>
#import "CUIFocusView.h"
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
@end
