#import "CUIFormMetadata.h"
#import "CUIInputWindow.h"
#import "CUIOwnedDateField.h"
#import "CUIFocusView.h"
#import <cmath>
#import <React/RCTMountingTransactionObserving.h>
#import <React/RCTTextInputComponentView.h>
#import <react/renderer/components/CodonNativeInputSpec/EventEmitters.h>
#import <react/renderer/components/CodonNativeInputSpec/ComponentDescriptors.h>
#import <react/renderer/components/CodonNativeInputSpec/Props.h>

using namespace facebook::react;

@interface CUIFormMetadataView () <RCTMountingTransactionObserving>
@end

@implementation CUIFormMetadataView {
  __weak UIWindow *_boundWindow;
  __weak UIView *_boundOriginal;
  __weak UIView *_boundEditor;
  NSString *_windowId;
  NSString *_signature;
  NSString *_identity;
  NSUInteger _epoch;
  NSUInteger _sequence;
  SurfaceId _surface;
  NSDictionary *_mountSnapshot;
  NSString *_lastMount;
  BOOL _applicationActive, _lastActive;
  NSString *_semanticBinding, *_semanticOwner, *_semanticModule;
  void (^_semanticRefresh)(void);
  id<CUIFieldSemanticContribution> _semanticContribution;
  BOOL _refreshingSemantics;
  __weak UIView *_semanticAXTarget;
  NSString *_semanticAXIdentity;
  __weak UIView *_semanticAXReturnEditor;
  NSString *_semanticAXReturnOwner, *_semanticAXReturnDescriptor;
}
- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    self.ownerId = @""; self.descriptorId = @""; self.descriptorRevision = @"";
    self.alpha = 0; self.userInteractionEnabled = NO;
    _windowId = @""; _signature = @""; _identity = @""; _surface = -1;
    _lastMount = @"unmounted";
    self.semanticBinding = @"";
    self.ownedEditorBinding = @"";
    self.ownedControlBinding = @"";
    _applicationActive = UIApplication.sharedApplication.applicationState == UIApplicationStateActive;
    for (NSString *name in @[UIApplicationWillResignActiveNotification, UIApplicationDidBecomeActiveNotification,
        UISceneWillDeactivateNotification, UISceneDidActivateNotification, UIWindowDidBecomeKeyNotification, UIWindowDidResignKeyNotification])
      [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(environmentChanged:) name:name object:nil];
  }
  return self;
}
- (BOOL)isAccessibilityElement { return NO; }
- (BOOL)accessibilityElementsHidden { return YES; }
- (NSArray *)accessibilityElements { return @[]; }
- (NSInteger)accessibilityElementCount { return 0; }
- (id)accessibilityElementAtIndex:(NSInteger)index { return nil; }
- (NSInteger)indexOfAccessibilityElement:(id)element { return NSNotFound; }
- (BOOL)canBecomeFocused { return NO; }
- (BOOL)canBecomeFirstResponder { return NO; }
- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event { return nil; }
- (void)finalizeUpdates:(RNComponentViewUpdateMask)updateMask
{
  [super finalizeUpdates:updateMask];
  self.alpha = 0; self.userInteractionEnabled = NO;
}
- (BOOL)isMetadataOnly
{
  return self.alpha == 0 && CGSizeEqualToSize(self.bounds.size, CGSizeZero) && !self.userInteractionEnabled &&
    !self.isAccessibilityElement && self.accessibilityElementsHidden && self.accessibilityElementCount == 0;
}
- (BOOL)isFieldBinding { return NO; }
- (NSString *)semanticBinding { return _semanticBinding ?: @""; }
- (void)setSemanticBinding:(NSString *)value
{
  if ([_semanticBinding isEqual:value]) return;
  [self setSemanticContribution:nil]; _semanticBinding = [value copy] ?: @"";
  if (!_semanticBinding.length) [self resetSemanticAccessibilityFocus];
}
- (void)setSemanticContribution:(id<CUIFieldSemanticContribution>)contribution
{
  if (_semanticContribution == contribution) return;
  [_semanticContribution retire]; _semanticContribution = contribution;
}
- (void)setSemanticRefresh:(void (^)(void))refresh owner:(NSString *)owner module:(NSString *)module
{
  if (![_semanticModule isEqual:module]) [self resetSemanticAccessibilityFocus];
  _semanticModule = [module copy];
  [self setSemanticContribution:nil]; _semanticOwner = [owner copy]; _semanticRefresh = [refresh copy];
  [self refreshSemantics];
}
- (void)clearSemanticRefreshForOwner:(NSString *)owner retiring:(BOOL)retiring
{
  if (![_semanticOwner isEqual:owner]) return;
  [self setSemanticContribution:nil]; _semanticRefresh = nil; _semanticOwner = nil;
  // Ordinary same-editor data revisions replace the watch before the next bind.
  if (retiring) [self resetSemanticAccessibilityFocus];
}
- (void)refreshSemantics
{
  if (!_semanticRefresh || _refreshingSemantics) return;
  _refreshingSemantics = YES;
  @try { _semanticRefresh(); }
  @catch (NSException *retired) { [self setSemanticContribution:nil]; [self resetSemanticAccessibilityFocus]; }
  @finally { _refreshingSemantics = NO; }
}
- (void)clearSemanticAccessibilityRequest { _semanticAXTarget = nil; _semanticAXIdentity = nil; }
- (void)resetSemanticAccessibilityFocus
{
  [self clearSemanticAccessibilityRequest];
  _semanticAXReturnEditor = nil; _semanticAXReturnOwner = nil; _semanticAXReturnDescriptor = nil;
}
- (void)requestSemanticAccessibilityFocus:(UIView *)target identity:(NSString *)identity editor:(UIView *)editor returningToEditor:(BOOL)returning
{
  if (!target || !editor || editor != _boundEditor || !editor.isFirstResponder || !editor.window.isKeyWindow || target.window != editor.window ||
      (returning && (target != editor || _semanticAXReturnEditor != editor ||
        ![_semanticAXReturnOwner isEqual:self.ownerId] || ![_semanticAXReturnDescriptor isEqual:self.descriptorId])) ||
      (_semanticAXTarget == target && [_semanticAXIdentity isEqual:identity])) return;
  id element = [target isKindOfClass:RCTViewComponentView.class] ? [(RCTViewComponentView *)target accessibilityElement] : target;
  if (!element) return;
  _semanticAXTarget = target; _semanticAXIdentity = [identity copy];
  // This records a dispatched request, never observed VoiceOver focus.
  _semanticAXReturnEditor = returning ? nil : editor;
  _semanticAXReturnOwner = returning ? nil : [self.ownerId copy];
  _semanticAXReturnDescriptor = returning ? nil : [self.descriptorId copy];
  UIAccessibilityPostNotification(UIAccessibilityLayoutChangedNotification, element);
}
- (void)environmentChanged:(NSNotification *)notification
{
  if ([notification.object isKindOfClass:UIWindowScene.class] && notification.object != self.window.windowScene) return;
  if ([notification.name isEqual:UIApplicationWillResignActiveNotification] || [notification.name isEqual:UISceneWillDeactivateNotification]) _applicationActive = NO;
  if ([notification.name isEqual:UIApplicationDidBecomeActiveNotification] || [notification.name isEqual:UISceneDidActivateNotification]) _applicationActive = YES;
  [self publish:self.window != nil surface:_surface mount:_lastMount];
  [self refreshSemantics];
}
- (void)dealloc { [_semanticContribution retire]; [NSNotificationCenter.defaultCenter removeObserver:self]; }
- (NSDictionary *)formMountSnapshot
{
  [self publish:self.window != nil surface:_surface mount:_lastMount];
  return _mountSnapshot;
}
- (UIView *)originalForAttachedMountSnapshot:(NSDictionary *)snapshot
{
  NSDictionary *current = [self formMountSnapshot];
  return [current isEqual:snapshot] && [current[@"complete"] boolValue] && [current[@"attached"] boolValue] ? _boundOriginal : nil;
}
- (UIView *)originalForMountSnapshot:(NSDictionary *)snapshot
{
  NSDictionary *current = [self formMountSnapshot];
  return [current isEqual:snapshot] && [current[@"complete"] boolValue] && [current[@"active"] boolValue] ? _boundOriginal : nil;
}
- (void)didMoveToWindow
{
  [self setSemanticContribution:nil];
  [self resetSemanticAccessibilityFocus];
  [super didMoveToWindow];
  if (_boundWindow == self.window) return;
  if (_boundWindow) [self publish:NO surface:_surface mount:@"detached"];
  _epoch++; _boundWindow = self.window; _boundOriginal = nil; _boundEditor = nil; _signature = @"";
  _windowId = self.window ? CUIInputWindowIdentity(self.window) : @"";
  [self publish:self.window != nil surface:_surface mount:_lastMount];
}
- (BOOL)isOwnedRangeThumb:(UIView *)original surface:(SurfaceId)surface
{
  @try {
    if (![original isKindOfClass:CUIFocusView.class] || self.ownedEditorBinding.length || self.semanticBinding.length || surface <= 0) return NO;
    id value = [NSJSONSerialization JSONObjectWithData:[self.ownedControlBinding dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    if (![value isKindOfClass:NSDictionary.class] || [value count] != 2 || ![value[@"kind"] isEqual:@"range-thumb"]) return NO;
    id rootTag = value[@"rootTarget"];
    if (![rootTag isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)rootTag) == CFBooleanGetTypeID()) return NO;
    double number = [rootTag doubleValue];
    if (!std::isfinite(number) || number <= 0 || number > INT_MAX || std::floor(number) != number) return NO;
    UIView *root = [self.window viewWithTag:[rootTag integerValue]];
    id element = [(CUIFocusView *)original accessibilityElement];
    return root != original && [root isKindOfClass:RCTViewComponentView.class] &&
      ![root isKindOfClass:CUIFormMetadataView.class] && ![root isKindOfClass:RCTTextInputComponentView.class] &&
      ![root isKindOfClass:CUIDateSegment.class] && root.window == self.window &&
      [original isDescendantOfView:root] && self != original && [self isDescendantOfView:original] &&
      ([element accessibilityTraits] & UIAccessibilityTraitAdjustable);
  } @catch (NSException *retired) { return NO; }
}
- (void)publish:(BOOL)attached surface:(SurfaceId)surface mount:(NSString *)mount
{
  if (!_eventEmitter || !self.ownerId.length || !self.descriptorId.length || !self.descriptorRevision.length) { _mountSnapshot = nil; [self resetSemanticAccessibilityFocus]; return; }
  UIView *original = nil;
  if (attached && self.originalTarget > 0) {
    UIView *bound = _boundOriginal;
    original = bound.tag == self.originalTarget && bound.window == self.window ? bound : [self.window viewWithTag:self.originalTarget];
  }
  attached &= self.window != nil;
  NSData *identityData = [NSJSONSerialization dataWithJSONObject:@[self.ownerId, self.descriptorId, self.descriptorRevision, @(self.originalTarget), self.ownedEditorBinding ?: @"", self.ownedControlBinding ?: @""] options:0 error:nil];
  if (!identityData) return;
  NSString *identity = [[NSString alloc] initWithData:identityData encoding:NSUTF8StringEncoding];
  UIView *editor = [self isFieldBinding] && [original isKindOfClass:RCTTextInputComponentView.class] ?
    (UIView *)((RCTTextInputComponentView *)original).accessibilityElement : original;
  if (_boundOriginal != original || _boundEditor != editor || _surface != surface ||
      (_semanticAXReturnEditor && (![_semanticAXReturnOwner isEqual:self.ownerId] || ![_semanticAXReturnDescriptor isEqual:self.descriptorId])))
    [self resetSemanticAccessibilityFocus];
  if (_boundOriginal != original || _boundEditor != editor || ![_identity isEqual:identity] || _surface != surface) {
    _epoch++; _boundOriginal = original; _boundEditor = editor; _identity = identity; _surface = surface;
  }
  BOOL ownedDate = [self isFieldBinding] && self.ownedEditorBinding.length;
  BOOL ownedControl = [self isFieldBinding] && self.ownedControlBinding.length;
  BOOL correctType = ownedControl ? [self isOwnedRangeThumb:original surface:surface] : ownedDate ? CUIResolveOwnedDateField(self, self.ownedEditorBinding, self.originalTarget, surface) == original && original != nil :
    [self isFieldBinding] ? [original isKindOfClass:RCTTextInputComponentView.class] &&
      ([editor isKindOfClass:UITextField.class] || [editor isKindOfClass:UITextView.class]) :
      [original isKindOfClass:RCTViewComponentView.class] && ![original isKindOfClass:CUIFormMetadataView.class];
  BOOL metadataOnly = self.isMetadataOnly;
  BOOL complete = attached && surface > 0 && _windowId.length && original.window == self.window && editor.window == self.window && correctType && metadataOnly;
  BOOL active = complete && _applicationActive && UIApplication.sharedApplication.applicationState == UIApplicationStateActive && editor.window.isKeyWindow &&
    editor.window.windowScene.activationState == UISceneActivationStateForegroundActive;
  for (UIView *view = editor; view && active; view = view.superview)
    active &= !view.hidden && view.alpha > 0 && view.userInteractionEnabled;
  if (!active) [self resetSemanticAccessibilityFocus];
  if (_lastActive != active) { _lastActive = active; _epoch++; }
  NSString *error = !attached ? @"form-metadata-detached" : !original ? @"form-original-target-unavailable" :
      !correctType ? @"form-original-type-mismatch" : !metadataOnly ? @"form-metadata-not-inert" : !complete ? @"form-metadata-incomplete" : @"";
  NSString *originalClass = original ? NSStringFromClass(original.class) : @"";
  NSData *data = [NSJSONSerialization dataWithJSONObject:@[identity, self.semanticBinding, @(self.tag), @(surface), _windowId, @(_epoch), @(attached), @(active), @(complete), @(metadataOnly), originalClass, error] options:0 error:nil];
  NSString *signature = data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : nil;
  if (!signature || [_signature isEqual:signature]) return;
  _signature = signature;
  _lastMount = [mount copy];
  _sequence++;
  _mountSnapshot = @{@"ownerId":self.ownerId, @"descriptorId":self.descriptorId, @"descriptorRevision":self.descriptorRevision,
    @"target":@(self.tag), @"originalTarget":@(self.originalTarget), @"surfaceId":@(surface), @"windowId":_windowId,
    @"epoch":@(_epoch), @"sequence":@(_sequence), @"mountRevision":mount, @"attached":@(attached), @"active":@(active),
    @"complete":@(complete), @"metadataOnly":@(metadataOnly), @"originalClass":originalClass, @"error":error};
  const auto fill = [&](auto &value) {
    value.ownerId = self.ownerId.UTF8String; value.descriptorId = self.descriptorId.UTF8String;
    value.descriptorRevision = self.descriptorRevision.UTF8String; value.target = (int)self.tag;
    value.originalTarget = (int)self.originalTarget; value.surfaceId = surface; value.windowId = _windowId.UTF8String;
    value.epoch = _epoch; value.sequence = _sequence; value.mountRevision = mount.UTF8String;
    value.attached = attached; value.active = active; value.complete = complete; value.metadataOnly = metadataOnly;
    value.originalClass = originalClass.UTF8String; value.error = error.UTF8String;
  };
  if ([self isFieldBinding]) {
    CUIFieldBindingEventEmitter::OnNativeFormCommit value{}; fill(value);
    std::static_pointer_cast<const CUIFieldBindingEventEmitter>(_eventEmitter)->onNativeFormCommit(value);
  } else {
    CUIFormRootEventEmitter::OnNativeFormCommit value{}; fill(value);
    std::static_pointer_cast<const CUIFormRootEventEmitter>(_eventEmitter)->onNativeFormCommit(value);
  }
}
- (void)mountingTransactionDidMount:(const MountingTransaction &)transaction withSurfaceTelemetry:(const SurfaceTelemetry &)surfaceTelemetry
{
  [self publish:self.window != nil surface:transaction.getSurfaceId()
      mount:[NSString stringWithFormat:@"ios-surface:%d:mount:%lld", transaction.getSurfaceId(), (long long)transaction.getNumber()]];
  [self refreshSemantics];
}
- (void)prepareForRecycle
{
  [self publish:NO surface:_surface mount:@"retired"];
  [self clearSemanticRefreshForOwner:_semanticOwner retiring:YES];
  [self resetSemanticAccessibilityFocus];
  _epoch++; _boundWindow = nil; _boundOriginal = nil; _boundEditor = nil; _windowId = @""; _signature = @""; _identity = @""; _surface = -1;
  _mountSnapshot = nil; _lastMount = @"retired"; _lastActive = NO;
  self.ownerId = @""; self.descriptorId = @""; self.descriptorRevision = @"";
  self.originalTarget = 0;
  self.ownedEditorBinding = @"";
  self.ownedControlBinding = @"";
  self.semanticBinding = @"";
  [super prepareForRecycle];
}
@end

@implementation CUIFormRoot
+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<CUIFormRootComponentDescriptor>();
}
- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) _props = std::make_shared<const CUIFormRootProps>();
  return self;
}
- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps
{
  const auto &value = *std::static_pointer_cast<const CUIFormRootProps>(props);
  self.ownerId = [NSString stringWithUTF8String:value.ownerId.c_str()];
  self.descriptorId = [NSString stringWithUTF8String:value.descriptorId.c_str()];
  self.descriptorRevision = [NSString stringWithUTF8String:value.descriptorRevision.c_str()];
  self.originalTarget = value.formTarget;
  [super updateProps:props oldProps:oldProps];
}
@end

@implementation CUIFieldBinding
+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<CUIFieldBindingComponentDescriptor>();
}
- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) _props = std::make_shared<const CUIFieldBindingProps>();
  return self;
}
- (BOOL)isFieldBinding { return YES; }
- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps
{
  const auto &value = *std::static_pointer_cast<const CUIFieldBindingProps>(props);
  self.ownerId = [NSString stringWithUTF8String:value.ownerId.c_str()];
  self.descriptorId = [NSString stringWithUTF8String:value.descriptorId.c_str()];
  self.descriptorRevision = [NSString stringWithUTF8String:value.descriptorRevision.c_str()];
  self.originalTarget = value.editorTarget;
  self.ownedEditorBinding = [NSString stringWithUTF8String:value.ownedEditorBinding.c_str()];
  self.ownedControlBinding = [NSString stringWithUTF8String:value.ownedControlBinding.c_str()];
  self.semanticBinding = [NSString stringWithUTF8String:value.semanticBinding.c_str()];
  [super updateProps:props oldProps:oldProps];
}
@end

Class<RCTComponentViewProtocol> CUIFormRootCls(void) { return CUIFormRoot.class; }
Class<RCTComponentViewProtocol> CUIFieldBindingCls(void) { return CUIFieldBinding.class; }
