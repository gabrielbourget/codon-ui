#import "CUIFieldInputBinding.h"
#import "CUIFieldGroupDocument.h"
#import "CUIFieldPointerHandler.h"
#import "CUIInputWindow.h"
#import "CUIFocusView.h"
#import "CUIOwnedDateField.h"
#import "CUIPhysicalKey.h"
#import <React/RCTAssert.h>
#import <React/RCTBackedTextInputViewProtocol.h>
#import <React/RCTTextInputComponentView.h>
#import <React/RCTTextInputNativeCommands.h>
#import <React/RCTSurfaceTouchHandler.h>
#import <React/RCTUtils.h>
#include "../cpp/form/FieldInputBinding.h"
#include "../cpp/FieldInputOriginalCapture.h"
#include "../cpp/form/FabricFormDocument.h"
#include <react/renderer/components/CodonNativeInputSpec/Props.h>

using namespace facebook::react;
using namespace codon;
using namespace codon::form;

@interface CUIFocusView (CUIOriginalFieldFocusCommand)
- (void)requestKeyboardFocus:(NSString *)ownerId;
@end
@interface CUIFieldInputBinding ()
- (NSDictionary *)capture;
- (UIView *)outerRoot;
- (BOOL)containsOriginalView:(UIView *)view;
- (BOOL)dispatch:(UIPress *)press phase:(NSString *)phase repeat:(BOOL)repeat;
- (void)emitOriginalInput:(UIView *)view emit:(void (^)(void))emit;
- (BOOL)dispatch:(UIPress *)press phase:(NSString *)phase repeat:(BOOL)repeat originalInput:(const RawEvent *)originalInput;
- (BOOL)dispatch:(UIPress *)press phase:(NSString *)phase repeat:(BOOL)repeat
  originalInput:(const RawEvent *)originalInput deadline:(FieldInputDispatchFrames::Clock::time_point)deadline;
- (void)emitOriginalPointers:(void (^)(void))emit decision:(void (^)(BOOL))decision;
- (void)record:(NSDictionary *)value;
- (void)publishReadiness:(BOOL)ready error:(NSString *)error;
- (void)pointerFailure:(NSString *)error;
- (UIWindow *)boundWindow;
- (NSString *)moduleLease;
- (NSDictionary *)keyIdentity;
@property(nonatomic, strong) NSHashTable<UIView<RCTBackedTextInputViewProtocol> *> *keyEditors;
@end

