#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

// Private drawing bridge. A description does not admit a clipping or renderer gate.
@interface CUIMotionContinuousCorners : NSObject
+ (nullable UIBezierPath *)pathForBounds:(CGRect)bounds topLeft:(CGSize)topLeft topRight:(CGSize)topRight
    bottomLeft:(CGSize)bottomLeft bottomRight:(CGSize)bottomRight continuousCorners:(NSUInteger)continuousCorners;
+ (nullable CALayer *)layerForBounds:(CGRect)bounds cornerSize:(CGSize)cornerSize contentsScale:(CGFloat)contentsScale;
+ (nullable NSDictionary *)nativeMaskDescriptionForLayer:(CALayer *)layer;
@end

NS_ASSUME_NONNULL_END
