// CUI-owned rendering adaptation of RN0.86.3; see cpp/motion/UPSTREAM.json and its RN license.
#import "CUIMotionDrawingView.h"
#import "CUIMotionDrawingGeometry.h"
#import <CoreGraphics/CoreGraphics.h>
#import <QuartzCore/QuartzCore.h>
#import <RCTSwiftUIWrapper/RCTSwiftUIContainerViewWrapper.h>
#import <React/RCTBackgroundImageUtils.h>
#import <React/RCTBorderDrawing.h>
#import <React/RCTBoxShadow.h>
#import <React/RCTConversions.h>
#import <React/RCTLinearGradient.h>
#import <React/RCTRadialGradient.h>
#import <react/featureflags/ReactNativeFeatureFlags.h>
#import <react/renderer/components/view/ViewProps.h>
#include <ranges>
#include <cmath>

// These pinned selectors expose rendering receivers; no private ivar is read or written.
@interface RCTViewComponentView (CUILockedDrawingReceivers)
- (UIView *)effectiveContentView;
- (UIView *)currentContainerView;
- (void)invalidateLayer;
@end

using namespace facebook::react;
static constexpr CGFloat CUI_BACKGROUND_COLOR_ZPOSITION = -1024.0f;
static bool CUIRadiiAreCircular(const BorderRadii &radii) {
  return radii.topLeft.horizontal == radii.topLeft.vertical && radii.topRight.horizontal == radii.topRight.vertical &&
      radii.bottomLeft.horizontal == radii.bottomLeft.vertical && radii.bottomRight.horizontal == radii.bottomRight.vertical;
}

static RCTCornerRadii RCTCornerRadiiFromBorderRadii(BorderRadii borderRadii)
{
  return RCTCornerRadii{
      .topLeftHorizontal = (CGFloat)borderRadii.topLeft.horizontal,
      .topLeftVertical = (CGFloat)borderRadii.topLeft.vertical,
      .topRightHorizontal = (CGFloat)borderRadii.topRight.horizontal,
      .topRightVertical = (CGFloat)borderRadii.topRight.vertical,
      .bottomLeftHorizontal = (CGFloat)borderRadii.bottomLeft.horizontal,
      .bottomLeftVertical = (CGFloat)borderRadii.bottomLeft.vertical,
      .bottomRightHorizontal = (CGFloat)borderRadii.bottomRight.horizontal,
      .bottomRightVertical = (CGFloat)borderRadii.bottomRight.vertical};
}

static RCTCornerRadii
RCTCreateOutlineCornerRadiiFromBorderRadii(const BorderRadii &borderRadii, CGFloat outlineWidth, CGFloat outlineOffset)
{
  return RCTCornerRadii{
      borderRadii.topLeft.horizontal != 0 ? borderRadii.topLeft.horizontal + outlineWidth + outlineOffset : 0,
      borderRadii.topLeft.vertical != 0 ? borderRadii.topLeft.vertical + outlineWidth + outlineOffset : 0,
      borderRadii.topRight.horizontal != 0 ? borderRadii.topRight.horizontal + outlineWidth + outlineOffset : 0,
      borderRadii.topRight.vertical != 0 ? borderRadii.topRight.vertical + outlineWidth + outlineOffset : 0,
      borderRadii.bottomLeft.horizontal != 0 ? borderRadii.bottomLeft.horizontal + outlineWidth + outlineOffset : 0,
      borderRadii.bottomLeft.vertical != 0 ? borderRadii.bottomLeft.vertical + outlineWidth + outlineOffset : 0,
      borderRadii.bottomRight.horizontal != 0 ? borderRadii.bottomRight.horizontal + outlineWidth + outlineOffset : 0,
      borderRadii.bottomRight.vertical != 0 ? borderRadii.bottomRight.vertical + outlineWidth + outlineOffset : 0};
}

// To be used for CSS properties like `border` and `outline`.
static void RCTAddContourEffectToLayer(
    CALayer *layer,
    const RCTCornerRadii &cornerRadii,
    const RCTBorderColors &contourColors,
    const UIEdgeInsets &contourInsets,
    const RCTBorderStyle &contourStyle,
    const CUIMotionCornerCurves &curves)
{
  const bool circular = curves.topLeft == BorderCurve::Circular && curves.topRight == BorderCurve::Circular &&
      curves.bottomLeft == BorderCurve::Circular && curves.bottomRight == BorderCurve::Circular;
  UIImage *image = circular
      ? RCTGetBorderImage(contourStyle, layer.bounds.size, cornerRadii, contourInsets, contourColors, [UIColor clearColor], NO)
      : CUIGetBorderImage(contourStyle, layer.bounds.size, cornerRadii, contourInsets, contourColors, [UIColor clearColor], NO, curves);

  if (image == nil) {
    layer.contents = nil;
  } else {
    CGSize imageSize = image.size;
    UIEdgeInsets imageCapInsets = image.capInsets;
    CGRect contentsCenter = CGRect{
        CGPoint{imageCapInsets.left / imageSize.width, imageCapInsets.top / imageSize.height},
        CGSize{(CGFloat)1.0 / imageSize.width, (CGFloat)1.0 / imageSize.height}};
    layer.contents = (id)image.CGImage;
    layer.contentsScale = image.scale;

    BOOL isResizable = !UIEdgeInsetsEqualToEdgeInsets(image.capInsets, UIEdgeInsetsZero);
    if (isResizable) {
      layer.contentsCenter = contentsCenter;
    } else {
      layer.contentsCenter = CGRect{CGPoint{0.0, 0.0}, CGSize{1.0, 1.0}};
    }
  }

  // If mutations are applied inside of Animation block, it may cause layer to be animated.
  // To stop that, imperatively remove all animations from layer.
  [layer removeAllAnimations];
}

