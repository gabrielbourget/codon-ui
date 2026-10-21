#import "CUIMenuPointerPolicies.h"
#import "CUIMenuPointerGrace.h"
#import "CUICollectionRoot.h"
#import "CUIFocusView.h"
#import "CUIInputWindow.h"
#import "CUIKeyboardScope.h"
#import <UIKit/UIGestureRecognizerSubclass.h>
#import <QuartzCore/QuartzCore.h>
#import <objc/runtime.h>

@class CUIMenuPointerPolicy, CUIMenuPointerWindow;
@interface CUIMenuPointerPolicies ()
@property(nonatomic, weak) UIView *scope;
@property(nonatomic, copy) BOOL (^ready)(void);
@property(nonatomic, copy) void (^publish)(NSDictionary *);
@property(nonatomic, copy) NSArray<CUIMenuPointerPolicy *> *policies;
@property(nonatomic, copy) NSDictionary *session;
@end

@interface CUIMenuPointerPolicy : NSObject
@property(nonatomic, weak) CUIMenuPointerPolicies *owner;
@property(nonatomic, copy) NSDictionary *registration;
@property(nonatomic, copy) NSDictionary *session;
@property(nonatomic, assign) double revision;
@property(nonatomic, readonly) UIView *parent;
- (instancetype)initWithOwner:(CUIMenuPointerPolicies *)owner registration:(NSDictionary *)registration session:(NSDictionary *)session revision:(double)revision pointer:(BOOL)pointer;
- (BOOL)current;
- (BOOL)suppressed;
- (void)status;
- (void)retire:(NSString *)reason;
- (void)setPointerMode:(BOOL)pointer;
- (void)move:(NSDictionary *)sample;
- (void)emit:(NSString *)phase sample:(NSDictionary *)sample error:(NSString *)error;
@end

@interface CUIMenuPointerRecognizer : UIGestureRecognizer <UIGestureRecognizerDelegate>
@property(nonatomic, weak) CUIMenuPointerWindow *owner;
@property(nonatomic, readonly) BOOL claiming;
@property(nonatomic, strong) NSMutableSet<CUIMenuPointerPolicy *> *claims;
@property(nonatomic, strong) NSMutableSet<UITouch *> *touches;
@end

@interface CUIMenuPointerWindow : NSObject <UIGestureRecognizerDelegate>
@property(nonatomic, weak) UIWindow *window;
@property(nonatomic, strong) NSMapTable<UIView *, UIHoverGestureRecognizer *> *hovers;
@property(nonatomic, strong) NSMapTable<UIView *, CUIMenuPointerRecognizer *> *recognizers;
@property(nonatomic, strong) CADisplayLink *display;
@property(nonatomic, copy) NSString *modality;
@property(nonatomic, assign) NSUInteger observationId;
@property(nonatomic, assign) NSUInteger policyCount;
- (NSArray<CUIMenuPointerPolicy *> *)policies;
- (BOOL)active;
- (NSArray<CUIMenuPointerPolicy *> *)down:(UITouch *)touch event:(UIEvent *)event;
- (void)moveTouch:(UITouch *)touch event:(UIEvent *)event;
- (void)notifyModality:(NSString *)modality;
- (void)invalidate;
@end

