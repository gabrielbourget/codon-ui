#import <React/RCTViewComponentView.h>

// Private owned painting receiver. Original props, children, state and refs remain on this host.
@interface CUIMotionDrawingView : RCTViewComponentView
- (void)setCuiDrawingEnabled:(BOOL)enabled;
- (void)setCuiProjectionRadii:(NSString *)radii;
@end
