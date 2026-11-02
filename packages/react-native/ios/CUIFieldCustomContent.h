#import <Accessibility/Accessibility.h>
#import <UIKit/UIKit.h>

// Only the owned date segment implements this provider. Core RN editor classes are never modified.
@interface CUIFieldCustomContentLease : NSObject
- (void)retire;
@end

CUIFieldCustomContentLease *CUIBindLiveFieldCustomContent(
    UIView *editor, NSArray<AXCustomContent *> *(^content)(void), BOOL (^isCurrent)(void));
NSArray<AXCustomContent *> *CUIReadOwnedDateFieldCustomContent(UIView *editor);
