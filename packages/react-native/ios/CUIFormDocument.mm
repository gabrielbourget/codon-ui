#import <CodonNativeInputSpec/CodonNativeInputSpec.h>
#import "CUIFormDocumentInspection.h"
#import "CUIFormMetadata.h"
#import "CUIFormFieldFocus.h"
#import "CUIFieldSemantics.h"
#import "CUICollectionRoot.h"
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
  NSMapTable<CUIFormMetadataView *, NSString *> *_semanticHosts;
  NSString *_semanticModuleId;
  NSDictionary *_semanticDocumentStamp, *_semanticDocument;
  NSDictionary<NSNumber *, NSDictionary *> *_semanticNodes, *_semanticFields;
}
RCT_EXPORT_MODULE(CUIFormDocument)
+ (BOOL)requiresMainQueueSetup { return NO; }
- (instancetype)init
{
  if (self = [super init]) {
    _valid.store(true); _session = std::make_unique<codon::form::NativeFormDocumentSession>([NSUUID.UUID.UUIDString UTF8String]);
    _semanticModuleId = NSUUID.UUID.UUIDString; _semanticHosts = [NSMapTable weakToStrongObjectsMapTable];
  }
  return self;
}
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }
- (void)setSurfacePresenter:(id<RCTSurfacePresenterStub>)presenter { _presenter = presenter; }
- (void)setBridge:(RCTBridge *)bridge { _presenter = bridge.surfacePresenter; }
- (void)invalidate
{
  _valid.store(false);
  dispatch_async(dispatch_get_main_queue(), ^{
    for (CUIFormMetadataView *metadata in _semanticHosts.keyEnumerator)
      [metadata clearSemanticRefreshForOwner:[_semanticHosts objectForKey:metadata]];
    [_semanticHosts removeAllObjects];
    _semanticDocument = nil; _semanticDocumentStamp = nil; _semanticNodes = nil; _semanticFields = nil;
  });
}
- (NSDictionary *)fieldDocumentStampForSurface:(NSInteger)surface
{
  if (!_valid.load() || ![(id)_presenter isKindOfClass:RCTSurfacePresenter.class])
    @throw [NSException exceptionWithName:@"CUI.Field" reason:@"field-module-retired" userInfo:nil];
  RCTSurfacePresenter *presenter = (id)_presenter;
  auto manager = presenter.scheduler.uiManager;
  if (!manager) @throw [NSException exceptionWithName:@"CUI.Field" reason:@"field-Fabric-unavailable" userInfo:nil];
  try {
    const auto result = codon::form::queryFabricFormDocumentStamp(*manager, (int)surface, *_session, [&] {
      if (!_valid.load()) throw std::runtime_error("field-module-retired");
    });
    NSDictionary *stamp = [NSJSONSerialization JSONObjectWithData:[[NSString stringWithUTF8String:result.c_str()] dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    if (!stamp) throw std::runtime_error("field-document-stamp-invalid");
    return stamp;
  } catch (const std::exception &failure) {
    @throw [NSException exceptionWithName:@"CUI.Field" reason:[NSString stringWithUTF8String:failure.what()] userInfo:nil];
  }
}
- (NSDictionary *)fieldDocumentForTarget:(NSInteger)target surface:(NSInteger)surface
{
  NSDictionary *stamp = [self fieldDocumentStampForSurface:surface];
  if ([_semanticDocumentStamp isEqual:stamp] && _semanticNodes[@(target)]) {
    NSMutableDictionary *scoped = [_semanticDocument mutableCopy]; scoped[@"target"] = @(target); return scoped;
  }
  if (!_valid.load() || ![(id)_presenter isKindOfClass:RCTSurfacePresenter.class])
    @throw [NSException exceptionWithName:@"CUI.Field" reason:@"field-module-retired" userInfo:nil];
  RCTSurfacePresenter *presenter = (id)_presenter;
  auto manager = presenter.scheduler.uiManager;
  if (!manager) @throw [NSException exceptionWithName:@"CUI.Field" reason:@"field-Fabric-unavailable" userInfo:nil];
  try {
    const auto result = codon::form::queryFabricFormDocument(*manager, (int)surface, (int)target, *_session, [&] {
      if (!_valid.load()) throw std::runtime_error("field-module-retired");
    });
    NSDictionary *document = [NSJSONSerialization JSONObjectWithData:[[NSString stringWithUTF8String:result.c_str()] dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    if (!document) throw std::runtime_error("field-document-invalid");
    NSDictionary *after = [self fieldDocumentStampForSurface:surface];
    for (NSString *key in @[@"documentId", @"surfaceId", @"rootTarget", @"revision"])
      if (![document[key] isEqual:after[key]]) throw std::runtime_error("field-document-retired-during-read");
    NSMutableDictionary *nodes = [NSMutableDictionary new], *fields = [NSMutableDictionary new];
    for (NSDictionary *node in document[@"nodes"]) nodes[node[@"target"]] = node;
    for (NSDictionary *field in document[@"fields"]) fields[field[@"metadataTarget"]] = field;
    // Cache metadata only for one exact revision; no editor props, values or
    // ShadowNodes are retained. Getter guards use the cheap native stamp.
    _semanticDocument = document; _semanticDocumentStamp = after; _semanticNodes = [nodes copy]; _semanticFields = [fields copy];
    return document;
  } catch (const std::exception &failure) {
    @throw [NSException exceptionWithName:@"CUI.Field" reason:[NSString stringWithUTF8String:failure.what()] userInfo:nil];
  }
}
- (void)refreshField:(CUIFieldBinding *)metadata core:(RCTTextInputComponentView *)core owner:(NSString *)owner descriptor:(NSString *)descriptor
{
  [metadata setSemanticContribution:nil];
  NSDictionary *mount = [metadata formMountSnapshot];
  if (!_valid.load() || !core || ![metadata.ownerId isEqual:owner] || ![metadata.descriptorId isEqual:descriptor] ||
      [metadata originalForMountSnapshot:mount] != core || !metadata.semanticBinding.length) {
    [metadata resetSemanticAccessibilityFocus]; return;
  }
  RCTSurfacePresenter *presenter = (id)_presenter;
  if ([presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:core.tag] != core) return;
  NSDictionary *document = [self fieldDocumentForTarget:core.tag surface:[mount[@"surfaceId"] integerValue]];
  NSDictionary *field = _semanticFields[@(metadata.tag)], *node = _semanticNodes[@(metadata.tag)];
  NSDictionary *plan = node[@"semanticPlan"];
  NSString *encoded = [metadata.semanticBinding copy], *revision = [metadata.descriptorRevision copy];
  if (!field || ![field[@"ownerId"] isEqual:owner] || ![field[@"descriptorId"] isEqual:descriptor] ||
      ![field[@"descriptorRevision"] isEqual:revision] || [field[@"target"] integerValue] != core.tag ||
      ![node[@"fieldSemantics"] isEqual:encoded] || ![plan isKindOfClass:NSDictionary.class]) { [metadata resetSemanticAccessibilityFocus]; return; }
  UIView *editor = core.accessibilityElement;
  __weak CUIFormDocument *weakSelf = self;
  __weak CUIFieldBinding *weakMetadata = metadata;
  __weak RCTTextInputComponentView *weakCore = core;
  __weak UIView *weakEditor = editor;
  NSString *documentId = document[@"documentId"], *documentRevision = document[@"revision"];
  BOOL (^current)(void) = ^BOOL {
    CUIFormDocument *module = weakSelf; CUIFieldBinding *binding = weakMetadata;
    RCTTextInputComponentView *original = weakCore; UIView *backed = weakEditor;
    @try {
      if (!module || !module->_valid.load() || !binding || !original || !backed ||
          original.accessibilityElement != backed || ![binding.ownerId isEqual:owner] || ![binding.descriptorId isEqual:descriptor] ||
          ![binding.descriptorRevision isEqual:revision] || ![binding.semanticBinding isEqual:encoded] ||
          [binding originalForMountSnapshot:mount] != original) return NO;
      NSDictionary *latest = [module fieldDocumentStampForSurface:[mount[@"surfaceId"] integerValue]];
      return [latest[@"documentId"] isEqual:documentId] && [latest[@"revision"] isEqual:documentRevision];
    } @catch (NSException *retired) { return NO; }
  };
  id<CUIFieldSemanticContribution> contribution = CUIBindFieldSemantics(presenter, core, plan, current);
  [metadata setSemanticContribution:contribution];
  if (!contribution || !current() || !editor.isFirstResponder || [plan[@"disabled"] boolValue]) { [metadata resetSemanticAccessibilityFocus]; return; }
  NSDictionary *active = [plan[@"activeDescendant"] isKindOfClass:NSDictionary.class] ? plan[@"activeDescendant"] : nil;
  if (active) {
    NSString *serialized = active[@"binding"];
    NSDictionary *binding = [NSJSONSerialization JSONObjectWithData:[serialized dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    CUICollectionRoot *root = (id)[presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[binding[@"target"] integerValue]];
    UIView *option = [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[active[@"target"] integerValue]];
    if ([root isKindOfClass:CUICollectionRoot.class] && option.window == editor.window &&
        [root acceptsPointerBinding:serialized visibleTarget:option.tag] && current())
      [metadata requestSemanticAccessibilityFocus:option identity:binding[@"descriptorId"] returningToEditor:NO];
    else [metadata resetSemanticAccessibilityFocus];
  } else if (![plan[@"expanded"] boolValue]) {
    [metadata requestSemanticAccessibilityFocus:editor identity:descriptor returningToEditor:YES];
  } else [metadata resetSemanticAccessibilityFocus];
}
- (void)bindField:(NSString *)encoded resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  RCTAssertMainQueue();
  @try {
    NSDictionary *request = [NSJSONSerialization JSONObjectWithData:[encoded dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    NSDictionary *mount = [request isKindOfClass:NSDictionary.class] ? request[@"mount"] : nil;
    NSString *nonce = request[@"requestId"];
    if (![mount isKindOfClass:NSDictionary.class] || ![nonce isKindOfClass:NSString.class] || !nonce.length || !_valid.load())
      @throw [NSException exceptionWithName:@"CUI.Field" reason:@"field-binding-request-invalid" userInfo:nil];
    RCTSurfacePresenter *presenter = (id)_presenter;
    CUIFieldBinding *metadata = (id)[presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[mount[@"target"] integerValue]];
    RCTTextInputComponentView *core = (id)[presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[mount[@"originalTarget"] integerValue]];
    if (![metadata isKindOfClass:CUIFieldBinding.class] || ![core isKindOfClass:RCTTextInputComponentView.class] ||
        [metadata originalForMountSnapshot:mount] != core || ![metadata.semanticBinding isEqual:request[@"semanticBinding"]])
      @throw [NSException exceptionWithName:@"CUI.Field" reason:@"field-binding-original-editor-retired" userInfo:nil];
    NSString *owner = [metadata.ownerId copy], *descriptor = [metadata.descriptorId copy];
    NSString *token = [NSString stringWithFormat:@"%@:binding:%@", _semanticModuleId, nonce];
    __weak CUIFormDocument *weakSelf = self; __weak CUIFieldBinding *weakMetadata = metadata; __weak RCTTextInputComponentView *weakCore = core;
    [metadata setSemanticRefresh:^{
      CUIFormDocument *module = weakSelf; CUIFieldBinding *binding = weakMetadata;
      if (!module || !binding) { [binding setSemanticContribution:nil]; return; }
      [module refreshField:binding core:weakCore owner:owner descriptor:descriptor];
    } owner:token];
    [_semanticHosts setObject:token forKey:metadata];
    NSDictionary *result = @{@"requestId":nonce, @"ownerToken":token, @"metadataTarget":@(metadata.tag)};
    resolve([[NSString alloc] initWithData:[NSJSONSerialization dataWithJSONObject:result options:NSJSONWritingSortedKeys error:nil] encoding:NSUTF8StringEncoding]);
  } @catch (NSException *failure) { reject(@"E_CUI_FIELD_BINDING", failure.reason, nil); }
}
- (void)unbindField:(NSString *)encoded resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  RCTAssertMainQueue();
  @try {
    NSDictionary *request = [NSJSONSerialization JSONObjectWithData:[encoded dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    CUIFormMetadataView *metadata = (id)[(RCTSurfacePresenter *)_presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[request[@"metadataTarget"] integerValue]];
    NSString *token = request[@"ownerToken"];
    BOOL owned = [metadata isKindOfClass:CUIFieldBinding.class] && [token isKindOfClass:NSString.class] &&
      [[_semanticHosts objectForKey:metadata] isEqual:token];
    if (owned) { [metadata clearSemanticRefreshForOwner:token]; [_semanticHosts removeObjectForKey:metadata]; }
    resolve(@(owned));
  } @catch (NSException *failure) { reject(@"E_CUI_FIELD_BINDING", failure.reason, nil); }
}
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
