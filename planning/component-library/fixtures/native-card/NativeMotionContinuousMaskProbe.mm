#import "NativeMotionContinuousMaskProbe.h"
#import "../../../../packages/react-native/ios/CUIMotionContinuousCorners.h"

void CUIAssertOwnedMotionDrawing();
void CUIAssertPinnedDrawingBranches();

CALayer *CUIProbeNativeContinuousMask(CGRect bounds, CGSize cornerSize, CGFloat scale) {
  return [CUIMotionContinuousCorners layerForBounds:bounds cornerSize:cornerSize contentsScale:scale];
}
NSDictionary *CUIProbeNativeContinuousMaskDescription(CALayer *layer) {
  return [CUIMotionContinuousCorners nativeMaskDescriptionForLayer:layer];
}
NSDictionary *CUIProbeRunDrawingReceiverAssertions(void) {
  @try {
    CUIAssertOwnedMotionDrawing();
    CUIAssertPinnedDrawingBranches();
    return @{@"outcome": @"receiver-assertions-complete", @"fixturesCompleted": @2,
        @"scope": @"Actual unmounted CUI/RN view props, paint, mask and original fixture-editor invariants only"};
  } @catch (NSException *exception) {
    return @{@"outcome": @"receiver-assertions-failed", @"name": exception.name,
        @"reason": exception.reason ?: @"", @"scope": @"Original native assertion failure; no retry or admission"};
  }
}
