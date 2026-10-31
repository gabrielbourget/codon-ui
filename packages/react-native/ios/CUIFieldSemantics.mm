#import "CUIFieldSemantics.h"
#import "CUIFieldCustomContent.h"
#import <React/RCTAssert.h>
#import <React/RCTConversions.h>
#include <react/renderer/components/view/ViewProps.h>

using namespace facebook::react;

static NSString *CUIFieldUnaugmentedLabel(UIView *view, BOOL *registered);
static NSString *CUIFieldText(UIView *view)
{
  BOOL registered = NO;
  NSString *label = CUIFieldUnaugmentedLabel(view, &registered);
  if (!registered) label = view.accessibilityLabel;
  if (label) return label;
  if ([view isKindOfClass:UILabel.class]) return ((UILabel *)view).text ?: @"";
  if ([view isKindOfClass:UITextView.class] || [view isKindOfClass:UITextField.class]) return @"";
  NSMutableArray *parts = [NSMutableArray new];
  for (UIView *child in view.subviews) { NSString *text = CUIFieldText(child); if (text.length) [parts addObject:text]; }
  return [parts componentsJoinedByString:@" "];
}
static NSString *CUIFieldReferencedText(RCTSurfacePresenter *presenter, NSArray *targets)
{
  NSMutableArray *parts = [NSMutableArray new];
  for (NSNumber *target in targets) {
    UIView *view = [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:target.integerValue];
    if (!view) @throw [NSException exceptionWithName:@"CUI.Field" reason:@"field-semantic-reference-not-materialized" userInfo:nil];
    [parts addObject:CUIFieldText(view)];
  }
  return [parts componentsJoinedByString:@" "];
}
static NSString *CUIFieldOwnerString(const std::string &value)
{
  return value.empty() ? nil : [NSString stringWithUTF8String:value.c_str()];
}

@interface CUIFieldSemanticsLease : NSObject <CUIFieldSemanticContribution>
- (NSString *)ownerLabel;
- (BOOL)isRetired;
- (BOOL)isCurrent;
- (instancetype)initWithCore:(RCTViewComponentView *)core editor:(UIView *)editor plan:(NSDictionary *)plan
    label:(NSString *)label description:(NSString *)description errors:(NSString *)errors details:(NSString *)details
    controls:(NSString *)controls isCurrent:(BOOL (^)(void))isCurrent;
@end

static NSMapTable<UIView *, CUIFieldSemanticsLease *> *CUIFieldSemanticLeases;