static RCTBorderColors RCTCreateRCTBorderColorsFromBorderColors(BorderColors borderColors)
{
  return RCTBorderColors{
      .top = RCTUIColorFromSharedColor(borderColors.top),
      .left = RCTUIColorFromSharedColor(borderColors.left),
      .bottom = RCTUIColorFromSharedColor(borderColors.bottom),
      .right = RCTUIColorFromSharedColor(borderColors.right)};
}

static CALayerCornerCurve CornerCurveFromBorderCurve(BorderCurve borderCurve)
{
  // The constants are available only starting from iOS 13
  // CALayerCornerCurve is a typealias on NSString *
  switch (borderCurve) {
    case BorderCurve::Continuous:
      return @"continuous"; // kCACornerCurveContinuous;
    case BorderCurve::Circular:
      return @"circular"; // kCACornerCurveCircular;
  }
}

static RCTBorderStyle RCTBorderStyleFromBorderStyle(BorderStyle borderStyle)
{
  switch (borderStyle) {
    case BorderStyle::Solid:
      return RCTBorderStyleSolid;
    case BorderStyle::Dotted:
      return RCTBorderStyleDotted;
    case BorderStyle::Dashed:
      return RCTBorderStyleDashed;
  }
}

static RCTBorderStyle RCTBorderStyleFromOutlineStyle(OutlineStyle outlineStyle)
{
  switch (outlineStyle) {
    case OutlineStyle::Solid:
      return RCTBorderStyleSolid;
    case OutlineStyle::Dotted:
      return RCTBorderStyleDotted;
    case OutlineStyle::Dashed:
      return RCTBorderStyleDashed;
  }
}

static BorderRadii CUIEnsureNoOverlap(const BorderRadii& radii, const facebook::react::Size& size) {
  // "Corner curves must not overlap: When the sum of any two adjacent border
  // radii exceeds the size of the border box, UAs must proportionally reduce
  // the used values of all border radii until none of them overlap."
  // Source: https://www.w3.org/TR/css-backgrounds-3/#corner-overlap

  float leftEdgeRadii = radii.topLeft.vertical + radii.bottomLeft.vertical;
  float topEdgeRadii = radii.topLeft.horizontal + radii.topRight.horizontal;
  float rightEdgeRadii = radii.topRight.vertical + radii.bottomRight.vertical;
  float bottomEdgeRadii =
      radii.bottomLeft.horizontal + radii.bottomRight.horizontal;

  float leftEdgeRadiiScale =
      (leftEdgeRadii > 0) ? std::min(size.height / leftEdgeRadii, (Float)1) : 0;
  float topEdgeRadiiScale =
      (topEdgeRadii > 0) ? std::min(size.width / topEdgeRadii, (Float)1) : 0;
  float rightEdgeRadiiScale = (rightEdgeRadii > 0)
      ? std::min(size.height / rightEdgeRadii, (Float)1)
      : 0;
  float bottomEdgeRadiiScale = (bottomEdgeRadii > 0)
      ? std::min(size.width / bottomEdgeRadii, (Float)1)
      : 0;

  return BorderRadii{
      .topLeft =
          {static_cast<float>(
               radii.topLeft.vertical *
               std::min(topEdgeRadiiScale, leftEdgeRadiiScale)),
           static_cast<float>(
               radii.topLeft.horizontal *
               std::min(topEdgeRadiiScale, leftEdgeRadiiScale))},
      .topRight =
          {static_cast<float>(
               radii.topRight.vertical *
               std::min(topEdgeRadiiScale, rightEdgeRadiiScale)),
           static_cast<float>(
               radii.topRight.horizontal *
               std::min(topEdgeRadiiScale, rightEdgeRadiiScale))},
      .bottomLeft =
          {static_cast<float>(
               radii.bottomLeft.vertical *
               std::min(bottomEdgeRadiiScale, leftEdgeRadiiScale)),
           static_cast<float>(
               radii.bottomLeft.horizontal *
               std::min(bottomEdgeRadiiScale, leftEdgeRadiiScale))},
      .bottomRight =
          {static_cast<float>(
               radii.bottomRight.vertical *
               std::min(bottomEdgeRadiiScale, rightEdgeRadiiScale)),
           static_cast<float>(
               radii.bottomRight.horizontal *
               std::min(bottomEdgeRadiiScale, rightEdgeRadiiScale))},
  };
}

static BorderRadii CUIRadiiPercentToPoint(
    const RectangleCorners<ValueUnit>& radii,
    const facebook::react::Size& size) {
  return BorderRadii{
      .topLeft =
          {radii.topLeft.resolve(size.height),
           radii.topLeft.resolve(size.width)},
      .topRight =
          {radii.topRight.resolve(size.height),
           radii.topRight.resolve(size.width)},
      .bottomLeft =
          {radii.bottomLeft.resolve(size.height),
           radii.bottomLeft.resolve(size.width)},
      .bottomRight =
          {radii.bottomRight.resolve(size.height),
           radii.bottomRight.resolve(size.width)},
  };
}


static void CUIApplyProjectionRadii(NSDictionary *values, BorderRadii &radii) {
  const auto apply = [&](NSString *key, CornerRadii &corner) {
    id value = values[key];
    if (value && value != NSNull.null) { corner.horizontal = [value[@"x"] doubleValue]; corner.vertical = [value[@"y"] doubleValue]; }
  };
  apply(@"topLeft", radii.topLeft); apply(@"topRight", radii.topRight);
  apply(@"bottomLeft", radii.bottomLeft); apply(@"bottomRight", radii.bottomRight);
}

static CUIMotionCornerCurves CUIUniformCornerCurve(BorderCurve curve) {
  return {curve, curve, curve, curve};
}


@implementation CUIMotionDrawingView {
  BOOL _cuiDrawingEnabled;
  BOOL _cuiModeDecided;
  BOOL _cuiDrawingDirty;
  NSDictionary *_cuiRadii;
  CALayer *_cuiBackgroundColorLayer;
  CALayer *_cuiBorderLayer;
  CALayer *_cuiOutlineLayer;
  NSMutableArray<CALayer *> *_cuiBoxShadowLayers;
  CALayer *_cuiFilterLayer;
  NSMutableArray<CALayer *> *_cuiBackgroundImageLayers;
  UIView *_cuiContainerView;
  RCTSwiftUIContainerViewWrapper *_cuiSwiftUIWrapper;
}

