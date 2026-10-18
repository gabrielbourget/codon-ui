#import "CUIFocusView.h"

#import <react/renderer/components/CodonNativeInputSpec/ComponentDescriptors.h>
#import <react/renderer/components/CodonNativeInputSpec/EventEmitters.h>
#import <react/renderer/components/CodonNativeInputSpec/Props.h>
#import <react/renderer/components/CodonNativeInputSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

static NSString *CUIKeyName(UIKey *key)
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

@interface CUIFocusView () <RCTCUIFocusViewViewProtocol>
@end

@implementation CUIFocusView {
  BOOL _keyboardFocusable;
  BOOL _focusAcknowledged;
  NSString *_ownerId;
  NSSet<NSString *> *_capturedKeys;
  NSMutableDictionary<NSNumber *, UIPress *> *_held;
  NSMutableSet<NSNumber *> *_consumed;
  CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin _origin;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<CUIFocusViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    _props = std::make_shared<const CUIFocusViewProps>();
    _keyboardFocusable = YES;
    _ownerId = @"";
    _capturedKeys = [NSSet set];
    _held = [NSMutableDictionary dictionary];
    _consumed = [NSMutableSet set];
    _origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Unknown;
    [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(applicationWillResignActive:) name:UIApplicationWillResignActiveNotification object:nil];
  }
  return self;
}

- (BOOL)canBecomeFocused { return _keyboardFocusable && self.window != nil && !self.hidden && self.alpha > 0; }
- (BOOL)canBecomeFirstResponder { return [self canBecomeFocused]; }

- (void)emitFocus:(BOOL)focused
{
  if (_focusAcknowledged == focused) return;
  _focusAcknowledged = focused;
  if (!focused) [self cancelHeldKeys];
  const auto origin = _origin;
  if (!focused) _origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Unknown;
  if (!_eventEmitter) return;
  CUIFocusViewEventEmitter::OnNativeFocusChange value{};
  value.ownerId = _ownerId.UTF8String;
  value.target = (int)self.tag;
  value.isFocused = focused;
  value.origin = origin;
  value.timestamp = NSProcessInfo.processInfo.systemUptime * 1000;
  std::static_pointer_cast<const CUIFocusViewEventEmitter>(_eventEmitter)->onNativeFocusChange(value);
}

- (BOOL)becomeFirstResponder
{
  BOOL accepted = [super becomeFirstResponder];
  if (accepted) [self emitFocus:YES];
  return accepted;
}

- (BOOL)resignFirstResponder
{
  BOOL accepted = [super resignFirstResponder];
  if (accepted) [self emitFocus:NO];
  return accepted;
}

- (void)didUpdateFocusInContext:(UIFocusUpdateContext *)context withAnimationCoordinator:(UIFocusAnimationCoordinator *)coordinator
{
  [super didUpdateFocusInContext:context withAnimationCoordinator:coordinator];
  if (context.nextFocusedView == self) {
    [self becomeFirstResponder];
    [self emitFocus:YES];
  } else if (context.previouslyFocusedView == self) {
    [self resignFirstResponder];
    [self emitFocus:NO];
  }
}

- (void)requestKeyboardFocus:(NSString *)ownerId
{
  if (![_ownerId isEqualToString:ownerId] || ![self canBecomeFirstResponder]) return;
  _origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Programmatic;
  [self becomeFirstResponder];
  UIFocusSystem *system = [UIFocusSystem focusSystemForEnvironment:self];
  [system requestFocusUpdateToEnvironment:self];
  [system updateFocusIfNeeded];
}

- (void)requestKeyboardBlur:(NSString *)ownerId
{
  if ([_ownerId isEqualToString:ownerId]) [self resignFirstResponder];
}

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
  RCTCUIFocusViewHandleCommand(self, commandName, args);
}

- (NSString *)captureToken:(UIKey *)key
{
  UIKeyModifierFlags flags = key.modifierFlags;
  return [NSString stringWithFormat:@"%d%d%d%d:%@", !!(flags & UIKeyModifierShift),
      !!(flags & UIKeyModifierAlternate), !!(flags & UIKeyModifierControl),
      !!(flags & UIKeyModifierCommand), CUIKeyName(key)];
}

