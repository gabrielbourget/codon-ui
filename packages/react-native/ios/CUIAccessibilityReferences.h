#import <UIKit/UIKit.h>

BOOL CUIAccessibilityIsResolving(UIView *source);
NSString *CUIAccessibilityResolve(UIView *source, NSArray<NSString *> *ids, NSInteger tag, BOOL bodyOnly);
NSString *CUIAccessibilityResolveLabel(UIView *source, NSArray<NSString *> *ids, NSString *ownLabel);
