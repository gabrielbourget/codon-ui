#import "CUIKeyboardScope.h"
#import "CUIInputWindow.h"
#import "CUIFloatingObserver.h"
#import <UIKit/UIGestureRecognizerSubclass.h>
#import <react/renderer/components/CodonNativeInputSpec/ComponentDescriptors.h>
#import <react/renderer/components/CodonNativeInputSpec/EventEmitters.h>
#import <react/renderer/components/CodonNativeInputSpec/Props.h>

using namespace facebook::react;

static UIView *CUIFirstResponder(UIView *root)
{
  if (root.isFirstResponder) return root;
  for (UIView *child in root.subviews) {
    UIView *focused = CUIFirstResponder(child);
    if (focused) return focused;
  }
  return nil;
}

@interface CUIKeyHold : NSObject
@property(nonatomic, strong) UIPress *press;
@property(nonatomic, copy) NSString *policyId;
@property(nonatomic, copy) NSString *ownerId;
@property(nonatomic, assign) NSInteger focusedTarget;
@property(nonatomic, assign) BOOL retired;
@property(nonatomic, copy) NSString *windowId;
@property(nonatomic, assign) double epoch;
@property(nonatomic, assign) double policyRevision;
@end
@implementation CUIKeyHold
@end

@class CUIKeyboardRecognizer;
@interface CUIKeyboardScope () <UIGestureRecognizerDelegate>
- (NSString *)policyForPress:(UIPress *)press;
- (BOOL)hasPolicyForPress:(UIPress *)press;
- (void)recordModality:(NSString *)origin;
- (void)emitKey:(CUIKeyHold *)hold down:(BOOL)down repeat:(BOOL)repeat cancelled:(BOOL)cancelled;
- (void)prepareHold:(CUIKeyHold *)hold;
- (NSString *)localPolicyForPress:(UIPress *)press focused:(UIView *)focused;
- (NSInteger)policyOrder;
@end

@interface CUIKeyboardRecognizer : UIGestureRecognizer
@property(nonatomic, weak) CUIKeyboardScope *scope;
@property(nonatomic, strong) NSMutableDictionary<NSNumber *, CUIKeyHold *> *held;
- (void)retireHeld;
@end

@implementation CUIKeyboardRecognizer
- (instancetype)init
{
  if (self = [super initWithTarget:nil action:nil]) {
    _held = [NSMutableDictionary dictionary];
    self.cancelsTouchesInView = YES;
    self.delaysTouchesBegan = YES;
    self.delaysTouchesEnded = YES;
  }
  return self;
}

- (void)pressesBegan:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
  for (UIPress *press in presses) {
    if (!press.key) continue;
    NSNumber *code = @(press.key.keyCode);
    CUIKeyHold *hold = self.held[code];
    BOOL repeat = hold != nil;
    if (!hold) {
      NSString *policy = [self.scope policyForPress:press];
      if (!policy) { [self ignorePress:press forEvent:event]; continue; }
      hold = [CUIKeyHold new];
      hold.policyId = policy;
      hold.press = press;
      UIView *focused = CUIFirstResponder(self.view.window);
      while (focused && focused.tag <= 0) focused = focused.superview;
      hold.focusedTarget = focused ? focused.tag : -1;
      [self.scope prepareHold:hold];
      self.held[code] = hold;
    }
    hold.press = press;
    if (self.state == UIGestureRecognizerStatePossible) self.state = UIGestureRecognizerStateBegan;
    else self.state = UIGestureRecognizerStateChanged;
    if (!hold.retired) [self.scope emitKey:hold down:YES repeat:repeat cancelled:NO];
  }
}

