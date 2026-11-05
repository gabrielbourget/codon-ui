#import <CodonNativeInputSpec/CodonNativeInputSpec.h>
#import "CUIFieldGroupDocument.h"
#import "CUIFormMetadata.h"
#import "CUIFormFieldFocus.h"
#import "CUIFieldSemantics.h"
#import "CUIOwnedDateField.h"
#import "CUICollectionRoot.h"
#import "CUIFocusView.h"
#import <React/RCTAssert.h>
#import <React/RCTInvalidating.h>
#import <React/RCTSurfacePresenter.h>
#include <atomic>
#include <cmath>
#include <climits>
#include <functional>
#include <stdexcept>

static void CUIFormFail(NSString *reason)
{
  @throw [NSException exceptionWithName:@"CUI.Form" reason:reason userInfo:nil];
}
static CUIFormMetadataView *CUIFormOriginal(RCTSurfacePresenter *presenter, NSDictionary *descriptor, BOOL field)
{
  if (![descriptor isKindOfClass:NSDictionary.class]) CUIFormFail(@"form-descriptor-invalid");
  CUIFormMetadataView *metadata = (id)[presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[descriptor[@"metadataTarget"] integerValue]];
  UIView *original = [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[descriptor[@"target"] integerValue]];
  if (![metadata isKindOfClass:CUIFormMetadataView.class] || metadata.isFieldBinding != field ||
      ![metadata.ownerId isEqual:descriptor[@"ownerId"]] || ![metadata.descriptorId isEqual:descriptor[@"descriptorId"]] ||
      ![metadata.descriptorRevision isEqual:descriptor[@"descriptorRevision"]] || metadata.originalTarget != original.tag ||
      !original || !metadata.isMetadataOnly ||
      (field && (![metadata.ownedEditorBinding isEqual:(descriptor[@"ownedEditorBinding"] ?: @"")] ||
        ![metadata.ownedControlBinding isEqual:(descriptor[@"ownedControlBinding"] ?: @"")]))) CUIFormFail(@"form-original-retired");
  return metadata;
}
// The explicit model supplies membership/order. This checks only its exact original native hosts.
static void CUIAdmitFormOriginals(RCTSurfacePresenter *presenter, NSDictionary *request)
{
  CUIFormMetadataView *form = CUIFormOriginal(presenter, request[@"form"], NO);
  NSDictionary *formMount = request[@"formMount"];
  UIView *root = [form originalForAttachedMountSnapshot:formMount];
  if (!root || !root.window.isKeyWindow) CUIFormFail(@"form-original-retired");
  id fields = request[@"fields"];
  if (![fields isKindOfClass:NSArray.class]) CUIFormFail(@"form-fields-invalid");
  NSMutableSet *targets = [NSMutableSet new];
  for (NSDictionary *row in fields) {
    CUIFormMetadataView *field = CUIFormOriginal(presenter, row[@"field"], YES);
    NSDictionary *mount = row[@"mount"];
    UIView *original = [field originalForAttachedMountSnapshot:mount];
    if (!original || original.window != root.window || ![mount[@"surfaceId"] isEqual:formMount[@"surfaceId"]] ||
        [targets containsObject:@(original.tag)]) CUIFormFail(@"form-field-original-retired");
    [targets addObject:@(original.tag)];
  }
  NSDictionary *lease = request[@"actionLease"];
  if (lease) {
    CUIFocusView *action = (id)[presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[lease[@"target"] integerValue]];
    NSDictionary *current = [action isKindOfClass:CUIFocusView.class] ? [action formActionSnapshot] : nil;
    if (![current isEqual:lease] || ![current[@"active"] boolValue] || ![current[@"attached"] boolValue] ||
        ![current[@"enabled"] boolValue] || action.window != root.window ||
        ![current[@"surfaceId"] isEqual:formMount[@"surfaceId"]]) CUIFormFail(@"form-action-native-lease-retired");
  }
}

@interface CUIFormDocument : NativeCUIFormDocumentSpecBase <NativeCUIFormDocumentSpec, RCTInvalidating>
@end