- (void)setCuiDrawingEnabled:(BOOL)enabled {
  if (_cuiModeDecided && enabled != _cuiDrawingEnabled)
    @throw [NSException exceptionWithName:@"CUI.MotionDrawing" reason:@"Drawing ownership must be stable for the native host lifetime" userInfo:nil];
  _cuiModeDecided = YES;
  _cuiDrawingEnabled = enabled;
}

- (void)setCuiProjectionRadii:(NSString *)encoded {
  NSData *data = [encoded dataUsingEncoding:NSUTF8StringEncoding];
  NSError *error = nil;
  id value = encoded.length ? [NSJSONSerialization JSONObjectWithData:data options:0 error:&error] : @{};
  if (error || ![value isKindOfClass:NSDictionary.class])
    @throw [NSException exceptionWithName:@"CUI.MotionDrawing" reason:@"Invalid native radius data" userInfo:nil];
  for (NSString *key in @[@"topLeft", @"topRight", @"bottomLeft", @"bottomRight"]) {
    id corner = value[key];
    if (!corner || corner == NSNull.null) continue;
    if (![corner isKindOfClass:NSDictionary.class])
      @throw [NSException exceptionWithName:@"CUI.MotionDrawing" reason:@"Invalid native radius corner" userInfo:nil];
    for (NSString *axis in @[@"x", @"y"]) {
      id number = corner[axis];
      if (![number isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)number) == CFBooleanGetTypeID() ||
          !std::isfinite([number doubleValue]) || [number doubleValue] < 0)
        @throw [NSException exceptionWithName:@"CUI.MotionDrawing" reason:@"Finite nonnegative native radius required" userInfo:nil];
    }
  }
  if (![_cuiRadii isEqual:value]) { _cuiRadii = [value copy]; _cuiDrawingDirty = YES; }
}

- (BOOL)cuiHasProjectionRadii {
  for (NSString *key in @[@"topLeft", @"topRight", @"bottomLeft", @"bottomRight"])
    if (_cuiRadii[key] && _cuiRadii[key] != NSNull.null) return YES;
  return NO;
}

- (BorderMetrics)cuiBorderMetrics {
  auto result = _props->resolveBorderMetrics(_layoutMetrics);
  if (![self cuiHasProjectionRadii]) return result;
  result.borderRadii = CUIRadiiPercentToPoint(_props->borderRadii.resolve(
      _layoutMetrics.layoutDirection == LayoutDirection::RightToLeft, ValueUnit{0, UnitType::Point}), _layoutMetrics.frame.size);
  CUIApplyProjectionRadii(_cuiRadii, result.borderRadii);
  result.borderRadii = CUIEnsureNoOverlap(result.borderRadii, _layoutMetrics.frame.size);
  return result;
}

- (BorderMetrics)cuiUniformLayerBorderMetrics {
  auto result = _props->resolveBorderMetrics(_layoutMetrics);
  // RN's uniform CALayer primitive uses its horizontal radius on both axes,
  // including percentage radii. Null corrections retain that actual primitive.
  const auto radius = result.borderRadii.topLeft.horizontal;
  result.borderRadii = {{radius, radius}, {radius, radius}, {radius, radius}, {radius, radius}};
  if ([self cuiHasProjectionRadii]) {
    CUIApplyProjectionRadii(_cuiRadii, result.borderRadii);
    result.borderRadii = CUIEnsureNoOverlap(result.borderRadii, _layoutMetrics.frame.size);
  }
  return result;
}

- (void)updateLayoutMetrics:(const LayoutMetrics &)layoutMetrics oldLayoutMetrics:(const LayoutMetrics &)oldLayoutMetrics {
  [super updateLayoutMetrics:layoutMetrics oldLayoutMetrics:oldLayoutMetrics];
  if (_cuiDrawingEnabled) {
    _cuiContainerView.frame = (CGRect){CGPointZero, self.bounds.size};
    [_cuiSwiftUIWrapper updateLayoutWithBounds:self.bounds];
  }
}
- (void)finalizeUpdates:(RNComponentViewUpdateMask)mask {
  [super finalizeUpdates:mask];
  if (_cuiDrawingEnabled && _cuiDrawingDirty) [self invalidateLayer];
}
- (void)prepareForRecycle {
  UIView *content = _cuiSwiftUIWrapper ? _cuiSwiftUIWrapper.contentView : self;
  if (_cuiContainerView) {
    for (UIView *child in [_cuiContainerView.subviews copy]) [content addSubview:child];
    [_cuiContainerView removeFromSuperview]; _cuiContainerView = nil;
  }
  if (_cuiSwiftUIWrapper) {
    for (UIView *child in [_cuiSwiftUIWrapper.contentView.subviews copy]) [self addSubview:child];
    [_cuiSwiftUIWrapper.hostingView removeFromSuperview]; _cuiSwiftUIWrapper = nil;
  }
  for (CALayer *layer in @[_cuiBackgroundColorLayer ?: NSNull.null, _cuiBorderLayer ?: NSNull.null,
      _cuiOutlineLayer ?: NSNull.null, _cuiFilterLayer ?: NSNull.null])
    if ((id)layer != NSNull.null) [layer removeFromSuperlayer];
  for (CALayer *layer in _cuiBoxShadowLayers) [layer removeFromSuperlayer];
  for (CALayer *layer in _cuiBackgroundImageLayers) [layer removeFromSuperlayer];
  _cuiBackgroundColorLayer = nil; _cuiBorderLayer = nil; _cuiOutlineLayer = nil; _cuiFilterLayer = nil;
  _cuiBoxShadowLayers = nil; _cuiBackgroundImageLayers = nil;
  _cuiRadii = nil; _cuiDrawingEnabled = NO; _cuiModeDecided = NO; _cuiDrawingDirty = NO;
  [super prepareForRecycle];
}

