#import <React/RCTViewComponentView.h>

// Private owned painting receiver. Original props, children, state and refs remain on this host.
@interface CUIMotionDrawingView : RCTViewComponentView
- (void)setCuiDrawingEnabled:(BOOL)enabled;
- (void)setCuiForegroundEnabled:(BOOL)enabled;
- (void)setCuiPaintOpacity:(CGFloat)opacity;
- (void)setCuiProjectionRadii:(NSString *)radii;
@end