static NSHashTable<CUIFieldInputBinding *> *CUIFieldInputs;
static NSMapTable<UIView *, CUIFieldPointerHandler *> *CUIFieldPointers;
static BOOL CUIFieldInputWindowActive(UIWindow *window)
{
  return window && window.isKeyWindow && UIApplication.sharedApplication.applicationState == UIApplicationStateActive &&
    (!window.windowScene || window.windowScene.activationState == UISceneActivationStateForegroundActive);
}
static UIView *CUIFieldPointerSurface(UIView *view)
{
  for (UIView *ancestor = view; ancestor; ancestor = ancestor.superview)
    for (UIGestureRecognizer *recognizer in ancestor.gestureRecognizers)
      if ([recognizer isKindOfClass:RCTSurfaceTouchHandler.class]) return ancestor;
  return nil;
}
static BOOL CUIFieldPointerSurfaceOccupied(UIView *surface)
{
  for (UIGestureRecognizer *recognizer in surface.gestureRecognizers)
    if ([recognizer isKindOfClass:RCTSurfacePointerHandler.class] &&
        ![recognizer isKindOfClass:CUIFieldPointerHandler.class]) return YES;
  return NO;
}
static BOOL CUIFieldContainsTarget(NSDictionary *value, int32_t surface, int32_t target)
{
  if (!value) return NO;
  const auto document = folly::parseJson([value[@"encodedDocument"] UTF8String]);
  if (document.at("surfaceId").asInt() != surface) return NO;
  const auto &plan = document.at("fieldGroup");
  if (plan.at("outerTarget").asInt() == target) return YES;
  for (const auto &node : plan.at("nodes")) if (node.at("target").asInt() == target) return YES;
  return NO;
}
static CUIFieldInputBinding *CUIFieldPointerOwner(UIView *surface, const RawEvent &event)
{
  if (!CUIFieldInputWindowActive(surface.window)) return nil;
  const auto family = event.shadowNodeFamily.lock();
  if (!family) return nil;
  CUIFieldInputBinding *selected = nil;
  for (CUIFieldInputBinding *binding in CUIFieldInputs.allObjects) {
    UIView *outer = [binding outerRoot];
    if (!surface || outer.window != surface.window || CUIFieldPointerSurface(outer) != surface ||
        !CUIFieldContainsTarget([binding capture], family->getSurfaceId(), family->getTag())) continue;
    if (selected && [selected outerRoot] == outer) throw std::runtime_error("field-input-pointer-group-ambiguous");
    if (!selected || CUIFieldContainsTarget([selected capture], family->getSurfaceId(), outer.tag)) selected = binding;
  }
  return selected;
}
static void CUIRefreshFieldPointerHandlers(UIWindow *window)
{
  if (!window) return;
  if (!CUIFieldPointers) CUIFieldPointers = [NSMapTable weakToStrongObjectsMapTable];
  NSHashTable<UIView *> *wanted = [NSHashTable weakObjectsHashTable];
  const BOOL active = CUIFieldInputWindowActive(window);
  if (active) {
    for (CUIFieldInputBinding *binding in CUIFieldInputs.allObjects) {
      UIView *outer = [binding outerRoot];
      if ([binding boundWindow] != window || outer.window != window) continue;
      if (RCTGetDispatchW3CPointerEvents()) {
        [binding pointerFailure:@"field-input-pointer-sdk-coexistence-unqualified"]; continue;
      }
      UIView *surface = CUIFieldPointerSurface(outer);
      if (!surface) { [binding pointerFailure:@"field-input-pointer-original-surface-unavailable"]; continue; }
      if (CUIFieldPointerSurfaceOccupied(surface)) {
        [binding pointerFailure:@"field-input-pointer-sdk-coexistence-unqualified"]; continue;
      }
      [binding pointerFailure:nil]; [wanted addObject:surface];
    }
  }
  for (UIView *surface in CUIFieldPointers.keyEnumerator.allObjects) {
    if ((surface.window == window || !surface.window) && ![wanted containsObject:surface]) {
      [[CUIFieldPointers objectForKey:surface] retire]; [CUIFieldPointers removeObjectForKey:surface];
    }
  }
  for (UIView *surface in wanted.allObjects) {
    if ([CUIFieldPointers objectForKey:surface]) continue;
    __weak UIView *weakSurface = surface;
    CUIFieldPointerHandler *handler = [[CUIFieldPointerHandler alloc] initWithSurface:surface accepts:^BOOL(UITouch *touch) {
      UIView *surface = weakSurface;
      if (!surface || !CUIFieldInputWindowActive(surface.window) || RCTGetDispatchW3CPointerEvents() ||
          CUIFieldPointerSurfaceOccupied(surface)) return NO;
      for (CUIFieldInputBinding *binding in CUIFieldInputs.allObjects) {
        UIView *outer = [binding outerRoot];
        if (outer.window == surface.window && CUIFieldPointerSurface(outer) == surface &&
            [binding containsOriginalView:touch.view]) return YES;
      }
      return NO;
    } emission:^(void (^emit)(void), void (^decision)(BOOL)) {
      UIView *surface = weakSurface;
      if (!surface) { emit(); return; }
      for (CUIFieldInputBinding *binding in CUIFieldInputs.allObjects)
        if (CUIFieldPointerSurface([binding outerRoot]) == surface && [binding capture]) {
          [binding emitOriginalPointers:emit decision:decision]; return;
        }
      emit();
    }];
    [CUIFieldPointers setObject:handler forKey:surface];
  }
}
static CUIFieldInputBinding *CUIFieldWinner(UIWindow *window)
{
  CUIFieldInputBinding *selected = nil;
  for (CUIFieldInputBinding *binding in CUIFieldInputs.allObjects) {
    NSDictionary *value = [binding capture];
    UIView *outer = [binding outerRoot];
    if (outer.window != window || ![value[@"fieldGroupSnapshot"][@"eventFocusedTarget"] integerValue]) continue;
    if (selected && [selected outerRoot] == outer) return nil;
    if (!selected || CUIFieldContainsTarget([selected capture], [value[@"fieldGroupSnapshot"][@"surfaceId"] intValue], outer.tag)) selected = binding;
  }
  return selected;
}
@interface CUIFieldKeyHold : NSObject
@property(nonatomic, weak) UIView *receiver;
@property(nonatomic, copy) NSDictionary *identity;
@property(nonatomic) BOOL capture;
@end
@implementation CUIFieldKeyHold
@end
@interface CUIFieldInputWindow : NSObject
@property(nonatomic, weak) UIWindow *window;
@property(nonatomic, strong) NSMapTable<UIPress *, NSMutableDictionary *> *records;
@property(nonatomic, strong) NSMutableDictionary<NSNumber *, CUIFieldKeyHold *> *held;
@property(nonatomic, strong) NSMutableSet<NSString *> *observedKeyBoundaries;
@property(nonatomic, strong) NSHashTable<UIView<RCTBackedTextInputViewProtocol> *> *editors;
@property(nonatomic, copy) RCTTextInputPressHandler editorHandler;
- (BOOL)handlePress:(UIPress *)press phase:(NSString *)phase receiver:(UIView *)receiver;
- (void)retire;
@end
static NSMapTable<UIWindow *, CUIFieldInputWindow *> *CUIFieldWindows;
static void CUIRefreshFieldInputWindow(UIWindow *window);
static void CUIRecordFieldKeyBoundary(CUIFieldInputWindow *router, NSString *stage, UIView *receiver,
                                     UIPress *press, CUIFieldInputBinding *selected)
{
  UIWindow *window = router.window;
  if (!window || [router.observedKeyBoundaries containsObject:stage]) return;
  CUIFieldInputBinding *sink = nil;
  for (CUIFieldInputBinding *binding in CUIFieldInputs.allObjects)
    if ([binding boundWindow] == window) { sink = binding; break; }
  if (!sink) return;
  [router.observedKeyBoundaries addObject:stage];
  UIKey *key = press.key;
  [sink record:@{@"kind":@"key-boundary", @"stage":stage,
    @"windowId":CUIInputWindowIdentity(window), @"windowActive":@(CUIFieldInputWindowActive(window)),
    @"receiverTarget":receiver ? @(receiver.tag) : NSNull.null, @"receiverFocused":@(receiver.isFirstResponder),
    @"hasOriginalPress":@(press != nil), @"hasOriginalKey":@(key != nil),
    @"pressWindowMatches":@(press && press.window == window),
    @"pressType":press ? @(press.type) : NSNull.null, @"nativeCode":key ? @(key.keyCode) : NSNull.null,
    @"timestamp":press ? @(press.timestamp) : NSNull.null, @"hasSelectedBinding":@(selected != nil)}];
}
@implementation CUIFieldInputWindow
- (BOOL)handlePress:(UIPress *)press phase:(NSString *)phase receiver:(UIView *)receiver
{
  if (![@[@"down", @"up", @"cancel"] containsObject:phase]) return NO;
  if (!press.key || press.window != self.window || !CUIFieldInputWindowActive(self.window)) return NO;
  NSMutableDictionary *record = [self.records objectForKey:press];
  if ([record[@"timestamp"] doubleValue] == press.timestamp && [record[@"phase"] isEqual:phase])
    return [record[@"capture"] boolValue];
  NSNumber *code = @(press.key.keyCode);
  CUIFieldKeyHold *held = self.held[code];
  const BOOL down = [phase isEqual:@"down"];
  const BOOL focusedReceiver = receiver.window == self.window && receiver.isFirstResponder;
  if (down ? !focusedReceiver : (!held || (receiver != held.receiver && !focusedReceiver))) return NO;
  record = [@{@"timestamp":@(press.timestamp), @"phase":phase, @"admitted":@NO, @"capture":@NO} mutableCopy];
  [self.records setObject:record forKey:press];
  CUIObserveKeyboardPress(press, phase);
  CUIFieldInputBinding *owner = CUIFieldWinner(self.window);
  CUIRecordFieldKeyBoundary(self, @"original-responder-entry", receiver, press, owner);
  const BOOL admitted = owner && [owner containsOriginalView:receiver];
  const BOOL current = admitted && (!held || [held.identity isEqual:[owner keyIdentity]]);
  BOOL capture = held.capture;
  if (down) {
    if (current) {
      CUIFieldKeyHold *nextHeld = held ?: [CUIFieldKeyHold new];
      if (!held) { nextHeld.receiver = receiver; nextHeld.identity = [owner keyIdentity]; self.held[code] = nextHeld; }
      capture = [owner dispatch:press phase:phase repeat:held != nil];
      if (self.held[code] == nextHeld) nextHeld.capture |= capture;
    }
  } else {
    // UIKit may finish at the original responder after focus or hierarchy loss.
    // Retire that hold before callbacks; never borrow a replacement owner's turn.
    [self.held removeObjectForKey:code];
    if (held && current) capture |= [owner dispatch:press phase:phase repeat:NO];
  }
  record[@"admitted"] = @(admitted); record[@"capture"] = @(capture);
  return capture;
}

