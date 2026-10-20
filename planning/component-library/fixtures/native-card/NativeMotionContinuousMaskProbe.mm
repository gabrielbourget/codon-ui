#import "NativeMotionContinuousMaskProbe.h"
#import "../../../../packages/react-native/ios/CUIMotionContinuousCorners.h"

CALayer *CUIProbeNativeContinuousMask(CGRect bounds, CGSize cornerSize, CGFloat scale) {
  return [CUIMotionContinuousCorners layerForBounds:bounds cornerSize:cornerSize contentsScale:scale];
}
NSDictionary *CUIProbeNativeContinuousMaskDescription(CALayer *layer) {
  return [CUIMotionContinuousCorners nativeMaskDescriptionForLayer:layer];
}
