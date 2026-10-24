#import "CUIFieldGroupDocument.h"
#import "CUIFormMetadata.h"
#import "CUIOwnedDateField.h"
#import "CUIInputWindow.h"
#import "CUIFocusView.h"
#import <React/RCTAssert.h>
#import <React/RCTTextInputComponentView.h>
#include <cmath>

static void CUIGroupFail(NSString *reason)
{
  @throw [NSException exceptionWithName:@"CUI.FieldGroup" reason:reason userInfo:nil];
}
static NSString *CUIGroupInstance(UIView *view)
{
  static NSMapTable<UIView *, NSString *> *identities;
  static NSUInteger sequence;
  if (!identities) identities = [NSMapTable weakToStrongObjectsMapTable];
  NSString *identity = [identities objectForKey:view];
  if (!identity) { identity = [NSString stringWithFormat:@"field-group-view:%lu", (unsigned long)++sequence]; [identities setObject:identity forKey:view]; }
  return identity;
}
static BOOL CUIGroupVisible(UIView *view, UIWindow *window)
{
  if (!view || view.window != window) return NO;
  for (UIView *current = view; current; current = current.superview)
    if (current.hidden || current.alpha <= 0 || !current.userInteractionEnabled) return NO;
  return YES;
}
BOOL CUIFieldGroupOriginalMatches(RCTSurfacePresenter *presenter, NSDictionary *row, UIView *component, UIView *editor)
{
  RCTAssertMainQueue();
  return component && editor && component == [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[row[@"target"] integerValue]] &&
    [CUIGroupInstance(component) isEqual:row[@"nativeInstance"]] && [CUIGroupInstance(editor) isEqual:row[@"editorInstance"]] &&
    (![component isKindOfClass:RCTTextInputComponentView.class] || [(RCTTextInputComponentView *)component accessibilityElement] == editor);
}
NSDictionary *CUIReadFieldGroupDocument(RCTSurfacePresenter *presenter, NSDictionary *document)
{
  RCTAssertMainQueue();
  NSDictionary *plan = document[@"fieldGroup"], *field = plan[@"field"], *mount = plan[@"mount"];
  UIView *(^resolve)(NSNumber *) = ^UIView *(NSNumber *target) {
    return [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:target.integerValue];
  };
  CUIFieldBinding *metadata = (id)resolve(field[@"metadataTarget"]);
  UIView *primary = resolve(field[@"target"]), *outer = resolve(plan[@"outerTarget"]), *input = resolve(plan[@"inputTarget"]);
  NSString *binding = field[@"ownedEditorBinding"];
  if (![metadata isKindOfClass:CUIFieldBinding.class] || ![outer isKindOfClass:RCTViewComponentView.class] ||
      ![input isKindOfClass:RCTViewComponentView.class] || outer == input || ![input isDescendantOfView:outer] ||
      ![metadata isDescendantOfView:outer] || [metadata originalForMountSnapshot:mount] != primary ||
      ![metadata.ownedEditorBinding isEqual:binding] || !outer.window.isKeyWindow ||
      !CUIGroupVisible(outer, outer.window) || !CUIGroupVisible(input, outer.window) ||
      ![CUIInputWindowIdentity(outer.window) isEqual:mount[@"windowId"]]) CUIGroupFail(@"field-group-original-roots-retired");
  NSArray<CUIDateSegment *> *segments = CUIResolveOwnedDateFieldSegments(metadata, binding, primary.tag, [document[@"surfaceId"] integerValue]);
  if (!segments.count) CUIGroupFail(@"field-group-whole-segment-set-retired");
  for (CUIDateSegment *segment in segments) if (![segment isDescendantOfView:input]) CUIGroupFail(@"field-group-original-input-retired");
  NSMutableDictionary *visibleTargets = [NSMutableDictionary new];
  for (NSDictionary *node in plan[@"nodes"]) visibleTargets[node[@"target"]] = node[@"visible"];
  NSMutableArray *nestedOwners = [NSMutableArray new];
  for (NSDictionary *candidate in document[@"fields"]) {
    if ([candidate[@"metadataTarget"] isEqual:field[@"metadataTarget"]] || ![candidate[@"ownedEditorBinding"] length]) continue;
    NSString *nestedBinding = candidate[@"ownedEditorBinding"];
    NSDictionary *owned = [NSJSONSerialization JSONObjectWithData:[nestedBinding dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    if (![visibleTargets[owned[@"rootTarget"]] boolValue]) continue;
    CUIFieldBinding *nested = (id)resolve(candidate[@"metadataTarget"]);
    UIView *nestedPrimary = resolve(candidate[@"target"]);
    if (![nested isKindOfClass:CUIFieldBinding.class] || ![nested.ownerId isEqual:candidate[@"ownerId"]] ||
        ![nested.descriptorId isEqual:candidate[@"descriptorId"]] || ![nested.descriptorRevision isEqual:candidate[@"descriptorRevision"]] ||
        ![nested.ownedEditorBinding isEqual:nestedBinding]) CUIGroupFail(@"field-group-nested-descriptor-retired");
    NSDictionary *nestedMount = [nested formMountSnapshot];
    NSArray *nestedSegments = CUIResolveOwnedDateFieldSegments(nested, nestedBinding, nestedPrimary.tag, [document[@"surfaceId"] integerValue]);
    if ([nested originalForMountSnapshot:nestedMount] != nestedPrimary || !nestedSegments.count)
      CUIGroupFail(@"field-group-nested-whole-segment-set-retired");
    [nestedOwners addObject:@{@"metadata":nested, @"primary":nestedPrimary, @"mount":nestedMount,
      @"binding":nestedBinding, @"segments":nestedSegments}];
  }
  NSMutableArray *originals = [NSMutableArray new], *components = [NSMutableArray new], *backedOriginals = [NSMutableArray new];
  NSMutableArray *instances = [NSMutableArray new];
  NSMutableArray<NSNumber *> *targets = [NSMutableArray new];
  NSMutableDictionary<NSNumber *, NSNumber *> *parents = [NSMutableDictionary new];
  for (NSDictionary *node in plan[@"nodes"]) parents[node[@"target"]] = node[@"parent"];
  [instances addObject:@{@"target":plan[@"outerTarget"], @"nativeTarget":plan[@"outerTarget"], @"nativeInstance":CUIGroupInstance(outer), @"editorInstance":CUIGroupInstance(outer)}];
  NSNumber *focused = @0;
  for (NSDictionary *node in plan[@"nodes"]) {
    if (![node[@"visible"] boolValue]) continue;
    UIView *component = resolve(node[@"target"]);
    NSString *name = node[@"component"];
    const BOOL core = [name isEqual:@"TextInput"] || [name isEqual:@"AndroidTextInput"];
    NSDictionary *policy = node[@"fieldFocus"];
    if (!component) {
      if (core || [policy[@"candidate"] boolValue]) CUIGroupFail(@"field-group-original-unavailable");
      NSNumber *ancestor = node[@"parent"]; UIView *backed = nil;
      NSMutableSet<NSNumber *> *visited = [NSMutableSet new];
      while (ancestor.integerValue > 0 && ![visited containsObject:ancestor]) {
        [visited addObject:ancestor];
        backed = [ancestor isEqual:plan[@"outerTarget"]] ? outer : resolve(ancestor);
        if (backed) break;
        ancestor = parents[ancestor];
      }
      if (!backed || backed.window != outer.window || ![backed isDescendantOfView:outer]) CUIGroupFail(@"field-group-hit-backing-unavailable");
      UIView *backedEditor = backed;
      if ([backed isKindOfClass:RCTTextInputComponentView.class]) {
        id element = [(RCTTextInputComponentView *)backed accessibilityElement];
        if (![element isKindOfClass:UIView.class]) CUIGroupFail(@"field-group-hit-editor-unavailable");
        backedEditor = element;
      }
      [instances addObject:@{@"target":node[@"target"], @"nativeTarget":@(backed.tag), @"nativeInstance":CUIGroupInstance(backed), @"editorInstance":CUIGroupInstance(backedEditor)}];
      [components addObject:backed]; [backedOriginals addObject:backedEditor]; [targets addObject:@(backed.tag)];
      continue;
    }
    if (component.window != outer.window || ![component isDescendantOfView:outer])
      CUIGroupFail(@"field-group-original-window-or-containment-retired");
    UIView *original = component;
    NSString *hostOwner = [component isKindOfClass:CUIDateSegment.class] ? [(CUIDateSegment *)component fieldOwnerId] :
      [component isKindOfClass:CUIFocusView.class] ? [(CUIFocusView *)component fieldInputOwnerId] : nil;
    if (policy[@"ownerId"] && ![policy[@"ownerId"] isEqual:hostOwner]) CUIGroupFail(@"field-group-original-host-owner-retired");
    if (core) {
      if (![component isKindOfClass:RCTTextInputComponentView.class]) CUIGroupFail(@"field-group-original-editor-class-retired");
      id element = [(RCTTextInputComponentView *)component accessibilityElement];
      if (![element isKindOfClass:UITextField.class] && ![element isKindOfClass:UITextView.class]) CUIGroupFail(@"field-group-backed-editor-unavailable");
      original = (UIView *)element;
    }
    [instances addObject:@{@"target":node[@"target"], @"nativeTarget":node[@"target"], @"nativeInstance":CUIGroupInstance(component), @"editorInstance":CUIGroupInstance(original)}];
    [components addObject:component]; [backedOriginals addObject:original]; [targets addObject:node[@"target"]];
    BOOL visible = [node[@"visible"] boolValue] && CUIGroupVisible(original, outer.window);
    BOOL enabled = !(original.accessibilityTraits & UIAccessibilityTraitNotEnabled) &&
      (![original isKindOfClass:UIControl.class] || [(UIControl *)original isEnabled]);
    BOOL eligible = visible && enabled && [original canBecomeFirstResponder] && (!policy || [policy[@"focusable"] boolValue]);
    if (!eligible && !original.isFirstResponder) continue;
    if (original.isFirstResponder) {
      if (focused.integerValue) CUIGroupFail(@"field-group-focused-original-ambiguous");
      focused = node[@"target"];
    }
    CGRect rectangle = [original convertRect:original.bounds toView:outer.window];
    if (!std::isfinite(rectangle.origin.x) || !std::isfinite(rectangle.origin.y) ||
        !std::isfinite(rectangle.size.width) || !std::isfinite(rectangle.size.height) ||
        rectangle.size.width < 0 || rectangle.size.height < 0) CUIGroupFail(@"field-group-original-geometry-invalid");
    BOOL readOnly = policy ? [policy[@"readOnly"] boolValue] :
      [original isKindOfClass:UITextView.class] ? ![(UITextView *)original isEditable] : NO;
    NSMutableDictionary *row = [@{@"target":node[@"target"], @"nativeInstance":CUIGroupInstance(component),
      @"editorInstance":CUIGroupInstance(original), @"focused":@(original.isFirstResponder), @"eligible":@(eligible),
      @"tabStop":policy ? policy[@"tabStop"] : @YES, @"readOnly":@(readOnly),
      @"placeholder":policy ? policy[@"placeholder"] : @NO, @"groups":node[@"groups"],
      @"rect":@{@"x":@(rectangle.origin.x), @"y":@(rectangle.origin.y), @"width":@(rectangle.size.width), @"height":@(rectangle.size.height)}} mutableCopy];
    if (hostOwner) row[@"hostOwnerId"] = hostOwner;
    if ([original isKindOfClass:CUIDateSegment.class]) row[@"segment"] = [(CUIDateSegment *)original formSegmentIdentity] ?: NSNull.null;
    [originals addObject:row];
  }
  // Read callbacks/getters may invalidate ownership. Recheck the actual objects,
  // complete native set and mount before returning any snapshot.
  if (resolve(plan[@"outerTarget"]) != outer || resolve(plan[@"inputTarget"]) != input ||
      resolve(field[@"metadataTarget"]) != metadata || [metadata originalForMountSnapshot:mount] != primary ||
      ![metadata.ownedEditorBinding isEqual:binding] ||
      ![segments isEqual:CUIResolveOwnedDateFieldSegments(metadata, binding, primary.tag, [document[@"surfaceId"] integerValue])])
    CUIGroupFail(@"field-group-originals-retired-during-read");
  for (NSUInteger index = 0; index < targets.count; index++) {
    UIView *component = resolve(targets[index]);
    if (component != components[index] || component.window != outer.window ||
        ([component isKindOfClass:RCTTextInputComponentView.class] && [(RCTTextInputComponentView *)component accessibilityElement] != backedOriginals[index]))
      CUIGroupFail(@"field-group-original-retired-during-read");
  }
  for (NSDictionary *owner in nestedOwners) {
    CUIFieldBinding *nested = owner[@"metadata"]; UIView *nestedPrimary = owner[@"primary"];
    if (resolve(@(nested.tag)) != nested || [nested originalForMountSnapshot:owner[@"mount"]] != nestedPrimary ||
        ![nested.ownedEditorBinding isEqual:owner[@"binding"]] ||
        ![owner[@"segments"] isEqual:CUIResolveOwnedDateFieldSegments(nested, owner[@"binding"], nestedPrimary.tag, [document[@"surfaceId"] integerValue])])
      CUIGroupFail(@"field-group-nested-originals-retired-during-read");
  }
  return @{@"documentId":document[@"documentId"], @"revision":document[@"revision"], @"surfaceId":document[@"surfaceId"],
    @"windowId":mount[@"windowId"], @"outerTarget":plan[@"outerTarget"], @"inputTarget":plan[@"inputTarget"],
    @"outerInstance":CUIGroupInstance(outer), @"inputInstance":CUIGroupInstance(input),
    @"field":field, @"mount":mount, @"focusedTarget":focused, @"originals":originals, @"instances":instances};
}