static const void *CUIMenuPointerWindowKey = &CUIMenuPointerWindowKey;
static CUIMenuPointerWindow *CUIMenuWindow(UIWindow *window) { return window ? objc_getAssociatedObject(window, CUIMenuPointerWindowKey) : nil; }
static double CUIMenuTime() { return NSProcessInfo.processInfo.systemUptime * 1000; }
static BOOL CUIMenuSurface(UIView *view) {
  Class handler = NSClassFromString(@"RCTSurfaceTouchHandler");
  for (UIGestureRecognizer *recognizer in view.gestureRecognizers) if (handler && [recognizer isKindOfClass:handler]) return YES;
  return NO;
}
static UIView *CUIMenuOriginalSurface(UIView *target) {
  for (UIView *view = target; view; view = view.superview) if (CUIMenuSurface(view)) return view;
  return nil;
}
static NSArray<UIView *> *CUIMenuSurfaces(UIWindow *window) {
  NSMutableArray *pending = [NSMutableArray arrayWithObject:window], *result = [NSMutableArray array];
  while (pending.count) {
    UIView *view = pending.lastObject; [pending removeLastObject];
    if (CUIMenuSurface(view)) [result addObject:view];
    [pending addObjectsFromArray:view.subviews];
  }
  return result;
}
static NSArray<NSNumber *> *CUIMenuHit(UIWindow *window, CGPoint point, UIEvent *event) {
  NSMutableArray *path = [NSMutableArray array];
  for (UIView *view = [window hitTest:point withEvent:event]; view; view = view.superview) [path addObject:@(view.tag)];
  return path;
}
static BOOL CUIMenuInputVisible(UIView *target, UIView *scope) {
  if (!target || target.window != scope.window) return NO;
  for (UIView *view = target; view; view = view.superview) {
    if (view.hidden || view.alpha <= 0 || !view.userInteractionEnabled) return NO;
    if (view == scope) return YES;
  }
  return NO;
}
static codon::MenuPointerRect CUIMenuRect(CGRect value) {
  return {CGRectGetMinX(value), CGRectGetMinY(value), CGRectGetMaxX(value), CGRectGetMaxY(value)};
}

