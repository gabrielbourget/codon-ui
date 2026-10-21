#import "CUIInputWindow.h"
#import "CUIFocusView.h"
#import "CUIMenuPointerPolicies.h"
#import <UIKit/UIGestureRecognizerSubclass.h>
#import <objc/runtime.h>

@interface CUIPassiveKeyboardObserver : UIGestureRecognizer <UIGestureRecognizerDelegate>
@property(nonatomic, strong) NSMutableSet<NSNumber *> *held;
@end

@interface CUIPassiveWindowPointerObserver : UIGestureRecognizer <UIGestureRecognizerDelegate>
@property(nonatomic, strong) NSMapTable<UITouch *, NSNumber *> *identities;
@property(nonatomic, strong) NSMutableDictionary<NSNumber *, NSNumber *> *primary;
@property(nonatomic, assign) NSInteger nextIdentity;
@property(nonatomic, assign) UIEventButtonMask previousButtons;
@end

@interface CUIWindowInputState : NSObject
@property(nonatomic, copy) NSString *identity;
@property(nonatomic, copy) NSString *modality;
@property(nonatomic, strong) NSHashTable<UIView *> *scopes;
@property(nonatomic, assign) NSInteger policyOrder;
@property(nonatomic, assign) NSUInteger inputRevision;
@property(nonatomic, strong) NSMapTable<UIView *, NSNumber *> *scopeOrder;
@property(nonatomic, assign) NSUInteger nextScopeOrder;
@property(nonatomic, assign) NSUInteger observedEventId;
@property(nonatomic, strong) CUIPassiveKeyboardObserver *keyboardObserver;
@property(nonatomic, strong) CUIPassiveWindowPointerObserver *pointerObserver;
@property(nonatomic, assign) NSUInteger pointerSequence;
@end
@implementation CUIWindowInputState
@end

