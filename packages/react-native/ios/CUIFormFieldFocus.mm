#import "CUIFormFieldFocus.h"
#import "CUIFormMetadata.h"
#import "CUIOwnedDateField.h"
#import "CUIFocusView.h"
#import <React/RCTTextInputComponentView.h>
#import <React/RCTTextInputNativeCommands.h>

NSDictionary *CUIFocusFormField(RCTSurfacePresenter *presenter, NSDictionary *request, BOOL (^isCurrent)(void))
{
  NSDictionary *field = request[@"field"], *form = request[@"form"], *mount = request[@"mount"];
  CUIFormRoot *root = (id)[presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[form[@"metadataTarget"] integerValue]];
  CUIFieldBinding *metadata = (id)[presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[field[@"metadataTarget"] integerValue]];
  UIView *original = (id)[presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[field[@"target"] integerValue]];
  if (![root isKindOfClass:CUIFormRoot.class] || !root.isMetadataOnly || root.originalTarget != [form[@"target"] integerValue] ||
      ![root.ownerId isEqual:form[@"ownerId"]] || ![root.descriptorId isEqual:form[@"descriptorId"]] ||
      ![root.descriptorRevision isEqual:form[@"descriptorRevision"]] ||
      ![metadata isKindOfClass:CUIFieldBinding.class] ||
      [metadata originalForMountSnapshot:mount] != original || !isCurrent())
    @throw [NSException exceptionWithName:@"CUI.Form" reason:@"form-focus-original-editor-retired" userInfo:nil];
  if ([field[@"ownedEditorBinding"] length]) {
    NSString *binding = field[@"ownedEditorBinding"];
    CUIDateSegment *segment = CUIResolveOwnedDateField(metadata, binding, [field[@"target"] integerValue], [mount[@"surfaceId"] integerValue]);
    if (segment != original || ![metadata.ownedEditorBinding isEqual:binding])
      @throw [NSException exceptionWithName:@"CUI.Form" reason:@"form-focus-owned-segments-retired" userInfo:nil];
    NSDictionary *identity = [segment formSegmentIdentity];
    BOOL requested = [segment requestFormSegmentFocus:identity];
    BOOL current = requested && isCurrent() && [metadata originalForMountSnapshot:mount] == original &&
      CUIResolveOwnedDateField(metadata, binding, [field[@"target"] integerValue], [mount[@"surfaceId"] integerValue]) == original;
    return @{@"descriptorId":field[@"descriptorId"], @"descriptorRevision":field[@"descriptorRevision"],
      @"target":field[@"target"], @"mount":mount, @"requested":@(requested), @"current":@(current)};
  }
  NSDictionary *control = metadata.ownedControlBinding.length ?
    [NSJSONSerialization JSONObjectWithData:[metadata.ownedControlBinding dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil] : nil;
  if ([control isKindOfClass:NSDictionary.class] && [control count] == 2 && [control[@"kind"] isEqual:@"combo-box-trigger"]) {
    CUIFocusView *trigger = [original isKindOfClass:CUIFocusView.class] ? (CUIFocusView *)original : nil;
    NSString *owner = [trigger fieldInputOwnerId];
    if (!trigger || !owner.length || metadata.ownedEditorBinding.length ||
        ![metadata.ownedControlBinding isEqual:field[@"ownedControlBinding"]] || ![trigger canBecomeFirstResponder] ||
        ([(id)trigger.accessibilityElement accessibilityTraits] & UIAccessibilityTraitNotEnabled))
      @throw [NSException exceptionWithName:@"CUI.Form" reason:@"form-focus-owned-trigger-retired" userInfo:nil];
    BOOL current = NO;
    @try {
      [trigger requestKeyboardFocus:owner];
      current = isCurrent() && [metadata originalForMountSnapshot:mount] == trigger && [[trigger fieldInputOwnerId] isEqual:owner];
    } @catch (NSException *retired) { current = NO; }
    return @{@"descriptorId":field[@"descriptorId"], @"descriptorRevision":field[@"descriptorRevision"],
      @"target":field[@"target"], @"mount":mount, @"requested":@YES, @"current":@(current)};
  }
  if (![original isKindOfClass:RCTTextInputComponentView.class] || metadata.ownedEditorBinding.length)
    @throw [NSException exceptionWithName:@"CUI.Form" reason:@"form-focus-original-editor-retired" userInfo:nil];
  RCTTextInputComponentView *coreOriginal = (RCTTextInputComponentView *)original;
  UIView *editor = coreOriginal.accessibilityElement;
  if (![editor isKindOfClass:UITextField.class] && ![editor isKindOfClass:UITextView.class])
    @throw [NSException exceptionWithName:@"CUI.Form" reason:@"form-focus-backed-editor-unavailable" userInfo:nil];
  if (([editor isKindOfClass:UITextField.class] && ![(UITextField *)editor isEnabled]) ||
      (editor.accessibilityTraits & UIAccessibilityTraitNotEnabled))
    @throw [NSException exceptionWithName:@"CUI.Form" reason:@"form-focus-editor-disabled" userInfo:nil];
  BOOL current = NO;
  // This is RN's original command, including its caller-owned focus behavior.
  // No text/selection repair or replacement responder/delegate is installed.
  @try {
    [(id<RCTTextInputViewProtocol>)original focus];
    current = isCurrent() && [metadata originalForMountSnapshot:mount] == original && coreOriginal.accessibilityElement == editor;
  }
  @catch (NSException *retired) { current = NO; }
  return @{@"descriptorId":field[@"descriptorId"], @"descriptorRevision":field[@"descriptorRevision"],
    @"target":field[@"target"], @"mount":mount, @"requested":@YES, @"current":@(current)};
}
