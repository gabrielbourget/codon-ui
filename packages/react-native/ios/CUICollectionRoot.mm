#import "CUICollectionRoot.h"
#import "CUIInputWindow.h"
#import "CUIFocusView.h"
#import <React/RCTMountingTransactionObserving.h>
#import <react/renderer/components/CodonNativeInputSpec/ComponentDescriptors.h>
#import <react/renderer/components/CodonNativeInputSpec/EventEmitters.h>
#import <react/renderer/components/CodonNativeInputSpec/Props.h>

using namespace facebook::react;

@interface CUICollectionRoot () <RCTMountingTransactionObserving>
@end

@implementation CUICollectionRoot {
  NSString *_rootRevision;
  NSString *_lastSignature;
  NSString *_inspectionRequest;
  NSString *_actionRequests;
  NSUInteger _lastActionSequence;
  NSString *_inspectedRequest;
  BOOL _lastComplete;
  __weak UIWindow *_boundWindow;
  NSString *_windowId;
  NSUInteger _epoch;
  NSUInteger _sequence;
  SurfaceId _lastSurfaceId;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<CUICollectionRootComponentDescriptor>();
}
- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    _props = std::make_shared<const CUICollectionRootProps>();
    _rootRevision = @""; _lastSignature = @""; _windowId = @""; _lastSurfaceId = -1;
    _inspectionRequest = @""; _inspectedRequest = @""; _actionRequests = @"[]";
  }
  return self;
}
- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps
{
  const auto &value = *std::static_pointer_cast<const CUICollectionRootProps>(props);
  self.ownerId = [NSString stringWithUTF8String:value.ownerId.c_str()];
  self.rootId = [NSString stringWithUTF8String:value.rootId.c_str()];
  _rootRevision = [NSString stringWithUTF8String:value.rootRevision.c_str()];
  _inspectionRequest = [NSString stringWithUTF8String:value.inspectionRequest.c_str()];
  _actionRequests = [NSString stringWithUTF8String:value.actionRequests.c_str()];
  [super updateProps:props oldProps:oldProps];
}
- (void)didMoveToWindow
{
  [super didMoveToWindow];
  if (_boundWindow == self.window && (self.window || !_windowId.length)) return;
  if (_windowId.length) [self publishAttached:NO surface:_lastSurfaceId mount:@"detached"];
  _epoch++; _lastSignature = @""; _boundWindow = self.window;
  _windowId = self.window ? CUIInputWindowIdentity(self.window) : @"";
}
- (NSString *)collect:(CUICollectionMetadataView *)parent parentId:(NSString *)parentId nodes:(NSMutableArray *)nodes ids:(NSMutableSet *)ids metadataOnly:(BOOL *)metadataOnly
{
  *metadataOnly &= parent.isMetadataOnly;
  NSInteger position = 0;
  NSInteger retainedIndex = -1;
  for (UIView *child in parent.subviews) {
    retainedIndex++;
    if (![child isKindOfClass:CUICollectionNode.class]) return @"non-metadata-child";
    CUICollectionNode *node = (CUICollectionNode *)child;
    *metadataOnly &= node.isMetadataOnly;
    if (![self.ownerId isEqual:node.ownerId] || ![self.rootId isEqual:node.rootId]) return @"metadata-owner-mismatch";
    if (node.hidden) continue;
    if (!node.descriptorId.length || !node.descriptorRevision.length || [ids containsObject:node.descriptorId]) return @"invalid-descriptor-identity";
    [ids addObject:node.descriptorId];
    [nodes addObject:@{@"descriptorId":node.descriptorId, @"descriptorRevision":node.descriptorRevision,
      @"parentDescriptorId":parentId, @"target":@(node.tag), @"index":@(position++), @"retainedIndex":@(retainedIndex),
      @"hasRetainedChildren":@(node.subviews.count > 0)}];
    NSString *error = [self collect:node parentId:node.descriptorId nodes:nodes ids:ids metadataOnly:metadataOnly];
    if (error.length) return error;
  }
  return @"";
}
- (void)publishAttached:(BOOL)attached surface:(SurfaceId)surface mount:(NSString *)mount
{
  if (!_eventEmitter || !self.ownerId.length || !self.rootId.length || !_rootRevision.length) return;
  attached &= self.window != nil;
  NSMutableArray *nodes = [NSMutableArray array]; BOOL metadataOnly = attached, complete = attached;
  NSString *error = @"";
  if (attached && !self.hidden) error = [self collect:self parentId:@"" nodes:nodes ids:[NSMutableSet set] metadataOnly:&metadataOnly];
  else error = attached ? @"metadata-root-hidden" : @"metadata-root-detached";
  if (surface < 0 || !_windowId.length) error = @"metadata-root-without-surface-or-window";
  complete &= !error.length;
  _lastComplete = complete;
  NSData *hierarchyData = [NSJSONSerialization dataWithJSONObject:nodes options:NSJSONWritingSortedKeys error:nil];
  if (!hierarchyData) return;
  NSString *hierarchy = [[NSString alloc] initWithData:hierarchyData encoding:NSUTF8StringEncoding];
  NSArray *signatureValues = @[self.ownerId, self.rootId, _rootRevision, @(self.tag), @(surface), _windowId,
    @(_epoch), @(attached), @(complete), @(metadataOnly), hierarchy, error];
  NSData *signatureData = [NSJSONSerialization dataWithJSONObject:signatureValues options:0 error:nil];
  if (!signatureData) return;
  NSString *signature = [[NSString alloc] initWithData:signatureData encoding:NSUTF8StringEncoding];
  if ([_lastSignature isEqual:signature]) return;
  _lastSignature = signature;
  CUICollectionRootEventEmitter::OnNativeCollectionCommit value{};
  value.ownerId = self.ownerId.UTF8String; value.rootId = self.rootId.UTF8String; value.rootRevision = _rootRevision.UTF8String;
  value.target = (int)self.tag; value.surfaceId = surface; value.windowId = _windowId.UTF8String;
  value.epoch = _epoch; value.sequence = ++_sequence; value.mountRevision = mount.UTF8String;
  value.attached = attached; value.complete = complete; value.metadataOnly = metadataOnly;
  value.hierarchy = hierarchy.UTF8String; value.error = error.UTF8String;
  std::static_pointer_cast<const CUICollectionRootEventEmitter>(_eventEmitter)->onNativeCollectionCommit(value);
}
- (NSDictionary *)inspectView:(CUICollectionMetadataView *)view
{
  NSMutableArray *children = [NSMutableArray array];
  for (UIView *child in view.subviews) {
    if (![child isKindOfClass:CUICollectionNode.class]) return nil;
    NSDictionary *inspection = [self inspectView:(CUICollectionNode *)child];
    if (!inspection) return nil;
    [children addObject:inspection];
  }
  UIView *hit = [view hitTest:CGPointZero withEvent:nil];
  return @{@"target":@(view.tag), @"className":NSStringFromClass(view.class), @"descriptorId":view.descriptorId,
    @"descriptorRevision":view.descriptorRevision, @"alpha":@(view.alpha), @"width":@(view.bounds.size.width),
    @"height":@(view.bounds.size.height), @"hidden":@(view.hidden), @"userInteractionEnabled":@(view.userInteractionEnabled),
    @"canBecomeFocused":@(view.canBecomeFocused), @"canBecomeFirstResponder":@(view.canBecomeFirstResponder),
    @"isFirstResponder":@(view.isFirstResponder), @"hitTarget":@(hit ? hit.tag : -1),
    @"isAccessibilityElement":@(view.isAccessibilityElement), @"accessibilityElementsHidden":@(view.accessibilityElementsHidden),
    @"accessibilityElementCount":@(view.accessibilityElementCount), @"explicitAccessibilityElements":@(view.accessibilityElements.count),
    @"children":children};
}
- (void)inspectRequested
{
  if (!_eventEmitter || !_inspectionRequest.length || [_inspectionRequest isEqual:_inspectedRequest]) return;
  _inspectedRequest = _inspectionRequest;
  NSDictionary *request = [NSJSONSerialization JSONObjectWithData:[_inspectionRequest dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
  NSString *requestId = [request isKindOfClass:NSDictionary.class] && [request[@"requestId"] isKindOfClass:NSString.class] ? request[@"requestId"] : @"";
  BOOL valid = requestId.length && self.ownerId.length && self.rootId.length && _rootRevision.length && _lastComplete && self.window &&
    [self.ownerId isEqual:request[@"ownerId"]] && [self.rootId isEqual:request[@"rootId"]] && [_rootRevision isEqual:request[@"rootRevision"]] &&
    [_windowId isEqual:request[@"windowId"]];
  NSDictionary *numbers = @{@"target":@(self.tag), @"surfaceId":@(_lastSurfaceId), @"epoch":@(_epoch), @"sequence":@(_sequence)};
  for (NSString *key in numbers) {
    id number = [request isKindOfClass:NSDictionary.class] ? request[key] : nil;
    if (![number isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)number) == CFBooleanGetTypeID() || ![number isEqualToNumber:numbers[key]]) valid = NO;
  }
  NSString *error = valid ? @"" : @"metadata-inspection-stale";
  NSDictionary *inspection = @{};
  if (valid) {
    NSDictionary *tree = [self inspectView:self];
    if (!tree) { valid = NO; error = @"non-metadata-inspection-child"; }
    else {
      UIView *focusedBefore = CUIInputFocusedView(self.window);
      NSInteger beforeTag = focusedBefore ? focusedBefore.tag : -1;
      BOOL focusAccepted = [self becomeFirstResponder];
      UIView *focusedAfter = CUIInputFocusedView(self.window);
      inspection = @{@"tree":tree, @"focusRequestAccepted":@(focusAccepted), @"focusedBefore":@(beforeTag),
        @"focusedAfter":@(focusedAfter ? focusedAfter.tag : -1)};
    }
  }
  NSData *data = [NSJSONSerialization dataWithJSONObject:inspection options:NSJSONWritingSortedKeys error:nil];
  if (!data) return;
  NSString *serialized = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
  CUICollectionRootEventEmitter::OnNativeCollectionInspection value{};
  value.requestId = requestId.UTF8String; value.ownerId = self.ownerId.UTF8String; value.rootId = self.rootId.UTF8String;
  value.rootRevision = _rootRevision.UTF8String; value.target = (int)self.tag; value.surfaceId = _lastSurfaceId;
  value.windowId = _windowId.UTF8String; value.epoch = _epoch; value.sequence = _sequence;
  value.accepted = valid; value.inspection = serialized.UTF8String; value.error = error.UTF8String;
  std::static_pointer_cast<const CUICollectionRootEventEmitter>(_eventEmitter)->onNativeCollectionInspection(value);
}
- (BOOL)binding:(NSDictionary *)binding matchesNumber:(NSString *)key value:(double)expected
{
  id number = binding[key];
  return [number isKindOfClass:NSNumber.class] && CFGetTypeID((__bridge CFTypeRef)number) != CFBooleanGetTypeID() && [number doubleValue] == expected;
}
- (BOOL)acceptsPointerBinding:(NSString *)serialized visibleTarget:(NSInteger)target
{
  id binding = [NSJSONSerialization JSONObjectWithData:[serialized dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
  return [self acceptsAction:binding serialized:serialized visibleTarget:target];
}
- (BOOL)acceptsAction:(NSDictionary *)binding serialized:(NSString *)serialized visibleTarget:(NSInteger)target
{
  if (![binding isKindOfClass:NSDictionary.class] || !_lastComplete || !self.window.isKeyWindow || self.hidden ||
    !self.ownerId.length || !self.rootId.length || !_rootRevision.length ||
    ![self.ownerId isEqual:binding[@"ownerId"]] || ![self.rootId isEqual:binding[@"rootId"]] || ![_rootRevision isEqual:binding[@"rootRevision"]] ||
    ![_windowId isEqual:binding[@"windowId"]] || ![_windowId isEqual:CUIInputWindowIdentity(self.window)]) return NO;
  NSDictionary *numbers = @{@"target":@(self.tag), @"surfaceId":@(_lastSurfaceId), @"epoch":@(_epoch), @"sequence":@(_sequence)};
  for (NSString *key in numbers) if (![self binding:binding matchesNumber:key value:[numbers[key] doubleValue]]) return NO;
  UIView *visible = [self.window viewWithTag:target];
  if (![visible isKindOfClass:CUIFocusView.class] || visible.window != self.window || ![serialized isEqual:((CUIFocusView *)visible).nativeCollectionBinding]) return NO;
  for (UIView *ancestor = visible; ancestor; ancestor = ancestor.superview) if (ancestor.hidden || ancestor.alpha <= 0) return NO;
  NSMutableArray *nodes = [NSMutableArray array]; BOOL metadataOnly = YES;
  NSString *error = [self collect:self parentId:@"" nodes:nodes ids:[NSMutableSet set] metadataOnly:&metadataOnly];
  if (error.length || !metadataOnly || ![binding[@"descriptorId"] isKindOfClass:NSString.class]) return NO;
  NSString *descriptor = binding[@"descriptorId"];
  if (!descriptor.length) return [binding[@"descriptorRevision"] isEqual:@""] && [self binding:binding matchesNumber:@"metadataTarget" value:self.tag];
  for (NSDictionary *node in nodes) {
    if ([descriptor isEqual:node[@"descriptorId"]] && [binding[@"descriptorRevision"] isEqual:node[@"descriptorRevision"]] &&
      [self binding:binding matchesNumber:@"metadataTarget" value:[node[@"target"] doubleValue]]) return YES;
  }
  return NO;
}
- (void)admitRequestedActions
{
  id requests = [NSJSONSerialization JSONObjectWithData:[_actionRequests dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
  if (![requests isKindOfClass:NSArray.class] || !_eventEmitter) return;
  for (id request in requests) {
    if (![request isKindOfClass:NSDictionary.class]) continue;
    id number = request[@"actionSequence"];
    if (![number isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)number) == CFBooleanGetTypeID()) continue;
    double sequence = [number doubleValue];
    if (!isfinite(sequence) || sequence != floor(sequence) || sequence <= _lastActionSequence || sequence > 9007199254740991.0) continue;
    NSString *requestId = [NSString stringWithFormat:@"%@:action:%llu", _rootRevision, (unsigned long long)sequence];
    if (![requestId isEqual:request[@"requestId"]] || ![request[@"binding"] isKindOfClass:NSString.class]) continue;
    _lastActionSequence = (NSUInteger)sequence;
    NSInteger target = [request[@"visibleTarget"] isKindOfClass:NSNumber.class] ? [request[@"visibleTarget"] integerValue] : -1;
    NSString *serialized = request[@"binding"];
    id binding = [NSJSONSerialization JSONObjectWithData:[serialized dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    BOOL accepted = target > 0 && [self acceptsAction:binding serialized:serialized visibleTarget:target];
    CUICollectionRootEventEmitter::OnNativeCollectionAction value{};
    value.requestId = requestId.UTF8String; value.ownerId = self.ownerId.UTF8String; value.rootId = self.rootId.UTF8String;
    value.rootRevision = _rootRevision.UTF8String; value.target = (int)self.tag; value.surfaceId = _lastSurfaceId;
    value.windowId = _windowId.UTF8String; value.epoch = _epoch; value.sequence = _sequence; value.visibleTarget = (int)target;
    value.accepted = accepted;
    std::static_pointer_cast<const CUICollectionRootEventEmitter>(_eventEmitter)->onNativeCollectionAction(value);
  }
}
- (void)mountingTransactionDidMount:(const MountingTransaction &)transaction withSurfaceTelemetry:(const SurfaceTelemetry &)surfaceTelemetry
{
  if (!self.window) return;
  // The locked coordinator dispatches only to descriptors registered on this exact surface, including modal children.
  SurfaceId surface = transaction.getSurfaceId();
  if (_lastSurfaceId >= 0 && _lastSurfaceId != surface) { _epoch++; _lastSignature = @""; }
  _lastSurfaceId = surface;
  [self publishAttached:YES surface:surface mount:[NSString stringWithFormat:@"ios-surface:%d:mount:%lld", surface, (long long)transaction.getNumber()]];
  [self inspectRequested];
  [self admitRequestedActions];
}
- (void)prepareForRecycle
{
  _epoch++; _boundWindow = nil; _windowId = @""; _rootRevision = @""; _lastSignature = @""; _lastSurfaceId = -1;
  _inspectionRequest = @""; _inspectedRequest = @""; _lastComplete = NO;
  _actionRequests = @"[]"; _lastActionSequence = 0;
  [super prepareForRecycle];
}
@end

Class<RCTComponentViewProtocol> CUICollectionRootCls(void) { return CUICollectionRoot.class; }