@implementation CUIMenuPointerPolicy {
  codon::MenuPointerGrace _grace;
  __weak UIView *_parent, *_submenu, *_trigger;
  __weak UIWindow *_window;
  BOOL _parentResolved, _submenuResolved, _triggerResolved, _retired, _wasReady;
  CGSize _submenuSize;
  CGRect _submenuRect;
  NSString *_status;
  NSDictionary *_observation;
  NSUInteger _generation, _sequence;
  double _decisionTime;
}
- (instancetype)initWithOwner:(CUIMenuPointerPolicies *)owner registration:(NSDictionary *)registration session:(NSDictionary *)session revision:(double)revision pointer:(BOOL)pointer {
  if (self = [super init]) {
    _owner = owner; _registration = registration.copy; _session = session.copy; _revision = revision; _window = owner.scope.window;
    _submenuSize = CGSizeMake(-1, -1); _grace.setPointerMode(pointer);
  }
  return self;
}
- (UIView *)parent { return _parent; }
- (BOOL)current {
  CUIMenuPointerPolicies *owner = self.owner;
  UIWindow *window = _window;
  if (_retired || !owner || ![owner.policies containsObject:self] || !owner.ready() || !window.isKeyWindow || window != owner.scope.window ||
      ![self.session isEqual:owner.session] || ![self.session[@"windowId"] isEqual:CUIInputWindowIdentity(window)]) return NO;
  if (!_parentResolved) { _parent = [window viewWithTag:[self.registration[@"parentTarget"] integerValue]]; _parentResolved = _parent != nil; }
  if (!_submenuResolved) { _submenu = [window viewWithTag:[self.registration[@"submenuTarget"] integerValue]]; _submenuResolved = _submenu != nil; }
  if (!_triggerResolved) { _trigger = [window viewWithTag:[self.registration[@"triggerTarget"] integerValue]]; _triggerResolved = _trigger != nil; }
  UIView *parent = _parent, *submenu = _submenu, *trigger = _trigger;
  if (![parent isKindOfClass:CUIFocusView.class] || ![submenu isKindOfClass:CUIFocusView.class] || ![trigger isKindOfClass:CUIFocusView.class] ||
      parent == submenu || parent == trigger || submenu == trigger || ![trigger isDescendantOfView:parent] ||
      !CUIMenuInputVisible(parent, owner.scope) || !CUIMenuInputVisible(submenu, owner.scope) || !CUIMenuInputVisible(trigger, owner.scope) ||
      ![(CUIFocusView *)trigger menuPointerTriggerEnabled] || parent.bounds.size.width <= 0 || parent.bounds.size.height <= 0 || submenu.bounds.size.width <= 0 || submenu.bounds.size.height <= 0) return NO;
  UIView *surface = CUIMenuOriginalSurface(parent);
  if (!surface || CUIMenuOriginalSurface(submenu) != surface || CUIMenuOriginalSurface(trigger) != surface) return NO;
  NSMutableArray *bindings = [NSMutableArray array];
  for (NSString *name in @[@"parent", @"submenu", @"trigger"]) {
    NSString *serialized = self.registration[[name stringByAppendingString:@"Binding"]];
    id binding = [NSJSONSerialization JSONObjectWithData:[serialized dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    if (![binding isKindOfClass:NSDictionary.class]) return NO;
    UIView *root = [window viewWithTag:[binding[@"target"] integerValue]];
    NSInteger target = [self.registration[[name stringByAppendingString:@"Target"]] integerValue];
    if (![root isKindOfClass:CUICollectionRoot.class] || ![(CUICollectionRoot *)root acceptsPointerBinding:serialized visibleTarget:target]) return NO;
    [bindings addObject:binding];
  }
  for (NSString *field in @[@"ownerId", @"rootId", @"rootRevision", @"target", @"surfaceId", @"windowId", @"epoch", @"sequence"])
    if (![bindings[0][field] isEqual:bindings[2][field]]) return NO;
  if (![bindings[0][@"surfaceId"] isEqual:bindings[1][@"surfaceId"]]) return NO;
  if (!CGSizeEqualToSize(_submenuSize, submenu.bounds.size)) {
    _submenuSize = submenu.bounds.size; _submenuRect = [submenu convertRect:submenu.bounds toView:window]; _grace.setSubmenu(CUIMenuRect(_submenuRect));
  }
  return YES;
}
- (BOOL)suppressed { return [self current] && _grace.suppressed(); }
- (void)status {
  BOOL ready = [self current];
  if (_wasReady && !ready) { [self retire:@"native-target-retired"]; return; }
  NSString *signature = [NSString stringWithFormat:@"%g:%d", self.revision, ready];
  if ([_status isEqual:signature]) return;
  _status = signature; _wasReady = ready;
  [self emit:@"status" sample:nil error:@""];
}
- (void)retire:(NSString *)reason {
  if (_retired) return;
  _retired = YES; _generation++; _grace.retire(); _observation = nil;
  [self emit:@"retired" sample:nil error:reason];
}
- (void)setPointerMode:(BOOL)pointer {
  if (_grace.setPointerMode(pointer)) {
    _generation++; _observation = nil;
    if (pointer && [self current]) { _submenuRect = [_submenu convertRect:_submenu.bounds toView:_window]; _grace.activateSubmenu(CUIMenuRect(_submenuRect)); }
  }
}
- (void)move:(NSDictionary *)sample {
  if (![self current]) return;
  CGRect parent = [_parent convertRect:_parent.bounds toView:_window];
  double now = CUIMenuTime();
  if (!_grace.move([sample[@"pageX"] doubleValue], [sample[@"pageY"] doubleValue], now, CUIMenuRect(parent))) return;
  _decisionTime = now;
  _generation++; _observation = sample.copy;
  [self emit:@"move" sample:sample error:@""];
  [self schedule];
}
- (void)schedule {
  if (_grace.deadline() < 0) return;
  NSUInteger generation = _generation;
  double delay = MAX(0, _grace.deadline() - CUIMenuTime());
  __weak CUIMenuPointerPolicy *weakSelf = self;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay * NSEC_PER_MSEC)), dispatch_get_main_queue(), ^{
    CUIMenuPointerPolicy *strong = weakSelf;
    if (!strong || strong->_generation != generation || !strong->_observation) return;
    if (![strong current] || ![CUIMenuWindow(strong->_window) active]) { [strong retire:@"observation-retired"]; return; }
    strong->_decisionTime = CUIMenuTime();
    BOOL handoff = strong->_grace.expire(strong->_decisionTime);
    NSMutableDictionary *sample = strong->_observation.mutableCopy;
    CGPoint point = CGPointMake([sample[@"pageX"] doubleValue], [sample[@"pageY"] doubleValue]);
    NSArray *path = CUIMenuHit(strong->_window, point, nil);
    sample[@"hitPath"] = path; sample[@"target"] = path.firstObject ?: @(-1);
    if (handoff) {
      if ([path containsObject:strong.registration[@"parentTarget"]]) [strong emit:@"handoff" sample:sample error:@""];
      strong->_observation = nil;
    } else { [strong emit:@"reset" sample:sample error:@""]; [strong schedule]; }
  });
}
- (void)emit:(NSString *)phase sample:(NSDictionary *)sample error:(NSString *)error {
  CUIMenuPointerPolicies *owner = self.owner;
  if (!owner) return;
  NSMutableDictionary *packet = [@{
    @"ownerId": self.session[@"ownerId"] ?: @"", @"windowId": self.session[@"windowId"] ?: @"", @"epoch": self.session[@"epoch"] ?: @(-1),
    @"revision": @(self.revision), @"policyId": self.registration[@"id"], @"sequence": @(++_sequence), @"phase": phase,
    @"ready": @(!_retired && [self current]), @"suppressed": @(!_retired && _grace.suppressed()),
    @"observationId": sample[@"observationId"] ?: @0, @"pointerType": sample[@"pointerType"] ?: @"unknown",
    @"pageX": sample[@"pageX"] ?: @0, @"pageY": sample[@"pageY"] ?: @0, @"timestamp": sample[@"timestamp"] ?: @(CUIMenuTime()),
    @"target": sample[@"target"] ?: @(-1), @"hitPath": sample[@"hitPath"] ?: @[],
    @"nativeButtons": sample[@"nativeButtons"] ?: @"0", @"nativeModifiers": sample[@"nativeModifiers"] ?: @"0", @"error": error, @"geometry": @"{}"
  } mutableCopy];
  if (!_retired && _parent && _submenu) {
    CGRect parent = [_parent convertRect:_parent.bounds toView:_window];
    NSDictionary *geometry = @{
      @"parent": @[@(CGRectGetMinX(parent)), @(CGRectGetMinY(parent)), @(CGRectGetMaxX(parent)), @(CGRectGetMaxY(parent))],
      @"submenu": @[@(CGRectGetMinX(_submenuRect)), @(CGRectGetMinY(_submenuRect)), @(CGRectGetMaxX(_submenuRect)), @(CGRectGetMaxY(_submenuRect))],
      @"decisionTime": @(_decisionTime), @"deadline": @(_grace.deadline())
    };
    NSData *data = [NSJSONSerialization dataWithJSONObject:geometry options:0 error:nil];
    packet[@"geometry"] = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
  }
  owner.publish(packet);
}
@end

