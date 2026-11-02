#import "CUICollectionRoot.h"
#import "CUIInputWindow.h"
#import <QuartzCore/CADisplayLink.h>
#import <React/RCTMountingTransactionObserving.h>
#import <React/RCTRootComponentView.h>
#import <React/RCTTextInputComponentView.h>
#import <React/RCTComponentViewProtocol.h>
#import <React/RCTTouchableComponentViewProtocol.h>
#import <react/renderer/components/CodonNativeInputSpec/ComponentDescriptors.h>
#import <react/renderer/components/CodonNativeInputSpec/EventEmitters.h>
#import <react/renderer/components/CodonNativeInputSpec/Props.h>
#import <react/renderer/components/CodonNativeInputSpec/RCTComponentViewHelpers.h>
#include <react/renderer/mounting/ShadowViewMutation.h>
#include <cmath>

using namespace facebook::react;

static NSString *CUIEncode(id value) {
  NSData *data = [NSJSONSerialization dataWithJSONObject:value options:NSJSONWritingSortedKeys error:nil];
  return data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : @"";
}
static NSDictionary *CUIDecode(NSString *value) {
  if (![value isKindOfClass:NSString.class] || !value.length) return nil;
  id result = [NSJSONSerialization JSONObjectWithData:[value dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
  return [result isKindOfClass:NSDictionary.class] ? result : nil;
}
static BOOL CUIString(id value) { return [value isKindOfClass:NSString.class] && [value length] > 0; }
static NSInteger CUITag(id value) {
  if (![value isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)value) == CFBooleanGetTypeID()) return 0;
  double number = [value doubleValue];
  return isfinite(number) && number > 0 && number <= INT32_MAX && floor(number) == number ? (NSInteger)number : 0;
}
// The emitter is used only for surface identity: Text may return a nested fragment emitter.
// Native object identity is retained independently and retired on observed mount changes.
static SurfaceId CUISurface(UIView *view) {
  for (UIView *current = view; current; current = current.superview) {
    if ([current conformsToProtocol:@protocol(RCTTouchableComponentViewProtocol)]) {
      auto emitter = [(id<RCTTouchableComponentViewProtocol>)current touchEventEmitterAtPoint:CGPointZero];
      if (emitter && emitter->getEventTarget()) return emitter->getEventTarget()->getSurfaceId();
    }
    if ([current isKindOfClass:RCTRootComponentView.class]) return (SurfaceId)current.tag;
  }
  return -1;
}
static UIView *CUIOriginal(UIWindow *window, NSInteger tag) {
  UIView *view = [window viewWithTag:tag];
  return [view conformsToProtocol:@protocol(RCTComponentViewProtocol)] ? view : nil;
}
static BOOL CUIVisible(UIView *view, UIWindow *window) {
  if (!view || !window || view.window != window || !window.isKeyWindow) return NO;
  CGRect visible = [view convertRect:view.bounds toView:window];
  for (UIView *ancestor = view; ancestor; ancestor = ancestor.superview) {
    if (ancestor.hidden || ancestor.alpha <= 0) return NO;
    if (ancestor.clipsToBounds) visible = CGRectIntersection(visible, [ancestor convertRect:ancestor.bounds toView:window]);
  }
  return !CGRectIsEmpty(CGRectIntersection(visible, window.bounds));
}

@interface CUICollectionVisibleRecord : NSObject
@property(nonatomic, weak) UIView *original;
@property(nonatomic, weak) UIWindow *window;
@property(nonatomic, copy) NSDictionary *intent;
@property(nonatomic, copy) NSString *binding;
@property(nonatomic, copy) NSString *lease;
@end
@implementation CUICollectionVisibleRecord
@end

static NSMapTable<NSString *, CUICollectionRoot *> *CUIPublishers(void) {
  static NSMapTable *publishers;
  static dispatch_once_t once;
  dispatch_once(&once, ^{ publishers = NSMapTable.strongToWeakObjectsMapTable; });
  return publishers;
}
static NSUInteger CUINextPublisherInstance = 0;
@interface CUICollectionAdmissionTick : NSObject
@property(nonatomic, weak) CUICollectionRoot *owner;
- (void)tick:(CADisplayLink *)link;
@end
@interface CUICollectionRoot () <RCTCUICollectionRootViewProtocol, RCTMountingTransactionObserving>
- (CUICollectionVisibleRecord *)resolve:(NSString *)binding target:(NSInteger)target;
- (void)originalChanged:(UIView *)original;
- (void)reconcile;
@end
@implementation CUICollectionAdmissionTick
- (void)tick:(CADisplayLink *)link { [self.owner reconcile]; }
@end
@interface CUICollectionOptionAdmission ()
@property(nonatomic, weak) UIView *option;
@property(nonatomic, copy) NSString *identity;
@property(nonatomic, copy) BOOL (^check)(void);
@end
@implementation CUICollectionOptionAdmission
- (UIView *)originalOption { return self.option; }
- (NSString *)opaqueFocusIdentity { return self.identity; }
- (BOOL)current { return self.option && self.check && self.check(); }
@end

@implementation CUICollectionRoot {
  NSString *_publisher, *_publication, *_requests, *_lastSnapshot, *_lifetime;
  NSUInteger _instance, _sequence, _epoch, _lastRequestSequence;
  SurfaceId _surface;
  BOOL _mounting, _applicationActive;
  NSDictionary *_model, *_rootIntent;
  NSArray<NSDictionary *> *_receiverIntents;
  NSMutableDictionary<NSString *, CUICollectionVisibleRecord *> *_records;
  __weak UIWindow *_observedWindow;
  CADisplayLink *_availabilityLink;
}
+ (ComponentDescriptorProvider)componentDescriptorProvider { return concreteComponentDescriptorProvider<CUICollectionRootComponentDescriptor>(); }
- (instancetype)initWithFrame:(CGRect)frame {
  if ((self = [super initWithFrame:frame])) {
    _props = std::make_shared<const CUICollectionRootProps>();
    _records = [NSMutableDictionary new]; _receiverIntents = @[];
    _publication = @""; _requests = @"[]"; _lifetime = @""; _surface = -1;
    [self renewPublisher];
    NSNotificationCenter *center = NSNotificationCenter.defaultCenter;
    for (NSNotificationName name in @[UIApplicationWillResignActiveNotification, UIApplicationDidBecomeActiveNotification,
        UIWindowDidBecomeKeyNotification, UIWindowDidResignKeyNotification, UISceneWillDeactivateNotification, UISceneDidActivateNotification])
      [center addObserver:self selector:@selector(environmentChanged:) name:name object:nil];
  }
  return self;
}
- (void)renewPublisher {
  if (_publisher) [CUIPublishers() removeObjectForKey:_publisher];
  _publisher = NSUUID.UUID.UUIDString; _instance = ++CUINextPublisherInstance; _sequence = 0; _lastRequestSequence = 0;
  [CUIPublishers() setObject:self forKey:_publisher];
  _applicationActive = UIApplication.sharedApplication.applicationState == UIApplicationStateActive;
}
- (void)revokeAll {
  if (!_records.count && !_lifetime.length) return;
  [_records removeAllObjects]; _lifetime = @""; _epoch++; _lastSnapshot = nil;
}
- (BOOL)active {
  return !_mounting && _applicationActive && self.window && self.window.isKeyWindow &&
    UIApplication.sharedApplication.applicationState == UIApplicationStateActive &&
    self.window.windowScene.activationState == UISceneActivationStateForegroundActive && _surface > 0;
}
- (void)environmentChanged:(NSNotification *)notification {
  if ([notification.object isKindOfClass:UIWindow.class] && notification.object != self.window) return;
  if ([notification.object isKindOfClass:UIWindowScene.class] && notification.object != self.window.windowScene) return;
  if ([notification.name isEqual:UIApplicationWillResignActiveNotification] || [notification.name isEqual:UISceneWillDeactivateNotification]) _applicationActive = NO;
  if ([notification.name isEqual:UIApplicationDidBecomeActiveNotification] || [notification.name isEqual:UISceneDidActivateNotification]) _applicationActive = YES;
  [self revokeAll]; [self reconcile];
}
- (void)didMoveToWindow {
  [super didMoveToWindow];
  if (_observedWindow != self.window) { _observedWindow = self.window; [self revokeAll]; [self reconcile]; }
}
- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps {
  const auto &next = *std::static_pointer_cast<const CUICollectionRootProps>(props);
  NSString *publication = [NSString stringWithUTF8String:next.publication.c_str()];
  _requests = [NSString stringWithUTF8String:next.actionRequests.c_str()];
  if (![_publication isEqual:publication]) {
    _publication = publication; NSDictionary *packet = CUIDecode(publication);
    NSDictionary *model = [packet[@"model"] isKindOfClass:NSDictionary.class] ? packet[@"model"] : nil;
    NSDictionary *root = [packet[@"root"] isKindOfClass:NSDictionary.class] ? packet[@"root"] : nil;
    BOOL valid = CUIString(packet[@"intent"]) && CUIString(model[@"ownerId"]) && CUIString(model[@"generation"]) && CUIString(model[@"revision"]) &&
      [model[@"items"] isKindOfClass:NSArray.class] && CUIString(root[@"id"]) && CUITag(root[@"tag"]) && [packet[@"receivers"] isKindOfClass:NSArray.class];
    NSMutableSet *ids = [NSMutableSet new];
    for (id item in valid ? model[@"items"] : @[]) {
      if (![item isKindOfClass:NSDictionary.class] || !CUIString(item[@"itemId"]) || !CUIString(item[@"itemRevision"]) || [ids containsObject:item[@"itemId"]]) { valid = NO; break; }
      [ids addObject:item[@"itemId"]];
    }
    if (!valid || ![_model isEqual:model] || ![_rootIntent isEqual:root]) [self revokeAll];
    _model = valid ? model : nil; _rootIntent = valid ? root : nil; _receiverIntents = valid ? packet[@"receivers"] : @[];
  }
  [super updateProps:props oldProps:oldProps];
}
- (BOOL)member:(NSDictionary *)intent {
  if ([intent isEqual:_rootIntent]) return YES;
  for (NSDictionary *item in _model[@"items"]) if ([item[@"itemId"] isEqual:intent[@"itemId"]] && [item[@"itemRevision"] isEqual:intent[@"itemRevision"]]) return YES;
  return NO;
}
- (BOOL)matches:(CUICollectionVisibleRecord *)record {
  UIView *view = record.original; UIWindow *window = self.window;
  return [self active] && view && record.window == window && view.tag == CUITag(record.intent[@"tag"]) &&
    CUIOriginal(window, view.tag) == view &&
    CUISurface(view) == _surface && CUIVisible(view, window);
}
- (void)reconcile {
  if (_mounting) return;
  if (!_model || ![self active]) { [_availabilityLink invalidate]; _availabilityLink = nil; [self revokeAll]; [self publish]; return; }
  NSMutableArray *desired = [NSMutableArray arrayWithObject:_rootIntent];
  [desired addObjectsFromArray:_receiverIntents];
  NSMutableDictionary<NSString *, NSDictionary *> *accepted = [NSMutableDictionary new];
  NSMutableSet *duplicates = [NSMutableSet new], *tags = [NSMutableSet new], *occurrences = [NSMutableSet new];
  for (id intent in desired) {
    if (![intent isKindOfClass:NSDictionary.class] || !CUIString(intent[@"id"]) || !CUITag(intent[@"tag"]) || ![self member:intent]) continue;
    NSString *identifier = intent[@"id"], *occurrence = [intent isEqual:_rootIntent] ? @"" : intent[@"itemId"];
    if ([tags containsObject:intent[@"tag"]] || [occurrences containsObject:occurrence] || accepted[identifier]) {
      [duplicates addObject:identifier];
      for (NSString *key in accepted) if ([accepted[key][@"tag"] isEqual:intent[@"tag"]] || [(accepted[key][@"itemId"] ?: @"") isEqual:occurrence]) [duplicates addObject:key];
    }
    [tags addObject:intent[@"tag"]]; [occurrences addObject:occurrence]; accepted[identifier] = intent;
  }
  for (NSString *key in duplicates) [accepted removeObjectForKey:key];
  for (NSString *key in _records.allKeys) if (![accepted[key] isEqual:_records[key].intent] || ![self matches:_records[key]]) [_records removeObjectForKey:key];
  if (!_records[_rootIntent[@"id"]]) {
    [self revokeAll];
  }
  for (NSDictionary *intent in desired) {
    if (![intent isKindOfClass:NSDictionary.class]) continue;
    NSString *identifier = intent[@"id"];
    if (!identifier || !accepted[identifier] || _records[identifier]) continue;
    UIView *view = CUIOriginal(self.window, CUITag(intent[@"tag"]));
    if (view == self || CUISurface(view) != _surface || !CUIVisible(view, self.window)) continue;
    CUICollectionVisibleRecord *root = _records[_rootIntent[@"id"]];
    if (![intent isEqual:_rootIntent] && (!root || ![view isDescendantOfView:root.original])) continue;
    CUICollectionVisibleRecord *record = [CUICollectionVisibleRecord new];
    record.original = view; record.window = self.window; record.intent = intent; record.lease = NSUUID.UUID.UUIDString;
    if ([intent isEqual:_rootIntent]) { _lifetime = NSUUID.UUID.UUIDString; _epoch++; }
    record.binding = CUIEncode(@{@"publisher":_publisher, @"lease":record.lease, @"ownerId":_model[@"ownerId"], @"rootId":_model[@"generation"],
      @"rootRevision":_model[@"revision"], @"target":@(self.tag), @"surfaceId":@(_surface), @"windowId":CUIInputWindowIdentity(self.window),
      @"epoch":@(_epoch), @"sequence":@(_epoch), @"descriptorId":intent[@"itemId"] ?: @"", @"descriptorRevision":intent[@"itemRevision"] ?: @""});
    _records[identifier] = record;
  }
  if (!_records[_rootIntent[@"id"]]) { [_records removeAllObjects]; _lifetime = @""; }
  if (_records.count < accepted.count) {
    if (!_availabilityLink) {
      CUICollectionAdmissionTick *tick = [CUICollectionAdmissionTick new]; tick.owner = self;
      _availabilityLink = [CADisplayLink displayLinkWithTarget:tick selector:@selector(tick:)];
      _availabilityLink.preferredFramesPerSecond = 10;
      [_availabilityLink addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
    }
  } else { [_availabilityLink invalidate]; _availabilityLink = nil; }
  [self publish];
}
- (void)publish {
  if (!_eventEmitter) return;
  NSMutableArray *registrations = [NSMutableArray new];
  for (NSString *key in [_records.allKeys sortedArrayUsingSelector:@selector(compare:)]) {
    CUICollectionVisibleRecord *record = _records[key];
    [registrations addObject:@{@"id":key, @"tag":record.intent[@"tag"], @"binding":record.binding}];
  }
  NSDictionary *packet = @{@"intent":CUIDecode(_publication)[@"intent"] ?: @"", @"publisher":_publisher, @"instance":@(_instance), @"lifetime":_lifetime, @"registrations":registrations};
  NSString *signature = CUIEncode(packet);
  if ([_lastSnapshot isEqual:signature]) return;
  _lastSnapshot = signature;
  NSMutableDictionary *receipt = [packet mutableCopy]; receipt[@"sequence"] = @(++_sequence);
  CUICollectionRootEventEmitter::OnNativeCollectionCommit event{}; event.data = CUIEncode(receipt).UTF8String;
  std::static_pointer_cast<const CUICollectionRootEventEmitter>(_eventEmitter)->onNativeCollectionCommit(event);
}
- (CUICollectionVisibleRecord *)resolve:(NSString *)binding target:(NSInteger)target {
  if (![self active] || !binding.length || !_rootIntent) return nil;
  CUICollectionVisibleRecord *root = _records[_rootIntent[@"id"]];
  if (!root || ![self matches:root]) { [self revokeAll]; [self publish]; [self reconcile]; return nil; }
  for (NSString *key in _records.allKeys) {
    CUICollectionVisibleRecord *record = _records[key];
    if (![record.binding isEqual:binding] || CUITag(record.intent[@"tag"]) != target) continue;
    if ([self matches:record] && (record == root || [record.original isDescendantOfView:root.original])) return record;
    [_records removeObjectForKey:key]; [self publish]; [self reconcile]; return nil;
  }
  return nil;
}
+ (BOOL)acceptsCurrentBinding:(NSString *)binding original:(UIView *)original {
  NSDictionary *decoded = CUIDecode(binding);
  CUICollectionRoot *publisher = CUIString(decoded[@"publisher"]) ? [CUIPublishers() objectForKey:decoded[@"publisher"]] : nil;
  return original && [publisher resolve:binding target:original.tag].original == original;
}
- (void)originalChanged:(UIView *)original {
  if (!_rootIntent || !original) return;
  if (_records[_rootIntent[@"id"]].original == original) [self revokeAll];
  else for (NSString *key in _records.allKeys) if (_records[key].original == original) [_records removeObjectForKey:key];
  [self publish];
  __weak CUICollectionRoot *weakSelf = self;
  dispatch_async(dispatch_get_main_queue(), ^{ [weakSelf reconcile]; });
}
- (void)admitRequests {
  id requests = [NSJSONSerialization JSONObjectWithData:[_requests dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
  if (![requests isKindOfClass:NSArray.class] || !_eventEmitter) return;
  for (id request in requests) {
    if (![request isKindOfClass:NSDictionary.class] || !CUIString(request[@"id"]) || !CUIString(request[@"binding"])) continue;
    NSString *identifier = request[@"id"];
    id number = request[@"sequence"];
    if (![number isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)number) == CFBooleanGetTypeID()) continue;
    double value = [number doubleValue];
    if (!isfinite(value) || value <= _lastRequestSequence || value > 9007199254740991.0 || value != floor(value)) continue;
    _lastRequestSequence = (NSUInteger)value;
    BOOL accepted = [self resolve:request[@"binding"] target:CUITag(request[@"target"])] != nil;
    CUICollectionRootEventEmitter::OnNativeCollectionAction event{};
    event.data = CUIEncode(@{@"id":identifier, @"publisher":_publisher, @"binding":request[@"binding"], @"accepted":@(accepted)}).UTF8String;
    std::static_pointer_cast<const CUICollectionRootEventEmitter>(_eventEmitter)->onNativeCollectionAction(event);
  }
}
- (void)mountingTransactionWillMount:(const MountingTransaction &)transaction withSurfaceTelemetry:(const SurfaceTelemetry &)telemetry {
  _mounting = YES;
  for (const auto &mutation : transaction.getMutations()) if (mutation.type == ShadowViewMutation::Delete || mutation.type == ShadowViewMutation::Remove) {
    for (NSString *key in _records.allKeys) {
      UIView *original = _records[key].original;
      for (UIView *ancestor = original; ancestor; ancestor = ancestor.superview) {
        if (ancestor.tag == mutation.oldChildShadowView.tag) { [self originalChanged:original]; break; }
      }
    }
  }
}
- (void)mountingTransactionDidMount:(const MountingTransaction &)transaction withSurfaceTelemetry:(const SurfaceTelemetry &)telemetry {
  _surface = transaction.getSurfaceId(); _mounting = NO; [self reconcile]; [self admitRequests];
}
- (void)requestTextInputFocus:(NSInteger)target binding:(NSString *)binding {
  UIView *original = [self resolve:binding target:target].original;
  if ([original isKindOfClass:RCTTextInputComponentView.class])
    [(RCTTextInputComponentView *)original handleCommand:@"focus" args:@[]];
}
- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args {
  RCTCUICollectionRootHandleCommand(self, commandName, args);
}
- (BOOL)isAccessibilityElement { return NO; }
- (BOOL)accessibilityElementsHidden { return YES; }
- (NSArray *)accessibilityElements { return @[]; }
- (BOOL)canBecomeFirstResponder { return NO; }
- (BOOL)canBecomeFocused { return NO; }
- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event { return nil; }
- (void)finalizeUpdates:(RNComponentViewUpdateMask)mask { [super finalizeUpdates:mask]; self.alpha = 0; self.userInteractionEnabled = NO; }
- (void)prepareForRecycle {
  [_availabilityLink invalidate]; _availabilityLink = nil;
  [self revokeAll]; _model = nil; _rootIntent = nil; _receiverIntents = @[]; _publication = @""; _requests = @"[]"; _surface = -1;
  [self renewPublisher]; [super prepareForRecycle];
}
- (void)dealloc { [_availabilityLink invalidate]; [CUIPublishers() removeObjectForKey:_publisher]; [NSNotificationCenter.defaultCenter removeObserver:self]; }
@end

void CUICollectionOriginalDidChange(UIView *original) {
  if (!original) return;
  for (CUICollectionRoot *publisher in CUIPublishers().objectEnumerator) [publisher originalChanged:original];
}
CUICollectionOptionAdmission *CUIResolveCurrentCollectionOption(NSString *binding, NSInteger target, UIView *editor, BOOL (^guard)(void)) {
  NSDictionary *decoded = CUIDecode(binding);
  CUICollectionRoot *publisher = CUIString(decoded[@"publisher"]) ? [CUIPublishers() objectForKey:decoded[@"publisher"]] : nil;
  CUICollectionVisibleRecord *record = [publisher resolve:binding target:target];
  if (!record || !guard || !guard() || !editor.isFirstResponder || !CUIVisible(editor, editor.window) || editor.window != record.original.window || CUISurface(editor) != CUISurface(record.original)) return nil;
  __weak CUICollectionRoot *weakPublisher = publisher; __weak UIView *weakEditor = editor, *weakOption = record.original;
  CUICollectionOptionAdmission *admission = [CUICollectionOptionAdmission new];
  admission.option = record.original; admission.identity = record.lease;
  admission.check = ^BOOL {
    CUICollectionRoot *currentPublisher = weakPublisher; UIView *currentEditor = weakEditor, *option = weakOption;
    return currentPublisher && currentEditor && option && guard() && currentEditor.isFirstResponder && CUIVisible(currentEditor, currentEditor.window) && currentEditor.window == option.window &&
      CUISurface(currentEditor) == CUISurface(option) && [currentPublisher resolve:binding target:target].original == option;
  };
  return admission;
}
