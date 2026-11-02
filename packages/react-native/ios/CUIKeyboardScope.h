#import <React/RCTViewComponentView.h>
@class CUIDialogFocusScopes;
@class CUIOrdinaryEditorKeys;

@interface CUIKeyboardScope : RCTViewComponentView
- (NSDictionary *)activationSession;
- (CUIOrdinaryEditorKeys *)ordinaryEditorKeys;
- (BOOL)dragCaptureReady;
- (BOOL)dragEnabled;
- (int32_t)dragSurfaceId;
- (NSDictionary *)dragActivationSession;
- (NSDictionary *)dragGeometry:(NSDictionary *)request;
- (void)emitDragStatus:(NSDictionary *)record;
- (CUIDialogFocusScopes *)dialogFocusScopes;
@end

NSString *CUIKeyboardToolbarRoute(UIPress *press);
void CUIKeyboardToolbarDidEmit(UIPress *press);
BOOL CUIRouteOriginalToolbarKey(UIView *target, UIPress *press, BOOL down, BOOL repeat, BOOL cancelled, BOOL handled);

BOOL CUIKeyboardToolbarCancelledOriginal(UIPress *press);

NSString *CUIKeyboardToolbarDateRoute(UIPress *press);

void CUIKeyboardPrepareToolbarDate(UIPress *press, NSString *phase, BOOL repeat);

BOOL CUIKeyboardToolbarDateOwnsOriginal(UIView *target, UIPress *press);
