#import <UIKit/UIKit.h>
#import <React/RCTBorderDrawing.h>
#import <react/renderer/components/view/primitives.h>
#import <react/renderer/graphics/BoxShadow.h>

using CUIMotionCornerCurves = facebook::react::RectangleCorners<facebook::react::BorderCurve>;

CGPathRef CUIPathCreateWithRoundedRect(
    CGRect bounds, RCTCornerInsets cornerInsets, const CUIMotionCornerCurves &curves, BOOL inverted = NO)
    CF_RETURNS_RETAINED;
UIImage *CUIGetBorderImage(
    RCTBorderStyle style, CGSize size, RCTCornerRadii radii, UIEdgeInsets insets, RCTBorderColors colors,
    UIColor *backgroundColor, BOOL drawToEdge, const CUIMotionCornerCurves &curves);
CALayer *CUIGetBoxShadowLayer(
    const facebook::react::BoxShadow &shadow, RCTCornerRadii radii, UIEdgeInsets insets, CGSize size,
    const CUIMotionCornerCurves &curves);
