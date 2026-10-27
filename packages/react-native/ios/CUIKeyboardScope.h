#import <React/RCTViewComponentView.h>
@class CUIMenuPointerPolicies;
@class CUIDialogFocusScopes;

@interface CUIKeyboardScope : RCTViewComponentView
- (NSDictionary *)activationSession;
- (CUIMenuPointerPolicies *)menuPointers;
- (CUIDialogFocusScopes *)dialogFocusScopes;
@end
