#import "CUIDialogFocusScopes.h"
#import "CUIInputWindow.h"
#import "CUIVirtualDragFocus.h"
#import "CUIKeyboardScope.h"
#import "CUIFocusView.h"

@interface CUIDialogTarget : NSObject
@property(nonatomic, copy) NSString *identity;
@property(nonatomic, assign) NSInteger tag;
@property(nonatomic, weak) UIView *view;
@property(nonatomic, assign) BOOL resolved;
@property(nonatomic, assign) BOOL allowed;
@property(nonatomic, assign) BOOL processed;
@property(nonatomic, copy) NSString *failure;
@end
@implementation CUIDialogTarget
@end

@interface CUIDialogBinding : NSObject
@property(nonatomic, copy) NSString *identity;
@property(nonatomic, copy) NSString *parent;
@property(nonatomic, copy) NSString *lease;
@property(nonatomic, strong) CUIDialogTarget *root;
@property(nonatomic, copy) NSArray<CUIDialogTarget *> *members;
@property(nonatomic, copy) NSArray<CUIDialogTarget *> *entries;
@property(nonatomic, assign) BOOL enabled;
@property(nonatomic, assign) BOOL entryAllowed;
@property(nonatomic, assign) BOOL entered;
@property(nonatomic, assign) NSInteger activationOrder;
@property(nonatomic, copy) NSString *failure;
@property(nonatomic, weak) UIView *last;
@end
@implementation CUIDialogBinding
@end

static UIView *CUIDialogFindTag(UIView *root, NSInteger tag) {
  if (root.tag == tag) return root;
  for (UIView *child in root.subviews) { UIView *found=CUIDialogFindTag(child, tag); if (found) return found; }
  return nil;
}
static BOOL CUIDialogVisible(UIView *view) {
  if (!view.window) return NO;
  for (UIView *ancestor=view; ancestor; ancestor=ancestor.superview) if (ancestor.hidden) return NO;
  return YES;
}