@implementation CUIFieldSemanticsLease {
  __weak RCTViewComponentView *_core;
  __weak UIView *_editor;
  std::string _ownerLabel, _ownerHint;
  NSString *_baseLabel, *_baseHint, *_appliedLabel, *_appliedHint;
  UIAccessibilityTraits _addedTraits;
  NSArray<AXCustomContent *> *_content;
  CUIFieldCustomContentLease *_customContent;
  BOOL (^_isCurrent)(void);
  BOOL _labelApplied, _hintApplied, _retired;
}
- (instancetype)initWithCore:(RCTViewComponentView *)core editor:(UIView *)editor plan:(NSDictionary *)plan
    label:(NSString *)label description:(NSString *)description errors:(NSString *)errors details:(NSString *)details
    controls:(NSString *)controls isCurrent:(BOOL (^)(void))isCurrent
{
  if (!(self = [super init])) return nil;
  if (!CUIFieldSemanticLeases) CUIFieldSemanticLeases = [NSMapTable weakToWeakObjectsMapTable];
  [[CUIFieldSemanticLeases objectForKey:editor] retire];
  _core = core; _editor = editor; _isCurrent = [isCurrent copy];
  const auto ownerProps = std::static_pointer_cast<const ViewProps>(core.props);
  _ownerLabel = ownerProps->accessibilityLabel; _ownerHint = ownerProps->accessibilityHint;
  _baseLabel = [editor.accessibilityLabel copy]; _baseHint = [editor.accessibilityHint copy];
  NSDictionary *labels = plan[@"labels"];
  NSMutableArray<AXCustomContent *> *content = [NSMutableArray new];
  const auto add = [&](NSString *caption, NSString *value) { [content addObject:[AXCustomContent customContentWithLabel:caption value:value]]; };
  const BOOL dateField = plan[@"dateField"] != nil;
  if (!dateField) {
    add(labels[@"role"], [plan[@"expanded"] boolValue] ? labels[@"expanded"] : labels[@"collapsed"]);
    add(labels[@"autocomplete"], labels[@"list"]);
  }
  for (NSString *key in @[@"required", @"readOnly", @"disabled"]) if ([plan[key] boolValue]) add(labels[key], labels[@"yes"]);
  if ([plan[@"invalid"] boolValue]) add(labels[@"invalid"], errors.length ? errors : labels[@"yes"]);
  if (details.length) add(labels[@"details"], details);
  if ([plan[@"controls"] count]) add(labels[@"options"], controls.length ? controls : labels[@"options"]);
  _content = [content copy];
  __weak CUIFieldSemanticsLease *weakSelf = self;
  _customContent = CUIBindLiveFieldCustomContent(editor, ^{
    CUIFieldSemanticsLease *lease = weakSelf; return lease ? lease->_content : nil;
  }, ^{
    CUIFieldSemanticsLease *lease = weakSelf;
    return lease && !lease->_retired && lease->_isCurrent && lease->_isCurrent();
  });
  if (!_customContent) return nil;
  [CUIFieldSemanticLeases setObject:self forKey:editor];
  if ([plan[@"labelledBy"] count]) {
    _labelApplied = YES;
    _appliedLabel = dateField && _baseLabel.length ? [_baseLabel stringByAppendingFormat:@", %@", label] : [label copy];
    editor.accessibilityLabel = _appliedLabel;
  }
  NSMutableArray *hints = [NSMutableArray new];
  if (_baseHint.length) [hints addObject:_baseHint];
  if (description.length) [hints addObject:description];
  if ([plan[@"invalid"] boolValue] && errors.length) [hints addObject:errors];
  if (description.length || ([plan[@"invalid"] boolValue] && errors.length)) {
    _hintApplied = YES; _appliedHint = [hints componentsJoinedByString:@" "]; editor.accessibilityHint = _appliedHint;
  }
  _addedTraits = [plan[@"disabled"] boolValue] ? UIAccessibilityTraitNotEnabled & ~editor.accessibilityTraits : 0;
  if (_addedTraits) editor.accessibilityTraits |= _addedTraits;
  return self;
}
- (void)retire
{
  if (_retired) return;
  _retired = YES;
  UIView *editor = _editor;
  CUIFieldSemanticsLease *current = editor ? [CUIFieldSemanticLeases objectForKey:editor] : nil;
  if (editor && (!current || current == self)) {
    RCTViewComponentView *core = nil;
    for (UIView *view = editor.superview; view && !core; view = view.superview)
      if ([view isKindOfClass:RCTTextInputComponentView.class]) core = (id)view;
    if (!core && _core.accessibilityElement == editor) core = _core;
    const auto props = core ? std::static_pointer_cast<const ViewProps>(core.props) : nullptr;
    NSString *label = props && props->accessibilityLabel != _ownerLabel ? CUIFieldOwnerString(props->accessibilityLabel) : _baseLabel;
    NSString *hint = props && props->accessibilityHint != _ownerHint ? CUIFieldOwnerString(props->accessibilityHint) : _baseHint;
    if (_labelApplied && [editor.accessibilityLabel isEqual:_appliedLabel]) editor.accessibilityLabel = label;
    if (_hintApplied && [editor.accessibilityHint isEqual:_appliedHint]) editor.accessibilityHint = hint;
    if (_addedTraits) {
      UIAccessibilityTraits ownerTraits = props ? RCTUIAccessibilityTraitsFromAccessibilityTraits(props->accessibilityTraits) : 0;
      if (props && props->accessibilityState.value_or(AccessibilityState{}).disabled) ownerTraits |= UIAccessibilityTraitNotEnabled;
      editor.accessibilityTraits = (editor.accessibilityTraits & ~_addedTraits) | (ownerTraits & _addedTraits);
    }
    [CUIFieldSemanticLeases removeObjectForKey:editor];
  }
  [_customContent retire]; _customContent = nil; _content = nil; _isCurrent = nil;
}
- (NSString *)ownerLabel
{
  RCTViewComponentView *core = _core;
  if (core && core.accessibilityElement == _editor) {
    const auto props = std::static_pointer_cast<const ViewProps>(core.props);
    if (props->accessibilityLabel != _ownerLabel) return CUIFieldOwnerString(props->accessibilityLabel);
  }
  return _baseLabel;
}
- (void)dealloc { [self retire]; }
- (BOOL)isRetired { return _retired; }
- (BOOL)isCurrent { return !_retired && _isCurrent && _isCurrent(); }
@end

NSString *CUIReadOwnedDateFieldText(UIView *editor, NSString *base, BOOL hint)
{
  CUIFieldSemanticsLease *lease = [CUIFieldSemanticLeases objectForKey:editor];
  if (!lease || lease.isRetired) return base;
  @try { if (lease.isCurrent) return base; } @catch (NSException *retired) {}
  [lease retire];
  return hint ? editor.accessibilityHint : editor.accessibilityLabel;
}

