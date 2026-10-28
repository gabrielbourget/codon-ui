#import <UIKit/UIKit.h>
#import "NativeMotionDrawingAssertionsEnabled.h"
#import "../../../../packages/react-native/ios/CUIMotionDrawingView.h"
#import "../../../../packages/react-native/ios/CUIMotionDrawingGeometry.h"
#include <folly/dynamic.h>
#include <react/renderer/components/view/ViewProps.h>
#include <react/renderer/components/view/ViewComponentDescriptor.h>
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
  auto container = std::make_shared<const ContextContainer>();
  PropsParserContext context{1, *container};
  ComponentDescriptorParameters parameters;
  parameters.contextContainer = container;
  ViewComponentDescriptor descriptor(parameters);
  auto cloneProps = [&](const Props::Shared &previous, RawProps raw) {
    return std::static_pointer_cast<const ViewProps>(descriptor.cloneProps(context, previous, std::move(raw)));
  };
  auto original = cloneProps(nullptr, RawProps{});
  auto props = cloneProps(original, RawProps(
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
  auto percent = cloneProps(original, RawProps(
      folly::dynamic::object("borderRadius", "25%")("overflow", "hidden")));
  [view updateProps:percent oldProps:props];
  [view setCuiProjectionRadii:@"{\"topLeft\":{\"x\":10,\"y\":5}}"];
  auto mixed = [view cuiBorderMetrics];
  NSCAssert(mixed.borderRadii.topRight.horizontal == 30 && mixed.borderRadii.topRight.vertical == 20,
      @"Percentage corners must resolve against the actual current width and height");
  NSCAssert([editor isDescendantOfView:view] && editor.text.length == 0, @"Style changes must retain the original editor");
  auto continuous = cloneProps(original, RawProps(
      folly::dynamic::object("borderRadius", 16)("borderCurve", "continuous")
          ("borderWidth", 3)("borderColor", static_cast<int64_t>(0xff102030))
          ("backgroundColor", static_cast<int64_t>(0xffe0e8f0))("overflow", "hidden")
          ("outlineWidth", 2)("outlineOffset", 1)("outlineColor", static_cast<int64_t>(0xff8090a0))));
  [view updateProps:continuous oldProps:percent];
  [view setCuiProjectionRadii:@"{\"topLeft\":{\"x\":40,\"y\":8},\"topRight\":{\"x\":12,\"y\":24},\"bottomLeft\":{\"x\":5,\"y\":13},\"bottomRight\":{\"x\":22,\"y\":6}}"];
  editor.text = @"original dirty value";
  editor.selectedTextRange = [editor textRangeFromPosition:[editor positionFromPosition:editor.beginningOfDocument offset:4]
      toPosition:[editor positionFromPosition:editor.beginningOfDocument offset:9]];
  NSInteger selectionStart = [editor offsetFromPosition:editor.beginningOfDocument toPosition:editor.selectedTextRange.start];
  NSInteger selectionEnd = [editor offsetFromPosition:editor.beginningOfDocument toPosition:editor.selectedTextRange.end];
  [view finalizeUpdates:RNComponentViewUpdateMaskProps];
  auto elliptical = [view cuiBorderMetrics];
  NSCAssert(elliptical.borderCurves.topLeft == BorderCurve::Continuous &&
      elliptical.borderRadii.topLeft.horizontal == 40 && elliptical.borderRadii.topLeft.vertical == 8 &&
      elliptical.borderRadii.topRight.horizontal == 12 && elliptical.borderRadii.topRight.vertical == 24 &&
      elliptical.borderRadii.bottomLeft.horizontal == 5 && elliptical.borderRadii.bottomLeft.vertical == 13 &&
      elliptical.borderRadii.bottomRight.horizontal == 22 && elliptical.borderRadii.bottomRight.vertical == 6,
      @"All four continuous elliptical corners must retain independent axes");
  NSCAssert([editor isDescendantOfView:view] && [editor.text isEqualToString:@"original dirty value"] &&
      [editor offsetFromPosition:editor.beginningOfDocument toPosition:editor.selectedTextRange.start] == selectionStart &&
      [editor offsetFromPosition:editor.beginningOfDocument toPosition:editor.selectedTextRange.end] == selectionEnd,
      @"Continuous painting must retain the original dirty editor and selection");
  const RCTCornerRadii cornerRadii{40, 8, 12, 24, 5, 13, 22, 6};
  const auto cornerInsets = RCTGetCornerInsets(cornerRadii, UIEdgeInsetsZero);
  CGPathRef continuousPath = CUIPathCreateWithRoundedRect(view.bounds, cornerInsets, elliptical.borderCurves);
  CGPathRef circularPath = RCTPathCreateWithRoundedRect(view.bounds, cornerInsets, nil, NO);
  NSCAssert(!CGPathEqualToPath(continuousPath, circularPath), @"Continuous corner paths cannot fall back to ellipses");
  NSCAssert(CGPathContainsPoint(continuousPath, nil, CGPointMake(60, 40), NO) &&
      !CGPathContainsPoint(continuousPath, nil, CGPointZero, NO), @"System continuous corners must enclose the interior");
  NSCAssert(CGRectEqualToRect(CGPathGetPathBoundingBox(continuousPath), view.bounds),
      @"Continuous assembly must retain the original border box");
  CGPathRelease(continuousPath);
  CGPathRelease(circularPath);
  const RCTCornerRadii nativeUniformRadii{40, 20, 40, 20, 40, 20, 40, 20};
  CGPathRef nativeUniformPath = CUIPathCreateWithRoundedRect(view.bounds,
      RCTGetCornerInsets(nativeUniformRadii, UIEdgeInsetsZero), elliptical.borderCurves);
  NSCAssert(nativeUniformPath, @"Uniform continuous overlap must retain the direct native system path");
  CGPathRelease(nativeUniformPath);
  if (@available(iOS 16.0, *)) {
    const RCTCornerRadii unevenSharedAxes{70, 35, 40, 20, 20, 10, 10, 5};
    const auto unevenInsets = RCTGetCornerInsets(unevenSharedAxes, UIEdgeInsetsZero);
    CGPathRef nativeUneven = CUIPathCreateWithRoundedRect(view.bounds, unevenInsets, elliptical.borderCurves);
    CGPathRef circularUneven = RCTPathCreateWithRoundedRect(view.bounds, unevenInsets, nil, NO);
    NSCAssert(nativeUneven && !CGPathEqualToPath(nativeUneven, circularUneven),
        @"Overlapping unequal continuous corners with shared axes retain the native system contour");
    NSCAssert(CGRectEqualToRect(CGPathGetPathBoundingBox(nativeUneven), view.bounds) &&
        CGPathContainsPoint(nativeUneven, nil, CGPointMake(60, 40), NO) &&
        !CGPathContainsPoint(nativeUneven, nil, CGPointZero, NO),
        @"The uneven native contour retains its original border box and enclosed interior");
    CGPathRelease(nativeUneven);
    CGPathRelease(circularUneven);
    NSCAssert([editor.text isEqualToString:@"original dirty value"] &&
        [editor offsetFromPosition:editor.beginningOfDocument toPosition:editor.selectedTextRange.start] == selectionStart &&
        [editor offsetFromPosition:editor.beginningOfDocument toPosition:editor.selectedTextRange.end] == selectionEnd,
        @"Uneven path construction cannot replace or mutate the original editor");
  }
  BOOL mixedOverlapRejected = NO;
  @try {
    const RCTCornerRadii overlapping{70, 40, 40, 20, 20, 20, 10, 10};
    CGPathRef unsupported = CUIPathCreateWithRoundedRect(view.bounds,
        RCTGetCornerInsets(overlapping, UIEdgeInsetsZero), elliptical.borderCurves);
    CGPathRelease(unsupported);
  } @catch (NSException *) { mixedOverlapRejected = YES; }
  NSCAssert(mixedOverlapRejected, @"Unproved mixed continuous overlap must reject instead of fitting a substitute curve");
  UIImage *borderImage = CUIGetBorderImage(RCTBorderStyleSolid, view.bounds.size, cornerRadii,
      UIEdgeInsetsMake(3, 7, 2, 5), RCTBorderColors{UIColor.redColor, UIColor.blueColor, UIColor.greenColor, UIColor.yellowColor},
      UIColor.clearColor, NO, elliptical.borderCurves);
  NSCAssert(borderImage.CGImage && CGSizeEqualToSize(borderImage.size, view.bounds.size) &&
      UIEdgeInsetsEqualToEdgeInsets(borderImage.capInsets, UIEdgeInsetsZero),
      @"Unequal-color continuous borders must retain full-size native paths without cap stretching");
  for (BOOL inset : {NO, YES}) {
    BoxShadow shadow{};
    shadow.inset = inset;
    shadow.blurRadius = 8;
    shadow.spreadDistance = 2;
    shadow.offsetX = 3;
    shadow.offsetY = -2;
    CALayer *shadowLayer = CUIGetBoxShadowLayer(shadow, cornerRadii, UIEdgeInsetsMake(3, 3, 3, 3),
        view.bounds.size, elliptical.borderCurves);
    NSCAssert(shadowLayer.shadowPath && shadowLayer.mask, @"Inset and outset continuous shadows must retain native paths");
  }
  [view prepareForRecycle];
  [view setCuiDrawingEnabled:NO];
}
