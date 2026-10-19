#import "CUIFocusView.h"
#import "CUIAccessibilityReferences.h"
#import "CUIInputWindow.h"
#import "CUIKeyboardScope.h"
#import "CUIFloatingScrollAnchor.h"
#import <react/featureflags/ReactNativeFeatureFlags.h>

#import <react/renderer/components/CodonNativeInputSpec/ComponentDescriptors.h>
#import <react/renderer/components/CodonNativeInputSpec/EventEmitters.h>
#import <react/renderer/components/CodonNativeInputSpec/Props.h>
#import <react/renderer/components/CodonNativeInputSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface CUIFocusView () <RCTCUIFocusViewViewProtocol>
@end

@implementation CUIFocusView {
  BOOL _keyboardFocusable;
  BOOL _nativePressable;
  BOOL _nativeNavigation;
  double _activationId;
  BOOL _focusAcknowledged;
  NSString *_ownerId;
  NSSet<NSString *> *_capturedKeys;
  NSMutableDictionary<NSNumber *, UIPress *> *_held;
  NSMutableSet<NSNumber *> *_consumed;
  NSArray<NSString *> *_nativeLabelledBy;
  NSArray<NSString *> *_nativeDescribedBy;
  NSArray<NSString *> *_nativeDetailsBy;
  NSInteger _nativeDescriptionTag;
  NSString *_nativeDescriptionLabel;
  NSString *_nativeDetailsLabel;
  NSArray<AXCustomContent *> *_callerAccessibilityContent;
  CUIFloatingScrollAnchor *_scrollAnchor;
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
    _nativeDescriptionLabel = @"Description";
    _nativeDetailsLabel = @"Details";
    _origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Unknown;
    _scrollAnchor = [[CUIFloatingScrollAnchor alloc] initWithRoot:self];
    [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(applicationWillResignActive:) name:UIApplicationWillResignActiveNotification object:nil];
  }
  return self;
}

- (NSString *)accessibilityLabel
{
  if (CUIAccessibilityIsResolving(self)) return nil;
  NSString *label = CUIAccessibilityResolve(self, _nativeLabelledBy, 0, NO);
  return label != nil ? label : [super accessibilityLabel];
}

- (UIAccessibilityContainerType)accessibilityContainerType
{
  return _nativeNavigation ? UIAccessibilityContainerTypeLandmark : [super accessibilityContainerType];
}

- (void)setAccessibilityCustomContent:(NSArray<AXCustomContent *> *)content
{
  _callerAccessibilityContent = [content copy];
}

- (NSArray<AXCustomContent *> *)accessibilityCustomContent
{
  NSMutableArray<AXCustomContent *> *content = [_callerAccessibilityContent mutableCopy] ?: [NSMutableArray array];
  NSString *description = CUIAccessibilityResolve(self, _nativeDescribedBy, _nativeDescriptionTag, YES);
  NSString *details = CUIAccessibilityResolve(self, _nativeDetailsBy, 0, YES);
  if (description != nil) [content addObject:[AXCustomContent customContentWithLabel:_nativeDescriptionLabel value:description]];
  if (details != nil) [content addObject:[AXCustomContent customContentWithLabel:_nativeDetailsLabel value:details]];
  return content;
}

- (void)inspectAccessibility:(NSString *)ownerId
{
  if (![_ownerId isEqualToString:ownerId] || !_eventEmitter || !self.window.isKeyWindow) return;
  NSArray<AXCustomContent *> *content = self.accessibilityCustomContent;
  NSUInteger index = _callerAccessibilityContent.count;
  BOOL descriptionAvailable = CUIAccessibilityResolve(self, _nativeDescribedBy, _nativeDescriptionTag, YES) != nil;
  BOOL detailsAvailable = CUIAccessibilityResolve(self, _nativeDetailsBy, 0, YES) != nil;
  CUIFocusViewEventEmitter::OnNativeAccessibilitySnapshot value{};
  value.ownerId = _ownerId.UTF8String;
  value.target = (int)self.tag;
  value.windowId = CUIInputWindowIdentity(self.window).UTF8String;
  value.platform = CUIFocusViewEventEmitter::OnNativeAccessibilitySnapshotPlatform::Ios;
  value.selected = (self.accessibilityTraits & UIAccessibilityTraitSelected) != 0;
  value.containerType = (int)self.accessibilityContainerType;
  value.containerTitle = "";
  value.roleDescription = "";
  value.label = self.accessibilityLabel.UTF8String ?: "";
  value.hint = self.accessibilityHint.UTF8String ?: "";
  value.value = self.accessibilityValue.UTF8String ?: "";
  value.description = descriptionAvailable ? content[index++].value.UTF8String : "";
  value.details = detailsAvailable ? content[index].value.UTF8String : "";
  value.descriptionAvailable = descriptionAvailable;
  value.detailsAvailable = detailsAvailable;
  value.observedAt = NSProcessInfo.processInfo.systemUptime * 1000;
  std::static_pointer_cast<const CUIFocusViewEventEmitter>(_eventEmitter)->onNativeAccessibilitySnapshot(value);
}

