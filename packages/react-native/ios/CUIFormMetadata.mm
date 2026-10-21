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
  NSString *_windowId;
  NSString *_signature;
  NSString *_identity;
  NSUInteger _epoch;
  NSUInteger _sequence;
  SurfaceId _surface;
}
- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    _windowId = @""; _signature = @""; _identity = @""; _surface = -1;
  }
  return self;
}
- (BOOL)isFieldBinding { return NO; }
- (void)didMoveToWindow
{
  [super didMoveToWindow];
  if (_boundWindow == self.window) return;
  if (_boundWindow) [self publish:NO surface:_surface mount:@"detached"];
  _epoch++; _boundWindow = self.window; _boundOriginal = nil; _signature = @"";
  _windowId = self.window ? CUIInputWindowIdentity(self.window) : @"";
}
- (void)publish:(BOOL)attached surface:(SurfaceId)surface mount:(NSString *)mount
{
  if (!_eventEmitter || !self.ownerId.length || !self.descriptorId.length || !self.descriptorRevision.length) return;
  UIView *original = attached && self.originalTarget > 0 ? [self.window viewWithTag:self.originalTarget] : nil;
  attached &= self.window != nil;
  NSData *identityData = [NSJSONSerialization dataWithJSONObject:@[self.ownerId, self.descriptorId, self.descriptorRevision, @(self.originalTarget)] options:0 error:nil];
  if (!identityData) return;
  NSString *identity = [[NSString alloc] initWithData:identityData encoding:NSUTF8StringEncoding];
  if (_boundOriginal != original || ![_identity isEqual:identity] || _surface != surface) {
    _epoch++; _boundOriginal = original; _identity = identity; _surface = surface;
  }
  BOOL correctType = [self isFieldBinding] ? [original isKindOfClass:RCTTextInputComponentView.class] :
      [original isKindOfClass:RCTViewComponentView.class] && ![original isKindOfClass:CUICollectionMetadataView.class];
  BOOL metadataOnly = self.isMetadataOnly;
  BOOL complete = attached && surface > 0 && _windowId.length && original.window == self.window && correctType && metadataOnly;
  NSString *error = !attached ? @"form-metadata-detached" : !original ? @"form-original-target-unavailable" :
      !correctType ? @"form-original-type-mismatch" : !metadataOnly ? @"form-metadata-not-inert" : !complete ? @"form-metadata-incomplete" : @"";
  NSString *originalClass = original ? NSStringFromClass(original.class) : @"";
  NSData *data = [NSJSONSerialization dataWithJSONObject:@[identity, @(self.tag), @(surface), _windowId, @(_epoch), @(attached), @(complete), @(metadataOnly), originalClass, error] options:0 error:nil];
  NSString *signature = data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : nil;
  if (!signature || [_signature isEqual:signature]) return;
  _signature = signature;
  const auto fill = [&](auto &value) {
    value.ownerId = self.ownerId.UTF8String; value.descriptorId = self.descriptorId.UTF8String;
    value.descriptorRevision = self.descriptorRevision.UTF8String; value.target = (int)self.tag;
    value.originalTarget = (int)self.originalTarget; value.surfaceId = surface; value.windowId = _windowId.UTF8String;
    value.epoch = _epoch; value.sequence = ++_sequence; value.mountRevision = mount.UTF8String;
    value.attached = attached; value.complete = complete; value.metadataOnly = metadataOnly;
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
}
- (void)prepareForRecycle
{
  [self publish:NO surface:_surface mount:@"retired"];
  _epoch++; _boundWindow = nil; _boundOriginal = nil; _windowId = @""; _signature = @""; _identity = @""; _surface = -1;
  self.originalTarget = 0;
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
  [super updateProps:props oldProps:oldProps];
}
@end

Class<RCTComponentViewProtocol> CUIFormRootCls(void) { return CUIFormRoot.class; }
Class<RCTComponentViewProtocol> CUIFieldBindingCls(void) { return CUIFieldBinding.class; }