- (BOOL)cuiStyleWouldClipOverflowInk
{
  const auto borderMetrics = [self cuiBorderMetrics];
  BOOL nonZeroBorderWidth = !(borderMetrics.borderWidths.isUniform() && borderMetrics.borderWidths.left == 0);
  BOOL clipToPaddingBox = ReactNativeFeatureFlags::enableIOSViewClipToPaddingBox();
  return _props->getClipsContentToBounds() &&
      ((!_props->boxShadow.empty() || (clipToPaddingBox && nonZeroBorderWidth)) || _props->outlineWidth != 0);
}

// The view that is used as the receiver for all styling (borders, background,
// etc.). Most of the time, this is just `self`. When a view has a filter like
// `blur` applied, we need to wrap it in a SwiftUI view to render the effect.
// In this case, `effectiveContentView` will be the content view inside the
// SwiftUI wrapper.
- (UIView *)effectiveContentView
{
  if (!_cuiDrawingEnabled) return [super effectiveContentView];
  if (!ReactNativeFeatureFlags::enableSwiftUIBasedFilters()) {
    return self;
  }

  UIView *effectiveContentView = self;

  if (self.cuiStyleNeedsSwiftUIContainer) {
    if (_cuiSwiftUIWrapper == nullptr) {
      _cuiSwiftUIWrapper = [RCTSwiftUIContainerViewWrapper new];
      UIView *swiftUIContentView = [[UIView alloc] init];
      for (UIView *subview = nullptr in self.subviews) {
        [swiftUIContentView addSubview:subview];
      }
      swiftUIContentView.clipsToBounds = self.clipsToBounds;
      self.clipsToBounds = NO;
      swiftUIContentView.layer.mask = self.layer.mask;
      self.layer.mask = nil;
      [_cuiSwiftUIWrapper updateContentView:swiftUIContentView];
      [_cuiSwiftUIWrapper updateLayoutWithBounds:self.bounds];
      [self addSubview:_cuiSwiftUIWrapper.hostingView];

      [self transferCuiVisualPropertiesFromView:self toView:swiftUIContentView];
    }

    effectiveContentView = _cuiSwiftUIWrapper.contentView;
  } else {
    if (_cuiSwiftUIWrapper != nullptr) {
      UIView *swiftUIContentView = _cuiSwiftUIWrapper.contentView;
      for (UIView *subview = nullptr in swiftUIContentView.subviews) {
        [self addSubview:subview];
      }
      self.clipsToBounds = swiftUIContentView.clipsToBounds;
      self.layer.mask = swiftUIContentView.layer.mask;

      [self transferCuiVisualPropertiesFromView:swiftUIContentView toView:self];

      [_cuiSwiftUIWrapper.hostingView removeFromSuperview];
      _cuiSwiftUIWrapper = nil;
    }
  }

  return effectiveContentView;
}

// This UIView is the UIView that holds all subviews. It is sometimes not self
// because we want to render "overflow ink" that extends beyond the bounds of
// the view and is not affected by clipping.
- (UIView *)currentContainerView
{
  if (!_cuiDrawingEnabled) return [super currentContainerView];
  UIView *effectiveContentView = self.effectiveContentView;

  if ([self cuiStyleWouldClipOverflowInk]) {
    if (!_cuiContainerView) {
      _cuiContainerView = [[UIView alloc] initWithFrame:CGRectMake(0, 0, self.bounds.size.width, self.bounds.size.height)];
      for (UIView *subview = nullptr in effectiveContentView.subviews) {
        [_cuiContainerView addSubview:subview];
      }
      _cuiContainerView.clipsToBounds = effectiveContentView.clipsToBounds;
      effectiveContentView.clipsToBounds = NO;
      _cuiContainerView.layer.mask = effectiveContentView.layer.mask;
      effectiveContentView.layer.mask = nil;
      [effectiveContentView addSubview:_cuiContainerView];
    }

    effectiveContentView = _cuiContainerView;
  } else {
    if (_cuiContainerView) {
      for (UIView *subview in _cuiContainerView.subviews) {
        [effectiveContentView addSubview:subview];
      }
      effectiveContentView.clipsToBounds = _cuiContainerView.clipsToBounds;
      effectiveContentView.layer.mask = _cuiContainerView.layer.mask;
      [_cuiContainerView removeFromSuperview];
      _cuiContainerView = nil;
    }
  }
  return effectiveContentView;
}