- (void)finishPresses:(NSSet<UIPress *> *)presses cancelled:(BOOL)cancelled
{
  for (UIPress *press in presses) {
    NSNumber *code = @(press.key.keyCode);
    CUIKeyHold *hold = self.held[code];
    if (!hold) continue;
    hold.press = press;
    if (!hold.retired) [self.scope emitKey:hold down:NO repeat:NO cancelled:cancelled];
    [self.held removeObjectForKey:code];
  }
  if (!self.held.count && self.state != UIGestureRecognizerStatePossible) self.state = UIGestureRecognizerStateEnded;
}
- (void)pressesEnded:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event { [self finishPresses:presses cancelled:NO]; }
- (void)pressesCancelled:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event { [self finishPresses:presses cancelled:YES]; }
- (void)retireHeld
{
  for (CUIKeyHold *hold in self.held.allValues) {
    if (!hold.retired) [self.scope emitKey:hold down:NO repeat:NO cancelled:YES];
    hold.retired = YES;
  }
}
- (void)reset
{
  [self retireHeld];
  [self.held removeAllObjects];
  [super reset];
}
- (BOOL)canPreventGestureRecognizer:(UIGestureRecognizer *)other { return NO; }
- (BOOL)canBePreventedByGestureRecognizer:(UIGestureRecognizer *)other { return NO; }
@end