- (BOOL)accessibilityActivate
{
  if (!_nativePressable) return [super accessibilityActivate];
  UIWindow *window = self.window;
  BOOL sceneActive = window.windowScene == nil || window.windowScene.activationState == UISceneActivationStateForegroundActive;
  if (!_eventEmitter || !window.isKeyWindow || window.hidden || self.hidden || self.alpha <= 0 || !sceneActive || UIApplication.sharedApplication.applicationState != UIApplicationStateActive) return NO;
  CUIFocusViewEventEmitter::OnNativeActivation value{};
  value.kind = "activation";
  value.ownerId = _ownerId.UTF8String;
  value.target = (int)self.tag;
  value.source = CUIFocusViewEventEmitter::OnNativeActivationSource::IosAccessibilityActivate;
  value.observedAt = NSProcessInfo.processInfo.systemUptime * 1000;
  value.activationId = ++_activationId;
  value.scopeOwnerId = "";
  value.windowId = CUIInputWindowIdentity(window).UTF8String;
  value.epoch = 0;
  for (UIView *parent = self.superview; parent; parent = parent.superview) {
    if ([parent isKindOfClass:CUIKeyboardScope.class]) {
      NSDictionary *session = [(CUIKeyboardScope *)parent activationSession];
      value.scopeOwnerId = [session[@"scopeOwnerId"] UTF8String];
      value.windowId = [session[@"windowId"] UTF8String];
      value.epoch = [session[@"epoch"] doubleValue];
      break;
    }
  }
  std::static_pointer_cast<const CUIFocusViewEventEmitter>(_eventEmitter)->onNativeActivation(value);
  [super accessibilityActivate];
  return YES;
}

- (BOOL)canBecomeFocused { return _keyboardFocusable && self.window != nil && !self.hidden && self.alpha > 0; }
- (BOOL)canBecomeFirstResponder { return [self canBecomeFocused]; }

