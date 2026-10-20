#import <UIKit/UIKit.h>
#import "NativeMotionDrawingAssertionsEnabled.h"
#import "../../../../packages/react-native/ios/CUIMotionContinuousCorners.h"
#import <React/RCTBorderDrawing.h>
#import "../../../../packages/react-native/ios/CUIMotionDrawingView.h"
#import <react/renderer/components/view/ViewProps.h>
#include <react/renderer/components/view/ViewComponentDescriptor.h>
#import <react/utils/ContextContainer.h>
#include <folly/dynamic.h>

@interface CUIMotionDrawingView (CUIDrawingBranchAssertions)
- (facebook::react::BorderMetrics)cuiBorderMetrics;
- (facebook::react::BorderMetrics)cuiUniformLayerBorderMetrics;
- (void)shapeCuiLayerToMatchView:(CALayer *)layer borderMetrics:(facebook::react::BorderMetrics)metrics;
- (UIView *)currentContainerView;
@end
@interface RCTViewComponentView (CUIPinnedDrawingBranchAssertions)
- (void)shapeLayerToMatchView:(CALayer *)layer borderMetrics:(facebook::react::BorderMetrics)metrics;
- (UIView *)currentContainerView;
@end

// Non-shipping, unmounted UIKit assertions. Compilation does not execute them,
// prove pixels, or admit native continuous projection/border/inset fidelity.
void CUIAssertPinnedDrawingBranches() {
  using namespace facebook::react;
  NSCAssert(NSThread.isMainThread, @"Run drawing assertions on the main thread");
  auto container = std::make_shared<const ContextContainer>();
  PropsParserContext context{1, *container};
  ComponentDescriptorParameters parameters;
  parameters.contextContainer = container;
  ViewComponentDescriptor descriptor(parameters);
  auto cloneProps = [&](const Props::Shared &previous, RawProps raw) {
    return std::static_pointer_cast<const ViewProps>(descriptor.cloneProps(context, previous, std::move(raw)));
  };
  auto original = cloneProps(nullptr, RawProps{});
  auto percent = cloneProps(original, RawProps(
      folly::dynamic::object("borderRadius", "25%")("borderCurve", "continuous")
          ("backgroundColor", static_cast<int64_t>(0xffe0e8f0))));
  LayoutMetrics layout;
  layout.frame = {{0, 0}, {120, 80}};
  CUIMotionDrawingView *owned = [[CUIMotionDrawingView alloc] initWithFrame:CGRectMake(0, 0, 120, 80)];
  RCTViewComponentView *source = [[RCTViewComponentView alloc] initWithFrame:owned.frame];
  [owned setCuiDrawingEnabled:YES];
  [owned updateProps:percent oldProps:original];
  [source updateProps:percent oldProps:original];
  [owned updateLayoutMetrics:layout oldLayoutMetrics:LayoutMetrics{}];
  [source updateLayoutMetrics:layout oldLayoutMetrics:LayoutMetrics{}];
  const auto native = percent->resolveBorderMetrics(layout);
  NSCAssert(native.borderRadii.topLeft.horizontal == 30 && native.borderRadii.topLeft.vertical == 20,
      @"The pinned percentage metrics retain distinct axes");
  CALayer *sourceLayer = [CALayer layer];
  CALayer *ownedLayer = [CALayer layer];
  [source shapeLayerToMatchView:sourceLayer borderMetrics:native];
  [owned shapeCuiLayerToMatchView:ownedLayer borderMetrics:[owned cuiBorderMetrics]];
  NSCAssert(sourceLayer.mask == nil && ownedLayer.mask == nil &&
      sourceLayer.cornerRadius == 30 && ownedLayer.cornerRadius == sourceLayer.cornerRadius &&
      [ownedLayer.cornerCurve isEqualToString:sourceLayer.cornerCurve],
      @"Uncorrected uniform percentage layers preserve RN's horizontal scalar/curve behavior");
  [owned setCuiProjectionRadii:@"{\"topLeft\":{\"x\":10,\"y\":5},\"topRight\":null}"];
  const auto layerRadii = [owned cuiUniformLayerBorderMetrics].borderRadii;
  const auto pathRadii = [owned cuiBorderMetrics].borderRadii;
  NSCAssert(layerRadii.topLeft.horizontal == 10 && layerRadii.topLeft.vertical == 5 &&
      layerRadii.topRight.horizontal == 30 && layerRadii.topRight.vertical == 30 &&
      pathRadii.topRight.horizontal == 30 && pathRadii.topRight.vertical == 20,
      @"Null corrections retain the source primitive's scalar or ellipse independently for each painter");
  [owned setCuiProjectionRadii:@"{\"topLeft\":{\"x\":20,\"y\":20},\"topRight\":{\"x\":20,\"y\":20},\"bottomLeft\":{\"x\":20,\"y\":20},\"bottomRight\":{\"x\":20,\"y\":20}}"];
  [owned shapeCuiLayerToMatchView:ownedLayer borderMetrics:[owned cuiBorderMetrics]];
  NSCAssert(ownedLayer.mask == nil && ownedLayer.cornerRadius == 20 &&
      [ownedLayer.cornerCurve isEqualToString:kCACornerCurveContinuous],
      @"Equal-axis projection retains the source native scalar continuous layer");
  [owned setCuiProjectionRadii:@"{\"topLeft\":{\"x\":40,\"y\":8},\"topRight\":{\"x\":40,\"y\":8},\"bottomLeft\":{\"x\":40,\"y\":8},\"bottomRight\":{\"x\":40,\"y\":8}}"];
  [owned shapeCuiLayerToMatchView:ownedLayer borderMetrics:[owned cuiBorderMetrics]];
  const RCTCornerRadii elliptical{40, 8, 40, 8, 40, 8, 40, 8};
  NSDictionary *nativeMask = [CUIMotionContinuousCorners nativeMaskDescriptionForLayer:ownedLayer.mask];
  NSCAssert(ownedLayer.mask && ownedLayer.cornerRadius == 0 &&
      [nativeMask[@"kind"] isEqual:@"cui-owned-native-continuous"] &&
      CGRectEqualToRect(ownedLayer.mask.frame, owned.bounds),
      @"Unequal-axis correction must use the owned native continuous primitive at the original bounds");
  CGPathRef circular;
  auto mixed = cloneProps(original, RawProps(
      folly::dynamic::object("borderTopLeftRadius", 30)("borderTopRightRadius", 12)
          ("borderBottomLeftRadius", 5)("borderBottomRightRadius", 22)("borderCurve", "continuous")
          ("backgroundColor", static_cast<int64_t>(0xffe0e8f0))("outlineWidth", 2)));
  [owned updateProps:mixed oldProps:percent];
  [source updateProps:mixed oldProps:percent];
  [owned setCuiProjectionRadii:@"{}"];
  const auto mixedNative = mixed->resolveBorderMetrics(layout);
  [source shapeLayerToMatchView:sourceLayer borderMetrics:mixedNative];
  [owned shapeCuiLayerToMatchView:ownedLayer borderMetrics:[owned cuiBorderMetrics]];
  NSCAssert(sourceLayer.mask && ownedLayer.mask && CGPathEqualToPath(
      ((CAShapeLayer *)sourceLayer.mask).path, ((CAShapeLayer *)ownedLayer.mask).path),
      @"A nonuniform authored continuous style retains the pinned circular fallback");
  [owned setCuiProjectionRadii:@"{\"topLeft\":{\"x\":70,\"y\":40},\"topRight\":{\"x\":40,\"y\":20},\"bottomLeft\":{\"x\":20,\"y\":20},\"bottomRight\":{\"x\":10,\"y\":10}}"];
  [owned shapeCuiLayerToMatchView:ownedLayer borderMetrics:[owned cuiBorderMetrics]];
  const RCTCornerRadii corrected{70, 40, 40, 20, 20, 20, 10, 10};
  circular = RCTPathCreateWithRoundedRect(owned.bounds, RCTGetCornerInsets(corrected, UIEdgeInsetsZero), nil, NO);
  NSCAssert(ownedLayer.mask && CGPathEqualToPath(((CAShapeLayer *)ownedLayer.mask).path, circular),
      @"Corrected axes cannot promote a source circular fallback into continuous overlap");
  CGPathRelease(circular);
  [owned finalizeUpdates:RNComponentViewUpdateMaskProps];
  [source finalizeUpdates:RNComponentViewUpdateMaskProps];
  auto clipped = cloneProps(original, RawProps(
      folly::dynamic::object("borderRadius", 16)("borderCurve", "continuous")("overflow", "hidden")
          ("outlineWidth", 2)("backgroundColor", static_cast<int64_t>(0xffe0e8f0))));
  [owned updateProps:clipped oldProps:mixed];
  [source updateProps:clipped oldProps:mixed];
  [owned setCuiProjectionRadii:@"{\"topLeft\":{\"x\":40,\"y\":8},\"topRight\":{\"x\":40,\"y\":8},\"bottomLeft\":{\"x\":40,\"y\":8},\"bottomRight\":{\"x\":40,\"y\":8}}"];
  [owned finalizeUpdates:RNComponentViewUpdateMaskProps];
  [source finalizeUpdates:RNComponentViewUpdateMaskProps];
  UIView *clipContainer = [owned currentContainerView];
  UIView *sourceClipContainer = [source currentContainerView];
  circular = RCTPathCreateWithRoundedRect(owned.bounds, RCTGetCornerInsets(elliptical, UIEdgeInsetsZero), nil, NO);
  const BOOL shapeMask = [clipContainer.layer.mask isKindOfClass:CAShapeLayer.class];
  const BOOL matchingMaskPath = shapeMask && ((CAShapeLayer *)clipContainer.layer.mask).path &&
      CGPathEqualToPath(((CAShapeLayer *)clipContainer.layer.mask).path, circular);
  NSDictionary *clipFacts = @{
    @"authoredClip": @(clipped->getClipsContentToBounds()),
    @"ownedSeparateContainer": @(clipContainer != owned), @"sourceSeparateContainer": @(sourceClipContainer != source),
    @"ownedRootCurve": owned.layer.cornerCurve ?: NSNull.null, @"sourceRootCurve": source.layer.cornerCurve ?: NSNull.null,
    @"ownedContainerCurve": clipContainer.layer.cornerCurve ?: NSNull.null,
    @"sourceContainerCurve": sourceClipContainer.layer.cornerCurve ?: NSNull.null,
    @"ownedClips": @(clipContainer.clipsToBounds), @"sourceClips": @(sourceClipContainer.clipsToBounds),
    @"ownedMaskClass": clipContainer.layer.mask ? NSStringFromClass(clipContainer.layer.mask.class) : NSNull.null,
    @"ownedMaskPathMatches": @(matchingMaskPath), @"sourceClipRadius": @(sourceClipContainer.layer.cornerRadius),
    @"ownedBounds": NSStringFromCGRect(owned.bounds), @"ownedClipBounds": NSStringFromCGRect(clipContainer.bounds)
  };
  NSCAssert(sourceClipContainer != source && sourceClipContainer.clipsToBounds &&
      sourceClipContainer.layer.mask == nil && sourceClipContainer.layer.cornerRadius == 16,
      @"Pinned scalar overflow clipping must establish the actual reference branch: %@", clipFacts);
  NSCAssert(clipContainer != owned && [owned.layer.cornerCurve isEqualToString:kCACornerCurveContinuous] &&
      [clipContainer.layer.cornerCurve isEqualToString:kCACornerCurveCircular] && matchingMaskPath,
      @"An overflow container retains its actual inherited circular clip around a continuous root: %@", clipFacts);
  CGPathRelease(circular);
  [owned prepareForRecycle];
  [source prepareForRecycle];

  // A percentage corner and numeric corners can resolve to the same native
  // radius at a square size. Percentage fallthrough then makes correction mixed.
  auto reachableProps = cloneProps(original, RawProps(
      folly::dynamic::object("borderRadius", 20)("borderTopLeftRadius", "25%")
          ("borderCurve", "continuous")("backgroundColor", static_cast<int64_t>(0xffe0e8f0))));
  CUIMotionDrawingView *reachable = [[CUIMotionDrawingView alloc] initWithFrame:CGRectMake(0, 0, 80, 80)];
  [reachable setCuiDrawingEnabled:YES];
  [reachable updateProps:reachableProps oldProps:original];
  LayoutMetrics square;
  square.frame = {{0, 0}, {80, 80}};
  [reachable updateLayoutMetrics:square oldLayoutMetrics:LayoutMetrics{}];
  NSCAssert(reachableProps->resolveBorderMetrics(square).borderRadii.isUniform(),
      @"Mixed percentage/numeric authors can select the source uniform CA branch");
  [reachable setCuiProjectionRadii:@"{\"topLeft\":null,\"topRight\":{\"x\":10,\"y\":40},\"bottomLeft\":{\"x\":10,\"y\":40},\"bottomRight\":{\"x\":10,\"y\":40}}"];
  const auto mixedCorrection = [reachable cuiUniformLayerBorderMetrics].borderRadii;
  NSCAssert(mixedCorrection.topLeft.horizontal == 20 && mixedCorrection.topLeft.vertical == 20 &&
      mixedCorrection.topRight.horizontal == 10 && mixedCorrection.topRight.vertical == 40 && !mixedCorrection.isUniform(),
      @"Percentage null fallthrough and corrected numeric corners retain distinct source-CA axes");
  BOOL overlapRejected = NO;
  @try {
    [reachable shapeCuiLayerToMatchView:[CALayer layer] borderMetrics:[reachable cuiBorderMetrics]];
  } @catch (NSException *error) {
    overlapRejected = [error.reason containsString:@"Exact mixed continuous corner overlap"];
  }
  NSCAssert(overlapRejected, @"Reachable corrected source-CA mixed overlap remains explicitly unproved");
  LayoutMetrics rectangle = square;
  rectangle.frame.size = {160, 80};
  reachable.frame = CGRectMake(0, 0, 160, 80);
  [reachable updateLayoutMetrics:rectangle oldLayoutMetrics:square];
  NSCAssert(!reachableProps->resolveBorderMetrics(rectangle).borderRadii.isUniform(),
      @"The actual layout size, rather than authored value types, selects the native branch");
  CALayer *resized = [CALayer layer];
  [reachable shapeCuiLayerToMatchView:resized borderMetrics:[reachable cuiBorderMetrics]];
  NSCAssert(resized.mask && resized.cornerRadius == 0,
      @"At the new native size the source nonuniform circular branch remains available");
  [reachable prepareForRecycle];
}
