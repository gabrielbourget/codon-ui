#import <CodonNativeInputSpec/CodonNativeInputSpec.h>
#import "CUIFormDocumentInspection.h"
#import "CUIFormMetadata.h"
#import "CUIFormFieldFocus.h"
#import "CUIFocusView.h"
#import <React/RCTAssert.h>
#import <React/RCTInvalidating.h>
#import <React/RCTScheduler.h>
#import <React/RCTSurfacePresenter.h>
#include "../cpp/form/FormDocumentQuery.h"
#include <atomic>
#include <cmath>
#include <climits>
#include <stdexcept>

static NSDictionary *CUIAdmitFormAction(RCTSurfacePresenter *presenter, NSDictionary *document, NSDictionary *request)
{
  if (![request isKindOfClass:NSDictionary.class] || ![request[@"lease"] isKindOfClass:NSDictionary.class] ||
      ![request[@"form"] isKindOfClass:NSDictionary.class] || ![request[@"documentId"] isEqual:document[@"documentId"]] ||
      ![request[@"revision"] isEqual:document[@"revision"]])
    @throw [NSException exceptionWithName:@"CUI.Form" reason:@"form-action-document-retired" userInfo:nil];
  NSDictionary *lease = request[@"lease"], *form = request[@"form"];
  BOOL found = NO;
  for (NSDictionary *candidate in document[@"forms"]) if ([candidate isEqual:form]) found = YES;
  if (!found || ![lease[@"target"] isEqual:document[@"target"]] || ![lease[@"surfaceId"] isEqual:document[@"surfaceId"]])
    @throw [NSException exceptionWithName:@"CUI.Form" reason:@"form-action-association-retired" userInfo:nil];
  UIView *target = [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[lease[@"target"] integerValue]];
  CUIFormRoot *metadata = (id)[presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[form[@"metadataTarget"] integerValue]];
  UIView *original = [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[form[@"target"] integerValue]];
  if (![target isKindOfClass:CUIFocusView.class] || ![metadata isKindOfClass:CUIFormRoot.class] ||
      ![original isKindOfClass:RCTViewComponentView.class] || !metadata.isMetadataOnly || metadata.originalTarget != original.tag ||
      ![metadata.ownerId isEqual:form[@"ownerId"]] || ![metadata.descriptorId isEqual:form[@"descriptorId"]] ||
      ![metadata.descriptorRevision isEqual:form[@"descriptorRevision"]])
    @throw [NSException exceptionWithName:@"CUI.Form" reason:@"form-action-original-target-retired" userInfo:nil];
  NSDictionary *current = [(CUIFocusView *)target formActionSnapshot];
  NSData *expectedBytes = [NSJSONSerialization dataWithJSONObject:lease options:NSJSONWritingSortedKeys error:nil];
  NSData *currentBytes = current ? [NSJSONSerialization dataWithJSONObject:current options:NSJSONWritingSortedKeys error:nil] : nil;
  if (!currentBytes || ![currentBytes isEqual:expectedBytes] || ![current[@"attached"] boolValue] ||
      ![current[@"active"] boolValue] || ![current[@"enabled"] boolValue])
    @throw [NSException exceptionWithName:@"CUI.Form" reason:@"form-action-native-lease-retired" userInfo:nil];
  return @{@"accepted":@YES, @"lease":current, @"documentId":document[@"documentId"], @"revision":document[@"revision"],
    @"formDescriptorId":form[@"descriptorId"], @"formDescriptorRevision":form[@"descriptorRevision"]};
}

@interface CUIFormDocument : NativeCUIFormDocumentSpecBase <NativeCUIFormDocumentSpec, RCTInvalidating>
@end

