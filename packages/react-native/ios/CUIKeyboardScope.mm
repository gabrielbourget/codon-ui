#import "CUIKeyboardScope.h"
#import "CUIDialogFocusScopes.h"
#import "CUIDragInteractions.h"
#import "CUIInputWindow.h"
#import "CUIMenuPointerPolicies.h"
#import "CUIFloatingObserver.h"
#import "CUIPhysicalKey.h"
#import "CUIEditorKeyboardRecognizer.h"
#import "CUIOrdinaryEditorKeys.h"
#import "CUIDateSegment.h"
#import "CUIFocusView.h"
#import <UIKit/UIGestureRecognizerSubclass.h>
#import <objc/runtime.h>
#import <React/RCTMountingTransactionObserving.h>
#import <React/RCTComponentViewProtocol.h>
#import <react/renderer/components/view/ViewProps.h>
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

@interface CUIToolbarRole : NSObject
@property(nonatomic, weak) UIView *original;
@property(nonatomic, copy) NSString *role;
@property(nonatomic, copy) NSString *capture;
@end
@implementation CUIToolbarRole
@end

@interface CUIToolbarBinding : NSObject
@property(nonatomic, copy) NSString *identity;
@property(nonatomic, copy) NSString *revision;
@property(nonatomic, assign) NSInteger rootTag;
@property(nonatomic, copy) NSString *orientation;
@property(nonatomic, weak) UIView *original;
@property(nonatomic, weak) UIView *last;
@property(nonatomic, assign) BOOL resolved;
@property(nonatomic, copy) NSString *failure;
@property(nonatomic, copy) NSArray<CUIToolbarRole *> *roles;
@end
@implementation CUIToolbarBinding
@end
@interface CUIToolbarHold : NSObject
@property(nonatomic, strong) CUIToolbarBinding *binding;
@property(nonatomic, strong) UIView *original;
@property(nonatomic, weak) UIPress *press;
@property(nonatomic, weak) CUIKeyboardScope *scope;
@property(nonatomic, copy) NSDictionary *route;
@property(nonatomic, assign) BOOL originalForwarded;
@property(nonatomic, assign) BOOL cancelForwarded;
@property(nonatomic, copy) NSString *window;
@property(nonatomic, assign) double epoch;
@property(nonatomic, copy) NSString *disposition;
@property(nonatomic, assign) BOOL consumed;
@property(nonatomic, assign) NSInteger requestedTarget;
@property(nonatomic, assign) BOOL focusObserved;
@property(nonatomic, assign) BOOL retired;
@end
@implementation CUIToolbarHold
@end

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

static char CUIToolbarPressRouteKey;
static char CUIToolbarPreparedPressKey;
static NSNumber *CUIPrepareToolbarPress(UIPress *press, NSString *phase, BOOL repeat);

@class CUIKeyboardRecognizer;
@interface CUIKeyboardScope () <UIGestureRecognizerDelegate, CUIKeyboardObservationScope, CUIWindowPointerScope, RCTMountingTransactionObserving>
- (NSString *)policyForPress:(UIPress *)press;
- (BOOL)hasPolicyForPress:(UIPress *)press;
- (void)recordModality:(NSString *)origin;
- (void)emitKey:(CUIKeyHold *)hold down:(BOOL)down repeat:(BOOL)repeat cancelled:(BOOL)cancelled;
- (void)prepareHold:(CUIKeyHold *)hold;
- (NSString *)localPolicyForPress:(UIPress *)press focused:(UIView *)focused;
- (NSInteger)policyOrder;
- (void)emitMenuPointer:(NSDictionary *)packet;
- (BOOL)toolbarAcceptsPress:(UIPress *)press;
- (NSNumber *)dispatchToolbarPress:(UIPress *)press phase:(NSString *)phase repeat:(BOOL)repeat;
- (BOOL)toolbarNavigationForPress:(UIPress *)press;
- (void)retireToolbarHeld;
- (NSString *)toolbarRouteForHold:(CUIToolbarHold *)hold;
- (void)cancelOriginalToolbarHold:(CUIToolbarHold *)hold press:(UIPress *)press handled:(BOOL)handled;
- (void)publishToolbarStatus;
- (void)updateToolbarBindings:(NSString *)value;
- (CUIToolbarBinding *)outermostToolbar:(UIView *)focused key:(UIKey *)key capture:(BOOL)capture;
- (CUIToolbarBinding *)toolbarForPress:(UIPress *)press;
- (CUIToolbarBinding *)toolbarNavigationBindingForPress:(UIPress *)press;
- (CUIKeyboardScope *)toolbarOwner:(CUIToolbarBinding *)binding;
- (BOOL)toolbarCaptureAvailable:(CUIToolbarBinding *)binding;
- (BOOL)toolbarObservationAvailable:(CUIToolbarBinding *)binding;
- (NSInteger)toolbarDelta:(CUIToolbarBinding *)binding key:(UIKey *)key;
- (BOOL)refreshToolbarRoles;
- (void)refreshToolbarRolesInWindow;
- (BOOL)toolbarEligible:(CUIToolbarBinding *)binding view:(UIView *)view;
- (BOOL)focusToolbar:(CUIToolbarBinding *)binding view:(UIView *)target;
- (NSMutableDictionary *)toolbarPacket:(CUIToolbarBinding *)binding;
- (void)emitToolbarKey:(CUIToolbarHold *)hold phase:(NSString *)phase repeat:(BOOL)repeat destination:(NSInteger)destination;
@end

@interface CUIKeyboardRecognizer : UIGestureRecognizer
@property(nonatomic, weak) CUIKeyboardScope *scope;
@property(nonatomic, strong) NSMutableDictionary<NSNumber *, CUIKeyHold *> *held;
@property(nonatomic, strong) NSMutableSet<NSNumber *> *suppressed;
- (void)retireHeld;
@end

