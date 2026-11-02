#import "CUIFieldSemantics.h"
#import "CUIFieldCustomContent.h"
#import <React/RCTAssert.h>
#import <React/RCTConversions.h>
#include <react/renderer/components/view/ViewProps.h>

using namespace facebook::react;

static NSString *CUIFieldOwnerString(const std::string &value)
{
  return value.empty() ? nil : [NSString stringWithUTF8String:value.c_str()];
}

@interface CUIFieldSemanticsLease : NSObject <CUIFieldSemanticContribution>
- (BOOL)isRetired;
- (BOOL)isCurrent;
- (instancetype)initWithCore:(RCTViewComponentView *)core editor:(UIView *)editor plan:(NSDictionary *)plan
    label:(NSString *)label description:(NSString *)description errors:(NSString *)errors details:(NSString *)details
    isCurrent:(BOOL (^)(void))isCurrent;
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
    isCurrent:(BOOL (^)(void))isCurrent
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
  for (NSString *key in @[@"required", @"readOnly", @"disabled"]) if ([plan[key] boolValue]) add(labels[key], labels[@"yes"]);
  if ([plan[@"invalid"] boolValue]) add(labels[@"invalid"], errors.length ? errors : labels[@"yes"]);
  if (details.length) add(labels[@"details"], details);
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
  if (label.length) {
    _labelApplied = YES;
    _appliedLabel = _baseLabel.length ? [_baseLabel stringByAppendingFormat:@", %@", label] : [label copy];
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
    RCTViewComponentView *core = _core.accessibilityElement == editor ? _core : nil;
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
      if (segment.tag != first.integerValue && ![plan[@"invalid"] boolValue]) {
        NSMutableDictionary *text = [plan[@"text"] mutableCopy]; text[@"description"] = @""; part[@"text"] = text;
      }
      part[@"readOnly"] = @([segment fieldSegmentReadOnly]);
      CUIFieldSemanticsLease *lease = [[CUIFieldSemanticsLease alloc] initWithCore:segment editor:segment plan:part
        label:part[@"text"][@"label"]
        description:part[@"text"][@"description"]
        errors:part[@"text"][@"errorMessage"]
        details:part[@"text"][@"details"] isCurrent:isCurrent];
      if (!lease) @throw [NSException exceptionWithName:@"CUI.Field" reason:@"date-semantic-content-unavailable" userInfo:nil];
      [leases addObject:lease];
    }
    if (!isCurrent()) @throw [NSException exceptionWithName:@"CUI.Field" reason:@"date-semantic-original-retired" userInfo:nil];
    group.leases = leases; return group;
  } @catch (NSException *retired) {
    for (id<CUIFieldSemanticContribution> lease in leases) [lease retire];
    return nil;
  }
}