@implementation CUIDialogFocusScopes {
  __weak UIView *_owner;
  BOOL (^_ready)(void);
  NSDictionary *(^_session)(void);
  void (^_emit)(NSString *, NSDictionary *);
  NSArray<CUIDialogBinding *> *_bindings;
  double _revision;
  BOOL _moving;
  BOOL _pendingUpdate;
  BOOL _refreshQueued;
  NSString *_published;
  CADisplayLink *_display;
  NSArray *_observers;
}
- (instancetype)initWithOwner:(UIView *)owner ready:(BOOL (^)(void))ready
                      session:(NSDictionary *(^)(void))session emit:(void (^)(NSString *, NSDictionary *))emit {
  if (self=[super init]) { _owner=owner; _ready=[ready copy]; _session=[session copy]; _emit=[emit copy]; _bindings=@[]; }
  return self;
}
- (UIView *)resolve:(CUIDialogTarget *)target {
  if (!target || !_owner.window) return nil;
  UIView *current=CUIDialogFindTag(_owner.window, target.tag);
  if (!target.resolved && current) { target.resolved=YES; target.view=current; }
  return target.view && target.view == current && current.window == _owner.window ? current : nil;
}
- (CUIDialogTarget *)target:(NSDictionary *)data previous:(NSArray<CUIDialogTarget *> *)previous {
  NSString *identity=data[@"id"]; NSInteger tag=[data[@"targetTag"] integerValue];
  CUIDialogTarget *result=nil;
  for (CUIDialogTarget *old in previous) if ([old.identity isEqual:identity] && old.tag == tag) { result=old; break; }
  if (!result) { result=[CUIDialogTarget new]; result.identity=identity; result.tag=tag; result.failure=@""; }
  result.allowed=[data[@"allowed"] boolValue]; return result;
}
- (void)update:(NSArray<NSDictionary *> *)bindings revision:(double)revision {
  NSMutableArray *next=[NSMutableArray new];
  for (NSDictionary *data in bindings) {
    CUIDialogBinding *binding=nil;
    for (CUIDialogBinding *old in _bindings) if ([old.identity isEqual:data[@"id"]] && [old.lease isEqual:data[@"bindingId"]] && old.root.tag == [data[@"targetTag"] integerValue]) { binding=old; break; }
    if (!binding) {
      binding=[CUIDialogBinding new]; binding.identity=data[@"id"]; binding.lease=data[@"bindingId"];
      binding.root=[self target:@{@"id":binding.lease, @"targetTag":data[@"targetTag"]} previous:@[]];
    }
    binding.parent=data[@"parentId"];
    if ([data[@"enabled"] boolValue] && (!binding.enabled || !binding.activationOrder)) binding.activationOrder=CUINextInputPolicyOrder(_owner.window);
    binding.enabled=[data[@"enabled"] boolValue]; binding.entryAllowed=[data[@"entryAllowed"] boolValue];
    NSMutableArray *members=[NSMutableArray new], *entries=[NSMutableArray new];
    for (NSDictionary *member in data[@"memberTargets"]) [members addObject:[self target:member previous:binding.members ?: @[]]];
    for (NSDictionary *entry in data[@"entryTargets"]) [entries addObject:[self target:entry previous:binding.entries ?: @[]]];
    binding.members=members; binding.entries=entries; [next addObject:binding];
  }
  _bindings=next; _revision=revision;
  if (!_bindings.count) [self stop];
  _pendingUpdate=YES;
  __weak CUIDialogFocusScopes *weak=self;
  dispatch_async(dispatch_get_main_queue(), ^{ CUIDialogFocusScopes *owner=weak; if (owner && owner->_revision == revision) { owner->_pendingUpdate=NO; [owner refresh]; } });
}
- (NSInteger)depth:(CUIDialogBinding *)binding {
  NSMutableSet *seen=[NSMutableSet setWithObject:binding.identity]; NSInteger depth=0; NSString *parent=binding.parent;
  while (parent.length) {
    if ([seen containsObject:parent]) return -1;
    [seen addObject:parent]; CUIDialogBinding *found=nil;
    for (CUIDialogBinding *candidate in _bindings) if ([candidate.identity isEqual:parent]) { found=candidate; break; }
    if (!found) return -1;
    parent=found.parent; depth++;
  }
  return depth;
}
- (CUIDialogBinding *)localActive {
  if (!_owner.window || !_ready()) return nil;
  CUIDialogBinding *result=nil; NSInteger deepest=-1;
  for (CUIDialogBinding *binding in _bindings) {
    NSInteger depth=[self depth:binding]; UIView *root=[self resolve:binding.root];
    if (binding.enabled && depth >= 0 && depth >= deepest && CUIDialogVisible(root)) { result=binding; deepest=depth; }
  }
  return result;
}
- (CUIDialogBinding *)active {
  if (CUIActiveVirtualDragFocus(_owner.window)) return nil;
  CUIDialogBinding *binding=[self localActive]; if (!binding) return nil;
  UIView *root=[self resolve:binding.root];
  for (UIView *scope in CUIInputScopes(_owner.window)) {
    if (scope == _owner || ![scope isKindOfClass:CUIKeyboardScope.class]) continue;
    CUIDialogFocusScopes *other=[(CUIKeyboardScope *)scope dialogFocusScopes]; CUIDialogBinding *candidate=[other localActive];
    if (!candidate) continue;
    BOOL containsOther=[self inside:binding view:[other resolve:candidate.root]], otherContains=[other inside:candidate view:root];
    if ((containsOther && !otherContains) || (containsOther == otherContains && candidate.activationOrder > binding.activationOrder)) return nil;
  }
  return binding;
}
- (BOOL)inside:(CUIDialogBinding *)binding view:(UIView *)view {
  if (!view) return NO;
  UIView *root=[self resolve:binding.root];
  if (root && [view isDescendantOfView:root]) return YES;
  for (CUIDialogTarget *member in binding.members) { UIView *target=[self resolve:member]; if (target && [view isDescendantOfView:target]) return YES; }
  return NO;
}
- (BOOL)eligible:(CUIDialogBinding *)binding view:(UIView *)view {
  return view && CUIDialogVisible(view) && view.window == _owner.window &&
      (view.canBecomeFirstResponder || view.canBecomeFocused) && [self inside:binding view:view];
}
- (void)collect:(UIView *)view binding:(CUIDialogBinding *)binding seen:(NSHashTable<UIView *> *)seen into:(NSMutableArray<UIView *> *)items {
  if (!CUIDialogVisible(view) || [seen containsObject:view]) return;
  [seen addObject:view];
  if (view.canBecomeFocused && ![self isDialogRoot:view] && [self eligible:binding view:view]) [items addObject:view];
  for (UIView *child in view.subviews) [self collect:child binding:binding seen:seen into:items];
}
- (NSArray<UIView *> *)candidates:(CUIDialogBinding *)binding {
  NSMutableArray *result=[NSMutableArray new]; NSHashTable *seen=NSHashTable.weakObjectsHashTable;
  [self collect:[self resolve:binding.root] binding:binding seen:seen into:result];
  for (CUIDialogTarget *member in binding.members) [self collect:[self resolve:member] binding:binding seen:seen into:result];
  return result;
}
- (UIView *)fallback:(CUIDialogBinding *)binding {
  if ([self eligible:binding view:binding.last]) return binding.last;
  for (CUIDialogTarget *entry in binding.entries.reverseObjectEnumerator) {
    UIView *view=[self resolve:entry]; if ([self eligible:binding view:view]) return view;
  }
  return [self resolve:binding.root];
}
- (void)status:(BOOL)ready error:(NSString *)error {
  NSDictionary *session=_session(); NSString *signature=[NSString stringWithFormat:@"%@:%g:%d:%@",session,_revision,ready,error];
  if ([_published isEqual:signature]) return;
  _published=signature; NSMutableDictionary *data=[session mutableCopy];
  data[@"revision"]=@(_revision); data[@"ready"]=@(ready); data[@"error"]=error; _emit(@"status",data);
}
- (void)action:(CUIDialogBinding *)binding target:(UIView *)target phase:(NSString *)phase {
  while (target && target.tag <= 0) target=target.superview;
  if (!target) return;
  NSMutableDictionary *data=[_session() mutableCopy]; data[@"revision"]=@(_revision); data[@"id"]=binding.identity;
  data[@"bindingId"]=binding.lease; data[@"phase"]=phase; data[@"target"]=@(target.tag); _emit(@"action",data);
}
- (BOOL)focus:(CUIDialogBinding *)binding target:(UIView *)target phase:(NSString *)phase {
  if (_moving || [self active] != binding || ![self eligible:binding view:target]) return NO;
  if (CUIInputFocusedView(_owner.window) == target) return YES;
  _moving=YES;
  @try {
    if ([target isKindOfClass:CUIFocusView.class]) [(CUIFocusView *)target requestKeyboardFocus:[(CUIFocusView *)target fieldInputOwnerId]];
    else {
      if (target.canBecomeFirstResponder) [target becomeFirstResponder];
      UIFocusSystem *system=[UIFocusSystem focusSystemForEnvironment:target]; [system requestFocusUpdateToEnvironment:target]; [system updateFocusIfNeeded];
    }
    if (!(target.isFirstResponder || target.isFocused) || [self active] != binding || ![self inside:binding view:target]) return NO;
    binding.entered=YES; binding.last=target; [self action:binding target:target phase:phase]; return YES;
  } @finally { _moving=NO; }
}
- (void)start {
  if (_display || !_bindings.count || !_ready()) return;
  _display=[CADisplayLink displayLinkWithTarget:self selector:@selector(tick:)]; [_display addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
  __weak CUIDialogFocusScopes *weak=self; NSMutableArray *tokens=[NSMutableArray new];
  for (NSNotificationName name in @[CUIInputFocusChangedNotification, UITextFieldTextDidBeginEditingNotification, UITextViewTextDidBeginEditingNotification])
    [tokens addObject:[NSNotificationCenter.defaultCenter addObserverForName:name object:nil queue:nil usingBlock:^(NSNotification *note) { [weak scheduleRefresh]; }]];
  _observers=tokens;
}
- (void)stop {
  [_display invalidate]; _display=nil;
  for (id token in _observers) [NSNotificationCenter.defaultCenter removeObserver:token];
  _observers=nil; _published=nil;
}
- (void)scheduleRefresh {
  if (_refreshQueued) return;
  _refreshQueued=YES;
  __weak CUIDialogFocusScopes *weak=self;
  dispatch_async(dispatch_get_main_queue(), ^{ CUIDialogFocusScopes *owner=weak; if (owner) { owner->_refreshQueued=NO; [owner refresh]; } });
}
- (void)tick:(CADisplayLink *)link { [self refresh]; }
- (void)refresh {
  if (_moving || _pendingUpdate) return;
  if (!_owner || !_bindings.count || !_ready()) { [self stop]; return; }
  [self start]; CUIDialogBinding *binding=[self active];
  if (!binding) { [self status:NO error:@""]; return; }
  if (binding.failure.length) { [self status:NO error:binding.failure]; return; }
  UIView *focused=CUIInputFocusedView(_owner.window), *root=[self resolve:binding.root];
  for (CUIDialogTarget *entry in binding.entries) {
    if (entry.failure.length) { [self status:NO error:entry.failure]; return; }
    if (entry.processed) continue;
    UIView *target=[self resolve:entry]; if (!target) { [self status:NO error:@""]; return; }
    if (!CUIDialogVisible(target)) { entry.processed=YES; continue; }
    if (!entry.allowed) { if ([self inside:binding view:focused]) entry.processed=YES; continue; }
    if ([focused isDescendantOfView:target]) { entry.processed=YES; continue; }
    entry.processed=YES;
    if (![self focus:binding target:target phase:@"entered"]) { if ([self active] == binding) { entry.failure=@"original-dialog-root-not-focusable"; [self status:NO error:entry.failure]; } return; }
    focused=CUIInputFocusedView(_owner.window);
  }
  if ([self inside:binding view:focused]) { binding.entered=YES; if ([self eligible:binding view:focused]) binding.last=focused; [self status:YES error:@""]; return; }
  if (binding.entered) {
    NSArray *items=[self candidates:binding]; UIView *target=[self eligible:binding view:binding.last] ? binding.last : items.firstObject ?: [self fallback:binding];
    if (![self focus:binding target:target phase:@"restored"] && [self active] == binding) { binding.failure=@"original-dialog-focus-recovery-refused"; [self status:NO error:binding.failure]; return; }
  } else if (binding.entryAllowed && ![self focus:binding target:root phase:@"entered"] && [self active] == binding) { binding.failure=@"original-dialog-root-not-focusable"; [self status:NO error:binding.failure]; return; }
  [self status:YES error:@""];
}
- (BOOL)isDialogRoot:(UIView *)view {
  if (!_ready()) return NO;
  for (CUIDialogBinding *binding in _bindings) if (binding.enabled) {
    if ([self resolve:binding.root] == view) return YES;
    for (CUIDialogTarget *entry in binding.entries) if ([self resolve:entry] == view) return YES;
  }
  return NO;
}
- (UIView *)wrapped:(CUIDialogBinding *)binding focused:(UIView *)focused forward:(BOOL)forward {
  NSArray<UIView *> *items=[self candidates:binding];
  if (!items.count) return focused;
  if ([self isDialogRoot:focused] || focused == (forward ? items.lastObject : items.firstObject)) return forward ? items.firstObject : items.lastObject;
  return nil;
}
- (BOOL)handlePress:(UIPress *)press {
  UIKey *key=press.key;
  if (!key || key.keyCode != UIKeyboardHIDUsageKeyboardTab || (key.modifierFlags & (UIKeyModifierAlternate|UIKeyModifierControl|UIKeyModifierCommand))) return NO;
  CUIDialogBinding *binding=[self active]; UIView *focused=CUIInputFocusedView(_owner.window);
  if (!binding || ![self inside:binding view:focused] || ([focused conformsToProtocol:@protocol(UITextInput)] && ((id<UITextInput>)focused).markedTextRange)) return NO;
  UIView *wrapped=[self wrapped:binding focused:focused forward:!(key.modifierFlags & UIKeyModifierShift)];
  return wrapped && (wrapped == focused || [self focus:binding target:wrapped phase:@"wrapped"]);
}
- (BOOL)shouldAllowFocusUpdate:(UIFocusUpdateContext *)context {
  BOOL forward=(context.focusHeading & UIFocusHeadingNext) != 0, backward=(context.focusHeading & UIFocusHeadingPrevious) != 0;
  CUIDialogBinding *binding=[self active]; UIView *previous=context.previouslyFocusedView, *next=context.nextFocusedView;
  if ((!forward && !backward) || !binding || ![self inside:binding view:previous] || ([self inside:binding view:next] && ![self isDialogRoot:next])) return YES;
  NSArray *items=[self candidates:binding]; UIView *target=forward ? items.firstObject : items.lastObject;
  target=target ?: ([self eligible:binding view:previous] ? previous : [self fallback:binding]);
  __weak CUIDialogFocusScopes *weak=self; __weak UIView *destination=target; double revision=_revision;
  dispatch_async(dispatch_get_main_queue(), ^{ CUIDialogFocusScopes *owner=weak; if (owner && owner->_revision == revision && [owner active] == binding) [owner focus:binding target:destination phase:@"wrapped"]; });
  return NO;
}
- (void)invalidate { [self stop]; _bindings=@[]; _revision++; _pendingUpdate=NO; }
- (void)dealloc { [self stop]; }
@end

BOOL CUIIsDialogFocusRoot(UIView *view) {
  for (UIView *scope in CUIInputScopes(view.window)) if ([scope isKindOfClass:CUIKeyboardScope.class] && [[(CUIKeyboardScope *)scope dialogFocusScopes] isDialogRoot:view]) return YES;
  return NO;
}
BOOL CUIHandleDialogFocusPress(UIView *receiver, UIPress *press) {
  if (!receiver.window || press.window != receiver.window || press.phase == UIPressPhaseCancelled) return NO;
  for (UIView *scope in [CUIInputScopes(receiver.window) reverseObjectEnumerator]) if ([scope isKindOfClass:CUIKeyboardScope.class] && [[(CUIKeyboardScope *)scope dialogFocusScopes] handlePress:press]) return YES;
  return NO;
}