- (void)invalidateLayer
{
  if (!_cuiDrawingEnabled) { [super invalidateLayer]; return; }
  _cuiDrawingDirty = NO;
  CALayer *layer = self.effectiveContentView.layer;

  if (CGSizeEqualToSize(layer.bounds.size, CGSizeZero)) {
    return;
  }

  const auto borderMetrics = [self cuiBorderMetrics];
  const auto nativeBorderMetrics = _props->resolveBorderMetrics(_layoutMetrics);
  const auto uniformLayerMetrics = [self cuiUniformLayerBorderMetrics];

  // Stage 1. Shadow Path
  BOOL const layerHasShadow = layer.shadowOpacity > 0 && CGColorGetAlpha(layer.shadowColor) > 0;
  if (layerHasShadow) {
    if (CGColorGetAlpha(self.backgroundColor.CGColor) > 0.999) {
      // If view has a solid background color, calculate shadow path from border.
      const RCTCornerInsets cornerInsets =
          RCTGetCornerInsets(RCTCornerRadiiFromBorderRadii(borderMetrics.borderRadii), UIEdgeInsetsZero);
      CGPathRef shadowPath = RCTPathCreateWithRoundedRect(self.bounds, cornerInsets, nil, NO);
      layer.shadowPath = shadowPath;
      CGPathRelease(shadowPath);
    } else {
      // Can't accurately calculate box shadow, so fall back to pixel-based shadow.
      layer.shadowPath = nil;
    }
  } else {
    layer.shadowPath = nil;
  }

#if !TARGET_OS_TV && defined(__IPHONE_OS_VERSION_MAX_ALLOWED) && \
    __IPHONE_OS_VERSION_MAX_ALLOWED >= 170000 /* __IPHONE_17_0 */
  // Stage 1.5. Cursor / Hover Effects
  if (@available(iOS 17.0, *)) {
    UIHoverStyle *hoverStyle = nil;
    if (_props->cursor == Cursor::Pointer) {
      const RCTCornerInsets cornerInsets =
          RCTGetCornerInsets(RCTCornerRadiiFromBorderRadii(borderMetrics.borderRadii), UIEdgeInsetsZero);
#if TARGET_OS_IOS
      // Due to an Apple bug, it seems on iOS, UIShapes made with `[UIShape shapeWithBezierPath:]`
      // evaluate their shape on the superviews' coordinate space. This leads to the hover shape
      // rendering incorrectly on iOS, iOS apps in compatibility mode on visionOS, but not on visionOS.
      // To work around this, for iOS, we can calculate the border path based on `view.frame` (the
      // superview's coordinate space) instead of view.bounds.
      CGPathRef borderPath = RCTPathCreateWithRoundedRect(self.frame, cornerInsets, nil, NO);
#else // TARGET_OS_VISION
      CGPathRef borderPath = RCTPathCreateWithRoundedRect(self.bounds, cornerInsets, nil, NO);
#endif
      UIBezierPath *bezierPath = [UIBezierPath bezierPathWithCGPath:borderPath];
      CGPathRelease(borderPath);
      UIShape *shape = [UIShape shapeWithBezierPath:bezierPath];

      hoverStyle = [UIHoverStyle styleWithEffect:[UIHoverAutomaticEffect effect] shape:shape];
    }
    [self setHoverStyle:hoverStyle];
  }
#endif
  const bool sourceUsesCoreAnimationBorderRendering =
      nativeBorderMetrics.borderColors.isUniform() && nativeBorderMetrics.borderWidths.isUniform() &&
      nativeBorderMetrics.borderStyles.isUniform() && nativeBorderMetrics.borderStyles.left == BorderStyle::Solid &&
      nativeBorderMetrics.borderRadii.isUniform() &&
      (
          nativeBorderMetrics.borderWidths.left == 0 || self.currentContainerView.clipsToBounds ||
          (colorComponentsFromColor(nativeBorderMetrics.borderColors.left).alpha == 0 &&
           (*nativeBorderMetrics.borderColors.left).getUIColor() != nullptr));
  const bool useCoreAnimationBorderRendering = sourceUsesCoreAnimationBorderRendering &&
      uniformLayerMetrics.borderRadii.isUniform() && CUIRadiiAreCircular(uniformLayerMetrics.borderRadii);

  // background color
  UIColor *backgroundColor = [self.backgroundColor resolvedColorWithTraitCollection:self.traitCollection];
  // The reason we sometimes do not set self.layer's backgroundColor is because
  // we want to support non-uniform border radii, which apple does not natively
  // support. To get this behavior we need to create a CGPath in the shape that
  // we want. If we mask self.layer to this path, we would be clipping subviews
  // which we may not want to do. The generalized solution in this case is just
  // create a new layer
  if (useCoreAnimationBorderRendering) {
    [_cuiBackgroundColorLayer removeFromSuperlayer];
    _cuiBackgroundColorLayer = nil;
    layer.backgroundColor = backgroundColor.CGColor;
  } else {
    layer.backgroundColor = nil;
    if (!_cuiBackgroundColorLayer) {
      _cuiBackgroundColorLayer = [CALayer layer];
      _cuiBackgroundColorLayer.zPosition = CUI_BACKGROUND_COLOR_ZPOSITION;
      [layer addSublayer:_cuiBackgroundColorLayer];
    }
    [self shapeCuiLayerToMatchView:_cuiBackgroundColorLayer borderMetrics:borderMetrics];
    _cuiBackgroundColorLayer.backgroundColor = backgroundColor.CGColor;
    [_cuiBackgroundColorLayer removeAllAnimations];
  }

  // borders
  if (useCoreAnimationBorderRendering) {
    [_cuiBorderLayer removeFromSuperlayer];
    _cuiBorderLayer = nil;

    layer.borderWidth = (CGFloat)borderMetrics.borderWidths.left;
    UIColor *borderColor = RCTUIColorFromSharedColor(borderMetrics.borderColors.left);
    layer.borderColor = borderColor.CGColor;
    layer.cornerRadius = (CGFloat)uniformLayerMetrics.borderRadii.topLeft.horizontal;
    layer.cornerCurve = CornerCurveFromBorderCurve(nativeBorderMetrics.borderCurves.topLeft);
  } else {
    if (!_cuiBorderLayer) {
      CALayer *borderLayer = [CALayer new];
      borderLayer.zPosition = CUI_BACKGROUND_COLOR_ZPOSITION + 1;
      borderLayer.frame = layer.bounds;
      borderLayer.magnificationFilter = kCAFilterNearest;
      [layer addSublayer:borderLayer];
      _cuiBorderLayer = borderLayer;
    }

    layer.borderWidth = 0;
    layer.borderColor = nil;
    layer.cornerRadius = 0;
    if (sourceUsesCoreAnimationBorderRendering)
      layer.cornerCurve = CornerCurveFromBorderCurve(nativeBorderMetrics.borderCurves.topLeft);

    RCTBorderColors borderColors = RCTCreateRCTBorderColorsFromBorderColors(borderMetrics.borderColors);

    RCTAddContourEffectToLayer(
        _cuiBorderLayer,
        RCTCornerRadiiFromBorderRadii(sourceUsesCoreAnimationBorderRendering ? uniformLayerMetrics.borderRadii : borderMetrics.borderRadii),
        borderColors,
        RCTUIEdgeInsetsFromEdgeInsets(borderMetrics.borderWidths),
        RCTBorderStyleFromBorderStyle(borderMetrics.borderStyles.left),
        sourceUsesCoreAnimationBorderRendering ? CUIUniformCornerCurve(nativeBorderMetrics.borderCurves.topLeft) : CUIMotionCornerCurves{});
  }

  // outline
  [_cuiOutlineLayer removeFromSuperlayer];
  _cuiOutlineLayer = nil;
  if (_props->outlineWidth != 0) {
    if (!_cuiOutlineLayer) {
      CALayer *outlineLayer = [CALayer new];
      outlineLayer.magnificationFilter = kCAFilterNearest;
      outlineLayer.zPosition = CUI_BACKGROUND_COLOR_ZPOSITION + 2;

      [layer addSublayer:outlineLayer];
      _cuiOutlineLayer = outlineLayer;
    }
    _cuiOutlineLayer.frame = CGRectInset(
        layer.bounds, -_props->outlineOffset - _props->outlineWidth, -_props->outlineOffset - _props->outlineWidth);

    if (borderMetrics.borderRadii.isUniform() && borderMetrics.borderRadii.topLeft.horizontal == 0) {
      UIColor *outlineColor = RCTUIColorFromSharedColor(_props->outlineColor);
      _cuiOutlineLayer.borderWidth = _props->outlineWidth;
      _cuiOutlineLayer.borderColor = outlineColor.CGColor;
    } else {
      UIColor *outlineColor = RCTUIColorFromSharedColor(_props->outlineColor);

      RCTAddContourEffectToLayer(
          _cuiOutlineLayer,
          RCTCreateOutlineCornerRadiiFromBorderRadii(
              borderMetrics.borderRadii, _props->outlineWidth, _props->outlineOffset),
          RCTBorderColors{outlineColor, outlineColor, outlineColor, outlineColor},
          UIEdgeInsets{_props->outlineWidth, _props->outlineWidth, _props->outlineWidth, _props->outlineWidth},
          RCTBorderStyleFromOutlineStyle(_props->outlineStyle),
          CUIMotionCornerCurves{});
    }
  }

  // filter
  [_cuiFilterLayer removeFromSuperlayer];
  _cuiFilterLayer = nil;
  if (_cuiSwiftUIWrapper != nullptr) {
    [_cuiSwiftUIWrapper resetStyles];
  }
  self.layer.opacity = (float)_props->opacity;
  if (!_props->filter.empty()) {
    float multiplicativeBrightness = 1;
    bool hasBrightnessFilter = false;
    for (const auto &primitive : _props->filter) {
      if (primitive.type == FilterType::DropShadow) {
        if (_cuiSwiftUIWrapper != nullptr && std::holds_alternative<DropShadowParams>(primitive.parameters)) {
          const auto &dropShadowParams = std::get<DropShadowParams>(primitive.parameters);
          UIColor *shadowColor = RCTUIColorFromSharedColor(dropShadowParams.color);
          [_cuiSwiftUIWrapper updateDropShadow:@(dropShadowParams.standardDeviation)
                                          x:@(dropShadowParams.offsetX)
                                          y:@(dropShadowParams.offsetY)
                                      color:shadowColor];
        }
      } else if (std::holds_alternative<Float>(primitive.parameters)) {
        if (primitive.type == FilterType::Brightness) {
          multiplicativeBrightness *= std::get<Float>(primitive.parameters);
          hasBrightnessFilter = true;
        } else if (primitive.type == FilterType::Opacity) {
          self.layer.opacity *= std::get<Float>(primitive.parameters);
        } else if (primitive.type == FilterType::Blur) {
          if (_cuiSwiftUIWrapper != nullptr) {
            Float blurRadius = std::get<Float>(primitive.parameters);
            [_cuiSwiftUIWrapper updateBlurRadius:@(blurRadius)];
          }
        } else if (primitive.type == FilterType::Grayscale) {
          if (_cuiSwiftUIWrapper != nullptr) {
            Float grayscale = std::get<Float>(primitive.parameters);
            [_cuiSwiftUIWrapper updateGrayscale:@(grayscale)];
          }
        } else if (primitive.type == FilterType::Saturate) {
          if (_cuiSwiftUIWrapper != nullptr) {
            Float saturation = std::get<Float>(primitive.parameters);
            [_cuiSwiftUIWrapper updateSaturation:@(saturation)];
          }
        } else if (primitive.type == FilterType::Contrast) {
          if (_cuiSwiftUIWrapper != nullptr) {
            Float contrast = std::get<Float>(primitive.parameters);
            [_cuiSwiftUIWrapper updateContrast:@(contrast)];
          }
        } else if (primitive.type == FilterType::HueRotate) {
          if (_cuiSwiftUIWrapper != nullptr) {
            Float hueRotateDegrees = std::get<Float>(primitive.parameters);
            [_cuiSwiftUIWrapper updateHueRotate:@(hueRotateDegrees)];
          }
        }
      }
    }

    if (hasBrightnessFilter) {
      _cuiFilterLayer = [CALayer layer];
      [self shapeCuiLayerToMatchView:_cuiFilterLayer borderMetrics:borderMetrics];
      _cuiFilterLayer.compositingFilter = @"multiplyBlendMode";
      _cuiFilterLayer.backgroundColor = [UIColor colorWithRed:multiplicativeBrightness
                                                     green:multiplicativeBrightness
                                                      blue:multiplicativeBrightness
                                                     alpha:self.layer.opacity]
                                         .CGColor;
      // So that this layer is always above any potential sublayers this view may
      // add
      _cuiFilterLayer.zPosition = CGFLOAT_MAX;
      [layer addSublayer:_cuiFilterLayer];
    }
  }

  // background image
  [self clearExistingCuiBackgroundImageLayers];
  if (!_props->backgroundImage.empty()) {
    const auto borderMetricsBI = [self cuiBorderMetrics];

    // background-origin: padding-box
    CGRect backgroundPositioningArea = RCTCGRectFromRect(_layoutMetrics.getPaddingFrame());
    // background-clip: border-box
    CGRect backgroundPaintingArea = self.layer.bounds;

    size_t imageIndex = _props->backgroundImage.size() - 1;
    // iterate in reverse to match CSS specification
    for (const auto &backgroundImage : std::ranges::reverse_view(_props->backgroundImage)) {
      BackgroundSize backgroundSize = BackgroundSizeLengthPercentage{};
      if (!_props->backgroundSize.empty()) {
        backgroundSize = _props->backgroundSize[imageIndex % _props->backgroundSize.size()];
      }

      BackgroundPosition backgroundPosition;
      if (!_props->backgroundPosition.empty()) {
        backgroundPosition = _props->backgroundPosition[imageIndex % _props->backgroundPosition.size()];
      }

      BackgroundRepeat backgroundRepeat;
      if (!_props->backgroundRepeat.empty()) {
        backgroundRepeat = _props->backgroundRepeat[imageIndex % _props->backgroundRepeat.size()];
      }

      CGSize backgroundImageSize = [RCTBackgroundImageUtils calculateBackgroundImageSize:backgroundPositioningArea
                                                                       itemIntrinsicSize:backgroundPositioningArea.size
                                                                          backgroundSize:backgroundSize
                                                                        backgroundRepeat:backgroundRepeat];

      CALayer *gradientLayer;

      if (std::holds_alternative<LinearGradient>(backgroundImage)) {
        const auto &linearGradient = std::get<LinearGradient>(backgroundImage);
        gradientLayer = [RCTLinearGradient gradientLayerWithSize:backgroundImageSize gradient:linearGradient];
      } else if (std::holds_alternative<RadialGradient>(backgroundImage)) {
        const auto &radialGradient = std::get<RadialGradient>(backgroundImage);
        gradientLayer = [RCTRadialGradient gradientLayerWithSize:backgroundImageSize gradient:radialGradient];
      }

      if (gradientLayer != nil) {
        CALayer *backgroundImageLayer =
            [RCTBackgroundImageUtils createBackgroundImageLayerWithSize:backgroundPositioningArea
                                                           paintingArea:backgroundPaintingArea
                                                               itemSize:backgroundImageSize
                                                     backgroundPosition:backgroundPosition
                                                       backgroundRepeat:backgroundRepeat
                                                              itemLayer:gradientLayer];
        [self shapeCuiLayerToMatchView:backgroundImageLayer borderMetrics:borderMetricsBI];
        backgroundImageLayer.masksToBounds = YES;
        backgroundImageLayer.zPosition = CUI_BACKGROUND_COLOR_ZPOSITION;
        [layer addSublayer:backgroundImageLayer];
        [_cuiBackgroundImageLayers addObject:backgroundImageLayer];
      }

      imageIndex--;
    }
  }

  // box shadow
  for (CALayer *boxShadowLayer in _cuiBoxShadowLayers) {
    [boxShadowLayer removeFromSuperlayer];
  }
  [_cuiBoxShadowLayers removeAllObjects];
  if (!_props->boxShadow.empty()) {
    if (!_cuiBoxShadowLayers) {
      _cuiBoxShadowLayers = [NSMutableArray new];
    }
    for (auto it = _props->boxShadow.rbegin(); it != _props->boxShadow.rend(); ++it) {
      CALayer *shadowLayer = RCTGetBoxShadowLayer(
          *it,
          RCTCornerRadiiFromBorderRadii(borderMetrics.borderRadii),
          RCTUIEdgeInsetsFromEdgeInsets(borderMetrics.borderWidths),
          self.layer.bounds.size);
      shadowLayer.zPosition = _cuiBorderLayer.zPosition;
      [layer addSublayer:shadowLayer];
      [_cuiBoxShadowLayers addObject:shadowLayer];
    }
  }

  // clipping
  CALayer *containerLayer = self.currentContainerView.layer;
  containerLayer.mask = nil;
  if (self.currentContainerView.clipsToBounds) {
    const BOOL clipToPaddingBox = ReactNativeFeatureFlags::enableIOSViewClipToPaddingBox();
    const BOOL sourceUsesScalarClip = nativeBorderMetrics.borderRadii.isUniform() &&
        (!clipToPaddingBox || (nativeBorderMetrics.borderWidths.isUniform() && nativeBorderMetrics.borderWidths.left == 0));
    if (sourceUsesScalarClip) {
      if (uniformLayerMetrics.borderRadii.isUniform() && CUIRadiiAreCircular(uniformLayerMetrics.borderRadii)) {
        containerLayer.cornerRadius = uniformLayerMetrics.borderRadii.topLeft.horizontal;
      } else {
        // RN does not assign cornerCurve here. Preserve the actual inherited
        // curve, including a circular overflow container around a continuous root.
        const auto curve = [containerLayer.cornerCurve isEqualToString:kCACornerCurveContinuous]
            ? BorderCurve::Continuous : BorderCurve::Circular;
        containerLayer.cornerRadius = 0;
        containerLayer.mask = [self createCuiMaskLayer:self.bounds
            cornerInsets:RCTGetCornerInsets(RCTCornerRadiiFromBorderRadii(uniformLayerMetrics.borderRadii), UIEdgeInsetsZero)
            cornerCurves:CUIUniformCornerCurve(curve)];
      }
    } else {
      const CGRect clipBounds = clipToPaddingBox ? RCTCGRectFromRect(_layoutMetrics.getPaddingFrame()) : self.bounds;
      const UIEdgeInsets clipInsets = clipToPaddingBox ? RCTUIEdgeInsetsFromEdgeInsets(borderMetrics.borderWidths) : UIEdgeInsetsZero;
      containerLayer.mask = [self createCuiMaskLayer:clipBounds
          cornerInsets:RCTGetCornerInsets(RCTCornerRadiiFromBorderRadii(borderMetrics.borderRadii), clipInsets)
          cornerCurves:CUIMotionCornerCurves{}];
    }
    if (!clipToPaddingBox) {
      for (UIView *subview in self.currentContainerView.subviews) {
        if ([subview isKindOfClass:[UIImageView class]]) {
          RCTCornerInsets cornerInsets = RCTGetCornerInsets(RCTCornerRadiiFromBorderRadii(borderMetrics.borderRadii),
              RCTUIEdgeInsetsFromEdgeInsets(borderMetrics.borderWidths));
          subview.layer.mask = [self createCuiMaskLayer:subview.bounds cornerInsets:cornerInsets cornerCurves:CUIMotionCornerCurves{}];
        }
      }
    }
  }
}

