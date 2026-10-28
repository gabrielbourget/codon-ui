#import <React/RCTViewComponentView.h>
@class CUIMenuPointerPolicies;
@class CUIDialogFocusScopes;

@interface CUIKeyboardScope : RCTViewComponentView
- (NSDictionary *)activationSession;
- (NSString *)dragMountWitness;
- (BOOL)dragCaptureReady;
- (CUIMenuPointerPolicies *)menuPointers;
- (CUIDialogFocusScopes *)dialogFocusScopes;
@end