static BOOL CUIIsComboBoxFormTrigger(CUIFormMetadataView *metadata, RCTViewComponentView *original)
{
  if (![original isKindOfClass:CUIFocusView.class]) return NO;
  id control = [NSJSONSerialization JSONObjectWithData:[metadata.ownedControlBinding dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
  return [control isKindOfClass:NSDictionary.class] && [control count] == 2 && [control[@"kind"] isEqual:@"combo-box-trigger"];
}

@implementation CUIFormDocument {
  id<RCTSurfacePresenterStub> _presenter;
  std::atomic<bool> _valid;
  NSMapTable<CUIFormMetadataView *, NSString *> *_semanticHosts;
  NSString *_semanticModuleId;
}
RCT_EXPORT_MODULE(CUIFormDocument)
+ (BOOL)requiresMainQueueSetup { return NO; }
- (instancetype)init
{
  if (self = [super init]) {
    _valid.store(true);
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
      [metadata clearSemanticRefreshForOwner:[_semanticHosts objectForKey:metadata] retiring:YES];
    [_semanticHosts removeAllObjects];
  });
}
- (void)refreshField:(CUIFieldBinding *)metadata core:(RCTViewComponentView *)core owner:(NSString *)owner descriptor:(NSString *)descriptor
{
  [metadata setSemanticContribution:nil];
  NSDictionary *mount = [metadata formMountSnapshot];
  if (!_valid.load() || !core || ![metadata.ownerId isEqual:owner] || ![metadata.descriptorId isEqual:descriptor] ||
      [metadata originalForMountSnapshot:mount] != core || !metadata.semanticBinding.length) {
    [metadata resetSemanticAccessibilityFocus]; return;
  }
  RCTSurfacePresenter *presenter = (id)_presenter;
  if ([presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:core.tag] != core) { [metadata resetSemanticAccessibilityFocus]; return; }
  NSString *encoded = [metadata.semanticBinding copy], *revision = [metadata.descriptorRevision copy];
  NSDictionary *plan = [NSJSONSerialization JSONObjectWithData:[encoded dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
  if (![plan isKindOfClass:NSDictionary.class] || ![plan[@"text"] isKindOfClass:NSDictionary.class]) {
    [metadata resetSemanticAccessibilityFocus]; return;
  }
  if (CUIIsComboBoxFormTrigger(metadata, core)) {
    // The trigger uses current RN field props; modal options own their separate focus.
    [metadata resetSemanticAccessibilityFocus]; return;
  }
  id accessible = core.accessibilityElement;
  UIView *editor = [accessible isKindOfClass:UIView.class] ? (UIView *)accessible : nil;
  if (!editor) { [metadata resetSemanticAccessibilityFocus]; return; }
  __weak CUIFormDocument *weakSelf = self;
  __weak CUIFieldBinding *weakMetadata = metadata;
  __weak RCTViewComponentView *weakCore = core;
  __weak UIView *weakEditor = editor;
  BOOL (^current)(void) = ^BOOL {
    CUIFormDocument *module = weakSelf; CUIFieldBinding *binding = weakMetadata;
    RCTViewComponentView *original = weakCore; UIView *backed = weakEditor;
    @try {
      if (!module || !module->_valid.load() || !binding || !original || !backed ||
          original.accessibilityElement != backed || ![binding.ownerId isEqual:owner] || ![binding.descriptorId isEqual:descriptor] ||
          ![binding.descriptorRevision isEqual:revision] || ![binding.semanticBinding isEqual:encoded] ||
          [binding originalForMountSnapshot:mount] != original) return NO;
      return YES;
    } @catch (NSException *retired) { return NO; }
  };
  const BOOL dateField = [core isKindOfClass:CUIDateSegment.class];
  if (dateField != (plan[@"dateField"] != nil)) { [metadata resetSemanticAccessibilityFocus]; return; }
  if (dateField) {
    [metadata setSemanticContribution:CUIBindDateFieldSemantics(presenter,
      CUIResolveOwnedDateFieldSegments(metadata, metadata.ownedEditorBinding, core.tag, [mount[@"surfaceId"] integerValue]), plan, current)];
    [metadata resetSemanticAccessibilityFocus]; return;
  }
  if (!current() || !editor.isFirstResponder || [plan[@"disabled"] boolValue]) { [metadata resetSemanticAccessibilityFocus]; return; }
  if (![plan[@"expanded"] boolValue]) {
    if (current()) [metadata requestSemanticAccessibilityFocus:editor identity:descriptor editor:editor returningToEditor:YES];
    else [metadata resetSemanticAccessibilityFocus];
    return;
  }
  NSDictionary *active = [plan[@"activeDescendant"] isKindOfClass:NSDictionary.class] ? plan[@"activeDescendant"] : nil;
  if (active) {
    CUICollectionOptionAdmission *admission = CUIResolveCurrentCollectionOption(
      active[@"binding"], [active[@"target"] integerValue], editor, current);
    if (admission && admission.current)
      [metadata requestSemanticAccessibilityFocus:admission.originalOption identity:admission.opaqueFocusIdentity editor:editor returningToEditor:NO];
    else if (current()) [metadata clearSemanticAccessibilityRequest];
    else [metadata resetSemanticAccessibilityFocus];
  } else [metadata clearSemanticAccessibilityRequest];
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
    RCTViewComponentView *core = (id)[presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[mount[@"originalTarget"] integerValue]];
    if (![metadata isKindOfClass:CUIFieldBinding.class] || (![core isKindOfClass:RCTTextInputComponentView.class] && ![core isKindOfClass:CUIDateSegment.class] && !CUIIsComboBoxFormTrigger(metadata, core)) ||
        [metadata originalForMountSnapshot:mount] != core || ![metadata.semanticBinding isEqual:request[@"semanticBinding"]])
      @throw [NSException exceptionWithName:@"CUI.Field" reason:@"field-binding-original-editor-retired" userInfo:nil];
    NSString *owner = [metadata.ownerId copy], *descriptor = [metadata.descriptorId copy];
    NSString *token = [NSString stringWithFormat:@"%@:binding:%@", _semanticModuleId, nonce];
    __weak CUIFormDocument *weakSelf = self; __weak CUIFieldBinding *weakMetadata = metadata; __weak RCTViewComponentView *weakCore = core;
    [metadata setSemanticRefresh:^{
      CUIFormDocument *module = weakSelf; CUIFieldBinding *binding = weakMetadata;
      if (!module || !binding) { [binding setSemanticContribution:nil]; [binding resetSemanticAccessibilityFocus]; return; }
      [module refreshField:binding core:weakCore owner:owner descriptor:descriptor];
    } owner:token module:_semanticModuleId];
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
    if (owned) { [metadata clearSemanticRefreshForOwner:token retiring:NO]; [_semanticHosts removeObjectForKey:metadata]; }
    resolve(@(owned));
  } @catch (NSException *failure) { reject(@"E_CUI_FIELD_BINDING", failure.reason, nil); }
}
- (void)readFocusParticipants:(NSString *)encoded resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  RCTAssertMainQueue();
  @try {
    if (!_valid.load() || ![(id)_presenter isKindOfClass:RCTSurfacePresenter.class])
      @throw [NSException exceptionWithName:@"CUI.FocusParticipants" reason:@"focus-participant-module-retired" userInfo:nil];
    NSDictionary *request = [NSJSONSerialization JSONObjectWithData:[encoded dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    NSDictionary *snapshot = CUIReadFocusParticipants((id)_presenter, request);
    NSData *bytes = [NSJSONSerialization dataWithJSONObject:snapshot options:0 error:nil];
    resolve([[NSString alloc] initWithData:bytes encoding:NSUTF8StringEncoding]);
  } @catch (NSException *failure) { reject(@"E_CUI_FOCUS_PARTICIPANTS", failure.reason, nil); }
}
- (void)admitForm:(NSString *)encoded resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  RCTAssertMainQueue();
  @try {
    if (!_valid.load()) CUIFormFail(@"form-module-retired");
    NSDictionary *request = [NSJSONSerialization JSONObjectWithData:[encoded dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    CUIAdmitFormOriginals((id)_presenter, request);
    NSDictionary *result = @{@"accepted":@YES, @"requestId":request[@"requestId"], @"formRevision":request[@"form"][@"descriptorRevision"]};
    resolve([[NSString alloc] initWithData:[NSJSONSerialization dataWithJSONObject:result options:0 error:nil] encoding:NSUTF8StringEncoding]);
  } @catch (NSException *failure) { reject(@"E_CUI_FORM_ADMISSION", failure.reason, nil); }
}
- (void)focusField:(NSString *)encoded resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  RCTAssertMainQueue();
  @try {
    if (!_valid.load()) CUIFormFail(@"form-module-retired");
    NSDictionary *request = [NSJSONSerialization JSONObjectWithData:[encoded dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    NSString *origin = request[@"origin"];
    if (!([origin isEqual:@"native"] && request[@"actionLease"]) && !([origin isEqual:@"programmatic"] && !request[@"actionLease"]))
      CUIFormFail(@"form-focus-origin-invalid");
    NSMutableDictionary *admission = [request mutableCopy];
    admission[@"fields"] = @[@{@"field":request[@"field"], @"mount":request[@"mount"]}];
    CUIAdmitFormOriginals((id)_presenter, admission);
    NSDictionary *result = CUIFocusFormField((id)_presenter, request, ^BOOL {
      @try { if (!_valid.load()) return NO; CUIAdmitFormOriginals((id)_presenter, admission); return YES; }
      @catch (NSException *retired) { return NO; }
    });
    resolve([[NSString alloc] initWithData:[NSJSONSerialization dataWithJSONObject:result options:0 error:nil] encoding:NSUTF8StringEncoding]);
  } @catch (NSException *failure) { reject(@"E_CUI_FORM_FOCUS", failure.reason, nil); }
}
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeCUIFormDocumentSpecJSI>(params);
}
@end
