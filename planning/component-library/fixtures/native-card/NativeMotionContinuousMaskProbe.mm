#import "NativeMotionContinuousMaskProbe.h"
#import "../../../../packages/react-native/ios/CUIMotionContinuousCorners.h"

void CUIAssertOwnedMotionDrawing();
void CUIAssertPinnedDrawingBranches();
NSDictionary *CUIAssertOwnedMaskGeometry(NSString *directory);

CALayer *CUIProbeNativeContinuousMask(CGRect bounds, CGSize cornerSize, CGFloat scale) {
  return [CUIMotionContinuousCorners layerForBounds:bounds cornerSize:cornerSize contentsScale:scale];
}
NSDictionary *CUIProbeNativeContinuousMaskDescription(CALayer *layer) {
  return [CUIMotionContinuousCorners nativeMaskDescriptionForLayer:layer];
}
NSDictionary *CUIProbeRunDrawingReceiverAssertions(NSString *artifactDirectory) {
  @try {
    CUIAssertOwnedMotionDrawing();
    CUIAssertPinnedDrawingBranches();
    NSDictionary *maskGeometry = CUIAssertOwnedMaskGeometry(artifactDirectory);
    return @{@"outcome": @"receiver-assertions-complete", @"fixturesCompleted": @3, @"maskGeometry": maskGeometry,
        @"scope": @"Actual unmounted CUI/RN view props, paint, mask model geometry and original fixture-editor invariants only"};
  } @catch (NSException *exception) {
    return @{@"outcome": @"receiver-assertions-failed", @"name": exception.name,
        @"reason": exception.reason ?: @"", @"scope": @"Original native assertion failure; no retry or admission"};
  }
}
