#import <Accessibility/Accessibility.h>
#import <UIKit/UIKit.h>

// The lease augments only the original registered RN editor. Its intrinsic
// accessibility value, editing delegates and keyboard focus remain owned by RN.
@interface CUIFieldCustomContentLease : NSObject
- (void)retire;
@end

CUIFieldCustomContentLease *CUIBindFieldCustomContent(
    UIView *editor, NSArray<AXCustomContent *> *content);