@implementation CUIKeyboardScope {
  NSString *_ownerId;
  BOOL _captureEnabled;
  NSArray<NSDictionary *> *_policies;
  CUIKeyboardRecognizer *_keyboard;
  __weak UIWindow *_boundWindow;
  double _windowEpoch;
  double _acceptedEpoch;
  double _policyRevision;
  NSString *_acceptedWindowId;
  NSInteger _policyOrder;
  BOOL _applicationActive;
  BOOL _sceneActive;
  CUIFloatingObserver *_floating;
  NSArray<NSDictionary *> *_floatingTargets;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<CUIKeyboardScopeComponentDescriptor>();
}
- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    _props = std::make_shared<const CUIKeyboardScopeProps>();
    _ownerId = @"";
    _captureEnabled = YES;
    _policies = @[];
    _acceptedWindowId = @"";
    _acceptedEpoch = -1;
    _applicationActive = UIApplication.sharedApplication.applicationState == UIApplicationStateActive;
    _sceneActive = YES;
    _floatingTargets = @[];
    __weak CUIKeyboardScope *weakSelf = self;
    _floating = [[CUIFloatingObserver alloc] initWithHost:self publish:^(NSDictionary *sample) {
      CUIKeyboardScope *scope = weakSelf;
      if (!scope || ![scope captureReady] || !scope->_eventEmitter) return;
      CUIKeyboardScopeEventEmitter::OnNativeFloatingObservation data{};
      data.ownerId = scope->_ownerId.UTF8String;
      data.windowId = CUIInputWindowIdentity(scope.window).UTF8String;
      data.epoch = scope->_windowEpoch;
      data.id = [sample[@"id"] UTF8String];
      data.targetTag = [sample[@"targetTag"] intValue];
      data.x = [sample[@"x"] doubleValue]; data.y = [sample[@"y"] doubleValue];
      data.width = [sample[@"width"] doubleValue]; data.height = [sample[@"height"] doubleValue];
      data.scrollRevision = [sample[@"scrollRevision"] doubleValue];
      data.revision = [sample[@"revision"] doubleValue];
      std::static_pointer_cast<const CUIKeyboardScopeEventEmitter>(scope->_eventEmitter)->onNativeFloatingObservation(data);
    }];
    _keyboard = [CUIKeyboardRecognizer new];
    _keyboard.scope = self;
    _keyboard.delegate = self;
    [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(windowDeactivated:) name:UIWindowDidResignKeyNotification object:nil];
    [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(applicationDeactivated:) name:UIApplicationWillResignActiveNotification object:nil];
    [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(windowActivated:) name:UIWindowDidBecomeKeyNotification object:nil];
    [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(applicationActivated:) name:UIApplicationDidBecomeActiveNotification object:nil];
    [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(sceneDeactivated:) name:UISceneWillDeactivateNotification object:nil];
    [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(sceneActivated:) name:UISceneDidActivateNotification object:nil];
  }
  return self;
}
- (NSDictionary *)activationSession
{
  return @{ @"scopeOwnerId": _ownerId, @"windowId": CUIInputWindowIdentity(self.window), @"epoch": @(_windowEpoch) };
}
- (BOOL)captureReady
{
  return _captureEnabled && [self windowActive] && _acceptedEpoch == _windowEpoch && [_acceptedWindowId isEqualToString:CUIInputWindowIdentity(self.window)];
}
- (BOOL)windowActive
{
  BOOL sceneActive = self.window.windowScene == nil || self.window.windowScene.activationState == UISceneActivationStateForegroundActive;
  return self.window.isKeyWindow && !self.window.hidden && _sceneActive && sceneActive && _applicationActive && UIApplication.sharedApplication.applicationState == UIApplicationStateActive;
}
- (void)publishStatus
{
  [_floating setTargets:_floatingTargets active:[self captureReady]];
  if (!_eventEmitter) return;
  CUIKeyboardScopeEventEmitter::OnNativeScopeStatus data{};
  data.ownerId = _ownerId.UTF8String;
  data.windowId = CUIInputWindowIdentity(self.window).UTF8String;
  data.epoch = _windowEpoch;
  data.policyRevision = _policyRevision;
  data.ready = [self captureReady];
  data.windowActive = [self windowActive];
  std::static_pointer_cast<const CUIKeyboardScopeEventEmitter>(_eventEmitter)->onNativeScopeStatus(data);
}
- (NSString *)policyForPress:(UIPress *)press
{
  if (![self captureReady] || !press.key || press.window != self.window) return nil;
  UIView *focused = CUIFirstResponder(self.window);
  NSString *policy = [self localPolicyForPress:press focused:focused];
  if (!policy) return nil;
  for (UIView *view in CUIInputScopes(self.window)) {
    CUIKeyboardScope *scope = (CUIKeyboardScope *)view;
    if (scope != self && [scope policyOrder] > _policyOrder && [scope localPolicyForPress:press focused:focused]) return nil;
  }
  return policy;
}
- (NSInteger)policyOrder { return _policyOrder; }
- (NSString *)localPolicyForPress:(UIPress *)press focused:(UIView *)focused
{
  if (![self captureReady] || !press.key || press.window != self.window) return nil;
  BOOL composing = [focused conformsToProtocol:@protocol(UITextInput)] && ((id<UITextInput>)focused).markedTextRange != nil;
  BOOL editable = [focused conformsToProtocol:@protocol(UIKeyInput)];
  NSString *token = CUIInputKeyToken(press.key);
  for (NSDictionary *policy in _policies) {
    if (editable && [policy[@"excludeEditable"] boolValue]) continue;
    if (composing && [policy[@"excludeComposing"] boolValue]) continue;
    NSInteger tag = [policy[@"targetTag"] integerValue];
    if (tag > 0) {
      BOOL contains = NO;
      for (UIView *view = focused; view; view = view.superview) if (view.tag == tag) { contains = YES; break; }
      if (!contains || ![focused isDescendantOfView:self]) continue;
    }
    if ([policy[@"tokens"] containsObject:token]) return policy[@"id"];
  }
  return nil;
}
- (BOOL)hasPolicyForPress:(UIPress *)press { return [self policyForPress:press] != nil; }
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceivePress:(UIPress *)press
{
  if (press.key && self.window.isKeyWindow) [self recordModality:@"keyboard"];
  return [self policyForPress:press] != nil;
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceiveTouch:(UITouch *)touch
{
  if (self.window.isKeyWindow) [self recordModality:@"pointer"];
  return NO;
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)other { return YES; }
- (void)recordModality:(NSString *)origin
{
  CUIRecordWindowModality(self.window, origin);
  if (!_eventEmitter) return;
  CUIKeyboardScopeEventEmitter::OnNativeInputModality data{};
  data.ownerId = _ownerId.UTF8String;
  data.windowId = CUIInputWindowIdentity(self.window).UTF8String;
  data.epoch = _windowEpoch;
  data.origin = [origin isEqualToString:@"keyboard"] ? CUIKeyboardScopeEventEmitter::OnNativeInputModalityOrigin::Keyboard : CUIKeyboardScopeEventEmitter::OnNativeInputModalityOrigin::Pointer;
  data.timestamp = NSProcessInfo.processInfo.systemUptime * 1000;
  std::static_pointer_cast<const CUIKeyboardScopeEventEmitter>(_eventEmitter)->onNativeInputModality(data);
}
- (void)emitKey:(CUIKeyHold *)hold down:(BOOL)down repeat:(BOOL)repeat cancelled:(BOOL)cancelled
{
  if (!_eventEmitter || !hold.press.key) return;
  UIKey *key = hold.press.key;
  UIKeyModifierFlags flags = key.modifierFlags;
  CUIKeyboardScopeEventEmitter::OnNativeScopedKey data{};
  data.kind = "keyboard";
  data.ownerId = hold.ownerId.UTF8String ?: "";
  data.policyId = hold.policyId.UTF8String;
  data.target = (int)self.tag;
  data.focusedTarget = (int)hold.focusedTarget;
  data.windowId = hold.windowId.UTF8String;
  data.epoch = hold.epoch;
  data.policyRevision = hold.policyRevision;
  data.key = CUIInputKeyName(key).UTF8String;
  data.nativeCode = (int)key.keyCode;
  data.characters = key.characters.UTF8String ?: "";
  data.phase = down ? CUIKeyboardScopeEventEmitter::OnNativeScopedKeyPhase::Down : CUIKeyboardScopeEventEmitter::OnNativeScopedKeyPhase::Up;
  data.repeat = repeat;
  data.cancelled = cancelled;
  data.shiftKey = flags & UIKeyModifierShift;
  data.altKey = flags & UIKeyModifierAlternate;
  data.ctrlKey = flags & UIKeyModifierControl;
  data.metaKey = flags & UIKeyModifierCommand;
  data.capsLock = flags & UIKeyModifierAlphaShift;
  data.nativeModifierData = std::to_string((unsigned long long)flags);
  data.nativeDefaultHandled = true;
  data.timestamp = (cancelled ? NSProcessInfo.processInfo.systemUptime : hold.press.timestamp) * 1000;
  std::static_pointer_cast<const CUIKeyboardScopeEventEmitter>(_eventEmitter)->onNativeScopedKey(data);
}
- (void)prepareHold:(CUIKeyHold *)hold
{
  hold.ownerId = _ownerId;
  hold.windowId = CUIInputWindowIdentity(self.window);
  hold.epoch = _windowEpoch;
  hold.policyRevision = _policyRevision;
}
- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &next = *std::static_pointer_cast<const CUIKeyboardScopeProps>(props);
  NSString *owner = [NSString stringWithUTF8String:next.ownerId.c_str()];
  NSMutableArray *policies = [NSMutableArray array];
  for (const auto &policy : next.policies) {
    NSMutableArray *tokens = [NSMutableArray array];
    for (const auto &token : policy.tokens) [tokens addObject:[NSString stringWithUTF8String:token.c_str()]];
    [policies addObject:@{@"id": [NSString stringWithUTF8String:policy.id.c_str()], @"tokens": tokens, @"excludeEditable": @(policy.excludeEditable), @"excludeComposing": @(policy.excludeComposing), @"targetTag": @(policy.targetTag)}];
  }
  NSString *accepted = [NSString stringWithUTF8String:next.acceptedWindowId.c_str()];
  if (![_ownerId isEqualToString:owner] || !next.enabled || ![_policies isEqual:policies] || _acceptedEpoch != next.acceptedEpoch || ![_acceptedWindowId isEqualToString:accepted] || _policyRevision != next.policyRevision) [_keyboard retireHeld];
  _ownerId = owner;
  _captureEnabled = next.enabled;
  if (![_policies isEqual:policies]) _policyOrder = CUINextInputPolicyOrder(self.window);
  _policies = policies;
  _acceptedWindowId = accepted;
  _acceptedEpoch = next.acceptedEpoch;
  _policyRevision = next.policyRevision;
  NSMutableArray *floating = [NSMutableArray array];
  for (const auto &target : next.floatingTargets) [floating addObject:@{ @"id": [NSString stringWithUTF8String:target.id.c_str()], @"targetTag": @(target.targetTag), @"descriptionTag": @(target.descriptionTag), @"descriptionLabel": [NSString stringWithUTF8String:target.descriptionLabel.c_str()] }];
  _floatingTargets = floating;
  [super updateProps:props oldProps:oldProps];
  [self publishStatus];
}
- (void)windowDeactivated:(NSNotification *)notification
{
  if (notification.object == self.window) { [_keyboard retireHeld]; _keyboard.enabled = NO; _keyboard.enabled = YES; _windowEpoch++; [self publishStatus]; }
}
- (void)windowActivated:(NSNotification *)notification
{
  if (notification.object == self.window) { _windowEpoch++; [self publishStatus]; }
}
- (void)applicationDeactivated:(NSNotification *)notification { _applicationActive = NO; [_keyboard retireHeld]; _keyboard.enabled = NO; _keyboard.enabled = YES; _windowEpoch++; [self publishStatus]; }
- (void)applicationActivated:(NSNotification *)notification { _applicationActive = YES; _windowEpoch++; [self publishStatus]; }
- (void)sceneDeactivated:(NSNotification *)notification
{
  if (notification.object == self.window.windowScene) { _sceneActive = NO; [_keyboard retireHeld]; _keyboard.enabled = NO; _keyboard.enabled = YES; _windowEpoch++; [self publishStatus]; }
}
- (void)sceneActivated:(NSNotification *)notification
{
  if (notification.object == self.window.windowScene) { _sceneActive = YES; _windowEpoch++; [self publishStatus]; }
}
- (void)didMoveToWindow
{
  [super didMoveToWindow];
  if (_boundWindow != self.window) {
    [_keyboard retireHeld];
    [_boundWindow removeGestureRecognizer:_keyboard];
    CUIUnregisterInputScope(_boundWindow, self);
    _boundWindow = self.window;
    _sceneActive = self.window.windowScene == nil || self.window.windowScene.activationState == UISceneActivationStateForegroundActive;
    _windowEpoch++;
    if (_boundWindow) {
      CUIRegisterInputScope(_boundWindow, self);
      [_boundWindow addGestureRecognizer:_keyboard];
      _policyOrder = CUINextInputPolicyOrder(_boundWindow);
    }
  }
  [self publishStatus];
}
- (void)prepareForRecycle
{
  [_floating invalidate]; _floatingTargets = @[];
  [_keyboard retireHeld];
  [_boundWindow removeGestureRecognizer:_keyboard];
  CUIUnregisterInputScope(_boundWindow, self);
  _boundWindow = nil;
  _ownerId = @"";
  _policies = @[];
  _captureEnabled = NO;
  _windowEpoch++;
  _acceptedEpoch = -1;
  _acceptedWindowId = @"";
  [super prepareForRecycle];
}
- (void)dealloc
{
  [_floating invalidate];
  [_boundWindow removeGestureRecognizer:_keyboard];
  CUIUnregisterInputScope(_boundWindow, self);
  [NSNotificationCenter.defaultCenter removeObserver:self];
}
@end

Class<RCTComponentViewProtocol> CUIKeyboardScopeCls(void) { return CUIKeyboardScope.class; }
