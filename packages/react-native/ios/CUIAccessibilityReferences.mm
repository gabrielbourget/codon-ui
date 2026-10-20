#import "CUIAccessibilityReferences.h"
#import <React/RCTViewComponentView.h>
#import <React/UIView+React.h>

static NSHashTable<UIView *> *CUIResolvingViews(void)
{
  NSMutableDictionary *storage = NSThread.currentThread.threadDictionary;
  NSHashTable *views = storage[@"com.codonui.accessibility.resolving"];
  if (!views) {
    views = [NSHashTable weakObjectsHashTable];
    storage[@"com.codonui.accessibility.resolving"] = views;
  }
  return views;
}

BOOL CUIAccessibilityIsResolving(UIView *source)
{
  return [CUIResolvingViews() containsObject:source];
}

static UIView *CUIFindAccessibilityTarget(UIView *root, NSString *nativeId, NSInteger tag)
{
  if (tag > 0 && root.tag == tag) return root;
  if (nativeId) {
    NSString *candidate = [root isKindOfClass:RCTViewComponentView.class] ? ((RCTViewComponentView *)root).nativeId : root.nativeID;
    if ([candidate isEqualToString:nativeId]) return root;
  }
  for (UIView *child in root.subviews) {
    UIView *found = CUIFindAccessibilityTarget(child, nativeId, tag);
    if (found) return found;
  }
  return nil;
}

static NSString *CUIReadAccessibilityText(UIView *view, BOOL bodyOnly)
{
  if (CUIAccessibilityIsResolving(view)) return nil;
  if (!bodyOnly && view.accessibilityLabel != nil) return view.accessibilityLabel;
  if ([view isKindOfClass:UILabel.class]) return ((UILabel *)view).text;
  if ([view isKindOfClass:UITextView.class]) return ((UITextView *)view).text;
  if ([view isKindOfClass:UITextField.class]) return ((UITextField *)view).text;
  NSMutableArray<NSString *> *children = [NSMutableArray array];
  for (UIView *child in view.subviews) {
    NSString *text = CUIReadAccessibilityText(child, bodyOnly);
    if (text != nil) [children addObject:text];
  }
  return children.count ? [children componentsJoinedByString:@" "] : view.accessibilityLabel;
}

static NSString *CUIResolveAccessibilityReferences(UIView *source, NSArray<NSString *> *ids, NSInteger tag, BOOL bodyOnly, NSString *ownLabel)
{
  if (!ids.count && tag <= 0) return nil;
  UIWindow *window = source.window;
  if (!window || CUIAccessibilityIsResolving(source)) return nil;
  NSHashTable *resolving = CUIResolvingViews();
  [resolving addObject:source];
  @try {
    NSMutableArray<NSString *> *values = [NSMutableArray array];
    for (NSString *nativeId in ids) {
      UIView *target = CUIFindAccessibilityTarget(window, nativeId, 0);
      if (!target || target.window != window) continue;
      if (target == source) {
        if (!bodyOnly && ownLabel != nil) [values addObject:ownLabel];
        continue;
      }
      NSString *text = CUIReadAccessibilityText(target, bodyOnly);
      if (text != nil) [values addObject:text];
    }
    if (tag > 0) {
      UIView *target = CUIFindAccessibilityTarget(window, nil, tag);
      if (target && target != source && target.window == window) {
        NSString *text = CUIReadAccessibilityText(target, bodyOnly);
        if (text != nil) [values addObject:text];
      }
    }
    return values.count ? [values componentsJoinedByString:@" "] : nil;
  } @finally {
    [resolving removeObject:source];
  }
}

NSString *CUIAccessibilityResolve(UIView *source, NSArray<NSString *> *ids, NSInteger tag, BOOL bodyOnly)
{
  return CUIResolveAccessibilityReferences(source, ids, tag, bodyOnly, nil);
}

NSString *CUIAccessibilityResolveLabel(UIView *source, NSArray<NSString *> *ids, NSString *ownLabel)
{
  return CUIResolveAccessibilityReferences(source, ids, 0, NO, ownLabel);
}