@implementation CUIMenuPointerPolicies
- (instancetype)initWithScope:(UIView *)scope ready:(BOOL (^)(void))ready publish:(void (^)(NSDictionary *))publish {
  if (self = [super init]) { _scope = scope; _ready = ready; _publish = publish; _policies = @[]; _session = @{}; }
  return self;
}
- (void)update:(NSArray<NSDictionary *> *)registrations revision:(double)revision session:(NSDictionary *)session {
  NSMutableArray *next = [NSMutableArray array]; NSMutableSet *ids = [NSMutableSet set];
  BOOL pointer = [CUIMenuWindow(self.scope.window).modality isEqualToString:@"pointer"];
  for (NSDictionary *registration in registrations) {
    NSString *identity = registration[@"id"];
    if (!identity.length || [ids containsObject:identity]) continue;
    [ids addObject:identity];
    CUIMenuPointerPolicy *retained = nil;
    for (CUIMenuPointerPolicy *previous in _policies) if ([previous.registration isEqual:registration] && [previous.session isEqual:session]) { retained = previous; break; }
    if (!retained) retained = [[CUIMenuPointerPolicy alloc] initWithOwner:self registration:registration session:session revision:revision pointer:pointer];
    [next addObject:retained];
  }
  for (CUIMenuPointerPolicy *previous in _policies) if (![next containsObject:previous]) [previous retire:@"policy-retired"];
  for (CUIMenuPointerPolicy *policy in next) policy.revision = revision;
  _session = session.copy; _policies = next.copy;
  CUIRefreshMenuPointerPolicies(self.scope.window);
}
- (void)invalidate { for (CUIMenuPointerPolicy *policy in _policies) [policy retire:@"scope-retired"]; _policies = @[]; }
@end

