#import "CUIDragInteractions.h"
#import "CUIDragAction.h"
#import "CUIDragDataStore.h"
#import "CUIInputWindow.h"
#import "CUIKeyboardScope.h"
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <QuartzCore/QuartzCore.h>
#include "../cpp/drag/Motion.h"
#include <cmath>
#include <climits>

static uint64_t CUIDragEpoch;
static NSString *const CUIStringMapType = @"app.codon-ui.drag-string-map";
static NSString *const CUILocalType = @"app.codon-ui.local-drag";
static NSString *const CUIEncodedType = @"app.codon-ui.drag-type.f";
static NSInteger CUITag(id value, BOOL zero = NO) {
  if (![value isKindOfClass:NSNumber.class] || !isfinite([value doubleValue]) || [value doubleValue] != floor([value doubleValue]) ||
      [value doubleValue] < (zero ? 0 : 1) || [value doubleValue] > INT_MAX)
    @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-original-target-invalid" userInfo:nil];
  return [value integerValue];
}
static NSString *CUIString(id value) {
  if (![value isKindOfClass:NSString.class]) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-original-string-invalid" userInfo:nil];
  return value;
}
static NSString *CUITypeForString(NSString *value) {
  NSMutableString *result = [CUIEncodedType mutableCopy]; NSData *bytes = [value dataUsingEncoding:NSUTF8StringEncoding];
  const uint8_t *data = (const uint8_t *)bytes.bytes;
  for (NSUInteger index = 0; index < bytes.length; index++) [result appendFormat:@"%02x", data[index]];
  return result;
}
static NSString *CUIStringForType(NSString *type) {
  if (![type hasPrefix:CUIEncodedType]) return nil;
  NSString *hex = [type substringFromIndex:CUIEncodedType.length]; if (hex.length % 2) return nil;
  NSMutableData *bytes = [NSMutableData data];
  for (NSUInteger index = 0; index < hex.length; index += 2) {
    unsigned int value = 0; NSScanner *scanner = [NSScanner scannerWithString:[hex substringWithRange:NSMakeRange(index, 2)]];
    if (![scanner scanHexInt:&value] || !scanner.isAtEnd) return nil;
    uint8_t byte = value; [bytes appendBytes:&byte length:1];
  }
  return [[NSString alloc] initWithData:bytes encoding:NSUTF8StringEncoding];
}
static NSDictionary *CUIRect(UIView *view, UIWindow *window) {
  CGRect rect = [view convertRect:view.bounds toView:window];
  if (!isfinite(rect.origin.x) || !isfinite(rect.origin.y) || !isfinite(rect.size.width) || !isfinite(rect.size.height) || rect.size.width < 0 || rect.size.height < 0)
    @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-original-geometry-invalid" userInfo:nil];
  return @{ @"x": @(rect.origin.x), @"y": @(rect.origin.y), @"width": @(rect.size.width), @"height": @(rect.size.height) };
}
static BOOL CUIDescendant(UIView *view, UIView *root) { for (UIView *item = view; item; item = item.superview) if (item == root) return YES; return NO; }

@class CUIDragBinding;
@interface CUIDragTransfer : NSObject
@property(nonatomic, copy) NSString *identifier;
@property(nonatomic, copy) NSString *moduleId;
@property(nonatomic, copy) NSArray<NSArray<NSDictionary *> *> *maps;
@property(nonatomic, copy) NSArray<NSString *> *operations;
@property(nonatomic, copy) NSString *selected;
@property(nonatomic, assign) BOOL attempted, accepted, ended;
@property(nonatomic, weak) CUIDragBinding *source;
@property(nonatomic, weak) id<UIDragSession> session;
@property(nonatomic, weak) UIView *sourceView;
@property(nonatomic, copy) NSString *sourceKey, *sourceInstance;
@end
@implementation CUIDragTransfer
@end

@interface CUIDragMember : NSObject
@property(nonatomic, copy) NSDictionary *data;
@property(nonatomic, weak) UIView *view;
@property(nonatomic, assign) BOOL resolved, handleResolved;
@property(nonatomic, weak) UIView *handle;
@end
@implementation CUIDragMember
@end

@interface CUIDragBinding : NSObject <UIDragInteractionDelegate, UIDropInteractionDelegate> { @public codon::drag::HoverActivation _hover; }
@property(nonatomic, weak) CUIDragInteractions *owner;
@property(nonatomic, copy) NSDictionary *data;
@property(nonatomic, weak) UIView *root;
@property(nonatomic, strong) UIDragInteraction *drag;
@property(nonatomic, strong) UIDropInteraction *drop;
@property(nonatomic, strong) NSMutableDictionary<NSString *, CUIDragMember *> *members;
@property(nonatomic, strong) NSMapTable<id<UIDragSession>, CUIDragTransfer *> *sources;
@property(nonatomic, strong) NSMapTable<id<UIDropSession>, NSString *> *destinations;
@property(nonatomic, weak) UIView *preview;
@property(nonatomic, copy) NSString *previewIdentity;
@property(nonatomic, assign) BOOL retired, rootResolved, ready, motionDirty, hasScrollOffset;
@property(nonatomic, weak) UIView *scrollHost;
@property(nonatomic, copy) NSString *scrollIdentity;
@property(nonatomic, weak) UIScrollView *activeScroller;
@property(nonatomic, assign) CGPoint scrollOffset, motionPoint;
@property(nonatomic, assign) BOOL hasMotionPoint;
@property(nonatomic, strong) CADisplayLink *motionLink;
@property(nonatomic, weak) id<UIDropSession> motionSession;
@property(nonatomic, copy) NSDictionary *motionReply;
- (BOOL)owns:(CUIDragTransfer *)transfer;
- (BOOL)current;
- (void)refresh;
- (void)retire;
- (void)stopMotion;
- (void)startMotionFrames;
- (void)motionFrame:(CADisplayLink *)link;
- (NSDictionary *)updateTarget:(id<UIDropSession>)session;
- (void)trackMotion:(id<UIDropSession>)session reply:(NSDictionary *)reply;
@end