// Shapes the given layer to match the shape of this View's layer. This is
// basically just accounting for size, position, and border radius.
- (void)shapeCuiLayerToMatchView:(CALayer *)layer borderMetrics:(BorderMetrics)borderMetrics
{
  layer.frame = CGRectMake(0, 0, self.layer.bounds.size.width, self.layer.bounds.size.height);
  const auto nativeBorderMetrics = _props->resolveBorderMetrics(_layoutMetrics);
  const BOOL sourceUsesUniformLayer = nativeBorderMetrics.borderRadii.isUniform();
  const auto resolved = sourceUsesUniformLayer ? [self cuiUniformLayerBorderMetrics] : borderMetrics;
  if (sourceUsesUniformLayer && resolved.borderRadii.isUniform() && CUIRadiiAreCircular(resolved.borderRadii)) {
    layer.mask = nil;
    layer.cornerRadius = resolved.borderRadii.topLeft.horizontal;
    layer.cornerCurve = CornerCurveFromBorderCurve(nativeBorderMetrics.borderCurves.topLeft);
  } else {
    const auto curves = sourceUsesUniformLayer ? CUIUniformCornerCurve(nativeBorderMetrics.borderCurves.topLeft) : CUIMotionCornerCurves{};
    layer.mask = [self createCuiMaskLayer:self.bounds
        cornerInsets:RCTGetCornerInsets(RCTCornerRadiiFromBorderRadii(resolved.borderRadii), UIEdgeInsetsZero)
        cornerCurves:curves];
    layer.cornerRadius = 0;
  }
}

