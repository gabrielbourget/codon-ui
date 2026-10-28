#import <React/RCTViewComponentView.h>
@class CUIMenuPointerPolicies;
@class CUIDialogFocusScopes;

@interface CUIKeyboardScope : RCTViewComponentView
- (NSDictionary *)activationSession;
- (NSString *)dragMountWitness;
- (BOOL)dragCaptureReady;
- (BOOL)dragEnabled;
- (int32_t)dragSurfaceId;
- (NSDictionary *)dragActivationSession;
- (NSDictionary *)dragGeometry:(NSDictionary *)request;
- (void)emitDragStatus:(NSDictionary *)record;
- (CUIMenuPointerPolicies *)menuPointers;
- (CUIDialogFocusScopes *)dialogFocusScopes;
@end
