#import "CUIFieldGroupDocument.h"
#import "CUIDateSegment.h"
#import "CUIInputWindow.h"
#import "CUIFocusView.h"
#import <React/RCTAssert.h>
#import <React/RCTTextInputComponentView.h>

static void CUIGroupFail(NSString *reason)
{
  @throw [NSException exceptionWithName:@"CUI.FieldGroup" reason:reason userInfo:nil];
}
static BOOL CUIGroupVisible(UIView *view, UIWindow *window)
{
  if (!view || view.window != window) return NO;
  for (UIView *current = view; current; current = current.superview)
    if (current.hidden || current.alpha <= 0 || !current.userInteractionEnabled) return NO;
  return YES;
}
// Explicit membership only. Native ancestry supplies ordering and eligibility;
// no descendant is enrolled because it happens to be focusable.
NSDictionary *CUIReadFocusParticipants(RCTSurfacePresenter *presenter, NSDictionary *request)
{
  RCTAssertMainQueue();
  NSNumber *rootTag = request[@"rootTarget"];
  UIView *root = [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:rootTag.integerValue];
  UIWindow *window = root.window;
  if (!root || !window.isKeyWindow || !CUIGroupVisible(root, window)) CUIGroupFail(@"focus-participant-root-retired");
  UIView *focused = CUIInputFocusedView(window);
  UIView *scope = nil;
  NSNumber *focusedTarget = @0;
  for (UIView *view = focused; view && view != window; view = view.superview)
    if (view.tag > 0 && [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:view.tag] == view) { focusedTarget = @(view.tag); break; }
  if (request[@"scopeTarget"]) {
    scope = [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[request[@"scopeTarget"] integerValue]];
    if (!scope || scope.window != window || (scope != root && ![scope isDescendantOfView:root])) CUIGroupFail(@"focus-participant-input-retired");
  } else for (NSNumber *tag in request[@"inputRoots"]) {
    UIView *input = [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:tag.integerValue];
    if (!input || input.window != window || ![input isDescendantOfView:root]) CUIGroupFail(@"focus-participant-input-retired");
    if (focused == input || [focused isDescendantOfView:input]) {
      if (scope) CUIGroupFail(@"focus-participant-input-ambiguous");
      scope = input;
    }
  }
  NSMutableDictionary<NSNumber *, NSDictionary *> *members = [NSMutableDictionary new];
  for (NSNumber *tag in request[@"targets"]) {
    if (tag.integerValue <= 0 || members[tag]) CUIGroupFail(@"focus-participant-target-invalid");
    UIView *component = [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:tag.integerValue];
    if (!component || component == root || ![component isDescendantOfView:root] || component.window != window)
      CUIGroupFail(@"focus-participant-outside-root");
    UIView *editor = component;
    BOOL tabStop = YES;
    if ([component isKindOfClass:RCTTextInputComponentView.class]) {
      editor = [(RCTTextInputComponentView *)component accessibilityElement];
      if (![editor isKindOfClass:UITextField.class] && ![editor isKindOfClass:UITextView.class]) CUIGroupFail(@"focus-participant-editor-unavailable");
    } else if ([component isKindOfClass:CUIFocusView.class]) tabStop = [(CUIFocusView *)component fieldFocusTabStop];
    else if (![component isKindOfClass:CUIDateSegment.class]) CUIGroupFail(@"focus-participant-control-unsupported");
    BOOL eligible = (!scope || component == scope || [component isDescendantOfView:scope]) && CUIGroupVisible(editor, window) && [editor canBecomeFirstResponder] &&
      !(editor.accessibilityTraits & UIAccessibilityTraitNotEnabled) &&
      (![editor isKindOfClass:UIControl.class] || [(UIControl *)editor isEnabled]);
    members[tag] = @{@"target":tag, @"eligible":@(eligible), @"tabStop":@(tabStop),
      @"x":@([editor convertRect:editor.bounds toView:window].origin.x)};
  }
  NSMutableArray *rows = [NSMutableArray new];
  NSNumber *pressTag = request[@"pressTarget"];
  UIView *hit = pressTag ? [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:pressTag.integerValue] : nil;
  if (pressTag && hit != root && ![hit isDescendantOfView:root]) CUIGroupFail(@"focus-participant-press-retired");
  BOOL focusedMember = NO;
  for (UIView *view = focused; view && view != root; view = view.superview) if (members[@(view.tag)]) focusedMember = YES;
  BOOL independent = !focusedMember && hit && hit != root && !members[@(hit.tag)] && focused &&
    (focused == hit || [focused isDescendantOfView:hit]);
  for (UIView *view = hit; view && view != root; view = view.superview) {
    UIView *editor = [view isKindOfClass:RCTTextInputComponentView.class] ? [(RCTTextInputComponentView *)view accessibilityElement] : view;
    if ([editor canBecomeFirstResponder] && !members[@(view.tag)]) independent = YES;
  }
  __block NSNumber *before = nil;
  __block BOOL foundHit = NO;
  __block void (^walk)(UIView *);
  walk = ^(UIView *view) {
    if (view == hit) foundHit = YES;
    NSDictionary *row = members[@(view.tag)];
    if (row) {
      [rows addObject:row];
      if (!foundHit && [row[@"eligible"] boolValue] && [row[@"tabStop"] boolValue]) before = row[@"target"];
    }
    for (UIView *child in view.subviews) walk(child);
  };
  walk(root); walk = nil;
  if (rows.count != members.count || (pressTag && !foundHit)) CUIGroupFail(@"focus-participant-order-retired");
  return @{@"rootTarget":rootTag, @"windowId":CUIInputWindowIdentity(window), @"focusedTarget":focusedTarget, @"rows":rows, @"before":before ?: NSNull.null, @"pressIndependent":@(independent)};
}