- (CAShapeLayer *)createCuiMaskLayer:(CGRect)bounds cornerInsets:(RCTCornerInsets)cornerInsets
    cornerCurves:(CUIMotionCornerCurves)curves
{
  CGPathRef path = CUIPathCreateWithRoundedRect(bounds, cornerInsets, curves);
  CAShapeLayer *maskLayer = [CAShapeLayer layer];
  maskLayer.path = path;
  CGPathRelease(path);
  return maskLayer;
}

- (void)clearExistingCuiBackgroundImageLayers
{
  if (_cuiBackgroundImageLayers == nil) {
    _cuiBackgroundImageLayers = [NSMutableArray new];
    return;
  }
  for (CALayer *backgroundImageLayer in _cuiBackgroundImageLayers) {
    [backgroundImageLayer removeFromSuperlayer];
  }
  [_cuiBackgroundImageLayers removeAllObjects];
}


- (BOOL)cuiStyleNeedsSwiftUIContainer
{
  if (!_props->filter.empty()) {
    for (const auto &primitive : _props->filter) {
      if (primitive.type == FilterType::Blur || primitive.type == FilterType::Grayscale ||
          primitive.type == FilterType::DropShadow || primitive.type == FilterType::Saturate ||
          primitive.type == FilterType::Contrast || primitive.type == FilterType::HueRotate) {
        return YES;
      }
    }
  }
  return NO;
}

