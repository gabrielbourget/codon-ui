#import "CUIFormDocumentInspection.h"
#import "CUIFormMetadata.h"
#import "CUIFieldCustomContent.h"
#import "CUIInputWindow.h"
#import <React/RCTAssert.h>
#import <React/RCTTextInputComponentView.h>

static NSString *CUIFormViewIdentity(UIView *view)
{
  static NSMapTable<UIView *, NSString *> *identities;
  static NSUInteger sequence;
  if (!identities) identities = [NSMapTable weakToStrongObjectsMapTable];
  NSString *identity = [identities objectForKey:view];
  if (!identity) { identity = [NSString stringWithFormat:@"native-view:%lu", (unsigned long)++sequence]; [identities setObject:identity forKey:view]; }
  return identity;
}
static NSArray *CUIContentValues(UIView *editor)
{
  if (![editor respondsToSelector:@selector(accessibilityCustomContent)]) return @[];
  NSArray<AXCustomContent *> *content = [(id<AXCustomContentProvider>)editor accessibilityCustomContent];
  NSMutableArray *values = [NSMutableArray array];
  for (AXCustomContent *item in content) [values addObject:@{@"label":item.label, @"value":item.value, @"importance":@(item.importance)}];
  return values;
}
static UIView *CUIOriginalEditor(RCTSurfacePresenter *presenter, NSInteger target)
{
  UIView *component = [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:target];
  if (![component isKindOfClass:RCTTextInputComponentView.class]) return nil;
  NSObject *element = [(RCTViewComponentView *)component accessibilityElement];
  return [element isKindOfClass:UITextField.class] || [element isKindOfClass:UITextView.class] ? (UIView *)element : nil;
}
static NSDictionary *CUIEditorState(UIView *editor)
{
  id<UITextInput> input = (id<UITextInput>)editor;
  UITextRange *range = input.selectedTextRange;
  NSString *text = [editor isKindOfClass:UITextField.class] ? ((UITextField *)editor).text : ((UITextView *)editor).text;
  return @{@"text":text ?: @"", @"value":editor.accessibilityValue ?: NSNull.null,
    @"focused":@(editor.isFirstResponder), @"selection":range ? @[@([input offsetFromPosition:input.beginningOfDocument toPosition:range.start]), @([input offsetFromPosition:input.beginningOfDocument toPosition:range.end])] : @[],
    @"label":editor.accessibilityLabel ?: NSNull.null, @"hint":editor.accessibilityHint ?: NSNull.null, @"traits":@(editor.accessibilityTraits)};
}
NSDictionary *CUIInspectFormDocument(RCTSurfacePresenter *presenter, NSDictionary *document, BOOL probeCustomContent, NSNumber *controlTarget)
{
  RCTAssertMainQueue();
  NSMutableArray *fields = [NSMutableArray array];
  UIView *control = controlTarget ? CUIOriginalEditor(presenter, controlTarget.integerValue) : nil;
  BOOL controlInDocument = NO;
  if (controlTarget) for (NSDictionary *node in document[@"nodes"]) if ([node[@"target"] isEqual:controlTarget]) controlInDocument = YES;
  if (controlTarget && (!control || !controlInDocument)) @throw [NSException exceptionWithName:@"CUI.Form" reason:@"form-control-editor-unavailable" userInfo:nil];
  if (controlTarget) for (NSDictionary *field in document[@"fields"]) if ([field[@"target"] isEqual:controlTarget])
    @throw [NSException exceptionWithName:@"CUI.Form" reason:@"form-control-must-be-unbound" userInfo:nil];
  NSArray *controlBefore = control ? CUIContentValues(control) : nil;
  NSDictionary *controlState = control ? CUIEditorState(control) : nil;
  for (NSDictionary *field in document[@"fields"]) {
    NSInteger target = [field[@"target"] integerValue];
    UIView *component = [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:target];
    UIView *metadata = [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[field[@"metadataTarget"] integerValue]];
    UIView *editor = CUIOriginalEditor(presenter, target);
    BOOL resolved = editor && [metadata isKindOfClass:CUIFieldBinding.class];
    BOOL available = resolved && component.window && editor.window == component.window && metadata.window == component.window;
    NSMutableDictionary *record = [@{@"descriptorId":field[@"descriptorId"], @"target":field[@"target"], @"metadataTarget":field[@"metadataTarget"], @"available":@(available), @"resolved":@(resolved)} mutableCopy];
    if (resolved) {
      CUIFieldBinding *binding = (CUIFieldBinding *)metadata;
      BOOL current = [binding.ownerId isEqual:field[@"ownerId"]] && [binding.descriptorId isEqual:field[@"descriptorId"]] && [binding.descriptorRevision isEqual:field[@"descriptorRevision"]] && binding.originalTarget == target;
      record[@"currentDescriptor"] = @(current);
      record[@"metadataOnly"] = @(binding.isMetadataOnly);
      record[@"windowId"] = editor.window ? CUIInputWindowIdentity(editor.window) : @"";
      record[@"originalClass"] = NSStringFromClass(editor.class);
      record[@"originalInstance"] = CUIFormViewIdentity(component);
      record[@"editorInstance"] = CUIFormViewIdentity(editor);
      record[@"metadataInstance"] = CUIFormViewIdentity(metadata);
      record[@"state"] = CUIEditorState(editor);
      record[@"stateUnchanged"] = @YES;
      if (probeCustomContent && current && available && !binding.semanticBinding.length) {
        NSArray *before = CUIContentValues(editor);
        NSDictionary *stateBefore = CUIEditorState(editor);
        id delegate = [editor isKindOfClass:UITextField.class] ? ((UITextField *)editor).delegate : ((UITextView *)editor).delegate;
        CUIFieldCustomContentLease *lease = nil;
        @try {
          lease = CUIBindFieldCustomContent(editor, @[[AXCustomContent customContentWithLabel:@"Form prototype" value:@"Original editor metadata"]]);
          record[@"customContentBound"] = @(lease != nil);
          record[@"customContentDuring"] = CUIContentValues(editor);
          record[@"unregisteredControlUnchanged"] = @(!control || ([controlBefore isEqual:CUIContentValues(control)] && [controlState isEqual:CUIEditorState(control)]));
        } @finally { [lease retire]; }
        record[@"customContentBefore"] = before;
        record[@"customContentAfter"] = CUIContentValues(editor);
        record[@"stateUnchanged"] = @([stateBefore isEqual:CUIEditorState(editor)]);
        record[@"delegateUnchanged"] = @(delegate == ([editor isKindOfClass:UITextField.class] ? ((UITextField *)editor).delegate : ((UITextView *)editor).delegate));
        record[@"originalEditorUnchanged"] = @(editor == CUIOriginalEditor(presenter, target));
        record[@"unregisteredControlAfterUnchanged"] = @(!control || ([controlBefore isEqual:CUIContentValues(control)] && [controlState isEqual:CUIEditorState(control)]));
      } else if (probeCustomContent) record[@"probeSkipped"] = !current ? @"retired-descriptor" : binding.semanticBinding.length ? @"owned-semantic-config" : @"inactive-window";
      record[@"customContentCurrent"] = CUIContentValues(editor);
    }
    [fields addObject:record];
  }
  return @{@"platform":@"ios", @"fields":fields, @"controlTarget":controlTarget ?: NSNull.null, @"controlInstance":control ? CUIFormViewIdentity(control) : NSNull.null};
}