static BOOL CUIMenuPublicDispatchRecognizer(UIGestureRecognizer *other) {
  NSString *name = NSStringFromClass(other.class);
  return [name isEqualToString:@"RCTSurfaceTouchHandler"] || [name isEqualToString:@"RCTSurfacePointerHandler"] ||
      [name isEqualToString:@"CUIPassiveWindowPointerObserver"] || [name isEqualToString:@"CUIPassiveKeyboardObserver"] ||
      [other isKindOfClass:UIHoverGestureRecognizer.class];
}
static BOOL CUIMenuTextDefaultRecognizer(UIGestureRecognizer *other) {
  if (CUIMenuPublicDispatchRecognizer(other)) return NO;
  for (UIView *view = other.view; view; view = view.superview) for (id<UIInteraction> interaction in view.interactions)
    if ([interaction isKindOfClass:UITextInteraction.class] && [((UITextInteraction *)interaction).gesturesForFailureRequirements containsObject:other]) return YES;
  return NO;
}
@implementation CUIMenuPointerRecognizer
- (instancetype)init {
  if (self = [super initWithTarget:nil action:nil]) {
    self.cancelsTouchesInView = NO; self.delaysTouchesBegan = NO; self.delaysTouchesEnded = NO;
    self.requiresExclusiveTouchType = NO; self.delegate = self; _touches = [NSMutableSet set]; _claims = [NSMutableSet set];
  }
  return self;
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceivePress:(UIPress *)press { return NO; }
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)other { return !self.claiming || !CUIMenuTextDefaultRecognizer(other); }
- (BOOL)canPreventGestureRecognizer:(UIGestureRecognizer *)other { return self.claiming && CUIMenuTextDefaultRecognizer(other); }
- (BOOL)canBePreventedByGestureRecognizer:(UIGestureRecognizer *)other { return NO; }
- (BOOL)claiming { for (CUIMenuPointerPolicy *policy in self.claims) if ([policy current]) return YES; return NO; }
- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
  for (UITouch *touch in touches) { [self.touches addObject:touch]; [self.claims addObjectsFromArray:[self.owner down:touch event:event]]; }
  if (self.claiming) self.state = self.state == UIGestureRecognizerStatePossible ? UIGestureRecognizerStateBegan : UIGestureRecognizerStateChanged;
}
- (void)touchesMoved:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
  for (UITouch *touch in touches) [self.owner moveTouch:touch event:event];
}
- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
  [self.touches minusSet:touches];
  if (!self.touches.count) self.state = self.state == UIGestureRecognizerStateBegan || self.state == UIGestureRecognizerStateChanged ? UIGestureRecognizerStateEnded : UIGestureRecognizerStateFailed;
}
- (void)touchesCancelled:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
  [self.touches minusSet:touches];
  if (!self.touches.count) self.state = self.state == UIGestureRecognizerStateBegan || self.state == UIGestureRecognizerStateChanged ? UIGestureRecognizerStateCancelled : UIGestureRecognizerStateFailed;
}
- (void)reset { [self.claims removeAllObjects]; [self.touches removeAllObjects]; [super reset]; }
@end

