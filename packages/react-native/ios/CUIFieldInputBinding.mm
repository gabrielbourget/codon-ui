#import "CUIFieldInputBinding.h"
#import "CUIFieldGroupDocument.h"
#import <UIKit/UIGestureRecognizerSubclass.h>
#import "CUIInputWindow.h"
#import "CUIFocusView.h"
#import "CUIOwnedDateField.h"
#import "CUIPhysicalKey.h"
#import <React/RCTAssert.h>
#import <React/RCTTextInputComponentView.h>
#import <React/RCTTextInputNativeCommands.h>
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
- (BOOL)dispatch:(UIPress *)press phase:(NSString *)phase repeat:(BOOL)repeat;
- (void)emitOriginalInput:(UIView *)view emit:(void (^)(void))emit;
- (BOOL)dispatch:(UIPress *)press phase:(NSString *)phase repeat:(BOOL)repeat originalInput:(const RawEvent *)originalInput;
- (UIWindow *)boundWindow;
- (NSString *)moduleLease;
@end

static NSHashTable<CUIFieldInputBinding *> *CUIFieldInputs;
static CUIFieldInputBinding *CUIFieldWinner(UIWindow *window)
{
  CUIFieldInputBinding *selected = nil;
  for (CUIFieldInputBinding *binding in CUIFieldInputs.allObjects) {
    NSDictionary *value = [binding capture];
    UIView *outer = [binding outerRoot];
    if (outer.window != window || ![value[@"fieldGroupSnapshot"][@"focusedTarget"] integerValue]) continue;
    if (selected && [selected outerRoot] == outer) return nil;
    if (!selected || [outer isDescendantOfView:[selected outerRoot]]) selected = binding;
  }
  return selected;
}
@class CUIFieldInputWindow;
@interface CUIFieldKeyRecognizer : UIGestureRecognizer <UIGestureRecognizerDelegate>
- (instancetype)initWithRouter:(CUIFieldInputWindow *)router veto:(BOOL)veto;
@end
@interface CUIFieldInputWindow : NSObject
@property(nonatomic, weak) UIWindow *window;
@property(nonatomic, strong) CUIFieldKeyRecognizer *observer;
@property(nonatomic, strong) CUIFieldKeyRecognizer *veto;
@property(nonatomic, strong) NSMapTable<UIPress *, NSMutableDictionary *> *records;
@property(nonatomic, strong) NSMutableDictionary<NSNumber *, NSString *> *held;
- (NSMutableDictionary *)down:(UIPress *)press delivered:(BOOL)delivered;
- (void)finish:(UIPress *)press cancelled:(BOOL)cancelled;
@end
static NSMapTable<UIWindow *, CUIFieldInputWindow *> *CUIFieldWindows;
static void CUIRefreshFieldInputWindow(UIWindow *window);
@implementation CUIFieldInputWindow
- (NSMutableDictionary *)down:(UIPress *)press delivered:(BOOL)delivered
{
  NSMutableDictionary *record = [self.records objectForKey:press];
  BOOL repeatedCallback = delivered && [record[@"delivered"] boolValue];
  if (!record || [record[@"timestamp"] doubleValue] != press.timestamp || repeatedCallback) {
    CUIFieldInputBinding *owner = CUIFieldWinner(self.window);
    BOOL repeat = self.held[@(press.key.keyCode)] != nil;
    record = [@{@"timestamp":@(press.timestamp), @"admitted":@(owner != nil), @"capture":@NO, @"delivered":@NO} mutableCopy];
    // Store the original down before dispatch: a focus action may change which
    // field owns the current target while UIKit visits the other recognizer.
    [self.records setObject:record forKey:press];
    if (owner) {
      self.held[@(press.key.keyCode)] = [owner moduleLease] ?: @"";
      record[@"capture"] = @([owner dispatch:press phase:@"down" repeat:repeat]);
    }
  }
  if (delivered) record[@"delivered"] = @YES;
  return record;
}
- (void)finish:(UIPress *)press cancelled:(BOOL)cancelled
{
  NSNumber *code = @(press.key.keyCode);
  NSString *lease = self.held[code];
  CUIFieldInputBinding *owner = CUIFieldWinner(self.window);
  if (lease && owner && [lease isEqual:[owner moduleLease]]) [owner dispatch:press phase:cancelled ? @"cancel" : @"up" repeat:NO];
  [self.held removeObjectForKey:code]; [self.records removeObjectForKey:press];
}
@end
@implementation CUIFieldKeyRecognizer {
  __weak CUIFieldInputWindow *_router;
  BOOL _veto;
  NSMutableSet<NSNumber *> *_captured;
}
- (instancetype)initWithRouter:(CUIFieldInputWindow *)router veto:(BOOL)veto
{
  if ((self = [super initWithTarget:nil action:nil])) {
    _router = router; _veto = veto; self.delegate = self; _captured = [NSMutableSet new];
    self.cancelsTouchesInView = veto; self.delaysTouchesBegan = NO; self.delaysTouchesEnded = NO;
  }
  return self;
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceivePress:(UIPress *)press
{
  if (!press.key || press.window != _router.window) return NO;
  NSDictionary *record = [_router down:press delivered:NO];
  return [record[_veto ? @"capture" : @"admitted"] boolValue];
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceiveTouch:(UITouch *)touch { return NO; }
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)other { return YES; }
- (BOOL)canPreventGestureRecognizer:(UIGestureRecognizer *)other { return NO; }
- (BOOL)canBePreventedByGestureRecognizer:(UIGestureRecognizer *)other { return NO; }
- (void)pressesBegan:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
  if (_veto) {
    for (UIPress *press in presses) if (press.key) [_captured addObject:@(press.key.keyCode)];
    self.state = self.state == UIGestureRecognizerStatePossible ? UIGestureRecognizerStateBegan : UIGestureRecognizerStateChanged;
    return;
  }
  for (UIPress *press in presses) if (press.key) [_router down:press delivered:YES];
}
- (void)finish:(NSSet<UIPress *> *)presses cancelled:(BOOL)cancelled
{
  CUIFieldInputWindow *router = _router;
  if (!_veto) for (UIPress *press in presses) if (press.key) [router finish:press cancelled:cancelled];
  if (_veto) for (UIPress *press in presses) if (press.key) [_captured removeObject:@(press.key.keyCode)];
  if (_veto ? !_captured.count : !router.held.count) self.state = _veto && self.state != UIGestureRecognizerStatePossible ? UIGestureRecognizerStateEnded : UIGestureRecognizerStateFailed;
  CUIRefreshFieldInputWindow(router.window);
}
- (void)pressesEnded:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event { [self finish:presses cancelled:NO]; }
- (void)pressesCancelled:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event { [self finish:presses cancelled:YES]; }
- (void)reset { [_captured removeAllObjects]; [super reset]; }
@end
static void CUIRefreshFieldInputWindow(UIWindow *window)
{
  if (!window) return;
  if (!CUIFieldWindows) CUIFieldWindows = [NSMapTable weakToStrongObjectsMapTable];
  CUIFieldInputWindow *router = [CUIFieldWindows objectForKey:window];
  BOOL needed = NO;
  for (CUIFieldInputBinding *binding in CUIFieldInputs.allObjects) if ([binding boundWindow] == window) { needed = YES; break; }
  const BOOL active = window.isKeyWindow && UIApplication.sharedApplication.applicationState == UIApplicationStateActive &&
    (!window.windowScene || window.windowScene.activationState == UISceneActivationStateForegroundActive);
  if ((!needed && !router.held.count) || !active) {
    [window removeGestureRecognizer:router.observer]; [window removeGestureRecognizer:router.veto];
    [router.held removeAllObjects]; [CUIFieldWindows removeObjectForKey:window]; return;
  }
  if (router) return;
  router = [CUIFieldInputWindow new]; router.window = window; router.records = [NSMapTable weakToStrongObjectsMapTable]; router.held = [NSMutableDictionary new];
  router.observer = [[CUIFieldKeyRecognizer alloc] initWithRouter:router veto:NO];
  router.veto = [[CUIFieldKeyRecognizer alloc] initWithRouter:router veto:YES];
  [CUIFieldWindows setObject:router forKey:window]; [window addGestureRecognizer:router.observer]; [window addGestureRecognizer:router.veto];
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
  return binding && [view isDescendantOfView:[binding outerRoot]];
}