static NSString *CUIFieldUnaugmentedLabel(UIView *view, BOOL *registered)
{
  id accessible = [view isKindOfClass:RCTTextInputComponentView.class] ? ((RCTTextInputComponentView *)view).accessibilityElement : view;
  UIView *editor = [accessible isKindOfClass:UIView.class] ? (UIView *)accessible : nil;
  CUIFieldSemanticsLease *lease = [CUIFieldSemanticLeases objectForKey:editor];
  *registered = lease != nil;
  return lease ? [lease ownerLabel] : nil;
}

id<CUIFieldSemanticContribution> CUIBindFieldSemantics(RCTSurfacePresenter *presenter, RCTTextInputComponentView *core,
    NSDictionary *plan, BOOL (^isCurrent)(void))
{
  RCTAssertMainQueue();
  if (!core || !plan || !isCurrent || !isCurrent()) return nil;
  id accessible = core.accessibilityElement;
  UIView *editor = [accessible isKindOfClass:UIView.class] ? (UIView *)accessible : nil;
  if (![editor isKindOfClass:UITextField.class] && ![editor isKindOfClass:UITextView.class]) return nil;
  NSString *label = CUIFieldReferencedText(presenter, plan[@"labelledBy"]);
  NSString *description = CUIFieldReferencedText(presenter, plan[@"describedBy"]);
  NSString *errors = CUIFieldReferencedText(presenter, plan[@"errorMessageBy"]);
  NSString *details = CUIFieldReferencedText(presenter, plan[@"detailsBy"]);
  NSString *controls = CUIFieldReferencedText(presenter, plan[@"controls"]);
  if (!isCurrent() || core.accessibilityElement != editor) return nil;
  return [[CUIFieldSemanticsLease alloc] initWithCore:core editor:editor plan:plan label:label description:description
    errors:errors details:details controls:controls isCurrent:isCurrent];
}

@interface CUIDateSemanticGroup : NSObject <CUIFieldSemanticContribution>
@property(nonatomic, copy) NSArray<id<CUIFieldSemanticContribution>> *leases;
@end
@implementation CUIDateSemanticGroup
- (void)retire { for (id<CUIFieldSemanticContribution> lease in _leases) [lease retire]; _leases = nil; }
- (void)dealloc { [self retire]; }
@end

id<CUIFieldSemanticContribution> CUIBindDateFieldSemantics(RCTSurfacePresenter *presenter,
    NSArray<CUIDateSegment *> *segments, NSDictionary *plan, BOOL (^isCurrent)(void))
{
  RCTAssertMainQueue();
  NSNumber *first = plan[@"dateField"][@"firstEditableTarget"];
  if (!segments.count || !first || !isCurrent || !isCurrent()) return nil;
  BOOL found = NO;
  for (CUIDateSegment *segment in segments) if (segment.tag == first.integerValue) found = YES;
  if (!found) return nil;
  CUIDateSemanticGroup *group = [CUIDateSemanticGroup new];
  NSMutableArray *leases = [NSMutableArray new];
  @try {
    for (CUIDateSegment *segment in segments) {
      if (segment.accessibilityElement != segment || !isCurrent()) @throw [NSException exceptionWithName:@"CUI.Field" reason:@"date-semantic-editor-retired" userInfo:nil];
      NSMutableDictionary *part = [plan mutableCopy];
      if (segment.tag != first.integerValue && ![plan[@"invalid"] boolValue]) part[@"describedBy"] = @[];
      part[@"readOnly"] = @([segment fieldSegmentReadOnly]);
      CUIFieldSemanticsLease *lease = [[CUIFieldSemanticsLease alloc] initWithCore:segment editor:segment plan:part
        label:CUIFieldReferencedText(presenter, part[@"labelledBy"])
        description:CUIFieldReferencedText(presenter, part[@"describedBy"])
        errors:CUIFieldReferencedText(presenter, part[@"errorMessageBy"])
        details:CUIFieldReferencedText(presenter, part[@"detailsBy"]) controls:@"" isCurrent:isCurrent];
      if (!lease) @throw [NSException exceptionWithName:@"CUI.Field" reason:@"date-semantic-content-unavailable" userInfo:nil];
      [leases addObject:lease];
    }
    if (!isCurrent()) @throw [NSException exceptionWithName:@"CUI.Field" reason:@"date-semantic-document-retired" userInfo:nil];
    group.leases = leases; return group;
  } @catch (NSException *retired) {
    for (id<CUIFieldSemanticContribution> lease in leases) [lease retire];
    return nil;
  }
}