- (void)transferCuiVisualPropertiesFromView:(UIView *)sourceView toView:(UIView *)destinationView
{
  // shadow
  destinationView.layer.shadowColor = sourceView.layer.shadowColor;
  sourceView.layer.shadowColor = nil;
  destinationView.layer.shadowOffset = sourceView.layer.shadowOffset;
  sourceView.layer.shadowOffset = CGSizeZero;
  destinationView.layer.shadowOpacity = sourceView.layer.shadowOpacity;
  sourceView.layer.shadowOpacity = 0;
  destinationView.layer.shadowRadius = sourceView.layer.shadowRadius;
  sourceView.layer.shadowRadius = 0;

  // background
  destinationView.layer.backgroundColor = sourceView.layer.backgroundColor;
  sourceView.layer.backgroundColor = nil;
  if (_cuiBackgroundColorLayer != nullptr) {
    [destinationView.layer addSublayer:_cuiBackgroundColorLayer];
  }

  // border
  destinationView.layer.borderColor = sourceView.layer.borderColor;
  sourceView.layer.borderColor = nil;
  destinationView.layer.borderWidth = sourceView.layer.borderWidth;
  sourceView.layer.borderWidth = 0;

  // corner
  destinationView.layer.cornerRadius = sourceView.layer.cornerRadius;
  sourceView.layer.cornerRadius = 0;
  destinationView.layer.cornerCurve = sourceView.layer.cornerCurve;

  // custom layers
  if (_cuiBorderLayer != nullptr) {
    [destinationView.layer addSublayer:_cuiBorderLayer];
  }
  if (_cuiOutlineLayer != nullptr) {
    [destinationView.layer addSublayer:_cuiOutlineLayer];
  }
  if (_cuiFilterLayer != nullptr) {
    [destinationView.layer addSublayer:_cuiFilterLayer];
  }
  for (CALayer *layer = nullptr in _cuiBackgroundImageLayers) {
    [destinationView.layer addSublayer:layer];
  }
  for (CALayer *layer = nullptr in _cuiBoxShadowLayers) {
    [destinationView.layer addSublayer:layer];
  }
}


@end