static const void *CUIWindowInputKey = &CUIWindowInputKey;
static CUIWindowInputState *CUIWindowInput(UIWindow *window)
{
  if (!window) return nil;
  CUIWindowInputState *state = objc_getAssociatedObject(window, CUIWindowInputKey);
  if (!state) {
    state = [CUIWindowInputState new];
    state.identity = NSUUID.UUID.UUIDString;
    state.modality = @"unknown";
    state.scopes = NSHashTable.weakObjectsHashTable;
    state.scopeOrder = NSMapTable.weakToStrongObjectsMapTable;
    objc_setAssociatedObject(window, CUIWindowInputKey, state, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }
  return state;
}

NSString *CUIInputWindowIdentity(UIWindow *window) { return CUIWindowInput(window).identity ?: @""; }
static UIView *CUIFindInputFocus(UIView *root, BOOL responder) {
  if (responder ? root.isFirstResponder : root.isFocused) return root;
  for (UIView *child in root.subviews) { UIView *target = CUIFindInputFocus(child, responder); if (target) return target; }
  return nil;
}
UIView *CUIInputFocusedView(UIView *root) { return CUIFindInputFocus(root, YES) ?: CUIFindInputFocus(root, NO); }
NSString *CUIInputWindowModality(UIWindow *window) { return CUIWindowInput(window).modality ?: @"unknown"; }
NSUInteger CUIInputWindowRevision(UIWindow *window) { return CUIWindowInput(window).inputRevision; }
void CUIAdvanceInputRevision(UIWindow *window) { CUIWindowInputState *state = CUIWindowInput(window); state.inputRevision++; }
void CUIRecordWindowModality(UIWindow *window, NSString *modality) { CUIWindowInput(window).modality = modality; CUIAdvanceInputRevision(window); }
void CUIRegisterInputScope(UIWindow *window, UIView *scope) {
  CUIWindowInputState *state = CUIWindowInput(window);
  [state.scopes addObject:scope];
  [state.scopeOrder setObject:@(++state.nextScopeOrder) forKey:scope];
  CUIRefreshMenuPointerPolicies(window);
}
void CUIUnregisterInputScope(UIWindow *window, UIView *scope) {
  CUIWindowInputState *state = CUIWindowInput(window);
  [state.scopes removeObject:scope]; [state.scopeOrder removeObjectForKey:scope];
  CUIRefreshKeyboardObservation(window);
  CUIRefreshWindowPointerObservation(window);
  CUIRefreshMenuPointerPolicies(window);
}

static NSArray<NSNumber *> *CUIWindowPointerAncestry(UIView *target)
{
  NSMutableArray *ancestry = [NSMutableArray array];
  for (UIView *view = target; view; view = view.superview) [ancestry addObject:@(view.tag)];
  return ancestry;
}

static void CUIDeliverWindowPointer(UIWindow *window, NSDictionary *sample, NSArray<NSNumber *> *ancestry)
{
  if (!window.isKeyWindow || window.hidden || UIApplication.sharedApplication.applicationState != UIApplicationStateActive ||
      (window.windowScene && window.windowScene.activationState != UISceneActivationStateForegroundActive)) return;
  id<CUIWindowPointerScope> emitter = nil;
  NSMutableArray *registrations = [NSMutableArray array];
  for (UIView *view in CUIInputScopes(window)) {
    id<CUIWindowPointerScope> scope = (id<CUIWindowPointerScope>)view;
    NSArray *entries = [scope windowPointerRegistrationsForAncestry:ancestry];
    if (entries.count && !emitter) emitter = scope;
    [registrations addObjectsFromArray:entries];
  }
  if (!emitter) return;
  NSMutableDictionary *packet = [sample mutableCopy];
  packet[@"sequence"] = @(++CUIWindowInput(window).pointerSequence);
  packet[@"windowId"] = CUIInputWindowIdentity(window);
  packet[@"registrations"] = registrations;
  [emitter emitWindowPointer:packet];
}

void CUIRefreshWindowPointerObservation(UIWindow *window)
{
  if (!window) return;
  CUIWindowInputState *state = CUIWindowInput(window);
  BOOL enabled = NO;
  for (UIView *view in CUIInputScopes(window)) enabled |= [(id<CUIWindowPointerScope>)view windowPointerRegistrationsForAncestry:@[]].count > 0;
  if (enabled && !state.pointerObserver) {
    state.pointerObserver = [CUIPassiveWindowPointerObserver new];
    [window addGestureRecognizer:state.pointerObserver];
  } else if (!enabled && state.pointerObserver) {
    [window removeGestureRecognizer:state.pointerObserver];
    state.pointerObserver = nil;
  }
  for (UIView *view in CUIInputScopes(window)) [(id<CUIWindowPointerScope>)view publishWindowPointerStatus:state.pointerObserver != nil error:@""];
}

void CUIActivateWindowPointer(UIView *target)
{
  UIWindow *window = target.window;
  if (!window || !CUIWindowInput(window).pointerObserver) return;
  CGRect bounds = [target convertRect:target.bounds toView:window];
  CUIDeliverWindowPointer(window, @{
    @"phase": @"activation", @"pointerId": @(-1), @"pointerType": @"virtual", @"isPrimary": @YES,
    @"button": @(-1), @"buttons": @0, @"nativeButtons": @"0", @"shiftKey": @NO, @"altKey": @NO,
    @"ctrlKey": @NO, @"metaKey": @NO, @"nativeModifiers": @"0", @"pageX": @(CGRectGetMidX(bounds)),
    @"pageY": @(CGRectGetMidY(bounds)), @"timestamp": @(NSProcessInfo.processInfo.systemUptime * 1000), @"target": @(target.tag)
  }, CUIWindowPointerAncestry(target));
}

@implementation CUIPassiveWindowPointerObserver
- (instancetype)init
{
  if (self = [super initWithTarget:nil action:nil]) {
    self.cancelsTouchesInView = NO;
    self.delaysTouchesBegan = NO;
    self.delaysTouchesEnded = NO;
    self.requiresExclusiveTouchType = NO;
    self.delegate = self;
    _identities = NSMapTable.weakToStrongObjectsMapTable;
    _primary = [NSMutableDictionary dictionary];
  }
  return self;
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceivePress:(UIPress *)press { return NO; }
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)other { return YES; }
- (BOOL)canPreventGestureRecognizer:(UIGestureRecognizer *)other { return NO; }
- (BOOL)canBePreventedByGestureRecognizer:(UIGestureRecognizer *)other { return NO; }
- (void)observeTouches:(NSSet<UITouch *> *)touches event:(UIEvent *)event phase:(NSString *)phase
{
  UIWindow *window = self.view.window;
  NSArray<UITouch *> *ordered = [touches.allObjects sortedArrayUsingComparator:^NSComparisonResult(UITouch *left, UITouch *right) {
    return [@(left.timestamp) compare:@(right.timestamp)];
  }];
  for (UITouch *touch in ordered) {
    if (touch.window != window) continue;
    NSString *type = touch.type == UITouchTypeDirect ? @"touch" : touch.type == UITouchTypePencil ? @"pen" : touch.type == UITouchTypeIndirectPointer ? @"mouse" : nil;
    if (!type) {
      for (UIView *view in CUIInputScopes(window)) [(id<CUIWindowPointerScope>)view publishWindowPointerStatus:NO error:@"Native motion: unsupported UIKit touch authority"];
      continue;
    }
    NSNumber *identity = [self.identities objectForKey:touch];
    if (!identity && [phase isEqualToString:@"start"]) {
      identity = @(++self.nextIdentity);
      [self.identities setObject:identity forKey:touch];
      if (!self.primary[@(touch.type)]) self.primary[@(touch.type)] = identity;
    }
    if (!identity) continue;
    CGPoint point = [touch locationInView:window];
    UIView *hit = [window hitTest:point withEvent:event];
    UIKeyModifierFlags flags = event.modifierFlags;
    UIEventButtonMask nativeButtons = event.buttonMask;
    UIEventButtonMask changed = nativeButtons ^ self.previousButtons;
    NSInteger button = -1;
    if (![type isEqualToString:@"mouse"]) button = [phase isEqualToString:@"move"] ? -1 : 0;
    else if (changed & UIEventButtonMaskPrimary) button = 0;
    else if (changed & UIEventButtonMaskSecondary) button = 2;
    else if (changed & (1 << 2)) button = 1;
    else if (changed & (1 << 3)) button = 3;
    else if (changed & (1 << 4)) button = 4;
    BOOL primary = [type isEqualToString:@"mouse"] || [self.primary[@(touch.type)] isEqual:identity];
    NSUInteger buttons = [type isEqualToString:@"mouse"] ? nativeButtons : ([phase isEqualToString:@"end"] || [phase isEqualToString:@"cancel"] ? 0 : 1);
    CUIDeliverWindowPointer(window, @{
      @"phase": phase, @"pointerId": identity, @"pointerType": type, @"isPrimary": @(primary), @"button": @(button),
      @"buttons": @(buttons), @"nativeButtons": [NSString stringWithFormat:@"%lu", (unsigned long)nativeButtons],
      @"shiftKey": @((flags & UIKeyModifierShift) != 0), @"altKey": @((flags & UIKeyModifierAlternate) != 0),
      @"ctrlKey": @((flags & UIKeyModifierControl) != 0), @"metaKey": @((flags & UIKeyModifierCommand) != 0),
      @"nativeModifiers": [NSString stringWithFormat:@"%lu", (unsigned long)flags],
      @"pageX": @(point.x), @"pageY": @(point.y), @"timestamp": @(touch.timestamp * 1000), @"target": @(hit ? hit.tag : -1)
    }, CUIWindowPointerAncestry(hit));
    self.previousButtons = nativeButtons;
    if ([phase isEqualToString:@"end"] || [phase isEqualToString:@"cancel"]) {
      [self.identities removeObjectForKey:touch];
      BOOL remaining = NO;
      for (UITouch *other in self.identities.keyEnumerator) remaining |= other.type == touch.type;
      if (!remaining) [self.primary removeObjectForKey:@(touch.type)];
    }
  }
  if (!self.identities.count) self.state = UIGestureRecognizerStateFailed;
}
- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event { [self observeTouches:touches event:event phase:@"start"]; }
- (void)touchesMoved:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event { [self observeTouches:touches event:event phase:@"move"]; }
- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event { [self observeTouches:touches event:event phase:@"end"]; }
- (void)touchesCancelled:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event { [self observeTouches:touches event:event phase:@"cancel"]; }
- (void)reset { [self.identities removeAllObjects]; [self.primary removeAllObjects]; self.previousButtons = 0; [super reset]; }
@end
NSArray<UIView *> *CUIInputScopes(UIWindow *window) {
  CUIWindowInputState *state = CUIWindowInput(window);
  return [state.scopes.allObjects sortedArrayUsingComparator:^NSComparisonResult(UIView *left, UIView *right) {
    return [[state.scopeOrder objectForKey:left] compare:[state.scopeOrder objectForKey:right]];
  }] ?: @[];
}
NSInteger CUINextInputPolicyOrder(UIWindow *window)
{
  CUIWindowInputState *state = CUIWindowInput(window);
  state.policyOrder++;
  return state.policyOrder;
}

void CUIRefreshKeyboardObservation(UIWindow *window)
{
  if (!window) return;
  CUIWindowInputState *state = CUIWindowInput(window);
  BOOL enabled = NO;
  for (id<CUIKeyboardObservationScope> scope in CUIInputScopes(window)) enabled |= [scope hasKeyboardObservations];
  if (enabled && !state.keyboardObserver) {
    state.keyboardObserver = [CUIPassiveKeyboardObserver new];
    [window addGestureRecognizer:state.keyboardObserver];
  } else if (!enabled && state.keyboardObserver) {
    [window removeGestureRecognizer:state.keyboardObserver];
    state.keyboardObserver = nil;
  }
}

@implementation CUIPassiveKeyboardObserver
- (instancetype)init
{
  if (self = [super initWithTarget:nil action:nil]) {
    self.cancelsTouchesInView = NO;
    self.delaysTouchesBegan = NO;
    self.delaysTouchesEnded = NO;
    self.delegate = self;
    _held = [NSMutableSet set];
  }
  return self;
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceivePress:(UIPress *)press { return press.key != nil; }
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceiveTouch:(UITouch *)touch { return NO; }
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)other { return YES; }
- (BOOL)canPreventGestureRecognizer:(UIGestureRecognizer *)other { return NO; }
- (BOOL)canBePreventedByGestureRecognizer:(UIGestureRecognizer *)other { return NO; }
- (void)pressesBegan:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
  UIWindow *window = self.view.window;
  CUIWindowInputState *state = CUIWindowInput(window);
  NSArray *scopes = CUIInputScopes(window);
  for (UIPress *press in presses) {
    if (!press.key || press.window != window) continue;
    NSNumber *code = @(press.key.keyCode);
    BOOL repeat = [self.held containsObject:code];
    [self.held addObject:code];
    UIView *focused = CUIInputFocusedView(window);
    BOOL captured = [focused isKindOfClass:CUIFocusView.class] && [(CUIFocusView *)focused capturesObservedKey:press.key];
    for (id<CUIKeyboardObservationScope> scope in scopes) captured |= [scope capturesObservedPress:press];
    NSUInteger eventId = ++state.observedEventId;
    for (id<CUIKeyboardObservationScope> scope in scopes) [scope observePress:press repeat:repeat eventId:eventId captured:captured];
  }
}
- (void)finishPresses:(NSSet<UIPress *> *)presses
{
  for (UIPress *press in presses) if (press.key) [self.held removeObject:@(press.key.keyCode)];
  if (!self.held.count) self.state = UIGestureRecognizerStateFailed;
}
- (void)pressesEnded:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event { [self finishPresses:presses]; }
- (void)pressesCancelled:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event { [self finishPresses:presses]; }
- (void)reset { [self.held removeAllObjects]; [super reset]; }
@end

