#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>
#import <Accessibility/Accessibility.h>

// This owned symbolic editor never subclasses or mutates a core TextInput.
@interface CUIDateSegment : RCTViewComponentView <UITextInput, AXCustomContentProvider>
- (NSDictionary *)formSegmentIdentity;
- (BOOL)requestFormSegmentFocus:(NSDictionary *)identity;
- (BOOL)fieldSegmentReadOnly;
- (NSString *)fieldOwnerId;
@end
