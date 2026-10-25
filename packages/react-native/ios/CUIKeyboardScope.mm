#import "CUIKeyboardScope.h"
#import "CUIInputWindow.h"
#import "CUIMenuPointerPolicies.h"
#import "CUIFloatingObserver.h"
#import "CUIPhysicalKey.h"
#import "CUIEditorKeyboardRecognizer.h"
#import "CUIFieldInputBinding.h"
#include "../cpp/CUIEditorKeyboardDefaultRegistry.h"
#import <UIKit/UIGestureRecognizerSubclass.h>
#import <os/log.h>
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
@interface CUIKeyboardScope () <UIGestureRecognizerDelegate, CUIKeyboardObservationScope, CUIWindowPointerScope>
- (NSString *)policyForPress:(UIPress *)press;
- (BOOL)hasPolicyForPress:(UIPress *)press;
- (void)recordModality:(NSString *)origin;
- (void)emitKey:(CUIKeyHold *)hold down:(BOOL)down repeat:(BOOL)repeat cancelled:(BOOL)cancelled;
- (void)prepareHold:(CUIKeyHold *)hold;
- (NSString *)localPolicyForPress:(UIPress *)press focused:(UIView *)focused;
- (NSInteger)policyOrder;
- (void)emitMenuPointer:(NSDictionary *)packet;
- (NSDictionary *)editorBindingForPress:(UIPress *)press;
- (BOOL)dispatchEditorPress:(UIPress *)press phase:(NSString *)phase repeat:(BOOL)repeat;
- (void)publishEditorKeyboardStatus;
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
  CUIEditorKeyboardRecognizer *_editorKeyboard;
  NSArray<NSDictionary *> *_editorKeyboardBindings;
  NSMapTable<NSString *, UIView *> *_editorKeyboardTargets;
  NSMutableSet<NSString *> *_resolvedEditorKeyboardTargets;
  NSMutableDictionary<NSString *, NSString *> *_editorKeyboardStatuses;
  NSUInteger _editorKeyboardStatusSequence;
  NSUInteger _editorKeyboardEventId;
  CUIMenuPointerPolicies *_menuPointers;
  NSArray<NSDictionary *> *_menuPointerRegistrations;
  double _menuPointerRevision;
  NSString *_ownerId;
  BOOL _captureEnabled;
  NSArray<NSDictionary *> *_policies;
  CUIKeyboardRecognizer *_keyboard;
  __weak UIWindow *_boundWindow;
  double _windowEpoch;
  double _acceptedEpoch;
  double _policyRevision;
  double _observationRevision;
  NSArray<NSDictionary *> *_observations;
  NSArray<NSDictionary *> *_pointerRegistrations;
  NSMapTable<NSString *, UIView *> *_pointerTargets;
  NSMutableSet<NSString *> *_resolvedPointerTargets;
  double _pointerRevision;
  NSString *_pointerStatus;
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
    _observations = @[];
    _pointerRegistrations = @[];
    _pointerTargets = NSMapTable.strongToWeakObjectsMapTable;
    _resolvedPointerTargets = [NSMutableSet set];
    _acceptedWindowId = @"";
    _acceptedEpoch = -1;
    _applicationActive = UIApplication.sharedApplication.applicationState == UIApplicationStateActive;
    _sceneActive = YES;
    _floatingTargets = @[];
    __weak CUIKeyboardScope *weakSelf = self;
    _editorKeyboardBindings = @[];
    _editorKeyboardTargets = NSMapTable.strongToWeakObjectsMapTable;
    _resolvedEditorKeyboardTargets = [NSMutableSet set];
    _editorKeyboardStatuses = [NSMutableDictionary dictionary];
    _editorKeyboard = [[CUIEditorKeyboardRecognizer alloc] initWithAdmission:^BOOL(UIPress *press) {
      return [weakSelf editorBindingForPress:press] != nil;
    } dispatch:^BOOL(UIPress *press, NSString *phase, BOOL repeat) {
      return [weakSelf dispatchEditorPress:press phase:phase repeat:repeat];
    }];
    _editorKeyboard.enabled = NO;
    _menuPointerRegistrations = @[];
    _menuPointers = [[CUIMenuPointerPolicies alloc] initWithScope:self ready:^BOOL {
      CUIKeyboardScope *scope = weakSelf;
      return scope && [scope captureReady];
    } publish:^(NSDictionary *packet) { [weakSelf emitMenuPointer:packet]; }];
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
- (CUIMenuPointerPolicies *)menuPointers { return _menuPointers; }
- (void)emitMenuPointer:(NSDictionary *)packet
{
  if (!_eventEmitter) return;
  CUIKeyboardScopeEventEmitter::OnNativeMenuPointer data{};
  data.ownerId = [packet[@"ownerId"] UTF8String]; data.windowId = [packet[@"windowId"] UTF8String]; data.epoch = [packet[@"epoch"] doubleValue];
  data.revision = [packet[@"revision"] doubleValue]; data.policyId = [packet[@"policyId"] UTF8String]; data.sequence = [packet[@"sequence"] doubleValue];
  NSString *phase = packet[@"phase"];
  data.phase = [phase isEqualToString:@"move"] ? CUIKeyboardScopeEventEmitter::OnNativeMenuPointerPhase::Move
      : [phase isEqualToString:@"down"] ? CUIKeyboardScopeEventEmitter::OnNativeMenuPointerPhase::Down
      : [phase isEqualToString:@"reset"] ? CUIKeyboardScopeEventEmitter::OnNativeMenuPointerPhase::Reset
      : [phase isEqualToString:@"handoff"] ? CUIKeyboardScopeEventEmitter::OnNativeMenuPointerPhase::Handoff
      : [phase isEqualToString:@"retired"] ? CUIKeyboardScopeEventEmitter::OnNativeMenuPointerPhase::Retired
      : CUIKeyboardScopeEventEmitter::OnNativeMenuPointerPhase::Status;
  NSString *type = packet[@"pointerType"];
  data.pointerType = [type isEqualToString:@"mouse"] ? CUIKeyboardScopeEventEmitter::OnNativeMenuPointerPointerType::Mouse
      : [type isEqualToString:@"touch"] ? CUIKeyboardScopeEventEmitter::OnNativeMenuPointerPointerType::Touch
      : [type isEqualToString:@"pen"] ? CUIKeyboardScopeEventEmitter::OnNativeMenuPointerPointerType::Pen
      : [type isEqualToString:@"virtual"] ? CUIKeyboardScopeEventEmitter::OnNativeMenuPointerPointerType::Virtual
      : CUIKeyboardScopeEventEmitter::OnNativeMenuPointerPointerType::Unknown;
  data.ready = [packet[@"ready"] boolValue]; data.suppressed = [packet[@"suppressed"] boolValue]; data.observationId = [packet[@"observationId"] doubleValue];
  data.pageX = [packet[@"pageX"] doubleValue]; data.pageY = [packet[@"pageY"] doubleValue]; data.timestamp = [packet[@"timestamp"] doubleValue];
  data.target = [packet[@"target"] intValue]; for (NSNumber *tag in packet[@"hitPath"]) data.hitPath.push_back(tag.intValue);
  data.nativeButtons = [packet[@"nativeButtons"] UTF8String]; data.nativeModifiers = [packet[@"nativeModifiers"] UTF8String];
  data.geometry = [packet[@"geometry"] UTF8String]; data.error = [packet[@"error"] UTF8String];
  std::static_pointer_cast<const CUIKeyboardScopeEventEmitter>(_eventEmitter)->onNativeMenuPointer(data);
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
  [self publishEditorKeyboardStatus];
  [_floating setTargets:_floatingTargets active:[self captureReady]];
  CUIRefreshKeyboardObservation(self.window);
  CUIRefreshWindowPointerObservation(self.window);
  [_menuPointers update:_menuPointerRegistrations revision:_menuPointerRevision session:@{
    @"ownerId": _ownerId, @"windowId": CUIInputWindowIdentity(self.window), @"epoch": @(_windowEpoch)
  }];
  if (!_eventEmitter) return;
  CUIKeyboardScopeEventEmitter::OnNativeScopeStatus data{};
  data.ownerId = _ownerId.UTF8String;
  data.windowId = CUIInputWindowIdentity(self.window).UTF8String;
  data.epoch = _windowEpoch;
  data.policyRevision = _policyRevision;
  data.ready = [self captureReady];
  data.windowActive = [self windowActive];
  std::static_pointer_cast<const CUIKeyboardScopeEventEmitter>(_eventEmitter)->onNativeScopeStatus(data);
  CUIKeyboardScopeEventEmitter::OnNativeObservationStatus observed{};
  observed.ownerId = data.ownerId; observed.windowId = data.windowId; observed.epoch = _windowEpoch;
  observed.observationRevision = _observationRevision; observed.ready = [self captureReady]; observed.windowActive = [self windowActive];
  std::static_pointer_cast<const CUIKeyboardScopeEventEmitter>(_eventEmitter)->onNativeObservationStatus(observed);
}
- (NSArray<NSDictionary *> *)windowPointerRegistrationsForAncestry:(NSArray<NSNumber *> *)ancestry
{
  if (![self captureReady]) return @[];
  NSMutableArray *result = [NSMutableArray array];
  for (NSDictionary *entry in _pointerRegistrations) {
    NSString *identity = entry[@"id"];
    if (![_resolvedPointerTargets containsObject:identity]) {
      UIView *found = [self.window viewWithTag:[entry[@"targetTag"] integerValue]];
      if (found && [found isDescendantOfView:self]) {
        [_pointerTargets setObject:found forKey:identity];
        [_resolvedPointerTargets addObject:identity];
      }
    }
    UIView *target = [_pointerTargets objectForKey:identity];
    if (!target || target.tag != [entry[@"targetTag"] integerValue] || target.window != self.window || ![target isDescendantOfView:self]) continue;
    NSUInteger depth = [ancestry indexOfObject:entry[@"targetTag"]];
    [result addObject:@{ @"id": identity, @"targetTag": entry[@"targetTag"], @"ownerId": _ownerId,
      @"epoch": @(_windowEpoch), @"revision": @(_pointerRevision), @"depth": @(depth == NSNotFound ? -1 : (NSInteger)depth) }];
  }
  return result;
}
- (void)publishWindowPointerStatus:(BOOL)available error:(NSString *)error
{
  BOOL ready = available && [self captureReady] && _pointerRegistrations.count > 0 && [self windowPointerRegistrationsForAncestry:@[]].count == _pointerRegistrations.count;
  NSString *signature = [NSString stringWithFormat:@"%@:%@:%g:%g:%d:%@", _ownerId, CUIInputWindowIdentity(self.window), _windowEpoch, _pointerRevision, ready, error];
  if (!_eventEmitter || [_pointerStatus isEqualToString:signature]) return;
  _pointerStatus = signature;
  CUIKeyboardScopeEventEmitter::OnNativePointerStatus data{};
  data.ownerId = _ownerId.UTF8String; data.windowId = CUIInputWindowIdentity(self.window).UTF8String;
  data.epoch = _windowEpoch; data.revision = _pointerRevision; data.ready = ready; data.error = error.UTF8String;
  std::static_pointer_cast<const CUIKeyboardScopeEventEmitter>(_eventEmitter)->onNativePointerStatus(data);
}
- (void)emitWindowPointer:(NSDictionary *)packet
{
  if (!_eventEmitter || ![self captureReady]) return;
  CUIKeyboardScopeEventEmitter::OnNativeWindowPointer data{};
  data.ownerId = _ownerId.UTF8String; data.windowId = [packet[@"windowId"] UTF8String]; data.epoch = _windowEpoch;
  data.sequence = [packet[@"sequence"] doubleValue];
  NSString *phase = packet[@"phase"];
  data.phase = [phase isEqualToString:@"start"] ? CUIKeyboardScopeEventEmitter::OnNativeWindowPointerPhase::Start
    : [phase isEqualToString:@"move"] ? CUIKeyboardScopeEventEmitter::OnNativeWindowPointerPhase::Move
    : [phase isEqualToString:@"end"] ? CUIKeyboardScopeEventEmitter::OnNativeWindowPointerPhase::End
    : [phase isEqualToString:@"cancel"] ? CUIKeyboardScopeEventEmitter::OnNativeWindowPointerPhase::Cancel
    : CUIKeyboardScopeEventEmitter::OnNativeWindowPointerPhase::Activation;
  NSString *type = packet[@"pointerType"];
  data.pointerType = [type isEqualToString:@"touch"] ? CUIKeyboardScopeEventEmitter::OnNativeWindowPointerPointerType::Touch
    : [type isEqualToString:@"mouse"] ? CUIKeyboardScopeEventEmitter::OnNativeWindowPointerPointerType::Mouse
    : [type isEqualToString:@"pen"] ? CUIKeyboardScopeEventEmitter::OnNativeWindowPointerPointerType::Pen
    : CUIKeyboardScopeEventEmitter::OnNativeWindowPointerPointerType::Virtual;
  data.pointerId = [packet[@"pointerId"] intValue]; data.isPrimary = [packet[@"isPrimary"] boolValue];
  data.button = [packet[@"button"] intValue]; data.buttons = [packet[@"buttons"] intValue]; data.nativeButtons = [packet[@"nativeButtons"] UTF8String];
  data.shiftKey = [packet[@"shiftKey"] boolValue]; data.altKey = [packet[@"altKey"] boolValue];
  data.ctrlKey = [packet[@"ctrlKey"] boolValue]; data.metaKey = [packet[@"metaKey"] boolValue]; data.nativeModifiers = [packet[@"nativeModifiers"] UTF8String];
  data.pageX = [packet[@"pageX"] doubleValue]; data.pageY = [packet[@"pageY"] doubleValue];
  data.timestamp = [packet[@"timestamp"] doubleValue]; data.target = [packet[@"target"] intValue];
  for (NSDictionary *entry in packet[@"registrations"]) {
    CUIKeyboardScopeEventEmitter::OnNativeWindowPointerRegistrations registration{};
    registration.id = [entry[@"id"] UTF8String]; registration.ownerId = [entry[@"ownerId"] UTF8String];
    registration.epoch = [entry[@"epoch"] doubleValue]; registration.revision = [entry[@"revision"] doubleValue];
    registration.targetTag = [entry[@"targetTag"] intValue]; registration.depth = [entry[@"depth"] intValue];
    data.registrations.push_back(registration);
  }
  std::static_pointer_cast<const CUIKeyboardScopeEventEmitter>(_eventEmitter)->onNativeWindowPointer(data);
}
static UIView *CUIEditorViewWithTag(UIView *root, NSInteger tag)
{
  if (root.tag == tag) return root;
  for (UIView *child in root.subviews) { UIView *found = CUIEditorViewWithTag(child, tag); if (found) return found; }
  return nil;
}
- (NSString *)editorBindingIdentity:(NSDictionary *)binding
{
  return [NSString stringWithFormat:@"%@:%@:%@:%@", binding[@"bindingId"], binding[@"bindingRevision"], binding[@"targetTag"], binding[@"moduleLease"]];
}
- (UIView *)originalEditorForBinding:(NSDictionary *)binding
{
  if ([binding[@"targetTag"] integerValue] <= 0 || ![binding[@"bindingId"] length] || ![binding[@"bindingRevision"] length] || [binding[@"ambiguous"] boolValue]) return nil;
  NSString *identity = [self editorBindingIdentity:binding];
  if (![_resolvedEditorKeyboardTargets containsObject:identity]) {
    UIView *target = CUIEditorViewWithTag(self, [binding[@"targetTag"] integerValue]);
    if (target) { [_editorKeyboardTargets setObject:target forKey:identity]; [_resolvedEditorKeyboardTargets addObject:identity]; }
  }
  UIView *target = [_editorKeyboardTargets objectForKey:identity];
  if (!target || target.tag != [binding[@"targetTag"] integerValue] || target.window != self.window ||
      ![target isDescendantOfView:self]) return nil;
  for (UIView *ancestor = target; ancestor; ancestor = ancestor.superview) if (ancestor.hidden) return nil;
  return target;
}
- (NSDictionary *)editorBindingForPress:(UIPress *)press
{
  if (CUIFieldInputOwnsPress(press, self.window)) return nil;
  if (!press.key || ![self captureReady] || press.window != self.window) return nil;
  UIView *focused = [press.responder isKindOfClass:UIView.class] ? (UIView *)press.responder : CUIFirstResponder(self.window);
  if (![focused conformsToProtocol:@protocol(UITextInput)]) return nil;
  NSDictionary *match = nil;
  for (NSDictionary *binding in _editorKeyboardBindings) {
    UIView *target = [self originalEditorForBinding:binding];
    if (!target || (focused != target && ![focused isDescendantOfView:target]) ||
        !codon::editorKeyboardDefaultsForLease([binding[@"moduleLease"] UTF8String])) continue;
    if (match) return nil;
    match = binding;
  }
  return match;
}
- (void)publishEditorKeyboardStatus
{
  if (!_eventEmitter) return;
  for (NSDictionary *binding in _editorKeyboardBindings) {
    UIView *target = [self originalEditorForBinding:binding];
    BOOL ready = [self captureReady] && target && codon::editorKeyboardDefaultsForLease([binding[@"moduleLease"] UTF8String]) != nullptr;
    NSString *identity = [self editorBindingIdentity:binding];
    NSString *signature = [NSString stringWithFormat:@"%@:%@:%g:%d:%p", _ownerId, CUIInputWindowIdentity(self.window), _windowEpoch, ready, target];
    if ([_editorKeyboardStatuses[identity] isEqualToString:signature]) continue;
    _editorKeyboardStatuses[identity] = signature;
    CUIKeyboardScopeEventEmitter::OnNativeEditorKeyboardStatus data{};
    data.ownerId = _ownerId.UTF8String; data.bindingId = [binding[@"bindingId"] UTF8String];
    data.bindingRevision = [binding[@"bindingRevision"] UTF8String]; data.target = [binding[@"targetTag"] intValue];
    data.windowId = CUIInputWindowIdentity(self.window).UTF8String; data.epoch = _windowEpoch;
    data.sequence = ++_editorKeyboardStatusSequence; data.ready = ready; data.windowActive = self.window.isKeyWindow;
    data.error = ready ? "" : target ? "native-binding-not-ready" : "original-editor-unavailable";
    std::static_pointer_cast<const CUIKeyboardScopeEventEmitter>(_eventEmitter)->onNativeEditorKeyboardStatus(data);
  }
}
- (BOOL)dispatchEditorPress:(UIPress *)press phase:(NSString *)phase repeat:(BOOL)repeat
{
  NSDictionary *binding = [self editorBindingForPress:press];
  if (!binding || !_eventEmitter) return NO;
  UIView *original = [self originalEditorForBinding:binding];
  UIView *focused = [press.responder isKindOfClass:UIView.class] ? (UIView *)press.responder : CUIFirstResponder(self.window);
  auto frames = codon::editorKeyboardDefaultsForLease([binding[@"moduleLease"] UTF8String]);
  if (!frames || !original) return NO;
  const codon::EditorKeyIdentity identity{_ownerId.UTF8String, [binding[@"bindingId"] UTF8String],
    [binding[@"bindingRevision"] UTF8String], [binding[@"targetTag"] intValue], CUIInputWindowIdentity(self.window).UTF8String, (int64_t)_windowEpoch};
  const auto eventId = ++_editorKeyboardEventId;
  const auto token = frames->begin(identity, eventId, phase.UTF8String);
  if (!token) return NO;
  const double started = NSProcessInfo.processInfo.systemUptime * 1000;
  codon::EditorKeyDisposition decision;
  try {
  @try {
    UIKey *key = press.key; UIKeyModifierFlags flags = key.modifierFlags;
    CUIKeyboardScopeEventEmitter::OnNativeEditorKey data{};
    data.ownerId = identity.ownerId; data.bindingId = identity.bindingId; data.bindingRevision = identity.bindingRevision;
    data.target = identity.target; data.windowId = identity.windowId; data.epoch = identity.epoch; data.eventId = eventId;
    data.phase = [phase isEqualToString:@"down"] ? CUIKeyboardScopeEventEmitter::OnNativeEditorKeyPhase::Down
      : [phase isEqualToString:@"up"] ? CUIKeyboardScopeEventEmitter::OnNativeEditorKeyPhase::Up : CUIKeyboardScopeEventEmitter::OnNativeEditorKeyPhase::Cancel;
    data.key = CUIInputKeyName(key).UTF8String; data.code = CUIPhysicalKeyCode((int)key.keyCode);
    data.nativeCode = (int)key.keyCode; data.location = CUIPhysicalKeyLocation((int)key.keyCode);
    data.repeat = repeat; data.cancelled = [phase isEqualToString:@"cancel"];
    data.isComposing = ((id<UITextInput>)focused).markedTextRange != nil;
    data.shiftKey = flags & UIKeyModifierShift; data.altKey = flags & UIKeyModifierAlternate;
    data.ctrlKey = flags & UIKeyModifierControl; data.metaKey = flags & UIKeyModifierCommand; data.capsLock = flags & UIKeyModifierAlphaShift;
    data.nativeModifierData = std::to_string((unsigned long long)flags); data.timestamp = press.timestamp * 1000;
    auto emitter = std::static_pointer_cast<const CUIKeyboardScopeEventEmitter>(_eventEmitter);
    emitter->experimental_flushSync([&] { emitter->onNativeEditorKey(data); });
  } @catch (NSException *exception) {
    [_editorKeyboardStatuses removeAllObjects];
  }
  } catch (const std::exception &) { [_editorKeyboardStatuses removeAllObjects]; }
  catch (...) { [_editorKeyboardStatuses removeAllObjects]; }
  BOOL current = [_editorKeyboardBindings containsObject:binding] && [self originalEditorForBinding:binding] == original &&
    focused.window == self.window && (focused == original || [focused isDescendantOfView:original]) &&
    [self captureReady] && identity.epoch == _windowEpoch && identity.windowId == CUIInputWindowIdentity(self.window).UTF8String &&
    codon::editorKeyboardDefaultsForLease([binding[@"moduleLease"] UTF8String]) == frames;
  decision = frames->end(token, current);
  CUIKeyboardScopeEventEmitter::OnNativeEditorKeyboardDecision result{};
  result.ownerId = identity.ownerId; result.bindingId = identity.bindingId; result.bindingRevision = identity.bindingRevision;
  result.target = identity.target; result.windowId = identity.windowId; result.epoch = identity.epoch; result.eventId = eventId;
  result.phase = [phase isEqualToString:@"down"] ? CUIKeyboardScopeEventEmitter::OnNativeEditorKeyboardDecisionPhase::Down
    : [phase isEqualToString:@"up"] ? CUIKeyboardScopeEventEmitter::OnNativeEditorKeyboardDecisionPhase::Up : CUIKeyboardScopeEventEmitter::OnNativeEditorKeyboardDecisionPhase::Cancel;
  result.decision = decision == codon::EditorKeyDisposition::Prevented ? CUIKeyboardScopeEventEmitter::OnNativeEditorKeyboardDecisionDecision::Prevented
    : decision == codon::EditorKeyDisposition::Allowed ? CUIKeyboardScopeEventEmitter::OnNativeEditorKeyboardDecisionDecision::Allowed
    : decision == codon::EditorKeyDisposition::Unacknowledged ? CUIKeyboardScopeEventEmitter::OnNativeEditorKeyboardDecisionDecision::Unacknowledged
    : CUIKeyboardScopeEventEmitter::OnNativeEditorKeyboardDecisionDecision::Retired;
  result.elapsedMs = NSProcessInfo.processInfo.systemUptime * 1000 - started;
  if (_eventEmitter) std::static_pointer_cast<const CUIKeyboardScopeEventEmitter>(_eventEmitter)->onNativeEditorKeyboardDecision(result);
  return decision == codon::EditorKeyDisposition::Prevented;
}
- (BOOL)hasKeyboardObservations
{
  const BOOL ready = _observations.count > 0 && [self captureReady];
  NSDictionary *trace = @{@"stage":@"native-registration", @"ownerId":_ownerId,
    @"windowId":CUIInputWindowIdentity(self.window), @"epoch":@(_windowEpoch), @"revision":@(_observationRevision),
    @"ready":@(ready), @"acceptedWindowId":_acceptedWindowId, @"acceptedEpoch":@(_acceptedEpoch),
    @"registrations":_observations};
  NSData *traceBytes = [NSJSONSerialization dataWithJSONObject:trace options:0 error:nil];
  NSString *traceJSON = [[NSString alloc] initWithData:traceBytes encoding:NSUTF8StringEncoding];
  os_log_with_type(OS_LOG_DEFAULT, OS_LOG_TYPE_DEFAULT, "CUI_TIMEPICKER_OBSERVE %{public}s", (traceJSON ?: @"{}").UTF8String);
  return ready;
}
- (BOOL)capturesObservedPress:(UIPress *)press { return _keyboard.held[@(press.key.keyCode)] != nil || [self hasPolicyForPress:press]; }
- (void)observePress:(UIPress *)press repeat:(BOOL)repeat eventId:(NSUInteger)eventId captured:(BOOL)captured
{
  UIView *focused = CUIInputFocusedView(self.window);
  NSMutableArray *tracePath = [NSMutableArray new];
  for (UIView *view = focused; view; view = view.superview) [tracePath addObject:@(view.tag)];
  NSDictionary *trace = @{@"stage":@"native-admission", @"nativeCode":@(press.key.keyCode), @"eventId":@(eventId),
    @"ownerId":_ownerId, @"windowId":CUIInputWindowIdentity(self.window), @"epoch":@(_windowEpoch),
    @"revision":@(_observationRevision), @"emitterPresent":@(_eventEmitter != nullptr),
    @"captureReady":@([self captureReady]), @"pressWindowMatches":@(press.window == self.window),
    @"registrations":_observations, @"focusPath":tracePath};
  NSData *traceBytes = [NSJSONSerialization dataWithJSONObject:trace options:0 error:nil];
  NSString *traceJSON = [[NSString alloc] initWithData:traceBytes encoding:NSUTF8StringEncoding];
  os_log_with_type(OS_LOG_DEFAULT, OS_LOG_TYPE_DEFAULT, "CUI_TIMEPICKER_OBSERVE %{public}s", (traceJSON ?: @"{}").UTF8String);
  if (!_eventEmitter || ![self hasKeyboardObservations] || press.window != self.window) return;
  CUIKeyboardScopeEventEmitter::OnNativeObservedKey data{};
  for (NSDictionary *observation in _observations) {
    NSInteger tag = [observation[@"targetTag"] integerValue];
    BOOL matches = tag <= 0;
    for (UIView *view = focused; view && !matches; view = view.superview) matches = view.tag == tag;
    if (matches) data.observerIds.push_back([observation[@"id"] UTF8String]);
  }
  if (data.observerIds.empty()) return;
  UIView *target = focused;
  while (target && target.tag <= 0) target = target.superview;
  UIKey *key = press.key;
  UIKeyModifierFlags flags = key.modifierFlags;
  data.ownerId = _ownerId.UTF8String; data.windowId = CUIInputWindowIdentity(self.window).UTF8String;
  data.epoch = _windowEpoch; data.observationRevision = _observationRevision; data.eventId = eventId;
  data.target = target ? (int)target.tag : (int)self.tag; data.focusedTarget = target ? (int)target.tag : -1;
  data.key = CUIInputKeyName(key).UTF8String; data.code = CUIPhysicalKeyCode((int)key.keyCode); data.nativeCode = (int)key.keyCode;
  data.legacyKeyCode = data.code == "Unidentified" ? 0 : (int)key.keyCode; data.location = CUIPhysicalKeyLocation((int)key.keyCode);
  data.repeat = repeat; data.cancelled = false;
  data.isComposing = [focused conformsToProtocol:@protocol(UITextInput)] && ((id<UITextInput>)focused).markedTextRange != nil;
  data.shiftKey = flags & UIKeyModifierShift; data.altKey = flags & UIKeyModifierAlternate;
  data.ctrlKey = flags & UIKeyModifierControl; data.metaKey = flags & UIKeyModifierCommand; data.capsLock = flags & UIKeyModifierAlphaShift;
  data.nativeModifierData = std::to_string((unsigned long long)flags); data.defaultCaptured = captured; data.timestamp = press.timestamp * 1000;
  std::static_pointer_cast<const CUIKeyboardScopeEventEmitter>(_eventEmitter)->onNativeObservedKey(data);
  os_log_with_type(OS_LOG_DEFAULT, OS_LOG_TYPE_DEFAULT, "CUI_TIMEPICKER_OBSERVE {\"stage\":\"native-enqueued\",\"eventId\":%{public}lu}", (unsigned long)eventId);
}
- (NSString *)policyForPress:(UIPress *)press
{
  if (CUIFieldInputOwnsPress(press, self.window)) return nil;
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
  if (press.key && self.window.isKeyWindow) CUIRecordMenuPointerKey(self.window, press.key);
  if (press.key && self.window.isKeyWindow) [self recordModality:@"keyboard"];
  return [self policyForPress:press] != nil;
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceiveTouch:(UITouch *)touch
{
  if (self.window.isKeyWindow) CUIRecordMenuPointerDown(self.window);
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
  NSMutableArray *editorBindings = [NSMutableArray array];
  NSMutableSet *editorIdentities = [NSMutableSet set];
  for (const auto &entry : next.editorKeyboardBindings) {
    NSDictionary *binding = @{ @"bindingId": @(entry.bindingId.c_str()), @"bindingRevision": @(entry.bindingRevision.c_str()),
      @"targetTag": @(entry.targetTag), @"moduleLease": @(entry.moduleLease.c_str()) };
    [editorBindings addObject:binding]; [editorIdentities addObject:[self editorBindingIdentity:binding]];
  }
  for (NSString *identity in _resolvedEditorKeyboardTargets.copy) if (![editorIdentities containsObject:identity]) {
    [_editorKeyboardTargets removeObjectForKey:identity]; [_resolvedEditorKeyboardTargets removeObject:identity]; [_editorKeyboardStatuses removeObjectForKey:identity];
  }
  NSMutableDictionary<NSString *, NSNumber *> *editorIdCounts = [NSMutableDictionary dictionary];
  NSMutableDictionary<NSNumber *, NSNumber *> *editorTargetCounts = [NSMutableDictionary dictionary];
  for (NSDictionary *binding in editorBindings) {
    NSString *identity = binding[@"bindingId"]; NSNumber *target = binding[@"targetTag"];
    editorIdCounts[identity] = @([editorIdCounts[identity] integerValue] + 1);
    editorTargetCounts[target] = @([editorTargetCounts[target] integerValue] + 1);
  }
  NSMutableArray *checkedEditorBindings = [NSMutableArray array];
  for (NSDictionary *binding in editorBindings) {
    NSMutableDictionary *checked = [binding mutableCopy];
    checked[@"ambiguous"] = @([editorIdCounts[binding[@"bindingId"]] integerValue] != 1 || [editorTargetCounts[binding[@"targetTag"]] integerValue] != 1);
    [checkedEditorBindings addObject:checked];
  }
  if (![_editorKeyboardBindings isEqual:checkedEditorBindings] || !next.enabled) {
    _editorKeyboard.enabled = NO;
    _editorKeyboard.enabled = next.enabled && checkedEditorBindings.count > 0;
  }
  _editorKeyboardBindings = checkedEditorBindings;
  _ownerId = owner;
  _captureEnabled = next.enabled;
  if (![_policies isEqual:policies]) _policyOrder = CUINextInputPolicyOrder(self.window);
  _policies = policies;
  _acceptedWindowId = accepted;
  _acceptedEpoch = next.acceptedEpoch;
  _policyRevision = next.policyRevision;
  _observationRevision = next.observationRevision;
  NSMutableArray *observations = [NSMutableArray array];
  for (const auto &observation : next.observations) [observations addObject:@{ @"id": [NSString stringWithUTF8String:observation.id.c_str()], @"targetTag": @(observation.targetTag) }];
  _observations = observations;
  _pointerRevision = next.pointerRevision;
  NSMutableArray *pointers = [NSMutableArray array];
  NSMutableSet *identities = [NSMutableSet set];
  for (const auto &entry : next.pointerRegistrations) {
    NSString *identity = [NSString stringWithUTF8String:entry.id.c_str()];
    [pointers addObject:@{ @"id": identity, @"targetTag": @(entry.targetTag) }]; [identities addObject:identity];
  }
  for (NSString *identity in _resolvedPointerTargets.copy) if (![identities containsObject:identity]) { [_pointerTargets removeObjectForKey:identity]; [_resolvedPointerTargets removeObject:identity]; }
  _pointerRegistrations = pointers;
  _menuPointerRevision = next.menuPointerRevision;
  NSMutableArray *menuPointers = [NSMutableArray array];
  for (const auto &entry : next.menuPointerPolicies) [menuPointers addObject:@{
    @"id": [NSString stringWithUTF8String:entry.id.c_str()], @"parentTarget": @(entry.parentTarget),
    @"submenuTarget": @(entry.submenuTarget), @"triggerTarget": @(entry.triggerTarget),
    @"parentBinding": [NSString stringWithUTF8String:entry.parentBinding.c_str()],
    @"submenuBinding": [NSString stringWithUTF8String:entry.submenuBinding.c_str()],
    @"triggerBinding": [NSString stringWithUTF8String:entry.triggerBinding.c_str()]
  }];
  _menuPointerRegistrations = menuPointers;
  NSMutableArray *floating = [NSMutableArray array];
  for (const auto &target : next.floatingTargets) [floating addObject:@{ @"id": [NSString stringWithUTF8String:target.id.c_str()], @"targetTag": @(target.targetTag), @"descriptionTag": @(target.descriptionTag), @"descriptionLabel": [NSString stringWithUTF8String:target.descriptionLabel.c_str()] }];
  _floatingTargets = floating;
  [super updateProps:props oldProps:oldProps];
  [self publishStatus];
}
- (void)windowDeactivated:(NSNotification *)notification
{
  if (notification.object == self.window) { [_keyboard retireHeld]; _keyboard.enabled = NO; _keyboard.enabled = YES; _editorKeyboard.enabled = NO; _editorKeyboard.enabled = _captureEnabled && _editorKeyboardBindings.count > 0; _windowEpoch++; [self publishStatus]; }
}
- (void)windowActivated:(NSNotification *)notification
{
  if (notification.object == self.window) { _windowEpoch++; [self publishStatus]; }
}
- (void)applicationDeactivated:(NSNotification *)notification { _applicationActive = NO; [_keyboard retireHeld]; _keyboard.enabled = NO; _keyboard.enabled = YES; _editorKeyboard.enabled = NO; _editorKeyboard.enabled = _captureEnabled && _editorKeyboardBindings.count > 0; _windowEpoch++; [self publishStatus]; }
- (void)applicationActivated:(NSNotification *)notification { _applicationActive = YES; _windowEpoch++; [self publishStatus]; }
- (void)sceneDeactivated:(NSNotification *)notification
{
  if (notification.object == self.window.windowScene) { _sceneActive = NO; [_keyboard retireHeld]; _keyboard.enabled = NO; _keyboard.enabled = YES; _editorKeyboard.enabled = NO; _editorKeyboard.enabled = _captureEnabled && _editorKeyboardBindings.count > 0; _windowEpoch++; [self publishStatus]; }
}
- (void)sceneActivated:(NSNotification *)notification
{
  if (notification.object == self.window.windowScene) { _sceneActive = YES; _windowEpoch++; [self publishStatus]; }
}
- (void)layoutSubviews { [super layoutSubviews]; [self publishEditorKeyboardStatus]; CUIRefreshWindowPointerObservation(self.window); CUIRefreshMenuPointerPolicies(self.window); }
- (void)didMoveToWindow
{
  [super didMoveToWindow];
  if (_boundWindow != self.window) {
    [_menuPointers invalidate];
    [_keyboard retireHeld];
    [_boundWindow removeGestureRecognizer:_keyboard];
    [_boundWindow removeGestureRecognizer:_editorKeyboard];
    CUIUnregisterInputScope(_boundWindow, self);
    _boundWindow = self.window;
    _sceneActive = self.window.windowScene == nil || self.window.windowScene.activationState == UISceneActivationStateForegroundActive;
    _windowEpoch++;
    if (_boundWindow) {
      CUIRegisterInputScope(_boundWindow, self);
      [_boundWindow addGestureRecognizer:_keyboard];
      [_boundWindow addGestureRecognizer:_editorKeyboard];
      _policyOrder = CUINextInputPolicyOrder(_boundWindow);
    }
  }
  [self publishStatus];
}
- (void)prepareForRecycle
{
  [_menuPointers invalidate]; _menuPointerRegistrations = @[]; _menuPointerRevision = 0;
  [_floating invalidate]; _floatingTargets = @[];
  [_keyboard retireHeld];
  [_boundWindow removeGestureRecognizer:_keyboard];
  [_boundWindow removeGestureRecognizer:_editorKeyboard];
  CUIUnregisterInputScope(_boundWindow, self);
  _boundWindow = nil;
  _ownerId = @"";
  _editorKeyboardBindings = @[]; [_editorKeyboardTargets removeAllObjects]; [_resolvedEditorKeyboardTargets removeAllObjects]; [_editorKeyboardStatuses removeAllObjects];
  _policies = @[];
  _observations = @[];
  _pointerRegistrations = @[]; [_pointerTargets removeAllObjects]; [_resolvedPointerTargets removeAllObjects]; _pointerStatus = nil;
  _captureEnabled = NO;
  _windowEpoch++;
  _acceptedEpoch = -1;
  _acceptedWindowId = @"";
  [super prepareForRecycle];
}
- (void)dealloc
{
  [_menuPointers invalidate];
  [_floating invalidate];
  [_boundWindow removeGestureRecognizer:_keyboard];
  [_boundWindow removeGestureRecognizer:_editorKeyboard];
  CUIUnregisterInputScope(_boundWindow, self);
  [NSNotificationCenter.defaultCenter removeObserver:self];
}
@end

Class<RCTComponentViewProtocol> CUIKeyboardScopeCls(void) { return CUIKeyboardScope.class; }