static void CUIObserveCapturedDatePress(UIPress *press, NSString *phase, BOOL cancelled)
{
  UIView *target = [press.responder isKindOfClass:CUIDateSegment.class] ? (UIView *)press.responder : CUIInputFocusedView(press.window);
  if ([target isKindOfClass:CUIDateSegment.class]) [(CUIDateSegment *)target observeCapturedPress:press phase:phase cancelled:cancelled];
}

@implementation CUIKeyboardRecognizer
- (instancetype)init
{
  if (self = [super initWithTarget:nil action:nil]) {
    _held = [NSMutableDictionary dictionary];
    _suppressed = [NSMutableSet set];
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
    if ([self.suppressed containsObject:code]) {
      [self.suppressed addObject:code];
      self.state=self.state==UIGestureRecognizerStatePossible ? UIGestureRecognizerStateBegan : UIGestureRecognizerStateChanged;
      continue;
    }
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
    if (!hold.retired) {
      [self.scope emitKey:hold down:YES repeat:repeat cancelled:NO];
      CUIObserveCapturedDatePress(press, @"down", NO);
    }
  }
}

- (void)finishPresses:(NSSet<UIPress *> *)presses cancelled:(BOOL)cancelled
{
  for (UIPress *press in presses) {
    NSNumber *code = @(press.key.keyCode);
    if ([self.suppressed containsObject:code]) { [self.suppressed removeObject:code]; continue; }
    CUIKeyHold *hold = self.held[code];
    if (!hold) continue;
    hold.press = press;
    if (!hold.retired) [self.scope emitKey:hold down:NO repeat:NO cancelled:cancelled];
    CUIObserveCapturedDatePress(press, @"up", cancelled);
    [self.held removeObjectForKey:code];
  }
  if (!self.held.count && !self.suppressed.count && self.state != UIGestureRecognizerStatePossible) self.state = UIGestureRecognizerStateEnded;
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
  [self.suppressed removeAllObjects];
  [super reset];
}
- (BOOL)canPreventGestureRecognizer:(UIGestureRecognizer *)other { return NO; }
- (BOOL)canBePreventedByGestureRecognizer:(UIGestureRecognizer *)other { return NO; }
@end

