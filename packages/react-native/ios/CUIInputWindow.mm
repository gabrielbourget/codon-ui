#import "CUIInputWindow.h"
#import "CUIFocusView.h"
#import <UIKit/UIGestureRecognizerSubclass.h>
#import <objc/runtime.h>

@interface CUIPassiveKeyboardObserver : UIGestureRecognizer <UIGestureRecognizerDelegate>
@property(nonatomic, strong) NSMutableSet<NSNumber *> *held;
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
}
void CUIUnregisterInputScope(UIWindow *window, UIView *scope) {
  CUIWindowInputState *state = CUIWindowInput(window);
  [state.scopes removeObject:scope]; [state.scopeOrder removeObjectForKey:scope];
  CUIRefreshKeyboardObservation(window);
}
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
