#import <React/RCTViewComponentView.h>
@class CUIMenuPointerPolicies;
@class CUIDialogFocusScopes;
@class CUIVirtualDragFocus;

@interface CUIKeyboardScope : RCTViewComponentView
- (NSDictionary *)activationSession;
- (CUIVirtualDragFocus *)virtualDragFocus;
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
