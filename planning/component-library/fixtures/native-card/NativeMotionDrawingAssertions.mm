#import <UIKit/UIKit.h>
#import "../../../../packages/react-native/ios/CUIMotionDrawingView.h"
#include <folly/dynamic.h>
#include <react/renderer/components/view/ViewProps.h>
#include <react/utils/ContextContainer.h>
#include <cmath>

@interface CUIMotionDrawingView (CUIAssertionReads)
- (facebook::react::BorderMetrics)cuiBorderMetrics;
@end

// Non-shipping unmounted UIKit fixture. Compilation does not execute these
// assertions, measure native pixels or establish a mounted owner/window lease.
void CUIAssertOwnedMotionDrawing() {
  using namespace facebook::react;
  NSCAssert(NSThread.isMainThread, @"Run UIKit assertions on the main thread");
  CUIMotionDrawingView *view = [[CUIMotionDrawingView alloc] initWithFrame:CGRectMake(0, 0, 120, 80)];
  UITextField *editor = [UITextField new];
  editor.text = @"";
  [view addSubview:editor];
  [view setCuiDrawingEnabled:YES];
  [view setCuiProjectionRadii:@"{\"topLeft\":{\"x\":40,\"y\":8},\"topRight\":null}"];
  ContextContainer container;
  PropsParserContext context{1, container};
  auto original = std::make_shared<const ViewProps>();
  auto props = std::make_shared<const ViewProps>(context, *original, RawProps(
      folly::dynamic::object("borderRadius", 16)("borderTopStartRadius", 7)
          ("backgroundColor", static_cast<int64_t>(0xffe0e8f0))("overflow", "hidden")));
  [view updateProps:props oldProps:original];
  LayoutMetrics metrics;
  metrics.frame = {{0, 0}, {120, 80}};
  metrics.layoutDirection = LayoutDirection::RightToLeft;
  [view updateLayoutMetrics:metrics oldLayoutMetrics:LayoutMetrics{}];
  [view finalizeUpdates:RNComponentViewUpdateMaskProps];
  auto resolved = [view cuiBorderMetrics];
  NSCAssert(resolved.borderRadii.topLeft.horizontal == 40 && resolved.borderRadii.topLeft.vertical == 8,
      @"Independent numeric axes must reach the native renderer");
  NSCAssert(resolved.borderRadii.topRight.horizontal == 7 && resolved.borderRadii.topRight.vertical == 7,
      @"Untouched logical radii must retain native RTL resolution");
  NSCAssert([editor isDescendantOfView:view] && editor.text.length == 0, @"Original editor must survive rendering");
  BOOL ownershipRejected = NO;
  @try { [view setCuiDrawingEnabled:NO]; } @catch (NSException *) { ownershipRejected = YES; }
  NSCAssert(ownershipRejected, @"Mounted drawing ownership cannot switch underneath RN caches");
  BOOL invalidRejected = NO;
  @try { [view setCuiProjectionRadii:@"{\"topLeft\":{\"x\":-1,\"y\":8}}"];
  } @catch (NSException *) { invalidRejected = YES; }
  NSCAssert(invalidRejected, @"Invalid radius data must reject before drawing mutation");
  auto unchanged = [view cuiBorderMetrics];
  NSCAssert(unchanged.borderRadii.topLeft.horizontal == 40, @"Invalid data cannot replace the last valid receiver data");
  auto percent = std::make_shared<const ViewProps>(context, *original, RawProps(
      folly::dynamic::object("borderRadius", "25%")("overflow", "hidden")));
  [view updateProps:percent oldProps:props];
  [view setCuiProjectionRadii:@"{\"topLeft\":{\"x\":10,\"y\":5}}"];
  auto mixed = [view cuiBorderMetrics];
  NSCAssert(mixed.borderRadii.topRight.horizontal == 30 && mixed.borderRadii.topRight.vertical == 20,
      @"Percentage corners must resolve against the actual current width and height");
  NSCAssert([editor isDescendantOfView:view] && editor.text.length == 0, @"Style changes must retain the original editor");
  [view prepareForRecycle];
  [view setCuiDrawingEnabled:NO];
}
