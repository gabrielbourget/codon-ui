#import "CUIOrdinaryEditorKeys.h"
#import "CUIInputWindow.h"
#import "CUIPhysicalKey.h"
#import "CUIDateSegment.h"
#import "CUIFocusView.h"
#import "CUIKeyboardScope.h"
#include <react/renderer/core/EventEmitter.h>
#include <react/renderer/mounting/ShadowViewMutation.h>
#include <unordered_map>

using namespace facebook::react;

@implementation CUIOrdinaryEditorKeys {
  __weak UIView *_scope;
  NSDictionary *(^_session)(void);
  BOOL (^_ready)(void);
  void (^_status)(NSDictionary *);
  NSArray<NSDictionary *> *_bindings;
  NSMapTable<NSString *, UIView *> *_targets;
  NSMutableSet<NSString *> *_resolved;
  NSMutableDictionary<NSString *, NSString *> *_published;
  std::unordered_map<Tag, std::weak_ptr<const EventEmitter>> _emitters;
  std::unordered_map<std::string, std::weak_ptr<const EventEmitter>> _originalEmitters;
  NSUInteger _sequence, _eventId, _structureRevision;
  BOOL _awaitingMount;
}
- (instancetype)initWithScope:(UIView *)scope session:(NSDictionary *(^)(void))session ready:(BOOL (^)(void))ready status:(void (^)(NSDictionary *))status
{
  if ((self = [super init])) {
    _scope = scope; _session = [session copy]; _ready = [ready copy]; _status = [status copy];
    _bindings = @[]; _targets = NSMapTable.strongToWeakObjectsMapTable;
    _resolved = [NSMutableSet new]; _published = [NSMutableDictionary new];
  }
  return self;
}
- (NSString *)identity:(NSDictionary *)binding { return [NSString stringWithFormat:@"%@/%@", binding[@"bindingId"], binding[@"bindingRevision"]]; }
- (BOOL)hasBindings { return _bindings.count > 0; }
- (BOOL)canObserveTarget:(UIView *)target {
  if (!_ready() || !target) return NO;
  for (NSDictionary *binding in _bindings) if ([self original:binding] == target) return YES;
  return NO;
}
- (void)update:(NSArray<NSDictionary *> *)bindings
{
  if ([_bindings isEqual:bindings]) return;
  NSMutableSet *ids = [NSMutableSet new], *targets = [NSMutableSet new], *duplicates = [NSMutableSet new];
  for (NSDictionary *binding in bindings) {
    NSString *identifier = binding[@"bindingId"]; NSNumber *target = binding[@"targetTag"];
    if ([ids containsObject:identifier] || [targets containsObject:target]) {
      [duplicates addObject:identifier];
      for (NSDictionary *previous in bindings) if ([previous[@"targetTag"] isEqual:target]) [duplicates addObject:previous[@"bindingId"]];
    }
    [ids addObject:identifier]; [targets addObject:target];
  }
  NSMutableArray *accepted = [NSMutableArray new]; NSMutableSet *identities = [NSMutableSet new];
  for (NSDictionary *binding in bindings) if (![duplicates containsObject:binding[@"bindingId"]]) {
    [accepted addObject:binding]; [identities addObject:[self identity:binding]];
  }
  for (NSString *identity in _resolved.copy) if (![identities containsObject:identity]) {
    [_resolved removeObject:identity]; [_targets removeObjectForKey:identity]; [_published removeObjectForKey:identity];
    _originalEmitters.erase(identity.UTF8String);
  }
  _bindings = accepted; _awaitingMount = YES;
}
- (void)didMount:(const MountingTransaction &)transaction
{
  for (const auto &mutation : transaction.getMutations()) {
    if (mutation.type == ShadowViewMutation::Create || mutation.type == ShadowViewMutation::Delete ||
        mutation.type == ShadowViewMutation::Insert || mutation.type == ShadowViewMutation::Remove) _structureRevision++;
    if (mutation.type == ShadowViewMutation::Delete) _emitters.erase(mutation.oldChildShadowView.tag);
    else if (mutation.newChildShadowView.eventEmitter) _emitters[mutation.newChildShadowView.tag] = mutation.newChildShadowView.eventEmitter;
  }
  _awaitingMount = NO;
  [self publish];
}
- (UIView *)original:(NSDictionary *)binding
{
  UIView *scope = _scope;
  if (_awaitingMount || !scope.window || ![binding[@"bindingId"] length] || ![binding[@"bindingRevision"] length]) return nil;
  const Tag tag = [binding[@"targetTag"] intValue];
  const auto found = _emitters.find(tag);
  const auto currentEmitter = found == _emitters.end() ? nullptr : found->second.lock();
  if (!currentEmitter) return nil;
  NSString *identity = [self identity:binding];
  if (![_resolved containsObject:identity]) {
    UIView *target = [scope.window viewWithTag:tag];
    if (!target) return nil;
    [_targets setObject:target forKey:identity]; [_resolved addObject:identity];
    _originalEmitters[identity.UTF8String] = currentEmitter;
  }
  UIView *target = [_targets objectForKey:identity];
  const auto original = _originalEmitters.find(identity.UTF8String);
  if (!target || target.tag != tag || target.window != scope.window ||
      original == _originalEmitters.end() || original->second.lock() != currentEmitter) return nil;
  for (UIView *view = target; view; view = view.superview) if (view.hidden) return nil;
  return target;
}
- (NSDictionary *)bindingForPress:(UIPress *)press
{
  UIView *scope = _scope;
  if (!press.key || !scope.window || press.window != scope.window || !_ready()) return nil;
  UIView *focused = [press.responder isKindOfClass:UIView.class] ? (UIView *)press.responder : CUIInputFocusedView(scope.window);
  UIView *original = focused;
  while (original && original != scope) {
    const auto emitter = _emitters.find(static_cast<Tag>(original.tag));
    if (emitter != _emitters.end() && !emitter->second.expired()) break;
    original = original.superview;
  }
  if (!original || original == scope || [original isKindOfClass:CUIDateSegment.class]) return nil;
  BOOL toolbarObservation=CUIKeyboardToolbarRoute(press) != nil;
  NSDictionary *selected = nil;
  NSMutableArray *observers = [NSMutableArray new];
  for (NSDictionary *binding in _bindings) {
    UIView *target = [self original:binding];
    if (!target) continue;
    // Native dispatch supplies the real target. React's genuine bubbling path
    // selects observing roots, including logical ancestors across portals.
    if ([binding[@"subtree"] boolValue] && (![binding[@"toolbarSubtreeOnly"] boolValue] || toolbarObservation)) [observers addObject:binding];
    if (target == original && (![binding[@"toolbarTargetOnly"] boolValue] || toolbarObservation)) {
      if (selected) return nil;
      selected = binding;
    }
  }
  if (!selected) selected = observers.lastObject;
  if (!selected) return nil;
  NSMutableDictionary *result = [selected mutableCopy];
  result[@"originalTarget"] = @(original.tag);
  NSData *encoded = [NSJSONSerialization dataWithJSONObject:observers options:0 error:nil];
  result[@"observerBindings"] = [[NSString alloc] initWithData:encoded encoding:NSUTF8StringEncoding];
  return result;
}
- (BOOL)acceptsPress:(UIPress *)press { return [self bindingForPress:press] != nil; }
- (void)publish
{
  NSDictionary *session = _session();
  for (NSDictionary *binding in _bindings) {
    UIView *target = [self original:binding]; const BOOL ready = _ready() && target != nil;
    NSString *identity = [self identity:binding];
    NSString *signature = [NSString stringWithFormat:@"%@:%@:%@:%d:%p", session[@"scopeOwnerId"], session[@"windowId"], session[@"epoch"], ready, target];
    if ([binding[@"subtree"] boolValue]) signature = [signature stringByAppendingFormat:@":%lu", (unsigned long)_structureRevision];
    if ([_published[identity] isEqual:signature]) continue;
    _published[identity] = signature;
    _status(@{@"ownerId":session[@"scopeOwnerId"] ?: @"", @"windowId":session[@"windowId"] ?: @"", @"epoch":session[@"epoch"] ?: @0,
      @"bindingId":binding[@"bindingId"], @"bindingRevision":binding[@"bindingRevision"], @"target":binding[@"targetTag"],
      @"sequence":@(++_sequence), @"ready":@(ready), @"windowActive":@(_scope.window.isKeyWindow), @"error":ready ? @"" : @"original-editor-unavailable"});
  }
}
- (NSInteger)toolbarPriorityForPress:(UIPress *)press owner:(NSString *)owner
{
  NSDictionary *binding=[self bindingForPress:press];
  if (!binding) return 0;
  if ([binding[@"targetTag"] isEqual:binding[@"originalTarget"]]) return 2;
  return [_session()[@"scopeOwnerId"] isEqual:owner] ? 1 : 0;
}
- (void)appendToolbarObservers:(NSMutableArray *)observers
{
  NSDictionary *session=_session();
  for (NSDictionary *binding in _bindings) if ([binding[@"subtree"] boolValue] && [self original:binding]) {
    NSMutableDictionary *observer=[binding mutableCopy];
    observer[@"ownerId"]=session[@"scopeOwnerId"] ?: @""; observer[@"windowId"]=session[@"windowId"] ?: @""; observer[@"epoch"]=session[@"epoch"] ?: @0;
    [observers addObject:observer];
  }
}
- (void)dispatchPress:(UIPress *)press phase:(NSString *)phase repeat:(BOOL)repeat captured:(BOOL)captured
{
  if (![phase isEqualToString:@"cancel"] && CUIKeyboardToolbarCancelledOriginal(press)) return;
  NSDictionary *binding = [self bindingForPress:press];
  if (!binding || ![@[@"down", @"up", @"cancel"] containsObject:phase]) return;
  NSString *toolbarRoute=CUIKeyboardToolbarRoute(press);
  if (toolbarRoute) {
    NSDictionary *route=[NSJSONSerialization JSONObjectWithData:[toolbarRoute dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    CUIOrdinaryEditorKeys *winner=nil; NSInteger best=0;
    for (CUIKeyboardScope *scope in CUIInputScopes(_scope.window)) {
      CUIOrdinaryEditorKeys *candidate=[scope ordinaryEditorKeys]; NSInteger priority=[candidate toolbarPriorityForPress:press owner:route[@"ownerId"]];
      if (!priority || priority < best) continue;
      if (priority == best && winner) return;
      winner=candidate; best=priority;
    }
    if (winner != self) return;
    NSMutableArray *observers=[NSMutableArray new];
    for (CUIKeyboardScope *scope in CUIInputScopes(_scope.window)) [[scope ordinaryEditorKeys] appendToolbarObservers:observers];
    NSData *encoded=[NSJSONSerialization dataWithJSONObject:observers options:0 error:nil];
    NSMutableDictionary *scoped=[binding mutableCopy]; scoped[@"observerBindings"]=[[NSString alloc] initWithData:encoded encoding:NSUTF8StringEncoding]; binding=scoped;
  }
  const auto found = _emitters.find([binding[@"originalTarget"] intValue]);
  const auto emitter = found == _emitters.end() ? nullptr : found->second.lock();
  if (!emitter) return;
  NSDictionary *session = _session(); UIKey *key = press.key; const auto flags = key.modifierFlags;
  UIView *original = [_scope.window viewWithTag:[binding[@"originalTarget"] integerValue]];
  captured = captured || ([original isKindOfClass:CUIFocusView.class] && [(CUIFocusView *)original capturesObservedKey:key]);
  UIView *focused = [press.responder isKindOfClass:UIView.class] ? (UIView *)press.responder : CUIInputFocusedView(_scope.window);
  const bool composing = [focused conformsToProtocol:@protocol(UITextInput)] && ((id<UITextInput>)focused).markedTextRange != nil;
  folly::dynamic data = folly::dynamic::object("kind", "keyboard")("ownerId", [session[@"scopeOwnerId"] UTF8String] ?: "")
    ("bindingId", [binding[@"bindingId"] UTF8String])("bindingRevision", [binding[@"bindingRevision"] UTF8String])
    ("observerBindings", [binding[@"observerBindings"] UTF8String] ?: "[]")
    ("target", [binding[@"originalTarget"] intValue])("windowId", [session[@"windowId"] UTF8String] ?: "")("epoch", [session[@"epoch"] doubleValue])
    ("eventId", static_cast<double>(++_eventId))("key", CUIInputKeyName(key).UTF8String ?: "")
    ("code", CUIPhysicalKeyCode(static_cast<int>(key.keyCode)))("location", CUIPhysicalKeyLocation(static_cast<int>(key.keyCode)))
    ("nativeCode", static_cast<int>(key.keyCode))("characters", key.characters.UTF8String ?: "")
    ("phase", [phase isEqual:@"down"] ? "down" : "up")("repeat", static_cast<bool>(repeat))
    ("cancelled", static_cast<bool>([phase isEqual:@"cancel"]))("isComposing", composing)
    ("shiftKey", static_cast<bool>(flags & UIKeyModifierShift))("altKey", static_cast<bool>(flags & UIKeyModifierAlternate))
    ("ctrlKey", static_cast<bool>(flags & UIKeyModifierControl))("metaKey", static_cast<bool>(flags & UIKeyModifierCommand))
    ("capsLock", static_cast<bool>(flags & UIKeyModifierAlphaShift))("nativeModifierData", std::to_string(static_cast<uint64_t>(flags)))
    ("nativeDefaultHandled", static_cast<bool>(captured))("timestamp", press.timestamp * 1000);
  if (toolbarRoute) data["toolbarRoute"]=toolbarRoute.UTF8String;
  emitter->dispatchEvent("nativeOrdinaryEditorKey", std::move(data), RawEvent::Category::Discrete,
      HighResTimeStamp::fromDOMHighResTimeStamp(press.timestamp * 1000));
  if (toolbarRoute) CUIKeyboardToolbarDidEmit(press);
}
@end
