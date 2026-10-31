#import <UIKit/UIKit.h>

// Private drawing/observation boundary for immutable CUI-owned mask paths.
CAShapeLayer *CUICreateOwnedShapeMask(CGPathRef _Nullable path);
NSDictionary *_Nullable CUIOwnedShapeMaskDescription(CALayer *layer);
NSDictionary *CUIGetLayerClipDescription(CALayer *layer);
