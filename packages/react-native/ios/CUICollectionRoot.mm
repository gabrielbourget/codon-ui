#import "CUICollectionRoot.h"
#import "CUIInputWindow.h"
#import <React/RCTComponent.h>
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
  }
  return self;
}
- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps
{
  const auto &value = *std::static_pointer_cast<const CUICollectionRootProps>(props);
  self.ownerId = [NSString stringWithUTF8String:value.ownerId.c_str()];
  self.rootId = [NSString stringWithUTF8String:value.rootId.c_str()];
  _rootRevision = [NSString stringWithUTF8String:value.rootRevision.c_str()];
  [super updateProps:props oldProps:oldProps];
}
- (SurfaceId)currentSurfaceId
{
  // Use the same actual root-view identity rule as the locked mounting manager.
  for (UIView *view = self; view; view = view.superview) if (RCTIsReactRootView(@(view.tag))) return (SurfaceId)view.tag;
  return -1;
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
  for (UIView *child in parent.subviews) {
    if (![child isKindOfClass:CUICollectionNode.class]) return @"non-metadata-child";
    CUICollectionNode *node = (CUICollectionNode *)child;
    *metadataOnly &= node.isMetadataOnly;
    if (![self.ownerId isEqual:node.ownerId] || ![self.rootId isEqual:node.rootId]) return @"metadata-owner-mismatch";
    if (node.hidden) continue;
    if (!node.descriptorId.length || !node.descriptorRevision.length || [ids containsObject:node.descriptorId]) return @"invalid-descriptor-identity";
    [ids addObject:node.descriptorId];
    [nodes addObject:@{@"descriptorId":node.descriptorId, @"descriptorRevision":node.descriptorRevision,
      @"parentDescriptorId":parentId, @"target":@(node.tag), @"index":@(position++)}];
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
- (void)mountingTransactionDidMount:(const MountingTransaction &)transaction withSurfaceTelemetry:(const SurfaceTelemetry &)surfaceTelemetry
{
  SurfaceId surface = [self currentSurfaceId];
  if (!self.window || surface != transaction.getSurfaceId()) return;
  _lastSurfaceId = surface;
  [self publishAttached:YES surface:surface mount:[NSString stringWithFormat:@"ios-surface:%d:mount:%lld", surface, (long long)transaction.getNumber()]];
}
- (void)prepareForRecycle
{
  _epoch++; _boundWindow = nil; _windowId = @""; _rootRevision = @""; _lastSignature = @""; _lastSurfaceId = -1;
  [super prepareForRecycle];
}
@end

Class<RCTComponentViewProtocol> CUICollectionRootCls(void) { return CUICollectionRoot.class; }