NSString *CUIInputKeyName(UIKey *key)
{
  switch (key.keyCode) {
    case UIKeyboardHIDUsageKeyboardReturnOrEnter:
    case UIKeyboardHIDUsageKeypadEnter: return @"Enter";
    case UIKeyboardHIDUsageKeyboardEscape: return @"Escape";
    case UIKeyboardHIDUsageKeyboardTab: return @"Tab";
    case UIKeyboardHIDUsageKeyboardDeleteOrBackspace: return @"Backspace";
    case UIKeyboardHIDUsageKeyboardDeleteForward: return @"Delete";
    case UIKeyboardHIDUsageKeyboardRightArrow: return @"ArrowRight";
    case UIKeyboardHIDUsageKeyboardLeftArrow: return @"ArrowLeft";
    case UIKeyboardHIDUsageKeyboardDownArrow: return @"ArrowDown";
    case UIKeyboardHIDUsageKeyboardUpArrow: return @"ArrowUp";
    case UIKeyboardHIDUsageKeyboardHome: return @"Home";
    case UIKeyboardHIDUsageKeyboardEnd: return @"End";
    case UIKeyboardHIDUsageKeyboardPageUp: return @"PageUp";
    case UIKeyboardHIDUsageKeyboardPageDown: return @"PageDown";
    case UIKeyboardHIDUsageKeyboardSpacebar: return @" ";
    default: return key.characters.length ? key.characters : @"Unidentified";
  }
}

NSString *CUIInputKeyToken(UIKey *key)
{
  UIKeyModifierFlags flags = key.modifierFlags;
  return [NSString stringWithFormat:@"%d%d%d%d:%@", !!(flags & UIKeyModifierShift),
      !!(flags & UIKeyModifierAlternate), !!(flags & UIKeyModifierControl),
      !!(flags & UIKeyModifierCommand), CUIInputKeyName(key)];
}
