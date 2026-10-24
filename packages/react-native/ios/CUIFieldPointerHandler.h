#import <React/RCTSurfacePointerHandler.h>

typedef BOOL (^CUIFieldPointerAdmission)(UITouch *touch);
typedef void (^CUIFieldPointerEmission)(void (^original)(void), void (^decision)(BOOL prevented));

// One scoped instance of the original SDK handler, attached to its real surface.
@interface CUIFieldPointerHandler : RCTSurfacePointerHandler
- (instancetype)initWithSurface:(UIView *)surface
                       accepts:(CUIFieldPointerAdmission)accepts
                      emission:(CUIFieldPointerEmission)emission;
- (void)retire;
@end