@implementation CUIMenuPointerWindow
- (instancetype)initWithWindow:(UIWindow *)window {
  if (self = [super init]) {
    _window = window; _modality = @"unknown";
    _hovers = NSMapTable.weakToStrongObjectsMapTable;
    _recognizers = NSMapTable.weakToStrongObjectsMapTable;
  }
  return self;
}
- (NSArray<CUIMenuPointerPolicy *> *)policies {
  NSMutableArray *result = [NSMutableArray array];
  for (CUIKeyboardScope *scope in CUIInputScopes(self.window)) [result addObjectsFromArray:scope.menuPointers.policies];
  return result;
}
- (BOOL)active {
  UIWindow *window = self.window;
  return window.isKeyWindow && !window.hidden && UIApplication.sharedApplication.applicationState == UIApplicationStateActive &&
      (!window.windowScene || window.windowScene.activationState == UISceneActivationStateForegroundActive);
}
- (void)tick {
  if (!self.window) { [self invalidate]; return; }
  NSArray *policies = self.policies;
  self.policyCount = policies.count;
  BOOL needed = policies.count > 0;
  if (needed && !self.display) {
    self.display = [CADisplayLink displayLinkWithTarget:self selector:@selector(displayTick:)];
    [self.display addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
  } else if (!needed && self.display) { [self.display invalidate]; self.display = nil; }
  NSArray<UIView *> *surfaces = CUIMenuSurfaces(self.window);
  for (UIView *surface in self.recognizers.keyEnumerator.allObjects) if (![surfaces containsObject:surface]) {
    [surface removeGestureRecognizer:[self.recognizers objectForKey:surface]]; [self.recognizers removeObjectForKey:surface];
  }
  for (UIView *surface in surfaces) if (![self.recognizers objectForKey:surface]) {
    CUIMenuPointerRecognizer *recognizer = [CUIMenuPointerRecognizer new]; recognizer.owner = self;
    [surface addGestureRecognizer:recognizer]; [self.recognizers setObject:recognizer forKey:surface];
  }
  for (UIView *surface in self.hovers.keyEnumerator.allObjects) if (![surfaces containsObject:surface]) {
    [surface removeGestureRecognizer:[self.hovers objectForKey:surface]]; [self.hovers removeObjectForKey:surface];
  }
  for (UIView *surface in surfaces) if (![self.hovers objectForKey:surface]) {
    UIHoverGestureRecognizer *hover = [[UIHoverGestureRecognizer alloc] initWithTarget:self action:@selector(hovered:)];
    hover.allowedTouchTypes = @[@(UITouchTypeIndirectPointer)]; hover.delegate = self;
    hover.cancelsTouchesInView = NO; hover.delaysTouchesBegan = NO; hover.delaysTouchesEnded = NO;
    [surface addGestureRecognizer:hover]; [self.hovers setObject:hover forKey:surface];
  }
  for (CUIMenuPointerPolicy *policy in policies) [policy status];
}
- (void)displayTick:(CADisplayLink *)display { [self tick]; }
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)other { return YES; }
- (NSDictionary *)sample:(CGPoint)point timestamp:(double)timestamp type:(NSString *)type buttons:(UIEventButtonMask)buttons flags:(UIKeyModifierFlags)flags event:(UIEvent *)event {
  NSArray *path = CUIMenuHit(self.window, point, event);
  return @{@"observationId": @(++self.observationId), @"pointerType": type, @"pageX": @(point.x), @"pageY": @(point.y),
      @"timestamp": @(timestamp), @"target": path.firstObject ?: @(-1), @"hitPath": path,
      @"nativeButtons": [NSString stringWithFormat:@"%llu", (unsigned long long)buttons], @"nativeModifiers": [NSString stringWithFormat:@"%llu", (unsigned long long)flags]};
}
- (void)hovered:(UIHoverGestureRecognizer *)recognizer {
  if (![self active] || (recognizer.state != UIGestureRecognizerStateBegan && recognizer.state != UIGestureRecognizerStateChanged)) return;
  self.modality = @"pointer";
  NSDictionary *sample = [self sample:[recognizer locationInView:self.window] timestamp:CUIMenuTime() type:@"mouse" buttons:recognizer.buttonMask flags:recognizer.modifierFlags event:nil];
  for (CUIMenuPointerPolicy *policy in self.policies) [policy move:sample];
}
- (NSArray<CUIMenuPointerPolicy *> *)down:(UITouch *)touch event:(UIEvent *)event {
  if (![self active] || touch.window != self.window) return @[];
  NSString *type = touch.type == UITouchTypeIndirectPointer ? @"mouse" : touch.type == UITouchTypeDirect ? @"touch" : touch.type == UITouchTypePencil ? @"pen" : nil;
  if (!type) return @[];
  NSDictionary *sample = [self sample:[touch locationInView:self.window] timestamp:touch.timestamp * 1000 type:type buttons:event.buttonMask flags:event.modifierFlags event:event];
  NSMutableArray *claims = [NSMutableArray array];
  for (CUIMenuPointerPolicy *policy in self.policies) if (policy.suppressed) { [claims addObject:policy]; [policy emit:@"down" sample:sample error:@""]; }
  [self notifyModality:@"pointer"];
  return claims;
}
- (void)moveTouch:(UITouch *)touch event:(UIEvent *)event {
  if (![self active] || touch.window != self.window || touch.type != UITouchTypeIndirectPointer) return;
  self.modality = @"pointer";
  NSDictionary *sample = [self sample:[touch locationInView:self.window] timestamp:touch.timestamp * 1000 type:@"mouse" buttons:event.buttonMask flags:event.modifierFlags event:event];
  for (CUIMenuPointerPolicy *policy in self.policies) [policy move:sample];
}
- (void)notifyModality:(NSString *)modality {
  self.modality = modality;
  for (CUIMenuPointerPolicy *policy in self.policies) [policy setPointerMode:[modality isEqualToString:@"pointer"]];
}
- (void)invalidate {
  for (CUIMenuPointerPolicy *policy in self.policies) [policy retire:@"window-policy-retired"];
  [self.display invalidate]; self.display = nil;
  for (UIHoverGestureRecognizer *hover in self.hovers.objectEnumerator) [hover.view removeGestureRecognizer:hover];
  [self.hovers removeAllObjects];
  for (CUIMenuPointerRecognizer *recognizer in self.recognizers.objectEnumerator) [recognizer.view removeGestureRecognizer:recognizer];
  [self.recognizers removeAllObjects];
}
@end