void CUIEmitOwnedFieldInput(UIView *view, void (^emit)(void))
{
  CUIFieldInputBinding *owner = CUIFieldWinner(view.window);
  if (owner && [view isDescendantOfView:[owner outerRoot]]) [owner emitOriginalInput:view emit:emit];
  else emit();
}

@implementation CUIFieldInputBinding {
  __weak CUIFieldBinding *_metadata;
  __weak RCTSurfacePresenter *_presenter;
  __weak UIView *_outer, *_input;
  __weak UIWindow *_window;
  std::weak_ptr<UIManager> _manager;
  NSDictionary *(^_snapshot)(void);
  NSString *_bindingId, *_ownerId, *_lease, *_fingerprint, *_error, *_outerInstance, *_inputInstance;
  NSUInteger _epoch, _eventId;
  BOOL _closed, _capturing;
  NSMutableSet<NSNumber *> *_consumed;
}
- (instancetype)initWithMetadata:(CUIFieldBinding *)metadata presenter:(RCTSurfacePresenter *)presenter
                        manager:(std::shared_ptr<UIManager>)manager snapshot:(NSDictionary *(^)(void))snapshot
{
  if ((self = [super init])) {
    RCTAssertMainQueue();
    _metadata = metadata; _presenter = presenter; _manager = manager; _snapshot = [snapshot copy];
    _epoch = 1; _consumed = [NSMutableSet new];
    if (!CUIFieldInputs) CUIFieldInputs = [NSHashTable weakObjectsHashTable];
    [CUIFieldInputs addObject:self];
    [self refresh];
  }
  return self;
}
- (UIView *)outerRoot { return _outer; }
- (UIWindow *)boundWindow { return _window; }
- (NSString *)moduleLease { return _lease; }
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
      if (!outer || !input || (_outerInstance && ![_outerInstance isEqual:snapshot[@"outerInstance"]]) ||
          (_inputInstance && ![_inputInstance isEqual:snapshot[@"inputInstance"]]))
        throw std::runtime_error("field-input-original-root-instance-retired");
      NSString *fingerprint = [@[value[@"documentId"], value[@"surfaceId"], snapshot[@"windowId"], snapshot[@"outerInstance"],
          snapshot[@"inputInstance"], _metadata.fieldGroupBinding, _metadata.ownedEditorBinding] description];
      if (_fingerprint && ![_fingerprint isEqual:fingerprint]) { [self retirePending]; _epoch++; }
      _fingerprint = fingerprint; _bindingId = @(binding.bindingId.c_str()); _ownerId = @(binding.ownerId.c_str());
      _lease = @(binding.moduleLease.c_str()); _outer = outer; _input = input; _error = nil;
      _outerInstance = snapshot[@"outerInstance"]; _inputInstance = snapshot[@"inputInstance"];
      return value;
    } catch (const std::exception &error) {
      @throw [NSException exceptionWithName:@"CUI.FieldInput" reason:@(error.what()) userInfo:nil];
    }
  } @catch (NSException *error) {
    [self retirePending];
    if (![_error isEqual:error.reason]) {
      _error = error.reason;
      [self record:@{@"kind":@"status", @"ready":@NO, @"error":error.reason ?: @"field-input-capture-failed"}];
    }
    return nil;
  } @finally { _capturing = NO; }
}
- (void)refresh
{
  if (_capturing || _closed) return;
  NSDictionary *value = [self capture];
  UIWindow *window = value ? _outer.window : nil;
  UIWindow *previous = _window;
  if (previous != window) { _window = window; _epoch++; [self retirePending]; }
  CUIRefreshFieldInputWindow(previous); CUIRefreshFieldInputWindow(window);
}
- (NSString *)mountWitness
{
  NSDictionary *mount = [_metadata formMountSnapshot];
  NSData *bytes = mount ? [NSJSONSerialization dataWithJSONObject:mount options:NSJSONWritingSortedKeys error:nil] : nil;
  return bytes ? [[NSString alloc] initWithData:bytes encoding:NSUTF8StringEncoding] : @"unmounted";
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
  const auto target = fieldInputFocusTarget(document, snapshot, action);
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
  for (const auto &node : document.at("fieldGroup").at("nodes")) targets.insert(fieldGroupTarget(node.at("target")));
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
      if ([component isKindOfClass:CUIDateSegment.class]) {
        NSDictionary *identity = [NSJSONSerialization JSONObjectWithData:[@(folly::toJson(row.at("segment")).c_str()) dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
        commandResult = @([(CUIDateSegment *)component requestFormSegmentFocus:identity]); focus.requested = true;
      } else if ([component isKindOfClass:RCTTextInputComponentView.class]) {
        [(id<RCTTextInputViewProtocol>)component focus]; focus.requested = true;
      } else if ([component isKindOfClass:CUIFocusView.class]) {
        [(CUIFocusView *)component requestKeyboardFocus:[(CUIFocusView *)component motionSnapshotIdentity][@"ownerId"]]; focus.requested = true;
      } else { focus.error = "field-input-original-focus-command-unavailable"; return focus; }
      for (CUIFieldInputBinding *binding in CUIFieldInputs.allObjects) {
        UIView *root = [binding outerRoot];
        if (root.window == _window && [root isKindOfClass:CUIFocusView.class]) [(CUIFocusView *)root synchronizeFieldInputFocus];
      }
      NSDictionary *after = [self capture];
      NSDictionary *actual = nil;
      for (NSDictionary *entry in after[@"fieldGroupSnapshot"][@"originals"]) if ([entry[@"target"] integerValue] == target) actual = entry;
      focus.current = after && [self currentScope:*scope] &&
        [_presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:target] == component &&
        [actual[@"nativeInstance"] isEqual:@(row.at("nativeInstance").asString().c_str())] &&
        [actual[@"editorInstance"] isEqual:@(row.at("editorInstance").asString().c_str())];
      focus.observed = observed->load();
      focus.target = target; focus.nativeInstance = row.at("nativeInstance").asString(); focus.editorInstance = row.at("editorInstance").asString();
      if (focus.requested && !focus.observed) focus.error = "field-input-original-focus-not-observed";
      [self record:@{@"kind":@"focus", @"target":@(target), @"requested":@(focus.requested), @"observed":@(focus.observed),
        @"current":@(focus.current), @"nativeCommandResult":commandResult, @"after":after[@"fieldGroupSnapshot"] ?: NSNull.null}];
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
  NSDictionary *value = [self capture];
  const auto manager = _manager.lock();
  if (!value || !manager || (!originalInput && (press.window != _window || !press.key))) return NO;
  try {
    const auto document = folly::parseJson([value[@"encodedDocument"] UTF8String]);
    NSData *snapshotBytes = [NSJSONSerialization dataWithJSONObject:value[@"fieldGroupSnapshot"] options:0 error:nil];
    const auto snapshot = folly::parseJson([[[NSString alloc] initWithData:snapshotBytes encoding:NSUTF8StringEncoding] UTF8String]);
    const auto binding = fieldInputBinding(document);
    const auto target = static_cast<int32_t>(snapshot.at("focusedTarget").asInt());
    if (!target) throw std::invalid_argument("field-input-original-focus-retired");
    auto fabric = captureFabricFormDocument(*manager, static_cast<int32_t>(document.at("surfaceId").asInt()));
    if (document.at("revision").asString() != std::to_string(fabric.revision) || !fabric.positions.contains(target))
      throw std::invalid_argument("field-input-original-document-retired");
    const auto original = fabric.preorder[fabric.positions.at(target)].node;
    if (originalInput && (originalInput->type != "topNativeSegmentInput" ||
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
      UIView *source = [_presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:target];
      if (current && root.window == _window && [source isDescendantOfView:root]) {
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
    const auto groups = orderedFieldInputGroups(document, bindings, target);
    const auto identity = fieldInputIdentity(document, snapshot, binding, target, _epoch);
    const auto eventId = ++_eventId;
    const auto ticket = state->frames.begin(identity, eventId, phase.UTF8String, std::chrono::milliseconds(1000), std::move(scopes));
    if (!ticket) throw std::invalid_argument("field-input-original-scope-frame-retired");
    FieldInputFrameLifetime lifetime(state->frames, ticket);
    UIKey *key = press.key; const auto flags = key.modifierFlags;
    const BOOL down = [phase isEqual:@"down"], cancel = [phase isEqual:@"cancel"];
    BOOL intrinsic = !originalInput && [_consumed containsObject:@(key.keyCode)];
    UIView *component = [_presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:target];
    if (down && [component isKindOfClass:CUIFocusView.class]) intrinsic = [(CUIFocusView *)component capturesObservedKey:key];
    if (down && intrinsic) [_consumed addObject:@(key.keyCode)];
    if (!down && !originalInput) [_consumed removeObject:@(key.keyCode)];
    const auto row = fieldInputOriginal(snapshot, target);
    const auto hostOwner = row.get_ptr("hostOwnerId");
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
    const auto before = payload;
    if (!originalInput) CUIRecordWindowModality(_window, @"keyboard");
    const std::weak_ptr<const RootShadowNode> weakRoot = fabric.root;
    const std::weak_ptr<UIManager> weakManager = manager;
    const auto revision = fabric.revision;
    const bool scheduled = state->schedule(ticket, manager, original, originalInput ? "topNativeSegmentInput" : "nativeFieldKey", std::move(payload),
      originalInput ? originalInput->eventStartTimeStamp : HighResTimeStamp::fromDOMHighResTimeStamp(press.timestamp * 1000), [weakRoot, weakManager, revision] {
        const auto manager = weakManager.lock(); const auto root = weakRoot.lock();
        return manager && root && isFabricFormDocumentCurrent(*manager, {root, revision, {}, {}});
      }, originalInput);
    FieldInputMountCursor mountCursor{fabric.root};
    FieldInputDecision waited = scheduled ? state->frames.wait(ticket, [&](const FieldInputFocusAction &action) {
      CUIFieldInputBinding *owner = scopeOwners[@(action.groupTarget)];
      if (!owner) { FieldInputFocusResult failure; failure.error = "field-input-original-scope-retired"; return failure; }
      const auto result = [owner focus:action state:state ticket:ticket];
      if (result.current && result.error.empty()) mountCursor.appliedRoot = captureFabricFormDocument(*manager, identity.surfaceId).root;
      return result;
    }, [&] {
      return state->captureMountEvents(ticket, manager, [&](const RawEvent &event) {
        return isFieldInputMountEvent(*manager, ticket, event);
      }, [&] {
        @try { return mountFieldInputTransactions(*manager, ticket, mountCursor, [&] {
          return std::string([self mountWitness].UTF8String);
        }, state->frames.mountTarget(ticket)); }
        @catch (NSException *error) { throw std::runtime_error(error.reason.UTF8String ?: "field-input-original-mount-threw"); }
      });
    }, [&](const FieldInputCommandAction &command) {
      const auto current = [&] {
        if (![NSThread isMainThread] || !state->frames.isCurrent(ticket) || _epoch != identity.epoch || !_window.isKeyWindow)
          return false;
        for (const auto &scope : ticket->scopes) {
          CUIFieldInputBinding *owner = scopeOwners[@(scope.outerTarget)];
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
    bool current = after && _epoch == identity.epoch && _window.isKeyWindow &&
      [_presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:target] == component;
    for (const auto &scope : ticket->scopes) {
      CUIFieldInputBinding *owner = scopeOwners[@(scope.outerTarget)];
      current = current && owner && [owner currentScope:scope];
    }
    const auto decision = state->frames.end(ticket, current);
    folly::dynamic record = folly::dynamic::object("kind", originalInput ? "input" : "key")("event", before)("identity", encodeFieldInputIdentity(identity))
      ("wait", fieldInputDispositionName(waited.disposition))("decision", fieldInputDispositionName(decision.disposition))
      ("deliveryStarted", decision.deliveryStarted)("deliveryReturned", decision.deliveryReturned)("error", decision.error)
      ("originalDefaultPrevented", decision.originalDefaultPrevented)("renderPhasesComplete", decision.phasesComplete)
      ("scopeCurrent", current)("before", snapshot)
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
  _closed = YES; [self retirePending];
  UIWindow *window = _window; _window = nil;
  [CUIFieldInputs removeObject:self]; _snapshot = nil; CUIRefreshFieldInputWindow(window);
}
- (void)dealloc { [self retire]; }
@end