- (void)emitKey:(UIPress *)press down:(BOOL)down repeat:(BOOL)repeat cancelled:(BOOL)cancelled handled:(BOOL)handled
{
  UIKey *key = press.key;
  if (!key || !_eventEmitter) return;
  UIKeyModifierFlags flags = key.modifierFlags;
  CUIFocusViewEventEmitter::OnNativeKey value{};
  value.kind = "keyboard";
  value.ownerId = _ownerId.UTF8String;
  value.target = (int)self.tag;
  value.key = CUIKeyName(key).UTF8String;
  value.nativeCode = (int)key.keyCode;
  value.characters = key.characters.UTF8String ?: "";
  value.phase = down ? CUIFocusViewEventEmitter::OnNativeKeyPhase::Down : CUIFocusViewEventEmitter::OnNativeKeyPhase::Up;
  value.repeat = repeat;
  value.cancelled = cancelled;
  value.shiftKey = flags & UIKeyModifierShift;
  value.altKey = flags & UIKeyModifierAlternate;
  value.ctrlKey = flags & UIKeyModifierControl;
  value.metaKey = flags & UIKeyModifierCommand;
  value.capsLock = flags & UIKeyModifierAlphaShift;
  value.nativeModifierData = std::to_string((unsigned long long)flags);
  value.nativeDefaultHandled = handled;
  value.timestamp = (cancelled ? NSProcessInfo.processInfo.systemUptime : press.timestamp) * 1000;
  std::static_pointer_cast<const CUIFocusViewEventEmitter>(_eventEmitter)->onNativeKey(value);
}

- (NSSet<UIPress *> *)processPresses:(NSSet<UIPress *> *)presses down:(BOOL)down cancelled:(BOOL)cancelled
{
  NSMutableSet<UIPress *> *unhandled = [NSMutableSet set];
  for (UIPress *press in presses) {
    if (!press.key || !_keyboardFocusable || (!self.isFirstResponder && !self.isFocused)) {
      [unhandled addObject:press];
      continue;
    }
    NSNumber *code = @(press.key.keyCode);
    BOOL repeat = down && _held[code] != nil;
    BOOL handled = [_consumed containsObject:code];
    if (down) {
      if (!repeat) handled = [_capturedKeys containsObject:[self captureToken:press.key]];
      _held[code] = press;
      if (handled) [_consumed addObject:code];
    }
    _origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Keyboard;
    [self emitKey:press down:down repeat:repeat cancelled:cancelled handled:handled];
    if (!down) {
      [_held removeObjectForKey:code];
      [_consumed removeObject:code];
    }
    if (!handled) [unhandled addObject:press];
  }
  return unhandled;
}

- (void)pressesBegan:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
  NSSet *remaining = [self processPresses:presses down:YES cancelled:NO];
  if (remaining.count) [super pressesBegan:remaining withEvent:event];
}

- (void)pressesEnded:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
  NSSet *remaining = [self processPresses:presses down:NO cancelled:NO];
  if (remaining.count) [super pressesEnded:remaining withEvent:event];
}

- (void)pressesCancelled:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
  NSSet *remaining = [self processPresses:presses down:NO cancelled:YES];
  if (remaining.count) [super pressesCancelled:remaining withEvent:event];
}

- (void)cancelHeldKeys
{
  for (NSNumber *code in _held.allKeys) {
    [self emitKey:_held[code] down:NO repeat:NO cancelled:YES handled:[_consumed containsObject:code]];
  }
  [_held removeAllObjects];
  [_consumed removeAllObjects];
}

- (void)applicationWillResignActive:(NSNotification *)notification
{
  [self cancelHeldKeys];
}

- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{
  _origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Pointer;
  [super touchesBegan:touches withEvent:event];
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &next = *std::static_pointer_cast<const CUIFocusViewProps>(props);
  NSString *owner = [NSString stringWithUTF8String:next.ownerId.c_str()];
  NSMutableSet *capture = [NSMutableSet set];
  for (const auto &key : next.capturedKeys) [capture addObject:[NSString stringWithUTF8String:key.c_str()]];
  if (![_ownerId isEqualToString:owner] || !next.keyboardFocusable || ![_capturedKeys isEqual:capture]) [self cancelHeldKeys];
  _ownerId = owner;
  _keyboardFocusable = next.keyboardFocusable;
  _capturedKeys = capture;
  if (!_keyboardFocusable) [self resignFirstResponder];
  [super updateProps:props oldProps:oldProps];
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  if (!self.window) {
    [self cancelHeldKeys];
    [self emitFocus:NO];
    _origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Unknown;
  }
}

- (void)prepareForRecycle
{
  [self cancelHeldKeys];
  [self resignFirstResponder];
  _ownerId = @"";
  _capturedKeys = [NSSet set];
  _keyboardFocusable = YES;
  _focusAcknowledged = NO;
  _origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Unknown;
  [super prepareForRecycle];
}

- (void)dealloc
{
  [NSNotificationCenter.defaultCenter removeObserver:self];
}

@end

Class<RCTComponentViewProtocol> CUIFocusViewCls(void) { return CUIFocusView.class; }