@interface CUIDragInteractions ()
@property(nonatomic, weak) CUIKeyboardScope *scope;
@property(nonatomic, weak) UIWindow *window;
@property(nonatomic, assign) uint64_t epoch, geometryRevision;
@property(nonatomic, copy) NSArray<NSDictionary *> *configuration;
@property(nonatomic, strong) NSMutableDictionary<NSString *, CUIDragBinding *> *bindings;
@property(nonatomic, strong) NSMutableDictionary<NSString *, NSString *> *statuses;
@property(nonatomic, copy) NSString *windowStatus, *ownerIdentity, *windowIdentity;
@property(nonatomic, assign) int32_t surfaceIdentity;
@property(nonatomic, assign) BOOL closed;
- (BOOL)canLift;
- (BOOL)canDrop;
- (void)status:(CUIDragBinding *)binding ready:(BOOL)ready error:(NSString *)error kind:(NSString *)kind;
- (NSDictionary *)action:(CUIDragBinding *)binding kind:(NSString *)kind session:(NSString *)session member:(CUIDragMember *)member point:(CGPoint)point values:(NSDictionary *)values current:(BOOL (^)(void))current;
@end

@implementation CUIDragInteractions
- (instancetype)initWithScope:(CUIKeyboardScope *)scope {
  if (self = [super init]) { _scope = scope; _configuration = @[]; _bindings = [NSMutableDictionary new]; _statuses = [NSMutableDictionary new]; }
  return self;
}
- (BOOL)available { return !_closed && _scope && _scope.window && _scope.dragEnabled && _scope.dragSurfaceId > 0; }
- (BOOL)canLift { return [self available] && _scope.window.isKeyWindow && UIApplication.sharedApplication.applicationState == UIApplicationStateActive; }
- (BOOL)canDrop { return [self available] && !_scope.window.hidden && UIApplication.sharedApplication.applicationState != UIApplicationStateBackground; }
- (NSDictionary *)session {
  return @{ @"scopeOwnerId": _scope.activationSession[@"scopeOwnerId"] ?: @"", @"windowId": CUIInputWindowIdentity(_scope.window), @"epoch": @(_epoch), @"surfaceId": @(_scope.dragSurfaceId) };
}
- (void)update:(NSString *)encoded {
  NSError *error; id value = [NSJSONSerialization JSONObjectWithData:[encoded dataUsingEncoding:NSUTF8StringEncoding] options:0 error:&error];
  if (error || ![value isKindOfClass:NSArray.class]) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-bindings-invalid" userInfo:nil];
  NSMutableSet *ids = [NSMutableSet new], *roots = [NSMutableSet new];
  for (NSDictionary *binding in value) {
    if (![binding isKindOfClass:NSDictionary.class] || !CUIString(binding[@"bindingId"]).length || !CUIString(binding[@"revision"]).length || !CUIString(binding[@"moduleId"]).length ||
        ![binding[@"members"] isKindOfClass:NSArray.class] || [ids containsObject:binding[@"bindingId"]] || [roots containsObject:binding[@"rootTarget"]])
      @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-bindings-ambiguous" userInfo:nil];
    CUITag(binding[@"rootTarget"]); CUITag(binding[@"previewTarget"], YES);
    if (binding[@"scrollTarget"]) { NSInteger scroll = CUITag(binding[@"scrollTarget"], YES); if (scroll && !CUIString(binding[@"scrollInstanceId"]).length) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-original-scroll-identity-invalid" userInfo:nil]; } [ids addObject:binding[@"bindingId"]]; [roots addObject:binding[@"rootTarget"]];
    NSMutableSet *keys = [NSMutableSet new], *instances = [NSMutableSet new];
    for (NSDictionary *member in binding[@"members"]) {
      CUIString(member[@"key"]); NSString *instance = CUIString(member[@"instanceId"]); CUITag(member[@"targetTag"]); CUITag(member[@"handleTag"], YES);
      if (member[@"role"] && ![@[@"source", @"target", @"both"] containsObject:member[@"role"]]) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-member-role-invalid" userInfo:nil];
      if (!instance.length || [keys containsObject:[NSString stringWithFormat:@"%@:%@", member[@"key"], member[@"role"] ?: @"both"]] || [instances containsObject:instance]) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-members-ambiguous" userInfo:nil];
      [keys addObject:[NSString stringWithFormat:@"%@:%@", member[@"key"], member[@"role"] ?: @"both"]]; [instances addObject:instance];
    }
  }
  _configuration = value;
  for (NSString *key in _bindings.allKeys) {
    NSDictionary *next = nil; for (NSDictionary *candidate in value) if ([candidate[@"bindingId"] isEqual:key]) { next = candidate; break; }
    CUIDragBinding *old = _bindings[key];
    if (!next || ![next[@"revision"] isEqual:old.data[@"revision"]] || ![next[@"moduleId"] isEqual:old.data[@"moduleId"]] || ![next[@"rootTarget"] isEqual:old.data[@"rootTarget"]]) { [old retire]; [_bindings removeObjectForKey:key]; [_statuses removeObjectForKey:key]; }
  }
  for (NSDictionary *data in value) {
    CUIDragBinding *binding = _bindings[data[@"bindingId"]];
    if (!binding) { binding = [CUIDragBinding new]; binding.owner = self; binding.members = [NSMutableDictionary new]; binding.sources = NSMapTable.weakToStrongObjectsMapTable; binding.destinations = NSMapTable.weakToStrongObjectsMapTable; _bindings[data[@"bindingId"]] = binding; }
    binding.data = data;
  }
}
- (void)refreshWindow {
  if (_closed || !_scope) return;
  NSString *owner = _scope.activationSession[@"scopeOwnerId"] ?: @"";
  NSString *window = CUIInputWindowIdentity(_scope.window);
  if (_window != _scope.window || ![_windowIdentity isEqual:window] || ![_ownerIdentity isEqual:owner] || (_scope.dragSurfaceId > 0 && _surfaceIdentity > 0 && _surfaceIdentity != _scope.dragSurfaceId)) {
    _window = _scope.window; _windowIdentity = window; _ownerIdentity = owner; _surfaceIdentity = _scope.dragSurfaceId; _epoch = ++CUIDragEpoch; _windowStatus = nil;
    for (CUIDragBinding *binding in _bindings.allValues) { [binding retire]; binding.retired = NO; }
    [_statuses removeAllObjects];
  }
  if (_scope.dragSurfaceId > 0 && _epoch > 0) {
    NSDictionary *status = @{ @"kind": @"window", @"ownerId": owner, @"windowId": CUIInputWindowIdentity(_scope.window), @"epoch": @(_epoch), @"surfaceId": @(_scope.dragSurfaceId), @"scopeTarget": @(_scope.tag),
      @"available": @([self available]), @"canLift": @([self canLift]), @"canDrop": @([self canDrop]) };
    NSString *signature = [[NSString alloc] initWithData:[NSJSONSerialization dataWithJSONObject:status options:NSJSONWritingSortedKeys error:nil] encoding:NSUTF8StringEncoding];
    if (![_windowStatus isEqual:signature]) { _windowStatus = signature; [_scope emitDragStatus:status]; }
  }
  for (CUIDragBinding *binding in _bindings.allValues) { binding.drag.enabled = [binding.data[@"draggable"] boolValue] && ([self canLift] || binding.sources.count > 0); if (![self canDrop]) [binding stopMotion]; }
}
- (void)refresh {
  [self refreshWindow];
  if (_closed || !_scope) return;
  for (CUIDragBinding *binding in _bindings.allValues) [binding refresh];
}
- (void)status:(CUIDragBinding *)binding ready:(BOOL)ready error:(NSString *)error kind:(NSString *)kind {
  if (!_scope || _epoch == 0) return;
  NSDictionary *record = @{ @"kind": kind, @"ownerId": _ownerIdentity ?: @"", @"windowId": CUIInputWindowIdentity(_scope.window), @"epoch": @(_epoch),
    @"moduleId": binding.data[@"moduleId"], @"bindingId": binding.data[@"bindingId"], @"revision": binding.data[@"revision"], @"rootTarget": binding.data[@"rootTarget"], @"ready": @(ready), @"error": error ?: @"" };
  NSString *encoded = [[NSString alloc] initWithData:[NSJSONSerialization dataWithJSONObject:record options:NSJSONWritingSortedKeys error:nil] encoding:NSUTF8StringEncoding];
  if (![kind isEqual:@"binding"] || ![_statuses[binding.data[@"bindingId"]] isEqual:encoded]) { _statuses[binding.data[@"bindingId"]] = encoded; [_scope emitDragStatus:record]; }
}
- (NSDictionary *)action:(CUIDragBinding *)binding kind:(NSString *)kind session:(NSString *)session member:(CUIDragMember *)member point:(CGPoint)point values:(NSDictionary *)values current:(BOOL (^)(void))current {
  if (![binding current] || !current() || !isfinite(point.x) || !isfinite(point.y)) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-original-session-retired" userInfo:nil];
  NSDictionary *activation = self.session;
  NSDictionary *identity = @{ @"moduleId": binding.data[@"moduleId"], @"ownerId": activation[@"scopeOwnerId"], @"bindingId": binding.data[@"bindingId"], @"revision": binding.data[@"revision"],
    @"windowId": activation[@"windowId"], @"epoch": activation[@"epoch"], @"surfaceId": activation[@"surfaceId"], @"scopeTarget": @(_scope.tag), @"rootTarget": binding.data[@"rootTarget"],
    @"itemTarget": member ? member.data[@"targetTag"] : @0, @"sessionId": session, @"kind": kind };
  NSMutableArray *rectangles = [NSMutableArray new];
  for (CUIDragMember *item in binding.members.allValues) if (item.view.window == _scope.window && CUIDescendant(item.view, binding.root))
    [rectangles addObject:@{ @"key": item.data[@"key"], @"instanceId": item.data[@"instanceId"], @"targetTag": item.data[@"targetTag"], @"role": item.data[@"role"] ?: @"both", @"rect": CUIRect(item.view, _scope.window) }];
  NSMutableDictionary *payload = [values mutableCopy] ?: [NSMutableDictionary new]; payload[@"x"] = @(point.x); payload[@"y"] = @(point.y);
  payload[@"geometry"] = @{ @"revision": @(++_geometryRevision), @"root": CUIRect(binding.root, _scope.window), @"items": rectangles };
  if (member) { payload[@"key"] = member.data[@"key"]; payload[@"instanceId"] = member.data[@"instanceId"]; }
  NSString *response = CUIRunDragAction(_scope, identity, payload, YES, ^BOOL{
    return [binding current] && (!member || (binding.members[member.data[@"instanceId"]] == member && member.view &&
      member.view.window == binding.root.window && CUIDescendant(member.view, binding.root))) && current();
  });
  NSError *error; id parsed = [NSJSONSerialization JSONObjectWithData:[response dataUsingEncoding:NSUTF8StringEncoding] options:0 error:&error];
  if (error || ![parsed isKindOfClass:NSDictionary.class] || parsed[@"error"]) @throw [NSException exceptionWithName:@"CUI.Drag" reason:[parsed[@"error"] isKindOfClass:NSString.class] ? parsed[@"error"] : @"native-drag-original-response-invalid" userInfo:nil];
  return parsed;
}
- (NSDictionary *)geometry:(NSDictionary *)request {
  CUIDragBinding *binding = _bindings[CUIString(request[@"bindingId"])];
  NSDictionary *session = self.session;
  if (![binding current] || ![request[@"moduleId"] isEqual:binding.data[@"moduleId"]] ||
      ![request[@"revision"] isEqual:binding.data[@"revision"]] || ![request[@"rootTarget"] isEqual:binding.data[@"rootTarget"]] ||
      ![request[@"ownerId"] isEqual:session[@"scopeOwnerId"]] || ![request[@"windowId"] isEqual:session[@"windowId"]] ||
      ![request[@"epoch"] isEqual:session[@"epoch"]] || [request[@"scopeTarget"] integerValue] != _scope.tag)
    @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-original-geometry-owner-retired" userInfo:nil];
  NSMutableArray *items = [NSMutableArray new];
  for (CUIDragMember *member in binding.members.allValues) if (member.view && member.view.window == _scope.window && CUIDescendant(member.view,binding.root)) {
    NSMutableDictionary *item = [@{ @"key": member.data[@"key"], @"instanceId": member.data[@"instanceId"], @"targetTag": member.data[@"targetTag"], @"role": member.data[@"role"] ?: @"both", @"rect": CUIRect(member.view,_scope.window), @"handleTag": @0 } mutableCopy];
    if (member.handle && member.handle.window == _scope.window && CUIDescendant(member.handle,member.view)) { item[@"handleTag"] = member.data[@"handleTag"]; item[@"handleRect"] = CUIRect(member.handle,_scope.window); }
    [items addObject:item];
  }
  return @{ @"requestId": CUIString(request[@"requestId"]), @"windowId": session[@"windowId"], @"epoch": session[@"epoch"],
    @"geometry": @{ @"revision": @(++_geometryRevision), @"root": CUIRect(binding.root,_scope.window), @"items": items } };
}
- (void)invalidate { if (_closed) return; for (CUIDragBinding *binding in _bindings.allValues) [binding retire]; [_bindings removeAllObjects]; _closed = YES; }
@end

@implementation CUIDragBinding
- (BOOL)current { return _ready && !_retired && [_owner available] && _root.window == _owner.scope.window && CUIDescendant(_root, _owner.scope) &&
  _root == CUIResolveDragView(_data[@"moduleId"], [_data[@"rootTarget"] integerValue]); }
- (void)refresh {
  _ready = NO;
  if (_retired || ![_owner available]) { [_owner status:self ready:NO error:@"" kind:@"binding"]; return; }
  @try {
    UIView *root = CUIResolveDragView(_data[@"moduleId"], [_data[@"rootTarget"] integerValue]);
    if (!root || root.window != _owner.scope.window || !CUIDescendant(root, _owner.scope) || (_rootResolved && root != _root)) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-original-root-unavailable" userInfo:nil];
    _root = root; _rootResolved = YES;
    if (!_drag && [_data[@"draggable"] boolValue]) { _drag = [[UIDragInteraction alloc] initWithDelegate:self]; _drag.allowsSimultaneousRecognitionDuringLift = YES; [_root addInteraction:_drag]; }
    if (!_drop && [_data[@"droppable"] boolValue]) { _drop = [[UIDropInteraction alloc] initWithDelegate:self]; [_root addInteraction:_drop]; }
    _drag.enabled = [_data[@"draggable"] boolValue] && ([_owner canLift] || _sources.count > 0);
    NSMutableSet *keep = [NSMutableSet new];
    for (NSDictionary *descriptor in _data[@"members"]) {
      NSString *identity = descriptor[@"instanceId"]; [keep addObject:identity];
      CUIDragMember *member = _members[identity];
      if (!member) { member = [CUIDragMember new]; member.data = descriptor; _members[identity] = member; }
      if (![member.data[@"key"] isEqual:descriptor[@"key"]] || ![member.data[@"targetTag"] isEqual:descriptor[@"targetTag"]] || ![(member.data[@"role"] ?: @"both") isEqual:(descriptor[@"role"] ?: @"both")]) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-original-member-retargeted" userInfo:nil];
      if (![member.data[@"handleTag"] isEqual:descriptor[@"handleTag"]]) { member.handleResolved = NO; member.handle = nil; }
      member.data = descriptor;
      UIView *view = CUIResolveDragView(_data[@"moduleId"], [descriptor[@"targetTag"] integerValue]);
      if (!view || view.window != _root.window || !CUIDescendant(view, _root) || (member.resolved && member.view != view)) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-original-member-unavailable" userInfo:nil];
      member.view = view; member.resolved = YES;
      if ([descriptor[@"handleTag"] integerValue]) {
        UIView *handle = CUIResolveDragView(_data[@"moduleId"], [descriptor[@"handleTag"] integerValue]);
        if (!handle || handle.window != _root.window || !CUIDescendant(handle, view) || (member.handleResolved && member.handle != handle)) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-original-handle-unavailable" userInfo:nil];
        member.handle = handle; member.handleResolved = YES;
      }
    }
    for (NSString *key in _members.allKeys) if (![keep containsObject:key]) [_members removeObjectForKey:key];
    if ([_data[@"previewTarget"] integerValue]) {
      NSString *identity = [NSString stringWithFormat:@"%@:%@", _data[@"previewInstanceId"], _data[@"previewTarget"]];
      UIView *preview = CUIResolveDragView(_data[@"moduleId"], [_data[@"previewTarget"] integerValue]);
      if (!preview || preview.window != _root.window || ([_previewIdentity isEqual:identity] && _preview != preview)) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-original-preview-unavailable" userInfo:nil];
      _previewIdentity = identity; _preview = preview;
    } else { _preview = nil; _previewIdentity = nil; }
    NSInteger scrollTag = [_data[@"scrollTarget"] integerValue];
    if (scrollTag) {
      NSString *identity = [NSString stringWithFormat:@"%@:%@", _data[@"scrollInstanceId"], _data[@"scrollTarget"]];
      UIView *host = CUIResolveDragView(_data[@"moduleId"], scrollTag);
      if (!host || host.window != _root.window || (!CUIDescendant(host,_root) && !CUIDescendant(_root,host)) || ([_scrollIdentity isEqual:identity] && _scrollHost != host)) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-original-scroll-host-unavailable" userInfo:nil];
      if (![_scrollIdentity isEqual:identity]) { _activeScroller = nil; _hasScrollOffset = NO; }
      _scrollIdentity = identity; _scrollHost = host;
    } else { _scrollHost = nil; _scrollIdentity = nil; }
    _ready = YES; _motionDirty = YES;
    if (_motionSession) [self startMotionFrames];
    [_owner status:self ready:YES error:@"" kind:@"binding"];
  } @catch (NSException *error) { [_owner status:self ready:NO error:error.reason kind:@"binding"]; }
}
- (void)retire { [self stopMotion]; _scrollHost = nil; _scrollIdentity = nil; _ready = NO; _retired = YES; for (CUIDragTransfer *source in _sources.objectEnumerator) source.ended = YES; [_sources removeAllObjects]; _rootResolved = NO; if (_drag) [_root removeInteraction:_drag]; if (_drop) [_root removeInteraction:_drop]; _drag = nil; _drop = nil; _root = nil; [_members removeAllObjects]; _preview = nil; _previewIdentity = nil; }
- (CUIDragMember *)memberAt:(CGPoint)point {
  UIView *hit = [_root hitTest:[_owner.scope.window convertPoint:point toView:_root] withEvent:nil];
  CUIDragMember *selected = nil;
  for (CUIDragMember *member in _members.allValues) if (![member.data[@"role"] isEqual:@"target"] && member.view && CUIDescendant(hit, member.view) && (!selected || CUIDescendant(member.view, selected.view))) selected = member;
  return selected;
}
- (BOOL)owns:(CUIDragTransfer *)transfer {
  CUIDragMember *member = _members[transfer.sourceInstance];
  return [self current] && !transfer.ended && transfer.source == self && transfer.sourceView && member.view == transfer.sourceView &&
    [member.data[@"key"] isEqual:transfer.sourceKey] && transfer.sourceView.window == _root.window;
}
- (CUIDragTransfer *)prepare:(id<UIDragSession>)session {
  CUIDragTransfer *known = [_sources objectForKey:session]; if (known) return known;
  if (![self current] || ![_owner canLift]) return nil;
  CGPoint point = [session locationInView:_owner.scope.window]; CUIDragMember *member = [self memberAt:point]; if (!member) return nil;
  CUIDragTransfer *transfer = [CUIDragTransfer new]; transfer.identifier = NSUUID.UUID.UUIDString; transfer.moduleId = _data[@"moduleId"]; transfer.source = self; transfer.session = session;
  transfer.sourceView = member.view; transfer.sourceKey = member.data[@"key"]; transfer.sourceInstance = member.data[@"instanceId"]; [_sources setObject:transfer forKey:session];
  @try {
    NSDictionary *response = [_owner action:self kind:@"lift" session:transfer.identifier member:member point:point values:@{} current:^BOOL{ return !transfer.ended && transfer.session == session && member.view == transfer.sourceView; }];
    if (![response[@"items"] isKindOfClass:NSArray.class] || ![response[@"operations"] isKindOfClass:NSArray.class]) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-original-lift-response-invalid" userInfo:nil];
    NSMutableArray *maps = [NSMutableArray new];
    for (NSArray *rows in response[@"items"]) {
      if (![rows isKindOfClass:NSArray.class]) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-original-representations-invalid" userInfo:nil];
      NSMutableSet *types = [NSMutableSet new];
      for (NSDictionary *row in rows) { NSString *type = CUIString(row[@"type"]); CUIString(row[@"data"]); if (row.count != 2 || [types containsObject:type]) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-original-representation-duplicate" userInfo:nil]; [types addObject:type]; }
      [maps addObject:rows];
    }
    for (id operation in response[@"operations"]) if (![@[@"copy",@"move",@"link",@"cancel"] containsObject:operation]) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-original-operation-invalid" userInfo:nil];
    transfer.maps = maps; transfer.operations = response[@"operations"]; session.localContext = transfer;
    [self refresh];
    if ([response[@"previewExpected"] boolValue] && (!_preview || _preview.bounds.size.width <= 0 || _preview.bounds.size.height <= 0)) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-authored-preview-unavailable" userInfo:nil];
    return transfer;
  } @catch (NSException *error) { transfer.ended = YES; [_sources removeObjectForKey:session]; [_owner status:self ready:NO error:error.reason kind:@"binding"]; return nil; }
}
- (NSArray<UIDragItem *> *)dragInteraction:(UIDragInteraction *)interaction itemsForBeginningSession:(id<UIDragSession>)session {
  CUIDragTransfer *transfer = [self prepare:session]; if (!transfer) return @[];
  NSMutableArray *items = [NSMutableArray new]; BOOL copies = [transfer.operations containsObject:@"copy"];
  for (NSArray<NSDictionary *> *rows in transfer.maps) {
    NSItemProvider *provider = [NSItemProvider new]; NSData *wire = [NSJSONSerialization dataWithJSONObject:rows options:0 error:nil];
    [provider registerDataRepresentationForTypeIdentifier:copies ? CUIStringMapType : CUILocalType visibility:NSItemProviderRepresentationVisibilityAll loadHandler:^NSProgress *(void (^complete)(NSData *, NSError *)) { complete(copies ? wire : [transfer.identifier dataUsingEncoding:NSUTF8StringEncoding], nil); return nil; }];
    if (copies) for (NSDictionary *row in rows) {
      NSString *mime = row[@"type"], *encoded = CUITypeForString(mime); NSData *data = [row[@"data"] dataUsingEncoding:NSUTF8StringEncoding];
      [provider registerDataRepresentationForTypeIdentifier:encoded visibility:NSItemProviderRepresentationVisibilityAll loadHandler:^NSProgress *(void (^complete)(NSData *, NSError *)) { complete(data,nil); return nil; }];
      UTType *type = [UTType typeWithMIMEType:mime];
      if (type && ![provider.registeredTypeIdentifiers containsObject:type.identifier]) [provider registerDataRepresentationForTypeIdentifier:type.identifier visibility:NSItemProviderRepresentationVisibilityAll loadHandler:^NSProgress *(void (^complete)(NSData *, NSError *)) { complete(data,nil); return nil; }];
    }
    UIDragItem *item = [[UIDragItem alloc] initWithItemProvider:provider]; item.localObject = transfer; [items addObject:item];
  }
  if (!items.count) { transfer.ended = YES; [_sources removeObjectForKey:session]; [_owner status:self ready:YES error:@"" kind:@"retired"]; }
  return items;
}
- (BOOL)dragInteraction:(UIDragInteraction *)interaction sessionAllowsMoveOperation:(id<UIDragSession>)session { return [[self prepare:session].operations containsObject:@"move"]; }
- (BOOL)dragInteraction:(UIDragInteraction *)interaction sessionIsRestrictedToDraggingApplication:(id<UIDragSession>)session { return ![[self prepare:session].operations containsObject:@"copy"]; }
- (UITargetedDragPreview *)dragInteraction:(UIDragInteraction *)interaction previewForLiftingItem:(UIDragItem *)item session:(id<UIDragSession>)session {
  CUIDragTransfer *transfer = [_sources objectForKey:session]; if (!transfer || ![self owns:transfer]) return nil;
  UIView *view = _preview ?: transfer.sourceView; if (!view || view.window != _owner.scope.window) return nil;
  if (!_preview) return [[UITargetedDragPreview alloc] initWithView:view];
  CGPoint pointer = [session locationInView:view.window]; CGPoint center = CGPointMake(pointer.x - [_data[@"previewX"] doubleValue] + view.bounds.size.width/2, pointer.y - [_data[@"previewY"] doubleValue] + view.bounds.size.height/2);
  UIDragPreviewTarget *target = [[UIDragPreviewTarget alloc] initWithContainer:view.window center:center];
  return [[UITargetedDragPreview alloc] initWithView:view parameters:[UIDragPreviewParameters new] target:target];
}
- (void)dragInteraction:(UIDragInteraction *)interaction sessionDidMove:(id<UIDragSession>)session {
  CUIDragTransfer *transfer = [_sources objectForKey:session]; if (!transfer || ![self owns:transfer]) return;
  @try { [_owner action:self kind:@"move" session:transfer.identifier member:_members[transfer.sourceInstance] point:[session locationInView:_owner.scope.window] values:@{} current:^BOOL{ return !transfer.ended && transfer.session == session; }]; }
  @catch (NSException *error) { [_owner status:self ready:NO error:error.reason kind:@"binding"]; }
}
- (void)dragInteraction:(UIDragInteraction *)interaction session:(id<UIDragSession>)session didEndWithOperation:(UIDropOperation)operation {
  CUIDragTransfer *transfer = [_sources objectForKey:session]; if (!transfer || transfer.ended) return;
  @try {
    NSString *selected = transfer.attempted ? transfer.accepted ? transfer.selected : @"cancel" : operation == UIDropOperationMove && [transfer.operations containsObject:@"move"] ? @"move" : operation == UIDropOperationCopy && [transfer.operations containsObject:@"copy"] ? @"copy" : @"cancel";
    if ([self owns:transfer]) [_owner action:self kind:@"end" session:transfer.identifier member:_members[transfer.sourceInstance] point:[session locationInView:_owner.scope.window] values:@{ @"operation": selected, @"nativeOperation": @(operation) } current:^BOOL{ return !transfer.ended && transfer.session == session; }];
  } @catch (NSException *error) { [_owner status:self ready:NO error:error.reason kind:@"binding"]; }
  @finally { transfer.ended = YES; [_sources removeObjectForKey:session]; [self refresh]; }
}
- (CUIDragTransfer *)local:(id<UIDropSession>)session {
  id context = session.localDragSession.localContext;
  return [context isKindOfClass:CUIDragTransfer.class] && ((CUIDragTransfer *)context).session == session.localDragSession && !((CUIDragTransfer *)context).ended ? context : nil;
}
- (NSString *)identifier:(id<UIDropSession>)session {
  NSString *value = [_destinations objectForKey:session];
  if (!value) { CUIDragTransfer *local = [self local:session]; value = local ? local.identifier : NSUUID.UUID.UUIDString; [_destinations setObject:value forKey:session]; }
  return value;
}
- (NSDictionary *)types:(id<UIDropSession>)session {
  NSMutableOrderedSet *types = [NSMutableOrderedSet new]; BOOL directory = NO; CUIDragTransfer *local = [self local:session];
  if (local) for (NSArray *rows in local.maps) for (NSDictionary *row in rows) [types addObject:row[@"type"]];
  else for (UIDragItem *item in session.items) for (NSString *identifier in item.itemProvider.registeredTypeIdentifiers) {
    NSString *encoded = CUIStringForType(identifier); if (encoded) { [types addObject:encoded]; continue; }
    UTType *type = [UTType typeWithIdentifier:identifier]; if ([type conformsToType:UTTypeFolder]) directory = YES;
    if (type.preferredMIMEType) [types addObject:type.preferredMIMEType];
    if (![identifier isEqual:CUIStringMapType] && ![identifier isEqual:CUILocalType]) [types addObject:identifier];
  }
  return @{ @"types": types.array, @"directory": @(directory), @"operations": local && [local.source owns:local] ? local.operations : local && ![local.operations containsObject:@"copy"] ? @[] : @[@"copy"] };
}
- (BOOL)dropInteraction:(UIDropInteraction *)interaction canHandleSession:(id<UIDropSession>)session {
  if (![self local:session]) for (UIDragItem *item in session.items) if ([item.itemProvider.registeredTypeIdentifiers containsObject:CUILocalType]) return NO;
  return [self current] && [_data[@"droppable"] boolValue] && [_owner canDrop];
}
- (UIDropProposal *)dropInteraction:(UIDropInteraction *)interaction sessionDidUpdate:(id<UIDropSession>)session {
  @try {
    NSDictionary *reply = [self updateTarget:session];
    [self trackMotion:session reply:reply];
    NSString *operation = CUIString(reply[@"operation"]);
    if ([operation isEqual:@"link"]) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-link-proposal-unrepresentable" userInfo:nil];
    UIDropOperation native = [operation isEqual:@"copy"] ? UIDropOperationCopy : [operation isEqual:@"move"] && session.allowsMoveOperation ? UIDropOperationMove : UIDropOperationCancel;
    return [[UIDropProposal alloc] initWithDropOperation:native];
  } @catch (NSException *error) { [self stopMotion]; [_owner status:self ready:NO error:error.reason kind:@"binding"]; return [[UIDropProposal alloc] initWithDropOperation:UIDropOperationCancel]; }
}
- (void)dropInteraction:(UIDropInteraction *)interaction sessionDidExit:(id<UIDropSession>)session {
  [self stopMotion];
  @try { if ([self current]) [_owner action:self kind:@"exit" session:[self identifier:session] member:nil point:[session locationInView:_owner.scope.window] values:@{} current:^BOOL{ return [self current]; }]; }
  @catch (NSException *error) { [_owner status:self ready:NO error:error.reason kind:@"binding"]; }
}
- (void)dropInteraction:(UIDropInteraction *)interaction performDrop:(id<UIDropSession>)session {
  [self stopMotion];
  CUIDragTransfer *local = [self local:session]; if (local) local.attempted = YES;
  CUIDragDataStore *store = [CUIDragDataStore storeForModuleId:_data[@"moduleId"]]; NSString *handle = nil;
  @try {
    if (!store) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-data-module-retired" userInfo:nil];
    handle = local ? [store beginImportTextMaps:local.maps] : [store beginImportProviders:[session.items valueForKey:@"itemProvider"]];
    if (!handle.length) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-original-data-unavailable" userInfo:nil];
    NSMutableDictionary *values = [[self types:session] mutableCopy]; values[@"dataHandle"] = handle;
    NSDictionary *reply = [_owner action:self kind:@"drop" session:[self identifier:session] member:nil point:[session locationInView:_owner.scope.window] values:values current:^BOOL{ return [self dropInteraction:interaction canHandleSession:session]; }];
    if (![reply[@"accepted"] isEqual:@YES]) { [store releaseData:@{ @"moduleId": _data[@"moduleId"], @"handle": handle }]; return; }
    if (local) { local.accepted = YES; local.selected = CUIString(reply[@"operation"]); }
  } @catch (NSException *error) {
    if (handle.length) [store releaseData:@{ @"moduleId": _data[@"moduleId"], @"handle": handle }];
    [_owner status:self ready:NO error:error.reason kind:@"binding"];
  }
}
- (void)dropInteraction:(UIDropInteraction *)interaction sessionDidEnd:(id<UIDropSession>)session {
  [self stopMotion];
  @try { if ([self local:session].source != self && [self current]) [_owner action:self kind:@"end" session:[self identifier:session] member:nil point:CGPointZero values:@{ @"operation": @"cancel", @"external": @YES } current:^BOOL{ return [self current]; }]; }
  @catch (NSException *error) { [_owner status:self ready:NO error:error.reason kind:@"binding"]; }
  [_destinations removeObjectForKey:session];
}
- (NSDictionary *)updateTarget:(id<UIDropSession>)session {
  return [_owner action:self kind:@"target" session:[self identifier:session] member:nil point:[session locationInView:_owner.scope.window] values:[self types:session] current:^BOOL{ return [self dropInteraction:self.drop canHandleSession:session]; }];
}
- (void)startMotionFrames {
  if (_motionLink || !_motionSession) return;
  _motionLink = [CADisplayLink displayLinkWithTarget:self selector:@selector(motionFrame:)];
  [_motionLink addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
}
- (void)stopMotion {
  [_motionLink invalidate]; _motionLink = nil; _motionSession = nil; _motionReply = nil;
  _activeScroller = nil; _hasScrollOffset = NO; _hasMotionPoint = NO; _motionDirty = NO; _hover.stop();
}
- (void)trackMotion:(id<UIDropSession>)session reply:(NSDictionary *)reply {
  if (![self current] || ![_owner canDrop] || [reply[@"operation"] isEqual:@"cancel"]) { [self stopMotion]; return; }
  if (_motionSession && _motionSession != session) [self stopMotion];
  _motionSession = session; _motionReply = reply;
  NSDictionary *target = [reply[@"target"] isKindOfClass:NSDictionary.class] ? reply[@"target"] : nil;
  CGPoint point = [session locationInView:_owner.scope.window];
  _motionPoint = point; _hasMotionPoint = YES;
  NSString *identity = target ? [NSString stringWithFormat:@"%@:%@:%@", target[@"key"], target[@"instanceId"], target[@"position"]] : @"";
  _hover.update(identity.UTF8String ?: "", CUIString(reply[@"operation"]).UTF8String, point.x, point.y, [target[@"activate"] boolValue], CACurrentMediaTime()*1000);
  [self startMotionFrames];
}
- (UIScrollView *)explicitScroller {
  if (!_scrollHost) return nil;
  NSMutableArray<UIView *> *pending = [NSMutableArray arrayWithObject:_scrollHost]; UIScrollView *result = nil;
  while (pending.count) {
    UIView *view = pending.lastObject; [pending removeLastObject];
    if ([view isKindOfClass:UIScrollView.class]) {
      if (result) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-scroll-host-ambiguous" userInfo:nil];
      result = (UIScrollView *)view;
    } else [pending addObjectsFromArray:view.subviews];
  }
  if (!result) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-scroll-host-has-no-original-scroll-view" userInfo:nil];
  return result;
}
- (UIScrollView *)scroller {
  UIScrollView *preferred = [self explicitScroller]; UIView *start = preferred;
  if (!start) {
    NSDictionary *target = [_motionReply[@"target"] isKindOfClass:NSDictionary.class] ? _motionReply[@"target"] : nil; CUIDragMember *member = target ? _members[target[@"instanceId"]] : nil;
    start = member.view ? member.view.superview : _root;
  }
  for (UIView *view = start; view; view = view.superview) if ([view isKindOfClass:UIScrollView.class]) {
    UIScrollView *scroll = (UIScrollView *)view; UIEdgeInsets inset = scroll.adjustedContentInset;
    if (scroll.scrollEnabled && (scroll.contentSize.width + inset.left + inset.right > scroll.bounds.size.width || scroll.contentSize.height + inset.top + inset.bottom > scroll.bounds.size.height)) return scroll;
  }
  return nil;
}
- (BOOL)scrollMotion:(CGPoint)point edge:(BOOL *)edge {
  UIScrollView *scroll = [self scroller]; if (!scroll || scroll.window != _owner.scope.window) { _activeScroller = nil; _hasScrollOffset = NO; return NO; }
  CGRect box = [scroll convertRect:scroll.bounds toView:_owner.scope.window];
  UIEdgeInsets inset = scroll.adjustedContentInset; CGPoint offset = scroll.contentOffset;
  CGFloat minX = -inset.left, maxX = MAX(minX, scroll.contentSize.width-scroll.bounds.size.width+inset.right);
  CGFloat minY = -inset.top, maxY = MAX(minY, scroll.contentSize.height-scroll.bounds.size.height+inset.bottom);
  CGFloat dx = maxX>minX ? codon::drag::edgeScrollDelta(point.x-box.origin.x,box.size.width) : 0;
  CGFloat dy = maxY>minY ? codon::drag::edgeScrollDelta(point.y-box.origin.y,box.size.height) : 0;
  *edge = dx != 0 || dy != 0;
  BOOL external = _activeScroller == scroll && _hasScrollOffset && !CGPointEqualToPoint(_scrollOffset,offset);
  _activeScroller = scroll; _scrollOffset = offset; _hasScrollOffset = YES;
  if (external) return YES;
  CGPoint next = CGPointMake(MIN(maxX,MAX(minX,offset.x+dx)),MIN(maxY,MAX(minY,offset.y+dy)));
  if (CGPointEqualToPoint(next,offset)) return NO;
  [scroll setContentOffset:next animated:NO]; _scrollOffset = scroll.contentOffset;
  return !CGPointEqualToPoint(offset,_scrollOffset);
}
- (void)motionFrame:(CADisplayLink *)link {
  id<UIDropSession> session = _motionSession;
  if (!session || ![self dropInteraction:_drop canHandleSession:session]) { [self stopMotion]; return; }
  @try {
    CGPoint point = [session locationInView:_owner.scope.window]; BOOL edge = NO;
    BOOL moved = [self scrollMotion:point edge:&edge];
    double now = CACurrentMediaTime()*1000;
    BOOL due = _hover.initialized && !_hover.fired && now >= _hover.due;
    if (moved || _motionDirty || due || !_hasMotionPoint || !CGPointEqualToPoint(point,_motionPoint)) {
      _motionDirty = NO; NSDictionary *reply = [self updateTarget:session];
      if ([reply[@"operation"] isEqual:@"link"]) @throw [NSException exceptionWithName:@"CUI.Drag" reason:@"native-drag-link-proposal-unrepresentable" userInfo:nil];
      [self trackMotion:session reply:reply];
    }
    if (_motionSession == session && _hover.ready(now)) {
      NSDictionary *target = [_motionReply[@"target"] isKindOfClass:NSDictionary.class] ? _motionReply[@"target"] : nil; CUIDragMember *member = target ? _members[target[@"instanceId"]] : nil;
      if (member && member.view && [target[@"targetTag"] isEqual:member.data[@"targetTag"]])
        [_owner action:self kind:@"activate" session:[self identifier:session] member:member point:point values:@{ @"expectedTarget": target } current:^BOOL{ return [self dropInteraction:self.drop canHandleSession:session]; }];
    }
    if (!edge && (!_hover.initialized || _hover.fired) && !_motionDirty) { [_motionLink invalidate]; _motionLink = nil; }
  } @catch (NSException *error) { [self stopMotion]; [_owner status:self ready:NO error:error.reason kind:@"binding"]; }
}

@end
