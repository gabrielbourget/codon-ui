#import "CUIFormMetadata.h"
#import "CUIInputWindow.h"
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
  NSString *_semanticBinding, *_semanticOwner;
  void (^_semanticRefresh)(void);
  id<CUIFieldSemanticContribution> _semanticContribution;
  BOOL _refreshingSemantics;
  __weak UIView *_semanticAXTarget;
  NSString *_semanticAXIdentity;
}
- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    _windowId = @""; _signature = @""; _identity = @""; _surface = -1;
    _lastMount = @"unmounted";
    self.semanticBinding = @"";
    _applicationActive = UIApplication.sharedApplication.applicationState == UIApplicationStateActive;
    for (NSString *name in @[UIApplicationWillResignActiveNotification, UIApplicationDidBecomeActiveNotification,
        UISceneWillDeactivateNotification, UISceneDidActivateNotification, UIWindowDidBecomeKeyNotification, UIWindowDidResignKeyNotification])
      [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(environmentChanged:) name:name object:nil];
  }
  return self;
}
- (BOOL)isFieldBinding { return NO; }
- (NSString *)semanticBinding { return _semanticBinding ?: @""; }
- (void)setSemanticBinding:(NSString *)value
{
  if ([_semanticBinding isEqual:value]) return;
  [self setSemanticContribution:nil]; _semanticBinding = [value copy] ?: @"";
}
- (void)setSemanticContribution:(id<CUIFieldSemanticContribution>)contribution
{
  if (_semanticContribution == contribution) return;
  [_semanticContribution retire]; _semanticContribution = contribution;
}
- (void)setSemanticRefresh:(void (^)(void))refresh owner:(NSString *)owner
{
  [self setSemanticContribution:nil]; _semanticOwner = [owner copy]; _semanticRefresh = [refresh copy];
  [self refreshSemantics];
}
- (void)clearSemanticRefreshForOwner:(NSString *)owner
{
  if (![_semanticOwner isEqual:owner]) return;
  [self setSemanticContribution:nil]; _semanticRefresh = nil; _semanticOwner = nil;
}
- (void)refreshSemantics
{
  if (!_semanticRefresh || _refreshingSemantics) return;
  _refreshingSemantics = YES;
  @try { _semanticRefresh(); }
  @catch (NSException *retired) { [self setSemanticContribution:nil]; }
  @finally { _refreshingSemantics = NO; }
}
- (void)resetSemanticAccessibilityFocus { _semanticAXTarget = nil; _semanticAXIdentity = nil; }
- (void)requestSemanticAccessibilityFocus:(UIView *)target identity:(NSString *)identity returningToEditor:(BOOL)returning
{
  if (!target || !target.window.isKeyWindow || (returning && !_semanticAXTarget) ||
      (_semanticAXTarget == target && [_semanticAXIdentity isEqual:identity])) return;
  _semanticAXTarget = target; _semanticAXIdentity = [identity copy];
  id element = [target isKindOfClass:RCTViewComponentView.class] ? [(RCTViewComponentView *)target accessibilityElement] : target;
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
}
- (void)publish:(BOOL)attached surface:(SurfaceId)surface mount:(NSString *)mount
{
  if (!_eventEmitter || !self.ownerId.length || !self.descriptorId.length || !self.descriptorRevision.length) { _mountSnapshot = nil; return; }
  UIView *original = nil;
  if (attached && self.originalTarget > 0) {
    UIView *bound = _boundOriginal;
    original = bound.tag == self.originalTarget && bound.window == self.window ? bound : [self.window viewWithTag:self.originalTarget];
  }
  attached &= self.window != nil;
  NSData *identityData = [NSJSONSerialization dataWithJSONObject:@[self.ownerId, self.descriptorId, self.descriptorRevision, @(self.originalTarget)] options:0 error:nil];
  if (!identityData) return;
  NSString *identity = [[NSString alloc] initWithData:identityData encoding:NSUTF8StringEncoding];
  UIView *editor = [self isFieldBinding] && [original isKindOfClass:RCTTextInputComponentView.class] ?
    ((RCTTextInputComponentView *)original).accessibilityElement : original;
  if (_boundOriginal != original || _boundEditor != editor || ![_identity isEqual:identity] || _surface != surface) {
    _epoch++; _boundOriginal = original; _boundEditor = editor; _identity = identity; _surface = surface;
  }
  BOOL correctType = [self isFieldBinding] ? [original isKindOfClass:RCTTextInputComponentView.class] &&
      ([editor isKindOfClass:UITextField.class] || [editor isKindOfClass:UITextView.class]) :
      [original isKindOfClass:RCTViewComponentView.class] && ![original isKindOfClass:CUICollectionMetadataView.class];
  BOOL metadataOnly = self.isMetadataOnly;
  BOOL complete = attached && surface > 0 && _windowId.length && original.window == self.window && editor.window == self.window && correctType && metadataOnly;
  BOOL active = complete && _applicationActive && UIApplication.sharedApplication.applicationState == UIApplicationStateActive && editor.window.isKeyWindow &&
    editor.window.windowScene.activationState == UISceneActivationStateForegroundActive;
  for (UIView *view = editor; view && active; view = view.superview)
    active &= !view.hidden && view.alpha > 0 && view.userInteractionEnabled;
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
  [self clearSemanticRefreshForOwner:_semanticOwner];
  [self resetSemanticAccessibilityFocus];
  _epoch++; _boundWindow = nil; _boundOriginal = nil; _boundEditor = nil; _windowId = @""; _signature = @""; _identity = @""; _surface = -1;
  _mountSnapshot = nil; _lastMount = @"retired"; _lastActive = NO;
  self.originalTarget = 0;
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
  self.semanticBinding = [NSString stringWithUTF8String:value.semanticBinding.c_str()];
  [super updateProps:props oldProps:oldProps];
}
@end

Class<RCTComponentViewProtocol> CUIFormRootCls(void) { return CUIFormRoot.class; }
Class<RCTComponentViewProtocol> CUIFieldBindingCls(void) { return CUIFieldBinding.class; }