void CUIRefreshMenuPointerPolicies(UIWindow *window) {
  if (!window) return;
  CUIMenuPointerWindow *owner = CUIMenuWindow(window);
  if (!CUIInputScopes(window).count) {
    [owner invalidate]; objc_setAssociatedObject(window, CUIMenuPointerWindowKey, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC); return;
  }
  if (!owner) { owner = [[CUIMenuPointerWindow alloc] initWithWindow:window]; objc_setAssociatedObject(window, CUIMenuPointerWindowKey, owner, OBJC_ASSOCIATION_RETAIN_NONATOMIC); }
  [owner tick];
}
BOOL CUIMenuPointerSuppresses(UIView *target) {
  CUIMenuPointerWindow *owner = CUIMenuWindow(target.window);
  if (!owner.policyCount || ![owner active]) return NO;
  for (CUIMenuPointerPolicy *policy in owner.policies) if (policy.parent == target && policy.suppressed) return YES;
  return NO;
}
BOOL CUIMenuPointerPreventsFocus(UIWindow *window) {
  CUIMenuPointerWindow *owner = CUIMenuWindow(window);
  if (![owner active] || ![owner.modality isEqualToString:@"pointer"]) return NO;
  for (CUIMenuPointerRecognizer *recognizer in owner.recognizers.objectEnumerator) if (recognizer.claiming) return YES;
  return NO;
}
void CUIRecordMenuPointerDown(UIWindow *window) { [CUIMenuWindow(window) notifyModality:@"pointer"]; }
void CUIRecordMenuPointerVirtual(UIWindow *window) { [CUIMenuWindow(window) notifyModality:@"virtual"]; }
void CUIRecordMenuPointerKey(UIWindow *window, UIKey *key) {
  NSString *name = CUIInputKeyName(key);
  if (!key || key.modifierFlags & (UIKeyModifierCommand | UIKeyModifierControl | UIKeyModifierAlternate) || [@[@"Control", @"Shift", @"Meta"] containsObject:name]) return;
  [CUIMenuWindow(window) notifyModality:@"keyboard"];
}
