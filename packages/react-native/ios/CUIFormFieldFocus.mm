#import "CUIFormFieldFocus.h"
#import "CUIFormMetadata.h"
#import "CUIOwnedDateField.h"
#import <React/RCTTextInputComponentView.h>
#import <React/RCTTextInputNativeCommands.h>

static BOOL CUIFormContainsDescriptor(NSArray *descriptors, NSDictionary *expected)
{
  for (NSDictionary *descriptor in descriptors) if ([descriptor isEqual:expected]) return YES;
  return NO;
}

static BOOL CUIFieldBelongsToForm(NSDictionary *document, NSDictionary *field, NSDictionary *form)
{
  if ([field[@"hasFormAssociation"] boolValue]) {
    NSUInteger matches = 0;
    for (NSDictionary *candidate in document[@"forms"]) if ([candidate[@"formId"] isEqual:field[@"formId"]]) matches++;
    return [field[@"formId"] length] && matches == 1 && [field[@"formId"] isEqual:form[@"formId"]];
  }
  NSMutableDictionary *parents = [NSMutableDictionary new];
  for (NSDictionary *node in document[@"nodes"]) parents[node[@"target"]] = node[@"parent"];
  NSNumber *ancestor = field[@"metadataTarget"];
  while (ancestor.integerValue) {
    for (NSDictionary *candidate in document[@"forms"])
      if ([candidate[@"target"] isEqual:ancestor]) return [candidate isEqual:form];
    ancestor = parents[ancestor];
  }
  return NO;
}

NSDictionary *CUIFocusFormField(RCTSurfacePresenter *presenter, NSDictionary *document, NSDictionary *request, BOOL (^isCurrent)(void))
{
  NSDictionary *field = request[@"field"], *form = request[@"form"], *mount = request[@"mount"];
  if (![field isKindOfClass:NSDictionary.class] || ![form isKindOfClass:NSDictionary.class] || ![mount isKindOfClass:NSDictionary.class] ||
      ![request[@"documentId"] isEqual:document[@"documentId"]] || ![request[@"revision"] isEqual:document[@"revision"]] ||
      !CUIFormContainsDescriptor(document[@"fields"], field) || !CUIFormContainsDescriptor(document[@"forms"], form) ||
      !CUIFieldBelongsToForm(document, field, form))
    @throw [NSException exceptionWithName:@"CUI.Form" reason:@"form-focus-document-retired" userInfo:nil];
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
    CUIDateSegment *segment = CUIResolveOwnedDateField(metadata, binding, [field[@"target"] integerValue], [document[@"surfaceId"] integerValue]);
    if (segment != original || ![metadata.ownedEditorBinding isEqual:binding])
      @throw [NSException exceptionWithName:@"CUI.Form" reason:@"form-focus-owned-segments-retired" userInfo:nil];
    NSDictionary *identity = [segment formSegmentIdentity];
    BOOL requested = [segment requestFormSegmentFocus:identity];
    BOOL current = requested && isCurrent() && [metadata originalForMountSnapshot:mount] == original &&
      CUIResolveOwnedDateField(metadata, binding, [field[@"target"] integerValue], [document[@"surfaceId"] integerValue]) == original;
    return @{@"descriptorId":field[@"descriptorId"], @"descriptorRevision":field[@"descriptorRevision"],
      @"target":field[@"target"], @"mount":mount, @"requested":@(requested), @"current":@(current)};
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
