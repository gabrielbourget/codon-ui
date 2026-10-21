#import <React/RCTViewComponentView.h>
@class CUIMenuPointerPolicies;

@interface CUIKeyboardScope : RCTViewComponentView
- (NSDictionary *)activationSession;
- (CUIMenuPointerPolicies *)menuPointers;
@end