@implementation CUIFormDocument {
  id<RCTSurfacePresenterStub> _presenter;
  std::atomic<bool> _valid;
  std::unique_ptr<codon::form::NativeFormDocumentSession> _session;
}
RCT_EXPORT_MODULE(CUIFormDocument)
+ (BOOL)requiresMainQueueSetup { return NO; }
- (instancetype)init
{
  if (self = [super init]) { _valid.store(true); _session = std::make_unique<codon::form::NativeFormDocumentSession>([NSUUID.UUID.UUIDString UTF8String]); }
  return self;
}
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }
- (void)setSurfacePresenter:(id<RCTSurfacePresenterStub>)presenter { _presenter = presenter; }
- (void)setBridge:(RCTBridge *)bridge { _presenter = bridge.surfacePresenter; }
- (void)invalidate { _valid.store(false); }
- (void)getSnapshot:(NSString *)encoded resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [self performRequest:encoded focus:NO resolve:resolve reject:reject];
}
- (void)focusField:(NSString *)encoded resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [self performRequest:encoded focus:YES resolve:resolve reject:reject];
}
- (void)performRequest:(NSString *)encoded focus:(BOOL)focus resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  RCTAssertMainQueue();
  @try {
    if (!_valid.load() || ![(id)_presenter isKindOfClass:RCTSurfacePresenter.class])
      @throw [NSException exceptionWithName:@"CUI.Form" reason:@"form-module-retired" userInfo:nil];
    NSError *error = nil;
    id request = [NSJSONSerialization JSONObjectWithData:[encoded dataUsingEncoding:NSUTF8StringEncoding] options:0 error:&error];
    if (error || ![request isKindOfClass:NSDictionary.class])
      @throw [NSException exceptionWithName:@"CUI.Form" reason:@"form-request-invalid" userInfo:nil];
    id target = request[@"target"], surface = request[@"surfaceId"], nonce = request[@"requestId"];
    for (id value in (surface ? @[target ?: NSNull.null, surface] : @[target ?: NSNull.null])) {
      if (![value isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)value) == CFBooleanGetTypeID() ||
          !std::isfinite([value doubleValue]) || [value doubleValue] <= 0 || [value doubleValue] > INT_MAX ||
          [value doubleValue] != std::floor([value doubleValue]))
        @throw [NSException exceptionWithName:@"CUI.Form" reason:@"form-target-invalid" userInfo:nil];
    }
    if (![nonce isKindOfClass:NSString.class] || ![nonce length])
      @throw [NSException exceptionWithName:@"CUI.Form" reason:@"form-request-id-invalid" userInfo:nil];
    RCTSurfacePresenter *presenter = (RCTSurfacePresenter *)_presenter;
    auto manager = presenter.scheduler.uiManager;
    if (!manager) @throw [NSException exceptionWithName:@"CUI.Form" reason:@"form-Fabric-unavailable" userInfo:nil];
    try {
      const auto check = [&] { if (!_valid.load()) throw std::runtime_error("Native form: module retired"); };
      const auto result = codon::form::queryFabricFormDocument(*manager, [surface intValue], [target intValue], *_session, check);
      NSMutableDictionary *response = [[NSJSONSerialization JSONObjectWithData:[[NSString stringWithUTF8String:result.c_str()] dataUsingEncoding:NSUTF8StringEncoding] options:NSJSONReadingMutableContainers error:&error] mutableCopy];
      if (!response || error) throw std::runtime_error("Native form: invalid snapshot encoding");
      response[@"requestId"] = nonce;
      if (focus) {
        NSString *origin = request[@"origin"];
        if (!([origin isEqual:@"native"] && request[@"actionAdmission"]) &&
            !([origin isEqual:@"programmatic"] && !request[@"actionAdmission"]))
          throw std::runtime_error("Native form: focus origin invalid");
        if (request[@"inspect"]) throw std::runtime_error("Native form: focus inspection not admitted");
      }
      if (request[@"actionAdmission"]) {
        response[@"actionAdmission"] = CUIAdmitFormAction(presenter, response, request[@"actionAdmission"]);
        if (result != codon::form::queryFabricFormDocument(*manager, [surface intValue], [target intValue], *_session, check))
          throw std::runtime_error("Native form: document retired during action admission");
      }
      if ([request[@"inspect"] isEqual:@YES]) {
        id control = request[@"controlTarget"];
        if (control && (![control isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)control) == CFBooleanGetTypeID() || !std::isfinite([control doubleValue]) || [control doubleValue] <= 0 || [control doubleValue] > INT_MAX || [control doubleValue] != std::floor([control doubleValue])))
          throw std::runtime_error("Native form: invalid control target");
        response[@"inspection"] = CUIInspectFormDocument(presenter, response, [request[@"probeCustomContent"] isEqual:@YES], control);
        if (result != codon::form::queryFabricFormDocument(*manager, [surface intValue], [target intValue], *_session, check))
          throw std::runtime_error("Native form: document retired during inspection");
      }
      if (focus) {
        response[@"focus"] = CUIFocusFormField(presenter, response, request, ^BOOL {
          @try {
            try {
              if (!_valid.load()) return NO;
              if (request[@"actionAdmission"]) CUIAdmitFormAction(presenter, response, request[@"actionAdmission"]);
              return result == codon::form::queryFabricFormDocument(*manager, [surface intValue], [target intValue], *_session, check);
            } catch (...) { return NO; }
          } @catch (NSException *retired) { return NO; }
        });
      }
      NSData *data = [NSJSONSerialization dataWithJSONObject:response options:NSJSONWritingSortedKeys error:&error];
      if (!data || error) throw std::runtime_error("Native form: invalid snapshot encoding");
      resolve([[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]);
    } catch (const std::exception &failure) { reject(@"E_CUI_FORM_DOCUMENT", [NSString stringWithUTF8String:failure.what()], nil); }
  } @catch (NSException *failure) { reject(@"E_CUI_FORM_DOCUMENT", failure.reason, nil); }
}
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeCUIFormDocumentSpecJSI>(params);
}
@end