- (void)retire
{
  for (UIView<RCTBackedTextInputViewProtocol> *editor in self.editors.allObjects)
    if (editor.nativeKeyPressHandler == self.editorHandler) editor.nativeKeyPressHandler = nil;
  [self.editors removeAllObjects]; [self.held removeAllObjects]; [self.records removeAllObjects];
}
@end
BOOL CUIHandleFieldResponderPress(UIView *receiver, UIPress *press, NSString *phase)
{
  CUIFieldInputWindow *router = [CUIFieldWindows objectForKey:press.window];
  return router && [router handlePress:press phase:phase receiver:receiver];
}
NSSet<UIPress *> *CUIFieldInputRemainingPresses(UIView *receiver, NSSet<UIPress *> *presses, NSString *phase)
{
  return RCTTextInputRemainingPresses(receiver, presses, phase, ^BOOL(UIView *view, UIPress *press, NSString *originalPhase) {
    return CUIHandleFieldResponderPress(view, press, originalPhase);
  });
}
static void CUIRetireFieldKeyHolds(CUIFieldInputWindow *router, UIWindow *window, NSArray<NSDictionary *> *identities)
{
  for (NSNumber *code in router.held.allKeys) {
    CUIFieldKeyHold *held = router.held[code];
    if (held.receiver.window != window || ![identities containsObject:held.identity]) [router.held removeObjectForKey:code];
  }
}
static void CUIRefreshFieldInputWindow(UIWindow *window)
{
  if (!window) return;
  CUIRefreshFieldPointerHandlers(window);
  if (!CUIFieldWindows) CUIFieldWindows = [NSMapTable weakToStrongObjectsMapTable];
  CUIFieldInputWindow *router = [CUIFieldWindows objectForKey:window];
  BOOL needed = NO;
  NSMutableArray<NSDictionary *> *identities = [NSMutableArray new];
  NSHashTable<UIView<RCTBackedTextInputViewProtocol> *> *wanted = [NSHashTable weakObjectsHashTable];
  for (CUIFieldInputBinding *binding in CUIFieldInputs.allObjects) if ([binding boundWindow] == window) {
    needed = YES; [identities addObject:[binding keyIdentity]];
    for (UIView<RCTBackedTextInputViewProtocol> *editor in binding.keyEditors.allObjects)
      if (editor.window == window) [wanted addObject:editor];
  }
  if (!needed || !CUIFieldInputWindowActive(window)) {
    [router retire]; [CUIFieldWindows removeObjectForKey:window]; return;
  }
  if (!router) {
    router = [CUIFieldInputWindow new]; router.window = window;
    router.records = [NSMapTable weakToStrongObjectsMapTable]; router.held = [NSMutableDictionary new];
    router.observedKeyBoundaries = [NSMutableSet new]; router.editors = [NSHashTable weakObjectsHashTable];
    __weak CUIFieldInputWindow *weakRouter = router;
    router.editorHandler = ^BOOL(UIView *receiver, UIPress *press, NSString *phase) {
      CUIFieldInputWindow *current = weakRouter;
      if (!current || [CUIFieldWindows objectForKey:press.window] != current) return NO;
      return [current handlePress:press phase:phase receiver:receiver];
    };
    [CUIFieldWindows setObject:router forKey:window];
  }
  CUIRetireFieldKeyHolds(router, window, identities);
  for (UIView<RCTBackedTextInputViewProtocol> *editor in router.editors.allObjects) if (![wanted containsObject:editor]) {
    if (editor.nativeKeyPressHandler == router.editorHandler) editor.nativeKeyPressHandler = nil;
    [router.editors removeObject:editor];
  }
  for (UIView<RCTBackedTextInputViewProtocol> *editor in wanted.allObjects) {
    if (editor.nativeKeyPressHandler && editor.nativeKeyPressHandler != router.editorHandler) {
      CUIRecordFieldKeyBoundary(router, @"editor-hook-occupied", editor, nil, nil); continue;
    }
    editor.nativeKeyPressHandler = router.editorHandler; [router.editors addObject:editor];
  }
}

BOOL CUIFieldInputOwnsPress(UIPress *press, UIWindow *window)
{
  if (!press.key || press.window != window) return NO;
  NSDictionary *record = [[CUIFieldWindows objectForKey:window].records objectForKey:press];
  return ([record[@"timestamp"] doubleValue] == press.timestamp && [record[@"admitted"] boolValue]) || CUIFieldWinner(window) != nil;
}
BOOL CUIFieldInputOwnsView(UIView *view)
{
  CUIFieldInputBinding *binding = CUIFieldWinner(view.window);
  return binding && [binding containsOriginalView:view];
}

void CUIEmitOwnedFieldInput(UIView *view, void (^emit)(void))
{
  CUIFieldInputBinding *owner = CUIFieldWinner(view.window);
  if (owner && [owner containsOriginalView:view]) [owner emitOriginalInput:view emit:emit];
  else emit();
}