@implementation CUIKeyboardScope {
  NSArray<CUIToolbarBinding *> *_toolbars;
  NSMutableDictionary<NSNumber *, CUIToolbarHold *> *_toolbarHeld;
  NSUInteger _toolbarSequence, _toolbarEventId;
  BOOL _toolbarMoving;
  CUIEditorKeyboardRecognizer *_editorKeyboard;
  CUIOrdinaryEditorKeys *_ordinaryEditorKeys;
  CUIMenuPointerPolicies *_menuPointers;
  NSArray<NSDictionary *> *_menuPointerRegistrations;
  double _menuPointerRevision;
  CUIDialogFocusScopes *_dialogs;
  NSString *_ownerId;
  int32_t _dragSurfaceId;
  CUIDragInteractions *_dragInteractions;
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
    _toolbars=@[]; _toolbarHeld=[NSMutableDictionary new];
    _ownerId = @"";
    _dragInteractions = [[CUIDragInteractions alloc] initWithScope:self];
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
    _dialogs = [[CUIDialogFocusScopes alloc] initWithOwner:self ready:^BOOL {
      return [weakSelf captureReady];
    } session:^NSDictionary * {
      CUIKeyboardScope *scope = weakSelf;
      return @{ @"ownerId": scope ? scope->_ownerId : @"", @"windowId": CUIInputWindowIdentity(scope.window), @"epoch": @(scope ? scope->_windowEpoch : 0) };
    } emit:^(NSString *kind, NSDictionary *packet) {
      CUIKeyboardScope *scope = weakSelf;
      if (!scope || !scope->_eventEmitter) return;
      auto emitter = std::static_pointer_cast<const CUIKeyboardScopeEventEmitter>(scope->_eventEmitter);
      if ([kind isEqualToString:@"status"]) {
        CUIKeyboardScopeEventEmitter::OnNativeDialogStatus data{};
        data.ownerId = [packet[@"ownerId"] UTF8String]; data.windowId = [packet[@"windowId"] UTF8String];
        data.epoch = [packet[@"epoch"] doubleValue]; data.revision = [packet[@"revision"] doubleValue];
        data.ready = [packet[@"ready"] boolValue]; data.error = [packet[@"error"] UTF8String]; emitter->onNativeDialogStatus(data);
      } else {
        CUIKeyboardScopeEventEmitter::OnNativeDialogAction data{};
        data.ownerId = [packet[@"ownerId"] UTF8String]; data.windowId = [packet[@"windowId"] UTF8String];
        data.epoch = [packet[@"epoch"] doubleValue]; data.revision = [packet[@"revision"] doubleValue];
        data.id = [packet[@"id"] UTF8String]; data.bindingId = [packet[@"bindingId"] UTF8String]; data.target = [packet[@"target"] intValue];
        NSString *phase = packet[@"phase"];
        data.phase = [phase isEqualToString:@"entered"] ? CUIKeyboardScopeEventEmitter::OnNativeDialogActionPhase::Entered
          : [phase isEqualToString:@"wrapped"] ? CUIKeyboardScopeEventEmitter::OnNativeDialogActionPhase::Wrapped
          : CUIKeyboardScopeEventEmitter::OnNativeDialogActionPhase::Restored;
        emitter->onNativeDialogAction(data);
      }
    }];
    _ordinaryEditorKeys = [[CUIOrdinaryEditorKeys alloc] initWithScope:self session:^NSDictionary *{
      return [weakSelf activationSession] ?: @{};
    } ready:^BOOL { return [weakSelf captureReady]; } status:^(NSDictionary *packet) {
      CUIKeyboardScope *scope = weakSelf;
      if (!scope || !scope->_eventEmitter) return;
      CUIKeyboardScopeEventEmitter::OnNativeOrdinaryEditorStatus data{};
      data.ownerId = [packet[@"ownerId"] UTF8String]; data.bindingId = [packet[@"bindingId"] UTF8String];
      data.bindingRevision = [packet[@"bindingRevision"] UTF8String]; data.target = [packet[@"target"] intValue];
      data.windowId = [packet[@"windowId"] UTF8String]; data.epoch = [packet[@"epoch"] doubleValue];
      data.sequence = [packet[@"sequence"] doubleValue]; data.ready = [packet[@"ready"] boolValue];
      data.windowActive = [packet[@"windowActive"] boolValue]; data.error = [packet[@"error"] UTF8String];
      std::static_pointer_cast<const CUIKeyboardScopeEventEmitter>(scope->_eventEmitter)->onNativeOrdinaryEditorStatus(data);
    }];
    _editorKeyboard = [[CUIEditorKeyboardRecognizer alloc] initWithAdmission:^BOOL(UIPress *press) {
      CUIKeyboardScope *scope = weakSelf;
      return scope && ([scope toolbarAcceptsPress:press] || [scope->_ordinaryEditorKeys acceptsPress:press]);
    } dispatch:^BOOL(UIPress *press, NSString *phase, BOOL repeat) {
      CUIKeyboardScope *scope = weakSelf;
      NSNumber *toolbar=scope ? CUIPrepareToolbarPress(press,phase,repeat) : nil;
      if (scope && [scope->_ordinaryEditorKeys acceptsPress:press]) {
        BOOL captured = NO;
        for (id<CUIKeyboardObservationScope> observer in CUIInputScopes(scope.window)) captured |= [observer capturesObservedPress:press];
        [scope->_ordinaryEditorKeys dispatchPress:press phase:phase repeat:repeat captured:captured];
      }
      return toolbar ? toolbar.boolValue : NO;
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
- (CUIOrdinaryEditorKeys *)ordinaryEditorKeys { return _ordinaryEditorKeys; }
- (NSDictionary *)activationSession
{
  return @{ @"scopeOwnerId": _ownerId, @"windowId": CUIInputWindowIdentity(self.window), @"epoch": @(_windowEpoch) };
}
- (BOOL)dragCaptureReady { return [_dragInteractions available]; }
- (BOOL)dragEnabled { return _captureEnabled; }
- (int32_t)dragSurfaceId { return _dragSurfaceId; }
- (NSDictionary *)dragActivationSession { return _dragInteractions.session; }
- (NSDictionary *)dragGeometry:(NSDictionary *)request { return [_dragInteractions geometry:request]; }
- (void)emitDragStatus:(NSDictionary *)record {
  if (!_eventEmitter) return;
  NSData *json = [NSJSONSerialization dataWithJSONObject:record options:0 error:nullptr];
  if (!json) return;
  CUIKeyboardScopeEventEmitter::OnNativeDragStatus status{}; status.packet = std::string((const char *)json.bytes, json.length);
  std::static_pointer_cast<const CUIKeyboardScopeEventEmitter>(_eventEmitter)->onNativeDragStatus(status);
}
- (void)mountingTransactionDidMount:(const MountingTransaction &)transaction withSurfaceTelemetry:(const SurfaceTelemetry &)surfaceTelemetry {
  _dragSurfaceId = transaction.getSurfaceId();
  [_dragInteractions refresh];
  [_ordinaryEditorKeys didMount:transaction];
  [self publishToolbarStatus];
}
- (CUIMenuPointerPolicies *)menuPointers { return _menuPointers; }
- (CUIDialogFocusScopes *)dialogFocusScopes { return _dialogs; }
- (BOOL)shouldUpdateFocusInContext:(UIFocusUpdateContext *)context
{
  return [super shouldUpdateFocusInContext:context] && [_dialogs shouldAllowFocusUpdate:context];
}
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
  [_dragInteractions refreshWindow];
  [_dialogs refresh];
  [_ordinaryEditorKeys publish];
  [self publishToolbarStatus];
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
- (UIView *)toolbarRoot:(CUIToolbarBinding *)binding
{
  UIView *current = CUIEditorViewWithTag(self, binding.rootTag);
  if (!binding.resolved && current) { binding.resolved=YES; binding.original=current; }
  UIView *root=binding.original;
  return root && root == current && root.window == self.window && [root isDescendantOfView:self] ? root : nil;
}
- (CUIToolbarBinding *)toolbarAt:(UIView *)view
{
  for (CUIKeyboardScope *scope in CUIInputScopes(self.window)) if ([scope captureReady])
    for (CUIToolbarBinding *binding in scope->_toolbars) if ([scope toolbarRoot:binding] == view) return binding;
  return nil;
}
- (NSString *)originalToolbarRole:(UIView *)view
{
  if (![view conformsToProtocol:@protocol(RCTComponentViewProtocol)]) return @"";
  const auto props=std::dynamic_pointer_cast<const ViewProps>([(id<RCTComponentViewProtocol>)view props]);
  if (!props) return @"";
  if (props->role == Role::Toolbar) return @"toolbar";
  if (props->role != Role::None) return [NSString stringWithFormat:@"role:%ld", static_cast<long>(props->role)];
  return [NSString stringWithUTF8String:props->accessibilityRole.c_str()];
}
- (BOOL)toolbarAncestor:(UIView *)root
{
  for (UIView *view=root.superview; view; view=view.superview) if ([[self originalToolbarRole:view] isEqualToString:@"toolbar"]) return YES;
  return NO;
}
- (CUIKeyboardScope *)toolbarOwner:(CUIToolbarBinding *)binding
{
  if (!binding) return nil;
  for (CUIKeyboardScope *scope in CUIInputScopes(self.window)) if ([scope->_toolbars containsObject:binding]) return scope;
  return nil;
}
- (BOOL)toolbarObservationAvailable:(CUIToolbarBinding *)binding
{
  UIView *root=[self toolbarRoot:binding];
  return [self captureReady] && root && [_ordinaryEditorKeys canObserveTarget:root];
}
- (BOOL)toolbarCaptureAvailable:(CUIToolbarBinding *)binding
{
  return [self toolbarObservationAvailable:binding] && ![self toolbarAncestor:[self toolbarRoot:binding]];
}
- (CUIToolbarBinding *)outermostToolbar:(UIView *)focused key:(UIKey *)key capture:(BOOL)capture
{
  if (!focused || ![self captureReady]) return nil;
  CUIToolbarBinding *selected=nil;
  for (UIView *view=focused; view; view=view.superview) {
    CUIToolbarBinding *binding=[self toolbarAt:view];
    CUIKeyboardScope *owner=[self toolbarOwner:binding];
    if (!binding || !(capture ? [owner toolbarCaptureAvailable:binding] : [owner toolbarObservationAvailable:binding])) continue;
    if (key && [owner toolbarDelta:binding key:key] == 0 && !(key.keyCode == UIKeyboardHIDUsageKeyboardTab && !(key.modifierFlags & (UIKeyModifierAlternate | UIKeyModifierControl | UIKeyModifierCommand)))) continue;
    // Capture walks from outer to inner; an unhandled orientation falls through.
    selected=binding;
  }
  return selected;
}
- (BOOL)refreshToolbarRoles
{
  BOOL changed=NO;
  for (CUIToolbarBinding *binding in _toolbars) {
    NSMutableArray<CUIToolbarRole *> *roles=[NSMutableArray new];
    for (UIView *view=[self toolbarRoot:binding]; view; view=view.superview) {
      CUIToolbarRole *entry=[CUIToolbarRole new]; entry.original=view; entry.role=[self originalToolbarRole:view];
      CUIToolbarBinding *capture=[self toolbarAt:view];
      entry.capture=capture ? [NSString stringWithFormat:@"%@:%@:%ld",capture.identity,capture.revision,(long)capture.rootTag] : @"";
      [roles addObject:entry];
    }
    BOOL same=binding.roles != nil && binding.roles.count == roles.count;
    for (NSUInteger index=0; same && index<roles.count; index++) {
      CUIToolbarRole *before=binding.roles[index], *after=roles[index];
      same=before.original == after.original && [before.role isEqual:after.role] && [before.capture isEqual:after.capture];
    }
    if (same) continue;
    BOOL replacing=binding.roles != nil; binding.roles=roles; changed=YES;
    if (!replacing) continue;
    binding.last=nil;
    for (NSNumber *code in _toolbarHeld.allKeys) {
      CUIToolbarHold *hold=_toolbarHeld[code]; if (hold.binding != binding) continue;
      if (!hold.retired && hold.press) [self emitToolbarKey:hold phase:@"cancel" repeat:NO destination:-1];
      hold.retired=YES; [_toolbarHeld removeObjectForKey:code];
    }
  }
  return changed;
}
- (void)refreshToolbarRolesInWindow
{
  for (CUIKeyboardScope *scope in CUIInputScopes(self.window)) if ([scope refreshToolbarRoles]) [scope publishToolbarStatus];
}
- (BOOL)toolbarEligible:(CUIToolbarBinding *)binding view:(UIView *)view
{
  UIView *root=[self toolbarRoot:binding];
  if (!root || !view || root == view || (view.accessibilityTraits & UIAccessibilityTraitNotEnabled) || ([view isKindOfClass:UIControl.class] && !((UIControl *)view).enabled) || view.window != self.window || ![self toolbarObservationAvailable:binding] || !(view.canBecomeFirstResponder || view.canBecomeFocused)) return NO;
  for (UIView *current=view; current; current=current.superview) {
    if (current.hidden || current.alpha <= 0 || !current.userInteractionEnabled) return NO;
    if (current == root) return YES;
  }
  return NO;
}
- (void)collectToolbar:(UIView *)view binding:(CUIToolbarBinding *)binding into:(NSMutableArray<UIView *> *)items
{
  if (!view || view.hidden || view.alpha <= 0 || !view.userInteractionEnabled) return;
  if ([self toolbarEligible:binding view:view]) {
    [items addObject:view];
    // An original focusable host owns its internal native implementation descendants.
    return;
  }
  for (UIView *child in view.subviews) [self collectToolbar:child binding:binding into:items];
}
- (NSArray<UIView *> *)toolbarCandidates:(CUIToolbarBinding *)binding
{
  NSMutableArray *items=[NSMutableArray new]; [self collectToolbar:[self toolbarRoot:binding] binding:binding into:items]; return items;
}
- (BOOL)focusToolbar:(CUIToolbarBinding *)binding view:(UIView *)target
{
  if (_toolbarMoving || ![self toolbarCaptureAvailable:binding] || ![self toolbarEligible:binding view:target]) return NO;
  _toolbarMoving=YES;
  @try {
    if ([target isKindOfClass:CUIFocusView.class]) [(CUIFocusView *)target requestKeyboardFocus:[(CUIFocusView *)target fieldInputOwnerId]];
    else {
      if (target.canBecomeFirstResponder) [target becomeFirstResponder];
      UIFocusSystem *system=[UIFocusSystem focusSystemForEnvironment:target]; [system requestFocusUpdateToEnvironment:target]; [system updateFocusIfNeeded];
    }
    return (target.isFirstResponder || target.isFocused) && [self toolbarEligible:binding view:target];
  } @finally { _toolbarMoving=NO; }
}
- (NSInteger)toolbarDelta:(CUIToolbarBinding *)binding key:(UIKey *)key
{
  UIKeyModifierFlags flags=key.modifierFlags;
  if (flags & (UIKeyModifierAlternate | UIKeyModifierControl | UIKeyModifierCommand | UIKeyModifierShift)) return 0;
  NSInteger code=key.keyCode;
  if ([binding.orientation isEqualToString:@"vertical"]) return code == UIKeyboardHIDUsageKeyboardDownArrow ? 1 : code == UIKeyboardHIDUsageKeyboardUpArrow ? -1 : 0;
  BOOL rtl=[self toolbarRoot:binding].effectiveUserInterfaceLayoutDirection == UIUserInterfaceLayoutDirectionRightToLeft;
  return code == UIKeyboardHIDUsageKeyboardRightArrow ? (rtl ? -1 : 1) : code == UIKeyboardHIDUsageKeyboardLeftArrow ? (rtl ? 1 : -1) : 0;
}
- (CUIToolbarBinding *)toolbarNavigationBindingForPress:(UIPress *)press
{
  if (!press.key || ![self captureReady] || press.window != self.window) return nil;
  UIView *focused=CUIInputFocusedView(self.window);
  if ([focused conformsToProtocol:@protocol(UITextInput)] && ((id<UITextInput>)focused).markedTextRange) return nil;
  if ([focused conformsToProtocol:@protocol(UIKeyInput)] && press.key.keyCode != UIKeyboardHIDUsageKeyboardTab) return nil;
  CUIToolbarBinding *binding=[self outermostToolbar:focused key:press.key capture:YES];
  return [[self toolbarOwner:binding] toolbarEligible:binding view:focused] ? binding : nil;
}
- (BOOL)toolbarNavigationForPress:(UIPress *)press
{
  [self refreshToolbarRolesInWindow];
  return [self toolbarNavigationBindingForPress:press] != nil;
}
- (CUIToolbarBinding *)toolbarForPress:(UIPress *)press
{
  return [self toolbarNavigationBindingForPress:press] ?: [self outermostToolbar:CUIInputFocusedView(self.window) key:nil capture:NO];
}
- (BOOL)toolbarAcceptsPress:(UIPress *)press
{
  if (!press.key || press.window != self.window) return NO;
  [self refreshToolbarRolesInWindow];
  if (_toolbarHeld[@(press.key.keyCode)]) return YES;
  CUIToolbarBinding *binding=[self toolbarForPress:press];
  return binding && [_toolbars containsObject:binding];
}
- (NSNumber *)dispatchToolbarPress:(UIPress *)press phase:(NSString *)phase repeat:(BOOL)repeat
{
  if (![self toolbarAcceptsPress:press]) return nil;
  NSNumber *code=@(press.key.keyCode); CUIToolbarHold *hold=_toolbarHeld[code];
  BOOL down=[phase isEqualToString:@"down"];
  UIView *focused=CUIInputFocusedView(self.window);
  if (!hold && down && !repeat) {
    hold=[CUIToolbarHold new]; hold.scope=self; hold.binding=[self toolbarForPress:press]; hold.original=focused;
    hold.window=CUIInputWindowIdentity(self.window); hold.epoch=_windowEpoch; hold.disposition=@"ordinary"; hold.requestedTarget=-1; _toolbarHeld[code]=hold;
  }
  if (!hold) return nil;
  hold.press=press;
  objc_setAssociatedObject(press,&CUIToolbarPressRouteKey,hold,OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  if (![self captureReady] || hold.epoch != _windowEpoch || ![hold.window isEqualToString:CUIInputWindowIdentity(self.window)] || ![_toolbars containsObject:hold.binding] || ![self toolbarRoot:hold.binding] || ![self toolbarEligible:hold.binding view:hold.original]) hold.retired=YES;
  NSInteger destination=-1;
  if (!hold.retired && down && [self toolbarNavigationBindingForPress:press] == hold.binding) {
    NSArray<UIView *> *items=[self toolbarCandidates:hold.binding]; NSUInteger index=[items indexOfObjectIdenticalTo:focused];
    if (items.count && index != NSNotFound) {
      BOOL tab=press.key.keyCode == UIKeyboardHIDUsageKeyboardTab;
      NSInteger delta=[self toolbarDelta:hold.binding key:press.key];
      UIView *target=tab ? (press.key.modifierFlags & UIKeyModifierShift ? items.firstObject : items.lastObject) : items[MAX(0,MIN((NSInteger)items.count-1,(NSInteger)index+delta))];
      hold.requestedTarget=target.tag; hold.disposition=tab ? @"tab" : @"arrow"; hold.consumed=!tab;
      hold.focusObserved=target == focused || [self focusToolbar:hold.binding view:target];
      if (hold.focusObserved) {
        destination=target.tag; hold.disposition=tab ? @"tab" : @"arrow"; hold.consumed=!tab;
        hold.binding.last=tab ? focused : target;
      } else { hold.binding.failure=@"original-toolbar-focus-completion-not-observed"; [self publishToolbarStatus]; }
    }
  }
  if (!hold.retired) {
    [self emitToolbarKey:hold phase:phase repeat:repeat destination:destination];
    if ([hold.original isKindOfClass:CUIDateSegment.class] && [hold.disposition isEqualToString:@"tab"] && down) [(CUIDateSegment *)hold.original observeToolbarPress:press phase:phase cancelled:NO captured:NO];
  }
  if (!down) [_toolbarHeld removeObjectForKey:code];
  return hold.consumed || [hold.disposition isEqualToString:@"tab"] ? @(hold.consumed) : nil;
}
- (NSMutableDictionary *)toolbarPacket:(CUIToolbarBinding *)binding
{
  return [@{ @"ownerId":_ownerId, @"bindingId":binding.identity, @"bindingRevision":binding.revision, @"rootTarget":@(binding.rootTag), @"windowId":CUIInputWindowIdentity(self.window), @"epoch":@(_windowEpoch) } mutableCopy];
}
- (void)emitToolbarPacket:(NSDictionary *)packet status:(BOOL)status
{
  if (!_eventEmitter) return;
  NSData *json=[NSJSONSerialization dataWithJSONObject:packet options:0 error:nullptr]; if (!json) return;
  std::string encoded((const char *)json.bytes,json.length);
  auto emitter=std::static_pointer_cast<const CUIKeyboardScopeEventEmitter>(_eventEmitter);
  if (status) { CUIKeyboardScopeEventEmitter::OnNativeToolbarStatus data{}; data.packet=encoded; emitter->onNativeToolbarStatus(data); }
  else { CUIKeyboardScopeEventEmitter::OnNativeToolbarKeyboard data{}; data.packet=encoded; emitter->onNativeToolbarKeyboard(data); }
}
- (void)emitToolbarKey:(CUIToolbarHold *)hold phase:(NSString *)phase repeat:(BOOL)repeat destination:(NSInteger)destination
{
  UIKey *key=hold.press.key; UIKeyModifierFlags flags=key.modifierFlags;
  UIView *original=hold.original; while (original && original.tag <= 0) original=original.superview;
  if (!original) return;
  NSMutableDictionary *data=[self toolbarPacket:hold.binding];
  [data addEntriesFromDictionary:@{ @"windowId":hold.window, @"epoch":@(hold.epoch), @"eventId":@(++_toolbarEventId),
    @"target":@(original.tag), @"focusedTarget":@(original.tag), @"requestedTarget":@(hold.requestedTarget), @"destinationTarget":@(destination), @"focusObserved":@(hold.focusObserved),
    @"key":CUIInputKeyName(key), @"nativeCode":@(key.keyCode), @"characters":key.characters ?: @"",
    @"phase":[phase isEqualToString:@"down"] ? @"down" : @"up", @"repeat":@(repeat), @"cancelled":@([phase isEqualToString:@"cancel"]),
    @"isComposing":@([hold.original conformsToProtocol:@protocol(UITextInput)] && ((id<UITextInput>)hold.original).markedTextRange != nil),
    @"shiftKey":@((flags & UIKeyModifierShift) != 0), @"altKey":@((flags & UIKeyModifierAlternate) != 0),
    @"ctrlKey":@((flags & UIKeyModifierControl) != 0), @"metaKey":@((flags & UIKeyModifierCommand) != 0), @"capsLock":@((flags & UIKeyModifierAlphaShift) != 0),
    @"nativeModifierData":[NSString stringWithFormat:@"%llu",(unsigned long long)flags], @"nativeDefaultHandled":@(hold.consumed),
    @"disposition":hold.disposition, @"timestamp":@(hold.press.timestamp*1000) }];
  NSMutableArray *path=[NSMutableArray new];
  for (UIView *view=hold.original; view; view=view.superview) if (view.tag > 0) [path addObject:@(view.tag)];
  data[@"physicalPath"]=path; hold.route=data;
  [self emitToolbarPacket:data status:NO];
}
- (void)publishToolbarStatus
{
  [self refreshToolbarRoles];
  for (NSNumber *code in _toolbarHeld.allKeys) {
    CUIToolbarHold *hold=_toolbarHeld[code];
    if (![self captureReady] || hold.epoch != _windowEpoch || ![_toolbars containsObject:hold.binding] || ![self toolbarEligible:hold.binding view:hold.original]) {
      hold.retired=YES; [_toolbarHeld removeObjectForKey:code];
    }
  }
  for (CUIToolbarBinding *binding in _toolbars) {
    UIView *root=[self toolbarRoot:binding]; NSMutableDictionary *data=[self toolbarPacket:binding];
    [data addEntriesFromDictionary:@{ @"sequence":@(++_toolbarSequence), @"observationReady":@([self captureReady] && root != nil && [_ordinaryEditorKeys canObserveTarget:root]), @"ready":@([self captureReady] && root != nil && !binding.failure.length && [_ordinaryEditorKeys canObserveTarget:root]), @"windowActive":@([self windowActive]), @"nestedToolbar":@(root && [self toolbarAncestor:root]), @"error":root ? (binding.failure ?: @"") : @"original-toolbar-root-unavailable" }];
    [self emitToolbarPacket:data status:YES];
  }
}
- (NSString *)toolbarRouteForHold:(CUIToolbarHold *)hold
{
  [self refreshToolbarRolesInWindow];
  if (!hold || hold.retired || ![self captureReady] || hold.epoch != _windowEpoch || ![hold.window isEqualToString:CUIInputWindowIdentity(self.window)] || ![_toolbars containsObject:hold.binding] || ![self toolbarEligible:hold.binding view:hold.original] || ![_ordinaryEditorKeys canObserveTarget:[self toolbarRoot:hold.binding]] || !hold.route) return nil;
  NSData *data=[NSJSONSerialization dataWithJSONObject:hold.route options:0 error:nil];
  return data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : nil;
}
- (void)cancelOriginalToolbarHold:(CUIToolbarHold *)hold press:(UIPress *)press handled:(BOOL)handled
{
  if (hold.cancelForwarded || ![self toolbarRouteForHold:hold]) return;
  hold.cancelForwarded=YES; hold.press=press;
  [self emitToolbarKey:hold phase:@"cancel" repeat:NO destination:-1];
  for (CUIKeyboardScope *scope in CUIInputScopes(self.window)) [[scope ordinaryEditorKeys] dispatchPress:press phase:@"cancel" repeat:NO captured:handled];
  [_toolbarHeld removeObjectForKey:@(press.key.keyCode)];
}
- (void)retireToolbarHeld
{
  for (CUIToolbarHold *hold in _toolbarHeld.allValues) {
    if (!hold.retired && hold.press) [self emitToolbarKey:hold phase:@"cancel" repeat:NO destination:-1];
    hold.retired=YES;
  }
  [_toolbarHeld removeAllObjects];
  for (CUIToolbarBinding *binding in _toolbars) binding.last=nil;
}
- (void)updateToolbarBindings:(NSString *)value
{
  NSData *json=[value dataUsingEncoding:NSUTF8StringEncoding]; id parsed=json ? [NSJSONSerialization JSONObjectWithData:json options:0 error:nil] : nil;
  NSMutableArray *next=[NSMutableArray new];
  if ([parsed isKindOfClass:NSArray.class]) for (id item in parsed) {
    if (![item isKindOfClass:NSDictionary.class] || ![item[@"bindingId"] isKindOfClass:NSString.class] || ![item[@"bindingRevision"] isKindOfClass:NSString.class]) continue;
    CUIToolbarBinding *binding=nil;
    for (CUIToolbarBinding *old in _toolbars) if ([old.identity isEqual:item[@"bindingId"]] && [old.revision isEqual:item[@"bindingRevision"]] && old.rootTag == [item[@"rootTarget"] integerValue]) { binding=old; break; }
    if (!binding) { binding=[CUIToolbarBinding new]; binding.identity=item[@"bindingId"]; binding.revision=item[@"bindingRevision"]; binding.rootTag=[item[@"rootTarget"] integerValue]; binding.orientation=item[@"orientation"]; }
    [next addObject:binding];
  }
  if (![_toolbars isEqual:next]) [self retireToolbarHeld]; _toolbars=next;
}
- (void)didUpdateFocusInContext:(UIFocusUpdateContext *)context withAnimationCoordinator:(UIFocusAnimationCoordinator *)coordinator
{
  [super didUpdateFocusInContext:context withAnimationCoordinator:coordinator];
  if (_toolbarMoving) return;
  [self refreshToolbarRolesInWindow];
  CUIToolbarBinding *binding=[self outermostToolbar:context.nextFocusedView key:nil capture:YES];
  if (!binding || ![_toolbars containsObject:binding] || ![self toolbarEligible:binding view:context.nextFocusedView]) return;
  UIView *last=binding.last;
  if ([self outermostToolbar:context.previouslyFocusedView key:nil capture:YES] != binding && [self toolbarEligible:binding view:last]) [self focusToolbar:binding view:last];
  else binding.last=context.nextFocusedView;
}

- (BOOL)hasKeyboardObservations { return _observations.count > 0 && [self captureReady]; }
- (BOOL)capturesObservedPress:(UIPress *)press { return _keyboard.held[@(press.key.keyCode)] != nil || [self hasPolicyForPress:press]; }
- (void)observePress:(UIPress *)press repeat:(BOOL)repeat eventId:(NSUInteger)eventId captured:(BOOL)captured
{
  if (!_eventEmitter || ![self hasKeyboardObservations] || press.window != self.window) return;
  UIView *focused = CUIInputFocusedView(self.window);
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
}
- (NSString *)policyForPress:(UIPress *)press
{
  if (![self captureReady] || !press.key || press.window != self.window) return nil;
  UIView *focused = CUIFirstResponder(self.window);
  if ([focused isKindOfClass:CUIDateSegment.class] && [(CUIDateSegment *)focused capturesOrdinaryKey:press.key]) return nil;
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
  if ([self toolbarNavigationForPress:press]) return nil;
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
  if (![_ownerId isEqualToString:owner] || !next.enabled || ![_policies isEqual:policies] || _acceptedEpoch != next.acceptedEpoch || ![_acceptedWindowId isEqualToString:accepted] || _policyRevision != next.policyRevision) { [_keyboard retireHeld]; [self retireToolbarHeld]; }
  NSMutableArray *ordinary = [NSMutableArray new];
  for (const auto &entry : next.ordinaryEditorBindings) [ordinary addObject:@{
    @"bindingId": @(entry.bindingId.c_str()), @"bindingRevision": @(entry.bindingRevision.c_str()), @"targetTag": @(entry.targetTag), @"subtree": @(entry.subtree), @"toolbarTargetOnly": @(entry.toolbarTargetOnly), @"toolbarSubtreeOnly": @(entry.toolbarSubtreeOnly)
  }];
  [_ordinaryEditorKeys update:ordinary];
  [self updateToolbarBindings:@(next.toolbarBindings.c_str())];
  _editorKeyboard.enabled = next.enabled && ([_ordinaryEditorKeys hasBindings] || _toolbars.count > 0);
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
  NSMutableArray *dialogs = [NSMutableArray new];
  for (const auto &binding : next.dialogScopes) {
    NSMutableArray *members = [NSMutableArray new], *entries = [NSMutableArray new];
    for (const auto &member : binding.memberTargets) [members addObject:@{ @"id": @(member.id.c_str()), @"targetTag": @(member.targetTag) }];
    for (const auto &entry : binding.entryTargets) [entries addObject:@{ @"id": @(entry.id.c_str()), @"targetTag": @(entry.targetTag), @"allowed": @(entry.allowed) }];
    [dialogs addObject:@{ @"id": @(binding.id.c_str()), @"parentId": @(binding.parentId.c_str()), @"bindingId": @(binding.bindingId.c_str()),
      @"targetTag": @(binding.targetTag), @"enabled": @(binding.enabled), @"entryAllowed": @(binding.entryAllowed), @"memberTargets": members, @"entryTargets": entries }];
  }
  [_dialogs update:dialogs revision:next.dialogRevision];
  [super updateProps:props oldProps:oldProps];
  [_dragInteractions update:@(next.dragBindings.c_str())];
  [self publishStatus];
}
- (void)windowDeactivated:(NSNotification *)notification
{
  if (notification.object == self.window) { [_keyboard retireHeld]; [self retireToolbarHeld]; _keyboard.enabled = NO; _keyboard.enabled = YES; _editorKeyboard.enabled = NO; _editorKeyboard.enabled = _captureEnabled && ([_ordinaryEditorKeys hasBindings] || _toolbars.count > 0); _windowEpoch++; [self publishStatus]; }
}
- (void)windowActivated:(NSNotification *)notification
{
  if (notification.object == self.window) { _windowEpoch++; [self publishStatus]; }
}
- (void)applicationDeactivated:(NSNotification *)notification { _applicationActive = NO; [_keyboard retireHeld]; [self retireToolbarHeld]; _keyboard.enabled = NO; _keyboard.enabled = YES; _editorKeyboard.enabled = NO; _editorKeyboard.enabled = _captureEnabled && ([_ordinaryEditorKeys hasBindings] || _toolbars.count > 0); _windowEpoch++; [self publishStatus]; }
- (void)applicationActivated:(NSNotification *)notification { _applicationActive = YES; _windowEpoch++; [self publishStatus]; }
- (void)sceneDeactivated:(NSNotification *)notification
{
  if (notification.object == self.window.windowScene) { _sceneActive = NO; [_keyboard retireHeld]; [self retireToolbarHeld]; _keyboard.enabled = NO; _keyboard.enabled = YES; _editorKeyboard.enabled = NO; _editorKeyboard.enabled = _captureEnabled && ([_ordinaryEditorKeys hasBindings] || _toolbars.count > 0); _windowEpoch++; [self publishStatus]; }
}
- (void)sceneActivated:(NSNotification *)notification
{
  if (notification.object == self.window.windowScene) { _sceneActive = YES; _windowEpoch++; [self publishStatus]; }
}
- (void)layoutSubviews { [super layoutSubviews]; [_dragInteractions refreshWindow]; [_dialogs refresh]; [_ordinaryEditorKeys publish]; [self publishToolbarStatus]; CUIRefreshWindowPointerObservation(self.window); CUIRefreshMenuPointerPolicies(self.window); }
- (void)didMoveToWindow
{
  [super didMoveToWindow];
  if (_boundWindow != self.window) {
    [_menuPointers invalidate];
    [_keyboard retireHeld]; [self retireToolbarHeld];
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
  [_ordinaryEditorKeys update:@[]];
  [self retireToolbarHeld]; _toolbars=@[]; [_toolbarHeld removeAllObjects];
  _dragSurfaceId = 0;
  [_dragInteractions invalidate]; _dragInteractions = [[CUIDragInteractions alloc] initWithScope:self];
  [_dialogs invalidate];
  [_menuPointers invalidate]; _menuPointerRegistrations = @[]; _menuPointerRevision = 0;
  [_floating invalidate]; _floatingTargets = @[];
  [_keyboard retireHeld]; [self retireToolbarHeld];
  [_boundWindow removeGestureRecognizer:_keyboard];
  [_boundWindow removeGestureRecognizer:_editorKeyboard];
  CUIUnregisterInputScope(_boundWindow, self);
  _boundWindow = nil;
  _ownerId = @"";
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
  _dragSurfaceId = 0;
  [_dragInteractions invalidate]; _dragInteractions = [[CUIDragInteractions alloc] initWithScope:self];
  [_dialogs invalidate];
  [_menuPointers invalidate];
  [_floating invalidate];
  [_boundWindow removeGestureRecognizer:_keyboard];
  [_boundWindow removeGestureRecognizer:_editorKeyboard];
  CUIUnregisterInputScope(_boundWindow, self);
  [NSNotificationCenter.defaultCenter removeObserver:self];
}
@end

Class<RCTComponentViewProtocol> CUIKeyboardScopeCls(void) { return CUIKeyboardScope.class; }

NSString *CUIKeyboardToolbarRoute(UIPress *press)
{
  CUIToolbarHold *hold=objc_getAssociatedObject(press,&CUIToolbarPressRouteKey);
  return [hold.scope toolbarRouteForHold:hold];
}
void CUIKeyboardToolbarDidEmit(UIPress *press)
{
  CUIToolbarHold *hold=objc_getAssociatedObject(press,&CUIToolbarPressRouteKey);
  if ([hold.scope toolbarRouteForHold:hold]) hold.originalForwarded=YES;
}
BOOL CUIRouteOriginalToolbarKey(UIView *target, UIPress *press, BOOL down, BOOL repeat, BOOL cancelled, BOOL handled)
{
  CUIToolbarHold *hold=objc_getAssociatedObject(press,&CUIToolbarPressRouteKey);
  if (!hold.originalForwarded || hold.original != target) return NO;
  if (cancelled) [hold.scope cancelOriginalToolbarHold:hold press:press handled:handled];
  return YES;
}

static NSNumber *CUIPrepareToolbarPress(UIPress *press, NSString *phase, BOOL repeat)
{
  NSDictionary *record=objc_getAssociatedObject(press,&CUIToolbarPreparedPressKey);
  if ([record[@"timestamp"] doubleValue] == press.timestamp && [record[@"phase"] isEqual:phase]) return [record[@"result"] isKindOfClass:NSNumber.class] ? record[@"result"] : nil;
  NSNumber *result=nil;
  for (CUIKeyboardScope *scope in CUIInputScopes(press.window)) if ([scope toolbarAcceptsPress:press]) { result=[scope dispatchToolbarPress:press phase:phase repeat:repeat]; break; }
  objc_setAssociatedObject(press,&CUIToolbarPreparedPressKey,@{@"timestamp":@(press.timestamp),@"phase":phase,@"result":result ?: NSNull.null},OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  return result;
}
BOOL CUIKeyboardToolbarCancelledOriginal(UIPress *press)
{
  CUIToolbarHold *hold=objc_getAssociatedObject(press,&CUIToolbarPressRouteKey); return hold.cancelForwarded;
}

NSString *CUIKeyboardToolbarDateRoute(UIPress *press)
{
  NSString *encoded=CUIKeyboardToolbarRoute(press); if (!encoded) return nil;
  NSMutableDictionary *route=[[NSJSONSerialization JSONObjectWithData:[encoded dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil] mutableCopy];
  NSMutableArray *observers=[NSMutableArray new];
  for (CUIKeyboardScope *scope in CUIInputScopes(press.window)) [[scope ordinaryEditorKeys] appendToolbarObservers:observers];
  route[@"observerBindings"]=observers;
  NSData *json=[NSJSONSerialization dataWithJSONObject:route options:0 error:nil];
  return json ? [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding] : nil;
}

void CUIKeyboardPrepareToolbarDate(UIPress *press, NSString *phase, BOOL repeat)
{
  CUIToolbarHold *hold=objc_getAssociatedObject(press,&CUIToolbarPressRouteKey);
  if ([hold.route[@"phase"] isEqualToString:phase] && [hold.route[@"timestamp"] doubleValue] == press.timestamp*1000) return;
  CUIPrepareToolbarPress(press,phase,repeat);
}

BOOL CUIKeyboardToolbarDateOwnsOriginal(UIView *target, UIPress *press)
{
  CUIToolbarHold *hold=objc_getAssociatedObject(press,&CUIToolbarPressRouteKey);
  return hold.original == target && [hold.scope toolbarRouteForHold:hold] != nil;
}