- (void)emitFocus:(BOOL)focused
{
  if (_focusAcknowledged == focused) return;
  _focusAcknowledged = focused;
  CUIAdvanceInputRevision(self.window);
  if (!focused) [self cancelHeldKeys];
  const auto origin = _origin;
  if (!focused) _origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Unknown;
  if (!_eventEmitter) return;
  CUIFocusViewEventEmitter::OnNativeFocusChange value{};
  value.ownerId = _ownerId.UTF8String;
  value.target = (int)self.tag;
  value.isFocused = focused;
  value.isFocusVisible = focused && self.window.isKeyWindow && [CUIInputWindowModality(self.window) isEqualToString:@"keyboard"];
  value.origin = origin;
  if (origin == CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Unknown) {
    NSString *modality = CUIInputWindowModality(self.window);
    if ([modality isEqualToString:@"keyboard"]) value.origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Keyboard;
    else if ([modality isEqualToString:@"pointer"]) value.origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Pointer;
  }
  value.timestamp = NSProcessInfo.processInfo.systemUptime * 1000;
  std::static_pointer_cast<const CUIFocusViewEventEmitter>(_eventEmitter)->onNativeFocusChange(value);
  if (!ReactNativeFeatureFlags::enableImperativeFocus()) {
    if (focused) _eventEmitter->onFocus();
    else _eventEmitter->onBlur();
  }
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
  UIWindow *window = self.window;
  BOOL sceneActive = window.windowScene == nil || window.windowScene.activationState == UISceneActivationStateForegroundActive;
  if (!window.isKeyWindow || window.hidden || !sceneActive || UIApplication.sharedApplication.applicationState != UIApplicationStateActive) return;
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
- (void)requestContainerFocus:(NSString *)ownerId
{
  if (![_ownerId isEqualToString:ownerId]) return;
  UIView *focused = CUIInputFocusedView(self.window);
  if (focused && [focused isDescendantOfView:self]) return;
  [self requestKeyboardFocus:ownerId];
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
      !!(flags & UIKeyModifierCommand), CUIInputKeyName(key)];
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
  value.key = CUIInputKeyName(key).UTF8String;
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

- (BOOL)capturesObservedKey:(UIKey *)key
{
  NSNumber *code = @(key.keyCode);
  return _keyboardFocusable && (self.isFirstResponder || self.isFocused) && (_held[code] ? [_consumed containsObject:code] : [_capturedKeys containsObject:[self captureToken:key]]);
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
    CUIRecordWindowModality(self.window, @"keyboard");
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
  [_scrollAnchor invalidate];
}

- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{
  _origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Pointer;
  CUIRecordWindowModality(self.window, @"pointer");
  [super touchesBegan:touches withEvent:event];
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &next = *std::static_pointer_cast<const CUIFocusViewProps>(props);
  [_scrollAnchor prepareTag:next.nativeScrollAnchorTag key:[NSString stringWithUTF8String:next.nativeScrollAnchorKey.c_str()] revision:[NSString stringWithUTF8String:next.nativeScrollAnchorRevision.c_str()]];
  NSString *owner = [NSString stringWithUTF8String:next.ownerId.c_str()];
  NSMutableSet *capture = [NSMutableSet set];
  for (const auto &key : next.capturedKeys) [capture addObject:[NSString stringWithUTF8String:key.c_str()]];
  if (![_ownerId isEqualToString:owner] || !next.keyboardFocusable || ![_capturedKeys isEqual:capture]) [self cancelHeldKeys];
  _ownerId = owner;
  _keyboardFocusable = next.keyboardFocusable;
  _nativePressable = next.nativePressable;
  _nativeNavigation = next.nativeNavigation;
  _capturedKeys = capture;
  NSMutableArray<NSString *> *labelledBy = [NSMutableArray array];
  for (const auto &id : next.nativeLabelledBy) [labelledBy addObject:[NSString stringWithUTF8String:id.c_str()]];
  NSMutableArray<NSString *> *describedBy = [NSMutableArray array];
  for (const auto &id : next.nativeDescribedBy) [describedBy addObject:[NSString stringWithUTF8String:id.c_str()]];
  NSMutableArray<NSString *> *detailsBy = [NSMutableArray array];
  for (const auto &id : next.nativeDetailsBy) [detailsBy addObject:[NSString stringWithUTF8String:id.c_str()]];
  _nativeLabelledBy = labelledBy;
  _nativeDescribedBy = describedBy;
  _nativeDetailsBy = detailsBy;
  _nativeDescriptionTag = next.nativeDescriptionTag;
  _nativeDescriptionLabel = [NSString stringWithUTF8String:next.nativeDescriptionLabel.c_str()];
  _nativeDetailsLabel = [NSString stringWithUTF8String:next.nativeDetailsLabel.c_str()];
  if (!_keyboardFocusable) [self resignFirstResponder];
  [super updateProps:props oldProps:oldProps];
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  if (!self.window) {
    [_scrollAnchor invalidate];
    [self cancelHeldKeys];
    [self emitFocus:NO];
    _origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Unknown;
  }
}

- (void)prepareForRecycle
{
  [_scrollAnchor invalidate];
  [self cancelHeldKeys];
  [self resignFirstResponder];
  _ownerId = @"";
  _capturedKeys = [NSSet set];
  _keyboardFocusable = YES;
  _nativePressable = NO;
  _nativeNavigation = NO;
  _nativeLabelledBy = nil;
  _nativeDescribedBy = nil;
  _nativeDetailsBy = nil;
  _nativeDescriptionTag = 0;
  _nativeDescriptionLabel = @"Description";
  _nativeDetailsLabel = @"Details";
  _callerAccessibilityContent = nil;
  _focusAcknowledged = NO;
  _origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Unknown;
  [super prepareForRecycle];
}

- (void)dealloc
{
  [_scrollAnchor invalidate];
  [NSNotificationCenter.defaultCenter removeObserver:self];
}

@end

Class<RCTComponentViewProtocol> CUIFocusViewCls(void) { return CUIFocusView.class; }