@implementation CUIFieldInputBinding {
  __weak CUIFieldBinding *_metadata;
  __weak RCTSurfacePresenter *_presenter;
  __weak UIView *_outer, *_input;
  __weak UIWindow *_window;
  std::weak_ptr<UIManager> _manager;
  NSDictionary *(^_snapshot)(void);
  NSDictionary *_registration, *_status;
  NSUInteger _statusGeneration;
  BOOL _statusPublished;
  NSString *_bindingId, *_ownerId, *_lease, *_fingerprint, *_error, *_pointerError, *_outerInstance, *_inputInstance;
  NSUInteger _epoch, _eventId;
  BOOL _closed, _capturing;
  NSMutableSet<NSNumber *> *_consumed;
}
- (instancetype)initWithMetadata:(CUIFieldBinding *)metadata presenter:(RCTSurfacePresenter *)presenter
                        manager:(std::shared_ptr<UIManager>)manager registration:(NSDictionary *)registration
                          outer:(UIView *)outer input:(UIView *)input snapshot:(NSDictionary *(^)(void))snapshot
{
  if ((self = [super init])) {
    RCTAssertMainQueue();
    _metadata = metadata; _presenter = presenter; _manager = manager; _snapshot = [snapshot copy];
    _registration = [registration copy]; _status = _registration; _outer = outer; _input = input;
    _lease = registration[@"moduleLease"]; _bindingId = registration[@"bindingId"]; _ownerId = registration[@"ownerId"];
    _epoch = 1; _consumed = [NSMutableSet new];
    if (!CUIFieldInputs) CUIFieldInputs = [NSHashTable weakObjectsHashTable];
    [CUIFieldInputs addObject:self];
  }
  return self;
}
- (NSDictionary *)registrationReceipt
{
  return @{@"requestId":_registration[@"requestId"], @"ownerToken":_registration[@"ownerToken"],
    @"metadataTarget":_registration[@"metadataTarget"], @"status":_status};
}
- (void)publishReadiness:(BOOL)ready error:(NSString *)error
{
  NSString *encodedDeclaration = _metadata.fieldGroupBinding;
  id decodedDeclaration = encodedDeclaration.length ? [NSJSONSerialization JSONObjectWithData:[encodedDeclaration dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nullptr] : nil;
  NSDictionary *declaration = [decodedDeclaration isKindOfClass:NSDictionary.class] ? decodedDeclaration : nil;
  BOOL originalDeclaration = [_metadata.ownerId isEqual:_registration[@"ownerId"]] &&
    [declaration[@"ownerId"] isEqual:_registration[@"ownerId"]] &&
    [declaration[@"moduleLease"] isEqual:_registration[@"moduleLease"]] &&
    [declaration[@"bindingId"] isEqual:_registration[@"bindingId"]];
  NSString *revision = originalDeclaration && [declaration[@"bindingRevision"] isKindOfClass:NSString.class] ? declaration[@"bindingRevision"] : _status[@"bindingRevision"];
  if (_statusPublished && [_status[@"bindingRevision"] isEqual:revision] && [_status[@"ready"] boolValue] == ready) return;
  NSMutableDictionary *status = [_registration mutableCopy];
  status[@"bindingRevision"] = revision; status[@"generation"] = @(++_statusGeneration);
  status[@"ready"] = @(ready); status[@"error"] = error ?: @"";
  _status = [status copy]; _statusPublished = YES; [self record:_status];
}
- (UIView *)outerRoot { return _outer; }
- (BOOL)containsOriginalView:(UIView *)view
{
  NSDictionary *value = [self capture];
  if (!value || view.window != _window) return NO;
  const int32_t surface = [value[@"fieldGroupSnapshot"][@"surfaceId"] intValue];
  for (UIView *candidate = view; candidate && candidate != _window; candidate = candidate.superview) {
    BOOL captured = NO, member = NO;
    for (NSDictionary *instance in value[@"fieldGroupSnapshot"][@"instances"])
      if ([instance[@"nativeTarget"] integerValue] == candidate.tag &&
          [_presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:candidate.tag] == candidate) {
        captured = YES;
        member = member || CUIFieldContainsTarget(value, surface, [instance[@"target"] intValue]);
      }
    if (captured) return member;
  }
  return NO;
}
- (UIWindow *)boundWindow { return _window; }
- (NSString *)moduleLease { return _lease; }
- (NSDictionary *)keyIdentity
{
  return @{@"requestId":_registration[@"requestId"], @"ownerToken":_registration[@"ownerToken"],
    @"moduleLease":_lease ?: @"", @"epoch":@(_epoch)};
}
- (void)recordEncoded:(NSString *)encoded
{
  const auto state = _lease ? fieldInputRuntime(_lease.UTF8String) : nullptr;
  if (state) state->records.append(encoded.UTF8String ?: "");
  [_metadata emitFieldInputRecord:encoded];
}
- (void)record:(NSDictionary *)value
{
  NSData *bytes = [NSJSONSerialization dataWithJSONObject:value options:NSJSONWritingSortedKeys error:nil];
  if (bytes) [self recordEncoded:[[NSString alloc] initWithData:bytes encoding:NSUTF8StringEncoding]];
}
- (void)pointerFailure:(NSString *)error
{
  if ((_pointerError == error) || [_pointerError isEqual:error]) return;
  _pointerError = [error copy];
  if (error) [self record:@{@"kind":@"pointer-failure", @"error":error}];
}
- (void)retirePending
{
  const auto state = _lease ? fieldInputRuntime(_lease.UTF8String) : nullptr;
  if (state && _ownerId && _bindingId) state->frames.retireBinding(_ownerId.UTF8String, _bindingId.UTF8String);
  [_consumed removeAllObjects];
}
- (NSDictionary *)capture
{
  if (_closed || _capturing || !_metadata || !_snapshot) return nil;
  _capturing = YES;
  @try {
    try {
      NSString *encodedDeclaration = _metadata.fieldGroupBinding;
      id decodedDeclaration = encodedDeclaration.length ? [NSJSONSerialization JSONObjectWithData:[encodedDeclaration dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nullptr] : nil;
      NSDictionary *declaration = [decodedDeclaration isKindOfClass:NSDictionary.class] ? decodedDeclaration : nil;
      if (![_metadata.ownerId isEqual:_registration[@"ownerId"]] ||
          ![declaration[@"ownerId"] isEqual:_registration[@"ownerId"]] ||
          ![declaration[@"moduleLease"] isEqual:_registration[@"moduleLease"]] ||
          ![declaration[@"bindingId"] isEqual:_registration[@"bindingId"]])
        throw std::runtime_error("field-input-original-binding-retired");
      NSDictionary *value = _snapshot();
      if (!value) throw std::runtime_error("field-input-snapshot-unavailable");
      NSString *encoded = value[@"encodedDocument"];
      const auto document = folly::parseJson(encoded.UTF8String);
      const auto binding = fieldInputBinding(document);
      const auto state = fieldInputRuntime(binding.moduleLease);
      if (!state || !state->ready() || (_bindingId && ![_bindingId isEqual:@(binding.bindingId.c_str())]))
        throw std::runtime_error("field-input-original-binding-retired");
      NSDictionary *snapshot = value[@"fieldGroupSnapshot"];
      UIView *outer = [_presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:binding.outerTarget];
      UIView *input = [_presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:binding.inputTarget];
      if (!outer || !input || outer != _outer || input != _input || (_outerInstance && ![_outerInstance isEqual:snapshot[@"outerInstance"]]) ||
          (_inputInstance && ![_inputInstance isEqual:snapshot[@"inputInstance"]]))
        throw std::runtime_error("field-input-original-root-instance-retired");
      NSString *fingerprint = [@[value[@"documentId"], value[@"surfaceId"], snapshot[@"windowId"], snapshot[@"outerInstance"],
          snapshot[@"inputInstance"], _metadata.fieldGroupBinding, _metadata.ownedEditorBinding] description];
      if (_fingerprint && ![_fingerprint isEqual:fingerprint]) { [self retirePending]; _epoch++; }
      _fingerprint = fingerprint; _bindingId = @(binding.bindingId.c_str()); _ownerId = @(binding.ownerId.c_str());
      _lease = @(binding.moduleLease.c_str()); _outer = outer; _input = input; _error = nil;
      _outerInstance = snapshot[@"outerInstance"]; _inputInstance = snapshot[@"inputInstance"];
      [self publishReadiness:YES error:@""];
      return value;
    } catch (const std::exception &error) {
      @throw [NSException exceptionWithName:@"CUI.FieldInput" reason:@(error.what()) userInfo:nil];
    }
  } @catch (NSException *error) {
    [self retirePending];
    _error = error.reason;
    [self publishReadiness:NO error:error.reason ?: @"field-input-capture-failed"];
    return nil;
  } @finally { _capturing = NO; }
}
- (void)refresh
{
  if (_capturing || _closed) return;
  NSDictionary *value = [self capture];
  self.keyEditors = [NSHashTable weakObjectsHashTable];
  for (NSDictionary *row in value[@"fieldGroupSnapshot"][@"originals"]) {
    UIView *component = [_presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[row[@"target"] integerValue]];
    if (![component isKindOfClass:RCTTextInputComponentView.class]) continue;
    id editor = [(RCTTextInputComponentView *)component accessibilityElement];
    if ([editor isKindOfClass:UIView.class] && [editor conformsToProtocol:@protocol(RCTBackedTextInputViewProtocol)] &&
        CUIFieldGroupOriginalMatches(_presenter, row, component, editor))
      [self.keyEditors addObject:(UIView<RCTBackedTextInputViewProtocol> *)editor];
  }
  UIWindow *window = value ? _outer.window : nil;
  UIWindow *previous = _window;
  if (previous != window) { _window = window; _epoch++; [self retirePending]; }
  CUIRefreshFieldInputWindow(previous); CUIRefreshFieldInputWindow(window);
}
- (NSString *)mountWitness
{
  return [_metadata formTransactionWitness] ?: @"unmounted";
}
- (BOOL)currentScope:(const FieldInputIdentity &)expected
{
  NSDictionary *value = [self capture];
  if (!value || expected.epoch != _epoch) return NO;
  const auto document = folly::parseJson([value[@"encodedDocument"] UTF8String]);
  NSData *bytes = [NSJSONSerialization dataWithJSONObject:value[@"fieldGroupSnapshot"] options:0 error:nil];
  const auto snapshot = folly::parseJson([[[NSString alloc] initWithData:bytes encoding:NSUTF8StringEncoding] UTF8String]);
  return fieldInputScopeCurrent(expected, document, snapshot, _epoch);
}
- (FieldInputFocusResult)focus:(const FieldInputFocusAction &)action state:(const std::shared_ptr<FieldInputRuntime> &)state
                       ticket:(const FieldInputDispatchFrames::Handle &)ticket
{
  const auto serviceStarted = FieldInputDispatchFrames::Clock::now();
  FieldInputFocusResult result;
  const auto scope = ticket->scopeFor(action.groupTarget);
  NSDictionary *value = [self capture];
  if (!value || !scope || scope->epoch != _epoch) { result.error = "field-input-focus-binding-retired"; return result; }
  const auto document = folly::parseJson([value[@"encodedDocument"] UTF8String]);
  NSData *snapshotBytes = [NSJSONSerialization dataWithJSONObject:value[@"fieldGroupSnapshot"] options:0 error:nil];
  const auto snapshot = folly::parseJson([[[NSString alloc] initWithData:snapshotBytes encoding:NSUTF8StringEncoding] UTF8String]);
  if (!fieldInputScopeCurrent(*scope, document, snapshot, _epoch) || fieldInputBinding(document).moduleLease != _lease.UTF8String) {
    result.error = "field-input-focus-scope-retired"; return result;
  }
  const auto target = fieldInputFocusTarget(document, snapshot, action, ticket->identity.target);
  if (!target) { result.current = true; return result; }
  const auto row = fieldInputOriginal(snapshot, target);
  UIView *component = [_presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:target];
  UIView *original = component;
  if ([component isKindOfClass:RCTTextInputComponentView.class]) {
    id element = [(RCTTextInputComponentView *)component accessibilityElement];
    original = [element isKindOfClass:UIView.class] ? (UIView *)element : nil;
  }
  NSDictionary *expected = nil;
  for (NSDictionary *entry in value[@"fieldGroupSnapshot"][@"originals"]) if ([entry[@"target"] integerValue] == target) expected = entry;
  if (!original || original.window != _window || !CUIFieldGroupOriginalMatches(_presenter, expected, component, original)) {
    result.error = "field-input-focus-original-retired"; return result;
  }
  const auto manager = _manager.lock();
  if (!manager) { result.error = "field-input-focus-manager-retired"; return result; }
  std::unordered_set<int32_t> targets;
  for (const auto &node : snapshot.at("instances")) targets.insert(fieldGroupTarget(node.at("target")));
  targets.insert(fieldGroupTarget(document.at("fieldGroup").at("outerTarget")));
  const BOOL wasFocused = original.isFirstResponder;
  if (wasFocused) return {false, true, true, target, row.at("nativeInstance").asString(), row.at("editorInstance").asString(), ""};
  const auto observed = std::make_shared<std::atomic<bool>>(wasFocused);
  NSMutableArray *observers = [NSMutableArray new];
  for (NSString *name in @[CUIInputFocusChangedNotification, UITextFieldTextDidBeginEditingNotification, UITextViewTextDidBeginEditingNotification]) {
    id observer = [NSNotificationCenter.defaultCenter addObserverForName:name object:original queue:nil usingBlock:^(NSNotification *notification) {
      if (![name isEqual:CUIInputFocusChangedNotification] || [notification.userInfo[@"focused"] boolValue]) observed->store(true);
    }];
    [observers addObject:observer];
  }
  @try {
    result = state->captureFocusEvents(ticket, manager, [&](const RawEvent &event) {
      const auto family = event.shadowNodeFamily.lock();
      return family && family->getSurfaceId() == ticket->identity.surfaceId && targets.contains(family->getTag()) &&
        event.type != "topNativeFieldKey";
    }, [&] {
      FieldInputFocusResult focus;
      id commandResult = NSNull.null;
      const auto commandStarted = FieldInputDispatchFrames::Clock::now();
      if ([component isKindOfClass:CUIDateSegment.class]) {
        NSDictionary *identity = [NSJSONSerialization JSONObjectWithData:[@(folly::toJson(row.at("segment")).c_str()) dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
        commandResult = @([(CUIDateSegment *)component requestFormSegmentFocus:identity]); focus.requested = true;
      } else if ([component isKindOfClass:RCTTextInputComponentView.class]) {
        [(id<RCTTextInputViewProtocol>)component focus]; focus.requested = true;
      } else if ([component isKindOfClass:CUIFocusView.class]) {
        [(CUIFocusView *)component requestKeyboardFocus:[(CUIFocusView *)component motionSnapshotIdentity][@"ownerId"]]; focus.requested = true;
      } else { focus.error = "field-input-original-focus-command-unavailable"; return focus; }
      const auto commandReturned = FieldInputDispatchFrames::Clock::now();
      for (CUIFieldInputBinding *binding in CUIFieldInputs.allObjects) {
        UIView *root = [binding outerRoot];
        if (root.window == _window && [root isKindOfClass:CUIFocusView.class]) [(CUIFocusView *)root synchronizeFieldInputFocus];
      }
      const auto synchronized = FieldInputDispatchFrames::Clock::now();
      NSDictionary *after = [self capture];
      const auto captured = FieldInputDispatchFrames::Clock::now();
      const auto milliseconds = [](auto start, auto finish) { return std::chrono::duration<double, std::milli>(finish - start).count(); };
      NSDictionary *actual = nil;
      for (NSDictionary *entry in after[@"fieldGroupSnapshot"][@"originals"]) if ([entry[@"target"] integerValue] == target) actual = entry;
      focus.current = after && [self currentScope:*scope] &&
        [_presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:target] == component &&
        [actual[@"nativeInstance"] isEqual:@(row.at("nativeInstance").asString().c_str())] &&
        [actual[@"editorInstance"] isEqual:@(row.at("editorInstance").asString().c_str())];
      focus.observed = observed->load();
      focus.target = target; focus.nativeInstance = row.at("nativeInstance").asString(); focus.editorInstance = row.at("editorInstance").asString();
      if (focus.requested && !focus.observed) focus.error = "field-input-original-focus-not-observed";
      const auto validated = FieldInputDispatchFrames::Clock::now();
      [self record:@{@"kind":@"focus", @"token":@(ticket->token), @"eventId":@(ticket->eventId),
        @"groupTarget":@(action.groupTarget), @"action":@(action.kind.c_str()),
        @"target":@(target), @"requested":@(focus.requested), @"observed":@(focus.observed),
        @"current":@(focus.current), @"nativeCommandResult":commandResult,
        @"elapsedMilliseconds":@{@"prepare":@(milliseconds(serviceStarted, commandStarted)),
          @"command":@(milliseconds(commandStarted, commandReturned)),
          @"synchronize":@(milliseconds(commandReturned, synchronized)),
          @"snapshot":@(milliseconds(synchronized, captured)), @"validation":@(milliseconds(captured, validated)),
          @"totalBeforeReceipt":@(milliseconds(serviceStarted, validated))},
        @"after":after[@"fieldGroupSnapshot"] ?: NSNull.null}];
      return focus;
    });
  } @finally {
    for (id observer in observers) [NSNotificationCenter.defaultCenter removeObserver:observer];
  }
  return result;
}
- (void)emitOriginalInput:(UIView *)view emit:(void (^)(void))emit
{
  const auto manager = _manager.lock();
  if (!manager || !view.isFirstResponder) { emit(); return; }
  if (FieldInputNativeOperation::contains(manager.get())) {
    NSDictionary *value = [self capture];
    if (!value) throw std::runtime_error("field-input-captured-scope-retired");
    const auto document = folly::parseJson([value[@"encodedDocument"] UTF8String]);
    const auto json = [](id object) {
      NSData *bytes = [NSJSONSerialization dataWithJSONObject:object options:0 error:nil];
      return folly::parseJson([[[NSString alloc] initWithData:bytes encoding:NSUTF8StringEncoding] UTF8String]);
    };
    folly::dynamic declarations = folly::dynamic::array;
    for (CUIFieldInputBinding *entry in CUIFieldInputs.allObjects) {
      NSDictionary *current = [entry capture];
      UIView *root = [entry outerRoot];
      if (!current || root.window != _window || ![entry containsOriginalView:view] || ![[entry moduleLease] isEqual:_lease]) continue;
      declarations.push_back(folly::dynamic::object("encodedDocument", [current[@"encodedDocument"] UTF8String])
        ("snapshot", json(current[@"fieldGroupSnapshot"]))("epoch", entry->_epoch));
    }
    const auto context = captureFieldOwnedInput(manager, document, json(value[@"fieldGroupSnapshot"]), declarations,
      static_cast<int32_t>(view.tag), _epoch, ++_eventId);
    FieldInputNativeOperation::Input inputScope(manager.get(), context);
    emit();
    return;
  }
  continueFieldOriginalInput(*manager, static_cast<int32_t>(view.tag), [&] { emit(); }, [&](const RawEvent &original) {
    [self dispatch:nil phase:@"input" repeat:NO originalInput:&original];
  });
}
- (BOOL)dispatch:(UIPress *)press phase:(NSString *)phase repeat:(BOOL)repeat
{
  return [self dispatch:press phase:phase repeat:repeat originalInput:nullptr];
}
- (BOOL)dispatch:(UIPress *)press phase:(NSString *)phase repeat:(BOOL)repeat originalInput:(const RawEvent *)originalInput
{
  return [self dispatch:press phase:phase repeat:repeat originalInput:originalInput deadline:FieldInputDispatchFrames::Clock::time_point::max()];
}
- (void)emitOriginalPointers:(void (^)(void))emit decision:(void (^)(BOOL))decision
{
  const auto manager = _manager.lock();
  UIView *surface = CUIFieldPointerSurface(_outer);
  if (!manager || !surface) { emit(); return; }
  std::unordered_set<int32_t> members;
  int32_t surfaceId = 0;
  for (CUIFieldInputBinding *binding in CUIFieldInputs.allObjects)
    if (CUIFieldPointerSurface([binding outerRoot]) == surface) {
      NSDictionary *value = [binding capture]; if (!value) continue;
      const auto document = folly::parseJson([value[@"encodedDocument"] UTF8String]);
      const auto currentSurface = static_cast<int32_t>(document.at("surfaceId").asInt());
      if (surfaceId && surfaceId != currentSurface) throw std::runtime_error("field-input-pointer-surface-ambiguous");
      surfaceId = currentSurface;
      members.insert(fieldGroupTarget(document.at("fieldGroup").at("outerTarget")));
      for (const auto &node : document.at("fieldGroup").at("nodes")) members.insert(fieldGroupTarget(node.at("target")));
    }
  continueFieldOriginalPointer(*manager, [&](const RawEvent &event) {
    const auto family = event.shadowNodeFamily.lock();
    return family && family->getSurfaceId() == surfaceId && members.contains(family->getTag());
  }, [&] { emit(); }, [&](const RawEvent &original, FieldInputDispatchFrames::Clock::time_point deadline) -> std::optional<bool> {
    CUIFieldInputBinding *owner = CUIFieldPointerOwner(surface, original);
    if (!owner) {
      [self record:@{@"kind":@"pointer-retired", @"phase":@(fieldInputOriginalPointerPhase(original.type))}];
      return std::nullopt;
    }
    NSString *phase = @(fieldInputOriginalPointerPhase(original.type));
    if ([phase isEqual:@"pointer-start"]) CUIRecordWindowModality(surface.window, @"pointer");
    const BOOL prevented = [owner dispatch:nil phase:phase repeat:NO originalInput:&original deadline:deadline];
    decision(prevented);
    return static_cast<bool>(prevented);
  }, std::chrono::milliseconds(5000));
}
- (BOOL)dispatch:(UIPress *)press phase:(NSString *)phase repeat:(BOOL)repeat
  originalInput:(const RawEvent *)originalInput deadline:(FieldInputDispatchFrames::Clock::time_point)deadline
{
  NSDictionary *value = [self capture];
  const auto manager = _manager.lock();
  if (!value || !manager || (!originalInput && (press.window != _window || !press.key))) return NO;
  try {
    const auto document = folly::parseJson([value[@"encodedDocument"] UTF8String]);
    NSData *snapshotBytes = [NSJSONSerialization dataWithJSONObject:value[@"fieldGroupSnapshot"] options:0 error:nil];
    const auto snapshot = folly::parseJson([[[NSString alloc] initWithData:snapshotBytes encoding:NSUTF8StringEncoding] UTF8String]);
    const auto binding = fieldInputBinding(document);
    const bool pointer = originalInput && isFieldInputOriginalPointer(originalInput->type);
    const auto family = originalInput ? originalInput->shadowNodeFamily.lock() : nullptr;
    const auto target = pointer && family ? family->getTag() : static_cast<int32_t>(snapshot.at("eventFocusedTarget").asInt());
    if (!target) throw std::invalid_argument("field-input-original-focus-retired");
    auto fabric = captureFabricFormDocument(*manager, static_cast<int32_t>(document.at("surfaceId").asInt()));
    if (document.at("revision").asString() != std::to_string(fabric.revision) || !fabric.positions.contains(target))
      throw std::invalid_argument("field-input-original-document-retired");
    const auto original = fabric.preorder[fabric.positions.at(target)].node;
    if (originalInput && ((!pointer && originalInput->type != "topNativeSegmentInput") ||
        originalInput->shadowNodeFamily.lock() != original->getFamilyShared() ||
        originalInput->eventTarget != original->getEventEmitter()->getEventTarget()))
      throw std::invalid_argument("field-input-original-editor-retired");
    const auto state = fieldInputRuntime(binding.moduleLease);
    if (!state || !state->ready()) throw std::invalid_argument("field-input-runtime-retired");
    std::vector<TFieldInputBinding> bindings;
    std::vector<FieldInputIdentity> scopes;
    NSMutableDictionary<NSNumber *, CUIFieldInputBinding *> *scopeOwners = [NSMutableDictionary new];
    for (CUIFieldInputBinding *entry in CUIFieldInputs.allObjects) {
      NSDictionary *current = [entry capture];
      UIView *root = [entry outerRoot];
      if (current && root.window == _window && CUIFieldContainsTarget(current, original->getSurfaceId(), target)) {
        const auto currentDocument = folly::parseJson([current[@"encodedDocument"] UTF8String]);
        const auto field = fieldInputBinding(currentDocument);
        if (field.moduleLease != binding.moduleLease) continue;
        NSData *bytes = [NSJSONSerialization dataWithJSONObject:current[@"fieldGroupSnapshot"] options:0 error:nil];
        const auto currentSnapshot = folly::parseJson([[[NSString alloc] initWithData:bytes encoding:NSUTF8StringEncoding] UTF8String]);
        bindings.push_back(field);
        scopes.push_back(fieldInputIdentity(currentDocument, currentSnapshot, field, target, entry->_epoch));
        if (scopeOwners[@(field.outerTarget)]) throw std::invalid_argument("field-input-original-group-ambiguous");
        scopeOwners[@(field.outerTarget)] = entry;
      }
    }
    const auto groups = orderedFieldInputGroups(document, bindings, target, snapshot);
    const auto identity = fieldInputIdentity(document, snapshot, binding, target, _epoch);
    const auto eventId = ++_eventId;
    const auto ticket = state->frames.begin(identity, eventId, phase.UTF8String, std::chrono::milliseconds(pointer ? 5000 : 1000), std::move(scopes), deadline);
    if (!ticket) throw std::invalid_argument("field-input-original-scope-frame-retired");
    FieldInputFrameLifetime lifetime(state->frames, ticket);
    UIKey *key = press.key; const auto flags = key.modifierFlags;
    const BOOL down = [phase isEqual:@"down"], cancel = [phase isEqual:@"cancel"];
    BOOL intrinsic = !originalInput && [_consumed containsObject:@(key.keyCode)];
    UIView *component = [_presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:target];
    if (down && [component isKindOfClass:CUIFocusView.class]) intrinsic = [(CUIFocusView *)component capturesObservedKey:key];
    if (down && intrinsic) [_consumed addObject:@(key.keyCode)];
    if (!down && !originalInput) [_consumed removeObject:@(key.keyCode)];
    const auto row = fieldInputTargetInstance(snapshot, target);
    const auto hostOwner = row.get_ptr("hostOwnerId");
    const auto eventTimestamp = originalInput ? originalInput->eventStartTimeStamp : HighResTimeStamp::fromDOMHighResTimeStamp(press.timestamp * 1000);
    folly::dynamic payload = originalInput ? folly::dynamic::object("fieldDispatch", folly::toJson(fieldInputPacket(ticket, binding, groups))) : folly::dynamic::object("kind", "keyboard")("ownerId", hostOwner ? hostOwner->asString() : binding.ownerId)("target", target)
      ("key", CUIInputKeyName(key).UTF8String ?: "")("nativeCode", static_cast<int>(key.keyCode))("characters", key.characters.UTF8String ?: "")
      ("phase", down ? "down" : "up")("repeat", static_cast<bool>(repeat))("cancelled", static_cast<bool>(cancel))
      ("shiftKey", static_cast<bool>(flags & UIKeyModifierShift))("altKey", static_cast<bool>(flags & UIKeyModifierAlternate))
      ("ctrlKey", static_cast<bool>(flags & UIKeyModifierControl))("metaKey", static_cast<bool>(flags & UIKeyModifierCommand))
      ("capsLock", static_cast<bool>(flags & UIKeyModifierAlphaShift))("nativeModifierData", std::to_string(static_cast<uint64_t>(flags)))
      ("nativeDefaultHandled", static_cast<bool>(intrinsic))("timestamp", press.timestamp * 1000)
      ("fieldDispatch", folly::toJson(fieldInputPacket(ticket, binding, groups)))
      ("code", CUIPhysicalKeyCode(static_cast<int>(key.keyCode)))("location", CUIPhysicalKeyLocation(static_cast<int>(key.keyCode)))
      ("nativePressPhase", static_cast<int>(press.phase))("nativePressType", static_cast<int>(press.type));
    if (!originalInput) payload["timeStamp"] = eventTimestamp.toDOMHighResTimeStamp();
    const auto before = payload;
    if (!originalInput) CUIRecordWindowModality(_window, @"keyboard");
    const std::weak_ptr<const RootShadowNode> weakRoot = fabric.root;
    const std::weak_ptr<UIManager> weakManager = manager;
    const auto revision = fabric.revision;
    const bool scheduled = state->schedule(ticket, manager, original, originalInput ? originalInput->type : "nativeFieldKey", std::move(payload),
      eventTimestamp, [weakRoot, weakManager, revision] {
        const auto manager = weakManager.lock(); const auto root = weakRoot.lock();
        return manager && root && isFabricFormDocumentCurrent(*manager, {root, revision, {}, {}});
      }, originalInput);
    FieldInputMountCursor mountCursor{fabric.root};
    const auto scopeOwner = [&](int32_t target) -> CUIFieldInputBinding * {
      CUIFieldInputBinding *found = nil;
      for (CUIFieldInputBinding *entry in CUIFieldInputs.allObjects) {
        if ([entry outerRoot].tag != target || [entry boundWindow] != _window || ![[entry moduleLease] isEqual:_lease]) continue;
        if (found) throw std::runtime_error("field-input-original-group-ambiguous");
        found = entry;
      }
      return found;
    };
    FieldInputDecision waited = scheduled ? state->frames.waitWithInputs(ticket, [&](const FieldInputDispatchFrames::Handle &ticket, const FieldInputFocusAction &action) {
      CUIFieldInputBinding *owner = scopeOwner(action.groupTarget);
      if (!owner) { FieldInputFocusResult failure; failure.error = "field-input-original-scope-retired"; return failure; }
      const auto result = [owner focus:action state:state ticket:ticket];
      if (result.current && result.error.empty()) mountCursor.appliedRoot = captureFabricFormDocument(*manager, identity.surfaceId).root;
      return result;
    }, [&](const FieldInputDispatchFrames::Handle &ticket) {
      return state->captureMountEvents(ticket, manager, [&](const RawEvent &event) {
        return isFieldInputMountEvent(*manager, ticket, event);
      }, [&] {
        @try { return mountFieldInputTransactions(*manager, ticket, mountCursor, [&] {
          return std::string([self mountWitness].UTF8String);
        }, state->frames.mountTarget(ticket)); }
        @catch (NSException *error) { throw std::runtime_error(error.reason.UTF8String ?: "field-input-original-mount-threw"); }
      });
    }, [&](const FieldInputDispatchFrames::Handle &ticket, const FieldInputCommandAction &command) {
      const auto current = [&] {
        if (![NSThread isMainThread] || !state->frames.isCurrent(ticket) || _epoch != identity.epoch || !CUIFieldInputWindowActive(_window))
          return false;
        for (const auto &scope : ticket->scopes) {
          CUIFieldInputBinding *owner = scopeOwner(scope.outerTarget);
          if (!owner || ![owner currentScope:scope]) return false;
        }
        return true;
      };
      UIView *originalTarget = [_presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:command.target];
      NSDictionary *beforeCommand = [self capture];
      if (!beforeCommand || !current() || !originalTarget || originalTarget.window != _window)
        return FieldInputCommandResult{false, "field-input-original-command-window-retired"};
      auto result = state->captureCommandEvents(ticket, manager, [&](const RawEvent &event) {
        return isFieldInputCommandEvent(*manager, ticket, event);
      }, [&] {
        @try { return command.perform(); }
        @catch (NSException *error) { throw std::runtime_error(error.reason.UTF8String ?: "field-input-original-command-threw"); }
      });
      NSDictionary *afterCommand = [self capture];
      const bool targetCurrent = current() && afterCommand && originalTarget.window == _window &&
        [_presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:command.target] == originalTarget;
      if (!targetCurrent && result.error.empty()) result.error = "field-input-original-command-target-retired";
      [self record:@{@"kind":@"command-native", @"token":@(ticket->token), @"target":@(command.target),
        @"command":@(command.name.c_str()), @"callbackCompleted":@(result.callbackCompleted), @"current":@(targetCurrent),
        @"error":@(result.error.c_str()), @"before":beforeCommand[@"fieldGroupSnapshot"] ?: NSNull.null,
        @"after":afterCommand[@"fieldGroupSnapshot"] ?: NSNull.null}];
      return result;
    }) : FieldInputDecision{FieldInputDisposition::Retired, {}, false, false};
    NSDictionary *after = [self capture];
    bool current = after && _epoch == identity.epoch && CUIFieldInputWindowActive(_window) &&
      [_presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:target] == component;
    for (const auto &scope : ticket->scopes) {
      CUIFieldInputBinding *owner = scopeOwners[@(scope.outerTarget)];
      current = current && owner && [owner currentScope:scope];
    }
    const auto subphases = fieldInputSubphaseResults(state->frames, ticket);
  const auto decision = state->frames.end(ticket, current);
    folly::dynamic record = folly::dynamic::object("kind", pointer ? "pointer" : originalInput ? "input" : "key")("event", before)("identity", encodeFieldInputIdentity(identity))
      ("wait", fieldInputDispositionName(waited.disposition))("decision", fieldInputDispositionName(decision.disposition))
      ("deliveryStarted", decision.deliveryStarted)("deliveryReturned", decision.deliveryReturned)("error", decision.error)
      ("originalDefaultPrevented", decision.originalDefaultPrevented)("renderPhasesComplete", decision.phasesComplete)
      ("scopeCurrent", current)("inputSubphases", subphases)("before", snapshot)
      ("intrinsicDefaultCaptured", static_cast<bool>(intrinsic));
    if (after) {
      NSData *bytes = [NSJSONSerialization dataWithJSONObject:after[@"fieldGroupSnapshot"] options:0 error:nil];
      record["after"] = folly::parseJson([[[NSString alloc] initWithData:bytes encoding:NSUTF8StringEncoding] UTF8String]);
    } else record["after"] = nullptr;
    [self recordEncoded:@(folly::toJson(record).c_str())];
    return intrinsic || decision.originalDefaultPrevented;
  } catch (const std::exception &error) {
    [self record:@{@"kind":@"failure", @"error":@(error.what()), @"phase":phase}]; return NO;
  }
}
- (void)retire
{
  if (_closed) return;
  [self publishReadiness:NO error:@"field-input-registration-retired"];
  _closed = YES; [self retirePending];
  UIWindow *window = _window; _window = nil;
  [CUIFieldInputs removeObject:self]; _snapshot = nil; CUIRefreshFieldInputWindow(window);
}
- (void)dealloc { [self retire]; }
@end
