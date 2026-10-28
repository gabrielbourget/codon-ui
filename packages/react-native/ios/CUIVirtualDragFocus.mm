#import "CUIVirtualDragFocus.h"
#import "CUIDragAction.h"
#import "CUIKeyboardScope.h"
#import "CUIInputWindow.h"
#import "CUIFocusView.h"
#import "CUIVirtualDragAccessibility.h"

@interface CUIVirtualFocusTarget : NSObject
@property(nonatomic, copy) NSString *identity;
@property(nonatomic, assign) NSInteger tag;
@property(nonatomic, assign) BOOL descendants, resolved;
@property(nonatomic, weak) UIView *view;
@end
@implementation CUIVirtualFocusTarget
@end

@implementation CUIVirtualDragFocus {
  __weak CUIKeyboardScope *_scope;
  NSDictionary *_manifest, *_binding;
  NSArray<CUIVirtualFocusTarget *> *_targets;
  CUIVirtualFocusTarget *_source, *_selected;
  CADisplayLink *_display;
  NSArray *_observers;
  __weak UIView *_lastObserved;
  NSString *_lastObservedIdentity;
  NSString *_accessibilityError;
  BOOL _moving, _failed, _queued;
  double _appliedSelection;
}
- (instancetype)initWithScope:(CUIKeyboardScope *)scope { if (self=[super init]) { _scope=scope; _targets=@[]; CUIInstallVirtualDragAccessibilityProjection(); } return self; }
- (BOOL)active {
  NSDictionary *session=_scope.dragActivationSession;
  return !_failed && _manifest && _scope.dragCaptureReady && _scope.window.isKeyWindow && UIApplication.sharedApplication.applicationState==UIApplicationStateActive &&
    [_manifest[@"windowId"] isEqual:session[@"windowId"]] && [_manifest[@"epoch"] isEqual:session[@"epoch"]];
}
- (UIView *)resolve:(CUIVirtualFocusTarget *)target {
  if (!target) return nil;
  UIView *current=CUIResolveDragView(_binding[@"moduleId"], target.tag);
  if (!target.resolved && current) { target.resolved=YES; target.view=current; }
  return target.view && target.view==current && current.window==_scope.window ? current : nil;
}
- (void)emit:(NSString *)kind target:(CUIVirtualFocusTarget *)target error:(NSString *)error {
  NSDictionary *session=_scope.dragActivationSession; if (!_binding || !session) return;
  NSMutableDictionary *data=[@{ @"moduleId":_binding[@"moduleId"], @"bindingId":_binding[@"bindingId"], @"revision":_binding[@"revision"], @"rootTarget":_binding[@"rootTarget"] } mutableCopy];
  data[@"kind"]=kind; data[@"ownerId"]=session[@"scopeOwnerId"] ?: @""; data[@"windowId"]=session[@"windowId"] ?: @"";
  data[@"epoch"]=session[@"epoch"] ?: @0; data[@"sessionId"]=_manifest[@"sessionId"] ?: @"";
  data[@"focusRevision"]=_manifest[@"revision"] ?: @0; data[@"target"]=@(target ? target.tag : 0);
  data[@"ready"]=@NO; data[@"error"]=error ?: @""; [_scope emitDragStatus:data];
}
- (void)fail:(NSString *)error { if (_failed) return; [self emit:@"binding" target:nil error:error]; _failed=YES; [self stop]; }
- (void)update:(NSDictionary *)manifest binding:(NSDictionary *)binding {
  if (!manifest || manifest==(id)kCFNull) { [self invalidate]; return; }
  if ([_manifest isEqual:manifest] && [_binding isEqual:binding]) { [self refresh]; return; }
  NSArray *previous=_targets; NSMutableArray *targets=[NSMutableArray new]; NSMutableSet *ids=[NSMutableSet new], *tags=[NSMutableSet new];
  @try {
    if (![manifest isKindOfClass:NSDictionary.class] || ![manifest[@"sessionId"] isKindOfClass:NSString.class] || ![manifest[@"sessionId"] length] ||
        ![manifest[@"targets"] isKindOfClass:NSArray.class] || [manifest[@"revision"] doubleValue]<1) @throw @"native-virtual-focus-owner-invalid";
    for (NSDictionary *record in manifest[@"targets"]) {
      NSString *identity=record[@"id"]; NSNumber *tag=record[@"tag"];
      if (![identity isKindOfClass:NSString.class] || !identity.length || ![tag isKindOfClass:NSNumber.class] || tag.integerValue<=0 || [ids containsObject:identity] || [tags containsObject:tag]) @throw @"native-virtual-focus-target-invalid";
      [ids addObject:identity]; [tags addObject:tag]; CUIVirtualFocusTarget *target=nil;
      for (CUIVirtualFocusTarget *old in previous) if ([old.identity isEqual:identity] && old.tag==tag.integerValue) { target=old; break; }
      if (!target) { target=[CUIVirtualFocusTarget new]; target.identity=identity; target.tag=tag.integerValue; }
      target.descendants=[record[@"descendants"] boolValue]; [targets addObject:target];
    }
    CUIVirtualFocusTarget *source=nil, *selected=nil;
    for (CUIVirtualFocusTarget *target in targets) {
      if ([target.identity isEqual:manifest[@"source"][@"id"]] && target.tag==[manifest[@"source"][@"tag"] integerValue]) source=target;
      if ([manifest[@"selected"] isKindOfClass:NSDictionary.class] && [target.identity isEqual:manifest[@"selected"][@"id"]] && target.tag==[manifest[@"selected"][@"tag"] integerValue]) selected=target;
    }
    BOOL member=NO;
    for (NSDictionary *item in binding[@"members"]) if (![item[@"role"] isEqual:@"target"] &&
      ([item[@"targetTag"] integerValue]==source.tag || [item[@"handleTag"] integerValue]==source.tag)) member=YES;
    if (!source || !member) @throw @"native-virtual-focus-source-not-original";
    BOOL sameSession=[_manifest[@"sessionId"] isEqual:manifest[@"sessionId"]];
    _manifest=[manifest copy]; _binding=[binding copy]; _targets=targets; _source=source; _selected=selected;
    if (!sameSession) { _failed=NO; _lastObserved=nil; _lastObservedIdentity=nil; _appliedSelection=0; _accessibilityError=nil; }
    [self refresh];
  } @catch (id error) { _manifest=[manifest copy]; _binding=[binding copy]; [self fail:[error isKindOfClass:NSString.class] ? error : @"native-virtual-focus-manifest-invalid"]; }
}
- (CUIVirtualFocusTarget *)matching:(UIView *)view {
  if (!view) return nil;
  CUIVirtualFocusTarget *found=nil;
  for (CUIVirtualFocusTarget *target in _targets) { UIView *original=[self resolve:target];
    if (original==view) return target;
    if (target.descendants && original && [view isDescendantOfView:original] && (!found || [original isDescendantOfView:[self resolve:found]])) found=target;
  }
  return found;
}
- (RCTAccessibilityProjectionMode)accessibilityModeForView:(UIView *)view {
  if (![self active] || view.window!=_scope.window) return RCTAccessibilityProjectionOriginal;
  if (_accessibilityError) return RCTAccessibilityProjectionExcluded;
  if ([self matching:view]) return RCTAccessibilityProjectionAllowed;
  for (CUIVirtualFocusTarget *target in _targets) {
    UIView *original=[self resolve:target];
    if (original && [original isDescendantOfView:view]) return RCTAccessibilityProjectionTraverse;
  }
  return RCTAccessibilityProjectionExcluded;
}
- (void)rejectAccessibilityProjection:(NSString *)error {
  // A native getter never calls JavaScript or mutates authored props. Publish on the owned frame.
  if (!_accessibilityError) _accessibilityError=[error copy];
  [self schedule];
}
- (BOOL)allowsInteractionWithView:(UIView *)view {
  if (![self active]) return YES;
  return view && [self matching:view];
}
- (BOOL)focus:(CUIVirtualFocusTarget *)target {
  UIView *view=[self resolve:target]; if (!view || view.hidden || !view.window || ![self active]) return NO;
  for (UIView *parent=view; parent; parent=parent.superview) if (parent.hidden) return NO;
  UIView *before=CUIInputFocusedView(_scope.window);
  if (before==view || (target.descendants && [before isDescendantOfView:view])) return YES;
  if ([view isKindOfClass:CUIFocusView.class]) [(CUIFocusView *)view requestKeyboardFocus:[(CUIFocusView *)view fieldInputOwnerId]];
  else { NSDictionary *intent=_manifest; if (view.canBecomeFirstResponder) [view becomeFirstResponder];
    if (_manifest!=intent || ![self active] || [self resolve:target]!=view) return NO;
    UIFocusSystem *system=[UIFocusSystem focusSystemForEnvironment:view]; [system requestFocusUpdateToEnvironment:view]; [system updateFocusIfNeeded]; }
  UIView *focused=CUIInputFocusedView(_scope.window);
  return focused==view || (target.descendants && [focused isDescendantOfView:view]);
}
- (void)refresh {
  if (_moving) return;
  NSDictionary *intent=_manifest;
  if (![self active]) { [self stop]; return; }
  if (_accessibilityError) { [self fail:_accessibilityError]; return; }
  UIView *source=[self resolve:_source], *selected=[self resolve:_selected];
  if (!source || (_selected && !selected)) {
    if ((!source && _source.resolved) || (_selected && !selected && _selected.resolved)) [self fail:@"native-virtual-focus-original-target-retired"];
    return;
  }
  for (CUIVirtualFocusTarget *target in _targets) {
    UIView *view=[self resolve:target];
    if (view && !CUIValidateVirtualDragAccessibilityView(view)) { [self fail:@"native-virtual-accessibility-opaque-source-unregistered"]; return; }
  }
  if (!_display) {
    _display=[CADisplayLink displayLinkWithTarget:self selector:@selector(tick:)]; [_display addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
    __weak CUIVirtualDragFocus *weak=self; NSMutableArray *observers=[NSMutableArray new];
    for (NSNotificationName name in @[CUIInputFocusChangedNotification, UITextFieldTextDidBeginEditingNotification, UITextViewTextDidBeginEditingNotification])
      [observers addObject:[NSNotificationCenter.defaultCenter addObserverForName:name object:nil queue:nil usingBlock:^(NSNotification *note) { [weak schedule]; }]];
    _observers=observers;
  }
  if ([_manifest[@"nativeSelection"] boolValue] && _selected && _appliedSelection != [_manifest[@"revision"] doubleValue]) {
    _appliedSelection=[_manifest[@"revision"] doubleValue]; _moving=YES; BOOL accepted=NO;
    @try { accepted=[self focus:_selected]; } @finally { _moving=NO; }
    if (_manifest!=intent || ![self active]) return;
    if (!accepted) { [self fail:@"native-virtual-focus-original-selection-refused"]; return; }
  }
  UIView *focused=CUIInputFocusedView(_scope.window); CUIVirtualFocusTarget *target=[self matching:focused];
  if (!target) {
    _moving=YES; BOOL accepted=NO;
    @try { accepted=[self focus:_selected ?: _source]; } @finally { _moving=NO; }
    if (_manifest!=intent || ![self active]) return;
    if (!accepted) { [self fail:@"native-virtual-focus-recovery-refused"]; return; }
    focused=CUIInputFocusedView(_scope.window); target=[self matching:focused];
  }
  if (target && (focused!=_lastObserved || ![_lastObservedIdentity isEqual:target.identity])) {
    _lastObserved=focused; _lastObservedIdentity=target.identity; [self emit:@"virtualFocus" target:target error:@""];
  }
}
- (BOOL)allowsFocus:(UIFocusUpdateContext *)context {
  if (![self active]) return YES;
  if (!context.nextFocusedView) { if (!context.nextFocusedItem) return YES; [self schedule]; return NO; }
  if (context.nextFocusedView.window!=_scope.window || [self matching:context.nextFocusedView]) return YES;
  [self schedule]; return NO;
}
- (void)schedule { if (_queued) return; _queued=YES; __weak CUIVirtualDragFocus *weak=self; dispatch_async(dispatch_get_main_queue(), ^{ CUIVirtualDragFocus *owner=weak; if (owner) { owner->_queued=NO; [owner refresh]; } }); }
- (void)tick:(CADisplayLink *)link { [self refresh]; }
- (void)stop { [_display invalidate]; _display=nil; for (id observer in _observers) [NSNotificationCenter.defaultCenter removeObserver:observer]; _observers=nil; }
- (void)invalidate { [self stop]; _manifest=nil; _binding=nil; _targets=@[]; _source=nil; _selected=nil; _lastObserved=nil; _lastObservedIdentity=nil; _failed=NO; _appliedSelection=0; _accessibilityError=nil; }
- (void)dealloc { [self stop]; }
@end

CUIVirtualDragFocus *CUIActiveVirtualDragFocus(UIWindow *window) {
  CUIVirtualDragFocus *found=nil;
  for (UIView *scope in CUIInputScopes(window)) if ([scope isKindOfClass:CUIKeyboardScope.class]) {
    CUIVirtualDragFocus *candidate=[(CUIKeyboardScope *)scope virtualDragFocus];
    if ([candidate active]) { if (found && found!=candidate) { [found fail:@"native-virtual-focus-owners-ambiguous"]; [candidate fail:@"native-virtual-focus-owners-ambiguous"]; return nil; } found=candidate; }
  }
  return found;
}
