/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Drawing-only adaptation of RN0.86.3 border and box-shadow painters; native curves replace circular paths.
#import "CUIMotionDrawingGeometry.h"
#import "CUIMotionContinuousCorners.h"
#import <React/RCTLog.h>
#import <React/RCTUtils.h>
#import <React/RCTConversions.h>
#include <algorithm>
#include <array>
#include <cmath>
#include <iterator>
#include <vector>

static BOOL CUIHasContinuous(const CUIMotionCornerCurves &curves) {
  using facebook::react::BorderCurve;
  return curves.topLeft == BorderCurve::Continuous || curves.topRight == BorderCurve::Continuous ||
      curves.bottomLeft == BorderCurve::Continuous || curves.bottomRight == BorderCurve::Continuous;
}

CGPathRef CUIPathCreateWithRoundedRect(
    CGRect bounds, RCTCornerInsets insets, const CUIMotionCornerCurves &curves, BOOL inverted, BOOL permitsNativeCircularContour) {
  if (!CUIHasContinuous(curves)) return RCTPathCreateWithRoundedRect(bounds, insets, nil, inverted);
  using facebook::react::BorderCurve;
  NSUInteger corners = (curves.topLeft == BorderCurve::Continuous ? UIRectCornerTopLeft : 0) |
      (curves.topRight == BorderCurve::Continuous ? UIRectCornerTopRight : 0) |
      (curves.bottomLeft == BorderCurve::Continuous ? UIRectCornerBottomLeft : 0) |
      (curves.bottomRight == BorderCurve::Continuous ? UIRectCornerBottomRight : 0);
  UIBezierPath *path = [CUIMotionContinuousCorners pathForBounds:bounds
      topLeft:insets.topLeft topRight:insets.topRight bottomLeft:insets.bottomLeft bottomRight:insets.bottomRight
      continuousCorners:corners];
  if (!path && permitsNativeCircularContour && NSThread.isMainThread &&
      std::isfinite(bounds.origin.x) && std::isfinite(bounds.origin.y)) {
    const CGFloat dimensions[] = {bounds.size.width, bounds.size.height,
        insets.topLeft.width, insets.topLeft.height, insets.topRight.width, insets.topRight.height,
        insets.bottomLeft.width, insets.bottomLeft.height, insets.bottomRight.width, insets.bottomRight.height};
    const BOOL valid = std::all_of(std::begin(dimensions), std::end(dimensions),
        [](CGFloat value) { return std::isfinite(value) && value >= 0; });
    if (valid) return RCTPathCreateWithRoundedRect(bounds, insets, nil, inverted);
  }
  if (!path)
    @throw [NSException exceptionWithName:@"CUI.MotionDrawing"
        reason:@"Exact mixed continuous corner overlap or native path extraction remains unproved" userInfo:nil];
  return CGPathCreateCopy((inverted ? path.bezierPathByReversingPath : path).CGPath);
}

static const CGFloat RCTViewBorderThreshold = 0.001;
static UIEdgeInsets RCTRoundInsetsToPixel(UIEdgeInsets edgeInsets) {
  return {RCTRoundPixelValue(edgeInsets.top), RCTRoundPixelValue(edgeInsets.left),
      RCTRoundPixelValue(edgeInsets.bottom), RCTRoundPixelValue(edgeInsets.right)};
}

static void
RCTEllipseGetIntersectionsWithLine(CGRect ellipseBounds, CGPoint lineStart, CGPoint lineEnd, CGPoint intersections[2])
{
  const CGPoint ellipseCenter = {CGRectGetMidX(ellipseBounds), CGRectGetMidY(ellipseBounds)};

  lineStart.x -= ellipseCenter.x;
  lineStart.y -= ellipseCenter.y;
  lineEnd.x -= ellipseCenter.x;
  lineEnd.y -= ellipseCenter.y;

  const CGFloat m = (lineEnd.y - lineStart.y) / (lineEnd.x - lineStart.x);
  const CGFloat a = ellipseBounds.size.width / 2;
  const CGFloat b = ellipseBounds.size.height / 2;
  const CGFloat c = lineStart.y - m * lineStart.x;
  const CGFloat A = (b * b + a * a * m * m);
  const CGFloat B = 2 * a * a * c * m;
  const CGFloat D = sqrt((a * a * (b * b - c * c)) / A + pow(B / (2 * A), 2));

  const CGFloat x_ = -B / (2 * A);
  const CGFloat x1 = x_ + D;
  const CGFloat x2 = x_ - D;
  const CGFloat y1 = m * x1 + c;
  const CGFloat y2 = m * x2 + c;

  intersections[0] = (CGPoint){x1 + ellipseCenter.x, y1 + ellipseCenter.y};
  intersections[1] = (CGPoint){x2 + ellipseCenter.x, y2 + ellipseCenter.y};
}

NS_INLINE BOOL RCTCornerRadiiAreAboveThreshold(RCTCornerRadii cornerRadii)
{
  return (
      cornerRadii.topLeftHorizontal > RCTViewBorderThreshold || cornerRadii.topLeftVertical > RCTViewBorderThreshold ||
      cornerRadii.topRightHorizontal > RCTViewBorderThreshold ||
      cornerRadii.topRightVertical > RCTViewBorderThreshold ||
      cornerRadii.bottomLeftHorizontal > RCTViewBorderThreshold ||
      cornerRadii.bottomLeftVertical > RCTViewBorderThreshold ||
      cornerRadii.bottomRightHorizontal > RCTViewBorderThreshold ||
      cornerRadii.bottomRightVertical > RCTViewBorderThreshold);
}

static CGPathRef CUIPathCreateOuterOutline(BOOL drawToEdge, CGRect rect, RCTCornerRadii cornerRadii, const CUIMotionCornerCurves &curves, BOOL permitsNativeCircularContour)
{
  if (drawToEdge) {
    return CGPathCreateWithRect(rect, NULL);
  }

  return CUIPathCreateWithRoundedRect(rect, RCTGetCornerInsets(cornerRadii, UIEdgeInsetsZero), curves, NO, permitsNativeCircularContour);
}

static UIGraphicsImageRenderer *
RCTMakeUIGraphicsImageRenderer(CGSize size, UIColor *backgroundColor, BOOL hasCornerRadii, BOOL drawToEdge)
{
  const CGFloat alpha = CGColorGetAlpha(backgroundColor.CGColor);
  const BOOL opaque = (drawToEdge || !hasCornerRadii) && alpha == 1.0;
  UIGraphicsImageRendererFormat *const rendererFormat = [UIGraphicsImageRendererFormat defaultFormat];
  rendererFormat.opaque = opaque;
  UIGraphicsImageRenderer *const renderer = [[UIGraphicsImageRenderer alloc] initWithSize:size format:rendererFormat];
  return renderer;
}

// Intersect the border-width ray with the emitted native curve. Ellipse-only
// intersections can leave an unpainted wedge beside a continuous inner corner.
static CGPoint CUIContourJoin(CGPathRef path, CGPoint origin, CGPoint directionPoint) {
  const CGPoint direction{directionPoint.x - origin.x, directionPoint.y - origin.y};
  const double magnitude = direction.x * direction.x + direction.y * direction.y;
  if (magnitude == 0) return directionPoint;
  __block CGPoint current{};
  __block CGPoint subpathStart{};
  __block CGPoint closest = directionPoint;
  __block double closestDistance = INFINITY;
  CGPathApplyWithBlock(path, ^(const CGPathElement *element) {
    if (element->type == kCGPathElementMoveToPoint) {
      current = subpathStart = element->points[0];
      return;
    }
    std::array<CGPoint, 4> points{current};
    int degree = 1;
    switch (element->type) {
      case kCGPathElementAddCurveToPoint:
        degree = 3;
        break;
      case kCGPathElementAddQuadCurveToPoint:
        degree = 2;
        break;
      case kCGPathElementCloseSubpath:
        points[1] = subpathStart;
        break;
      default:
        break;
    }
    if (element->type != kCGPathElementCloseSubpath)
      for (int index = 1; index <= degree; index++) points[index] = element->points[index - 1];
    current = points[degree];
    std::array<double, 4> values{};
    for (int index = 0; index <= degree; index++)
      values[index] = (points[index].x - origin.x) * direction.y -
          (points[index].y - origin.y) * direction.x;
    const double a = degree == 3 ? -values[0] + 3 * values[1] - 3 * values[2] + values[3] : 0;
    const double b = degree == 3 ? 3 * values[0] - 6 * values[1] + 3 * values[2] :
        degree == 2 ? values[0] - 2 * values[1] + values[2] : 0;
    const double c = degree == 3 ? -3 * values[0] + 3 * values[1] :
        degree == 2 ? -2 * values[0] + 2 * values[1] : values[1] - values[0];
    const double d = values[0];
    const auto evaluate = [&](double position) { return ((a * position + b) * position + c) * position + d; };
    std::vector<double> intervals{0, 1};
    const auto addInterval = [&](double position) { if (position > 0 && position < 1) intervals.push_back(position); };
    if (a != 0) {
      const double discriminant = 4 * b * b - 12 * a * c;
      if (discriminant >= 0) {
        addInterval((-2 * b - std::sqrt(discriminant)) / (6 * a));
        addInterval((-2 * b + std::sqrt(discriminant)) / (6 * a));
      }
    } else if (b != 0) {
      addInterval(-c / (2 * b));
    }
    std::sort(intervals.begin(), intervals.end());
    double *distanceStorage = &closestDistance;
    CGPoint *pointStorage = &closest;
    const auto candidate = [&](double position) {
      auto evaluated = points;
      for (int remaining = degree; remaining > 0; remaining--)
        for (int index = 0; index < remaining; index++)
          evaluated[index] = CGPoint{
              evaluated[index].x + (evaluated[index + 1].x - evaluated[index].x) * position,
              evaluated[index].y + (evaluated[index + 1].y - evaluated[index].y) * position};
      const CGPoint point = evaluated[0];
      const double distance = ((point.x - origin.x) * direction.x + (point.y - origin.y) * direction.y) / magnitude;
      if (distance >= 0 && distance < *distanceStorage) { *distanceStorage = distance; *pointStorage = point; }
    };
    const double tolerance = std::max({std::abs(a), std::abs(b), std::abs(c), std::abs(d), 1.0}) * 1e-12;
    for (double position : intervals) if (std::abs(evaluate(position)) <= tolerance) candidate(position);
    for (size_t index = 1; index < intervals.size(); index++) {
      double low = intervals[index - 1];
      double high = intervals[index];
      const double lowValue = evaluate(low);
      if ((lowValue < 0) == (evaluate(high) < 0)) continue;
      for (int iteration = 0; iteration < 60; iteration++) {
        const double middle = (low + high) / 2;
        if ((evaluate(middle) < 0) == (lowValue < 0)) low = middle; else high = middle;
      }
      candidate((low + high) / 2);
    }
  });
  return closest;
}

static UIImage *CUIGetSolidBorderImage(
    RCTCornerRadii cornerRadii,
    CGSize viewSize,
    UIEdgeInsets borderInsets,
    RCTBorderColors borderColors,
    UIColor *backgroundColor,
    BOOL drawToEdge, const CUIMotionCornerCurves &curves, BOOL permitsNativeCircularContour)
{
  const BOOL hasCornerRadii = RCTCornerRadiiAreAboveThreshold(cornerRadii);
  const RCTCornerInsets cornerInsets = RCTGetCornerInsets(cornerRadii, borderInsets);

  // Incorrect render for borders that are not proportional to device pixel: borders get stretched and become
  // significantly bigger than expected.
  // Rdar: http://www.openradar.me/15959788
  borderInsets = RCTRoundInsetsToPixel(borderInsets);

  const BOOL makeStretchable = !CUIHasContinuous(curves) &&
      (borderInsets.left + cornerInsets.topLeft.width + borderInsets.right + cornerInsets.bottomRight.width <=
       viewSize.width) &&
      (borderInsets.left + cornerInsets.bottomLeft.width + borderInsets.right + cornerInsets.topRight.width <=
       viewSize.width) &&
      (borderInsets.top + cornerInsets.topLeft.height + borderInsets.bottom + cornerInsets.bottomRight.height <=
       viewSize.height) &&
      (borderInsets.top + cornerInsets.topRight.height + borderInsets.bottom + cornerInsets.bottomLeft.height <=
       viewSize.height);

  UIEdgeInsets edgeInsets =
      (UIEdgeInsets){borderInsets.top + MAX(cornerInsets.topLeft.height, cornerInsets.topRight.height),
                     borderInsets.left + MAX(cornerInsets.topLeft.width, cornerInsets.bottomLeft.width),
                     borderInsets.bottom + MAX(cornerInsets.bottomLeft.height, cornerInsets.bottomRight.height),
                     borderInsets.right + MAX(cornerInsets.bottomRight.width, cornerInsets.topRight.width)};

  const CGSize size = makeStretchable ? (CGSize){
    // 1pt for the middle stretchable area along each axis
    // we also need to round the edge insets to avoid border bleeding
    // this is because if the size is decimal, when calculating the unit
    // rectangle for CALayer.contentsCenter we encounter rounding errors
    // which causes visual glitches
    ceil(edgeInsets.left) + 1 + ceil(edgeInsets.right),
    ceil(edgeInsets.top) + 1 + ceil(edgeInsets.bottom),
  } : viewSize;

  UIGraphicsImageRenderer *const imageRenderer =
      RCTMakeUIGraphicsImageRenderer(size, backgroundColor, hasCornerRadii, drawToEdge);

  UIImage *image = [imageRenderer imageWithActions:^(UIGraphicsImageRendererContext *_Nonnull rendererContext) {
    const CGContextRef context = rendererContext.CGContext;
    const CGRect rect = {.size = size};
    CGPathRef path = CUIPathCreateOuterOutline(drawToEdge, rect, cornerRadii, curves, permitsNativeCircularContour);

    if (backgroundColor) {
      CGContextSetFillColorWithColor(context, backgroundColor.CGColor);
      CGContextAddPath(context, path);
      CGContextFillPath(context);
    }

    CGContextAddPath(context, path);
    CGPathRelease(path);

    CGPathRef insetPath =
        CUIPathCreateWithRoundedRect(UIEdgeInsetsInsetRect(rect, borderInsets), cornerInsets, curves, NO, permitsNativeCircularContour);

    CGContextAddPath(context, insetPath);
    CGContextEOClip(context);

    BOOL hasEqualColors = RCTBorderColorsAreEqual(borderColors);
    if ((drawToEdge || !hasCornerRadii) && hasEqualColors) {
      CGContextSetFillColorWithColor(context, borderColors.left.CGColor);
      CGContextAddRect(context, rect);
      CGContextAddPath(context, insetPath);
      CGContextEOFillPath(context);

    } else {
      CGPoint topLeft = (CGPoint){borderInsets.left, borderInsets.top};
      if (CUIHasContinuous(curves)) {
        topLeft = CUIContourJoin(insetPath, CGPointZero, topLeft);
      } else if (cornerInsets.topLeft.width > 0 && cornerInsets.topLeft.height > 0) {
        CGPoint points[2];
        RCTEllipseGetIntersectionsWithLine(
            (CGRect){topLeft, {2 * cornerInsets.topLeft.width, 2 * cornerInsets.topLeft.height}},
            CGPointZero,
            topLeft,
            points);
        if (!isnan(points[1].x) && !isnan(points[1].y)) {
          topLeft = points[1];
        }
      }

      CGPoint bottomLeft = (CGPoint){borderInsets.left, size.height - borderInsets.bottom};
      if (CUIHasContinuous(curves)) {
        bottomLeft = CUIContourJoin(insetPath, CGPoint{0, size.height}, bottomLeft);
      } else if (cornerInsets.bottomLeft.width > 0 && cornerInsets.bottomLeft.height > 0) {
        CGPoint points[2];
        RCTEllipseGetIntersectionsWithLine(
            (CGRect){{bottomLeft.x, bottomLeft.y - 2 * cornerInsets.bottomLeft.height},
                     {2 * cornerInsets.bottomLeft.width, 2 * cornerInsets.bottomLeft.height}},
            (CGPoint){0, size.height},
            bottomLeft,
            points);
        if (!isnan(points[1].x) && !isnan(points[1].y)) {
          bottomLeft = points[1];
        }
      }

      CGPoint topRight = (CGPoint){size.width - borderInsets.right, borderInsets.top};
      if (CUIHasContinuous(curves)) {
        topRight = CUIContourJoin(insetPath, CGPoint{size.width, 0}, topRight);
      } else if (cornerInsets.topRight.width > 0 && cornerInsets.topRight.height > 0) {
        CGPoint points[2];
        RCTEllipseGetIntersectionsWithLine(
            (CGRect){{topRight.x - 2 * cornerInsets.topRight.width, topRight.y},
                     {2 * cornerInsets.topRight.width, 2 * cornerInsets.topRight.height}},
            (CGPoint){size.width, 0},
            topRight,
            points);
        if (!isnan(points[0].x) && !isnan(points[0].y)) {
          topRight = points[0];
        }
      }

      CGPoint bottomRight = (CGPoint){size.width - borderInsets.right, size.height - borderInsets.bottom};
      if (CUIHasContinuous(curves)) {
        bottomRight = CUIContourJoin(insetPath, CGPoint{size.width, size.height}, bottomRight);
      } else if (cornerInsets.bottomRight.width > 0 && cornerInsets.bottomRight.height > 0) {
        CGPoint points[2];
        RCTEllipseGetIntersectionsWithLine(
            (CGRect){{bottomRight.x - 2 * cornerInsets.bottomRight.width,
                      bottomRight.y - 2 * cornerInsets.bottomRight.height},
                     {2 * cornerInsets.bottomRight.width, 2 * cornerInsets.bottomRight.height}},
            (CGPoint){size.width, size.height},
            bottomRight,
            points);
        if (!isnan(points[0].x) && !isnan(points[0].y)) {
          bottomRight = points[0];
        }
      }

      UIColor *currentColor = nil;

      // RIGHT
      if (borderInsets.right > 0) {
        const CGPoint points[] = {
            (CGPoint){size.width, 0},
            topRight,
            bottomRight,
            (CGPoint){size.width, size.height},
        };

        currentColor = borderColors.right;
        CGContextAddLines(context, points, sizeof(points) / sizeof(*points));
      }

      // BOTTOM
      if (borderInsets.bottom > 0) {
        const CGPoint points[] = {
            (CGPoint){0, size.height},
            bottomLeft,
            bottomRight,
            (CGPoint){size.width, size.height},
        };

        if (!CGColorEqualToColor(currentColor.CGColor, borderColors.bottom.CGColor)) {
          CGContextSetFillColorWithColor(context, currentColor.CGColor);
          CGContextFillPath(context);
          currentColor = borderColors.bottom;
        }
        CGContextAddLines(context, points, sizeof(points) / sizeof(*points));
      }

      // LEFT
      if (borderInsets.left > 0) {
        const CGPoint points[] = {
            CGPointZero,
            topLeft,
            bottomLeft,
            (CGPoint){0, size.height},
        };

        if (!CGColorEqualToColor(currentColor.CGColor, borderColors.left.CGColor)) {
          CGContextSetFillColorWithColor(context, currentColor.CGColor);
          CGContextFillPath(context);
          currentColor = borderColors.left;
        }
        CGContextAddLines(context, points, sizeof(points) / sizeof(*points));
      }

      // TOP
      if (borderInsets.top > 0) {
        const CGPoint points[] = {
            CGPointZero,
            topLeft,
            topRight,
            (CGPoint){size.width, 0},
        };

        if (!CGColorEqualToColor(currentColor.CGColor, borderColors.top.CGColor)) {
          CGContextSetFillColorWithColor(context, currentColor.CGColor);
          CGContextFillPath(context);
          currentColor = borderColors.top;
        }
        CGContextAddLines(context, points, sizeof(points) / sizeof(*points));
      }

      CGContextSetFillColorWithColor(context, currentColor.CGColor);
      CGContextFillPath(context);
    }

    CGPathRelease(insetPath);
  }];

  if (makeStretchable) {
    image = [image resizableImageWithCapInsets:edgeInsets];
  }

  return image;
}

// Currently, the dashed / dotted implementation only supports a single colour,
// as that's currently required and supported on Android.
//
// Supporting individual widths + colours on each side is possible by modifying
// the current implementation. The idea is that we will draw four different lines
// and clip appropriately for each side (might require adjustment of phase so that
// they line up but even browsers don't do a good job at that).
//
// Firstly, create two paths for the outer and inner paths. The inner path is
// generated exactly the same way as the outer, just given an inset rect, derived
// from the insets on each side. Then clip using the odd-even rule
// (CGContextEOClip()). This will give us a nice rounded (possibly) clip mask.
//
// +----------------------------------+
// |@@@@@@@@  Clipped Space  @@@@@@@@@|
// |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@|
// |@@+----------------------+@@@@@@@@|
// |@@|                      |@@@@@@@@|
// |@@|                      |@@@@@@@@|
// |@@|                      |@@@@@@@@|
// |@@+----------------------+@@@@@@@@|
// |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@|
// +----------------------------------+
//
// Afterwards, we create a clip path for each border side (CGContextSaveGState()
// and CGContextRestoreGState() when drawing each side). The clip mask for each
// segment is a trapezoid connecting corresponding edges of the inner and outer
// rects. For example, in the case of the top edge, the points would be:
// - (MinX(outer), MinY(outer))
// - (MaxX(outer), MinY(outer))
// - (MinX(inner) + topLeftRadius, MinY(inner) + topLeftRadius)
// - (MaxX(inner) - topRightRadius, MinY(inner) + topRightRadius)
//
//         +------------------+
//         |\                /|
//         | \              / |
//         |  \    top     /  |
//         |   \          /   |
//         |    \        /    |
//         |     +------+     |
//         |     |      |     |
//         |     |      |     |
//         |     |      |     |
//         |left |      |right|
//         |     |      |     |
//         |     |      |     |
//         |     +------+     |
//         |    /        \    |
//         |   /          \   |
//         |  /            \  |
//         | /    bottom    \ |
//         |/                \|
//         +------------------+
//
//
// Note that this approach will produce discontinuous colour changes at the edge
// (which is okay). The reason is that Quartz does not currently support drawing
// of gradients _along_ a path (NB: clipping a path and drawing a linear gradient
// is _not_ equivalent).

static UIImage *CUIGetDashedOrDottedBorderImage(
    RCTBorderStyle borderStyle,
    RCTCornerRadii cornerRadii,
    CGSize viewSize,
    UIEdgeInsets borderInsets,
    RCTBorderColors borderColors,
    UIColor *backgroundColor,
    BOOL drawToEdge, const CUIMotionCornerCurves &curves, BOOL permitsNativeCircularContour)
{
  NSCParameterAssert(borderStyle == RCTBorderStyleDashed || borderStyle == RCTBorderStyleDotted);

  if (!RCTBorderColorsAreEqual(borderColors)) {
    RCTLogWarn(@"Unsupported dashed / dotted border style");
    return nil;
  }

  const CGFloat lineWidth = RCTMaxBorderInset(borderInsets);
  if (lineWidth <= 0.0) {
    return nil;
  }

  const BOOL hasCornerRadii = RCTCornerRadiiAreAboveThreshold(cornerRadii);
  UIGraphicsImageRenderer *const imageRenderer =
      RCTMakeUIGraphicsImageRenderer(viewSize, backgroundColor, hasCornerRadii, drawToEdge);
  return [imageRenderer imageWithActions:^(UIGraphicsImageRendererContext *_Nonnull rendererContext) {
    const CGContextRef context = rendererContext.CGContext;
    const CGRect rect = {.size = viewSize};

    if (backgroundColor) {
      CGPathRef outerPath = CUIPathCreateOuterOutline(drawToEdge, rect, cornerRadii, curves, permitsNativeCircularContour);
      CGContextAddPath(context, outerPath);
      CGPathRelease(outerPath);

      CGContextSetFillColorWithColor(context, backgroundColor.CGColor);
      CGContextFillPath(context);
    }

    // Stroking means that the width is divided in half and grows in both directions
    // perpendicular to the path, that's why we inset by half the width, so that it
    // reaches the edge of the rect.
    CGRect pathRect = CGRectInset(rect, lineWidth / 2.0, lineWidth / 2.0);
    CGPathRef path =
        CUIPathCreateWithRoundedRect(pathRect, RCTGetCornerInsets(cornerRadii, UIEdgeInsetsZero), curves, NO, permitsNativeCircularContour);

    if (!RCTBorderInsetsAreEqual(borderInsets)) {
      CGContextSaveGState(context);
      {
        // Create a path representing the full rect
        CGMutablePathRef outerPath = CGPathCreateMutable();
        CGPathAddRect(outerPath, NULL, rect);

        CGRect insetRect = CGRectMake(
            rect.origin.x + borderInsets.left,
            rect.origin.y + borderInsets.top,
            rect.size.width - borderInsets.left - borderInsets.right,
            rect.size.height - borderInsets.top - borderInsets.bottom);

        // The padding edge (inner border) radius is the outer border radius minus the corresponding border thickness
        CGPathRef innerRoundedRect =
            CUIPathCreateWithRoundedRect(insetRect, RCTGetCornerInsets(cornerRadii, borderInsets), curves, NO, permitsNativeCircularContour);

        // Add both paths to outerPath
        CGPathAddPath(outerPath, NULL, innerRoundedRect);

        // Clip using even-odd
        CGContextAddPath(context, outerPath);
        CGContextEOClip(context);
        CGPathRelease(outerPath);
        CGPathRelease(innerRoundedRect);
      }
    }

    CGFloat dashLengths[2];
    dashLengths[0] = dashLengths[1] = (borderStyle == RCTBorderStyleDashed ? 3 : 1) * lineWidth;

    CGContextSetLineWidth(context, lineWidth);
    CGContextSetLineDash(context, 0, dashLengths, sizeof(dashLengths) / sizeof(*dashLengths));

    CGContextSetStrokeColorWithColor(context, [UIColor yellowColor].CGColor);

    CGContextAddPath(context, path);
    CGContextSetStrokeColorWithColor(context, borderColors.top.CGColor);
    CGContextStrokePath(context);

    CGPathRelease(path);
  }];
}

UIImage *CUIGetBorderImage(
    RCTBorderStyle borderStyle,
    CGSize viewSize,
    RCTCornerRadii cornerRadii,
    UIEdgeInsets borderInsets,
    RCTBorderColors borderColors,
    UIColor *backgroundColor,
    BOOL drawToEdge, const CUIMotionCornerCurves &curves, BOOL permitsNativeCircularContour)
{
  switch (borderStyle) {
    case RCTBorderStyleSolid:
      return CUIGetSolidBorderImage(cornerRadii, viewSize, borderInsets, borderColors, backgroundColor, drawToEdge, curves, permitsNativeCircularContour);
    case RCTBorderStyleDashed:
    case RCTBorderStyleDotted:
      return CUIGetDashedOrDottedBorderImage(
          borderStyle, cornerRadii, viewSize, borderInsets, borderColors, backgroundColor, drawToEdge, curves, permitsNativeCircularContour);
    case RCTBorderStyleUnset:
      break;
  }

  return nil;
}

using namespace facebook::react;
// See https://drafts.csswg.org/css-backgrounds/#shadow-shape
static CGFloat adjustedCornerRadius(CGFloat cornerRadius, CGFloat spreadDistance)
{
  CGFloat adjustment = spreadDistance;
  (void)adjustment;
  if (cornerRadius < abs(spreadDistance)) {
    const CGFloat r = cornerRadius / (CGFloat)abs(spreadDistance);
    const CGFloat p = (CGFloat)pow(r - 1.0, 3.0);
    adjustment *= 1.0 + p;
  }

  return fmax(cornerRadius + adjustment, 0);
}

static RCTCornerRadii cornerRadiiForBoxShadow(RCTCornerRadii cornerRadii, CGFloat spreadDistance)
{
  return {
      adjustedCornerRadius(cornerRadii.topLeftHorizontal, spreadDistance),
      adjustedCornerRadius(cornerRadii.topLeftVertical, spreadDistance),
      adjustedCornerRadius(cornerRadii.topRightHorizontal, spreadDistance),
      adjustedCornerRadius(cornerRadii.topRightVertical, spreadDistance),
      adjustedCornerRadius(cornerRadii.bottomLeftHorizontal, spreadDistance),
      adjustedCornerRadius(cornerRadii.bottomLeftVertical, spreadDistance),
      adjustedCornerRadius(cornerRadii.bottomRightHorizontal, spreadDistance),
      adjustedCornerRadius(cornerRadii.bottomRightVertical, spreadDistance)};
}

static CGRect insetRect(CGRect rect, CGFloat left, CGFloat top, CGFloat right, CGFloat bottom)
{
  return CGRectMake(
      rect.origin.x + left, rect.origin.y + top, rect.size.width - right - left, rect.size.height - bottom - top);
}

static CGColorRef colorRefFromSharedColor(const SharedColor &color)
{
  CGColorRef colorRef = RCTUIColorFromSharedColor(color).CGColor;
  return (colorRef != nullptr) ? colorRef : [UIColor blackColor].CGColor;
}

static CALayer *initBoxShadowLayer(const BoxShadow &shadow, CGSize layerSize)
{
  CALayer *shadowLayer = [CALayer layer];
  shadowLayer.frame = CGRectMake(0, 0, layerSize.width, layerSize.height);
  shadowLayer.shadowColor = colorRefFromSharedColor(shadow.color);
  // Default is (0, -3) believe it or not
  shadowLayer.shadowOffset = CGSizeMake(0, 0);
  shadowLayer.shadowOpacity = 1;
  // Apple's blur is not quite what we want and seems to be a bit overbearing
  // with the radius. This is an eyeballed adjustment that has the blur looking
  // more like the web.
  shadowLayer.shadowRadius = shadow.blurRadius / 2;
  shadowLayer.contentsScale = [UIScreen mainScreen].scale;

  return shadowLayer;
}

static CALayer *
CUIGetOutsetBoxShadowLayer(const facebook::react::BoxShadow &shadow, RCTCornerRadii cornerRadii, CGSize layerSize, const CUIMotionCornerCurves &curves)
{
  CALayer *shadowLayer = initBoxShadowLayer(shadow, layerSize);

  const RCTCornerInsets shadowRectCornerInsets =
      RCTGetCornerInsets(cornerRadiiForBoxShadow(cornerRadii, shadow.spreadDistance), UIEdgeInsetsZero);

  CGRect shadowRect = CGRectInset(shadowLayer.bounds, -shadow.spreadDistance, -shadow.spreadDistance);
  shadowRect = CGRectOffset(shadowRect, shadow.offsetX, shadow.offsetY);
  CGPathRef shadowRectPath = CUIPathCreateWithRoundedRect(shadowRect, shadowRectCornerInsets, curves, NO);
  shadowLayer.shadowPath = shadowRectPath;

  CAShapeLayer *mask = [CAShapeLayer new];
  [mask setContentsScale:[UIScreen mainScreen].scale];
  CGMutablePathRef path = CGPathCreateMutable();
  CGPathRef layerPath =
      CUIPathCreateWithRoundedRect(shadowLayer.bounds, RCTGetCornerInsets(cornerRadii, UIEdgeInsetsZero), curves, NO);
  CGPathAddPath(path, NULL, layerPath);
  CGPathRef paddedShadowRectPath = CUIPathCreateWithRoundedRect(
      CGRectInset(shadowRect, -2 * (shadow.blurRadius + 1), -2 * (shadow.blurRadius + 1)),
      shadowRectCornerInsets,
      curves,
      NO);
  CGPathAddPath(path, NULL, paddedShadowRectPath);
  mask.fillRule = kCAFillRuleEvenOdd;
  mask.path = path;
  shadowLayer.mask = mask;

  CGPathRelease(path);
  CGPathRelease(shadowRectPath);
  CGPathRelease(layerPath);
  CGPathRelease(paddedShadowRectPath);

  return shadowLayer;
}

static CALayer *CUIGetInsetBoxShadowLayer(
    const facebook::react::BoxShadow &shadow,
    RCTCornerRadii cornerRadii,
    UIEdgeInsets edgeInsets,
    CGSize layerSize, const CUIMotionCornerCurves &curves)
{
  CALayer *shadowLayer = initBoxShadowLayer(shadow, layerSize);

  CGMutablePathRef path = CGPathCreateMutable();
  // This shadow is padded by the blur to make sure blur artifacts can be cast
  // if the clear region is right on the border of the layer
  CGRect shadowRect =
      insetRect(shadowLayer.bounds, edgeInsets.left, edgeInsets.top, edgeInsets.right, edgeInsets.bottom);
  if (CGRectIsNull(shadowRect)) {
    shadowRect = CGRectMake(0, 0, 0, 0);
  }
  CGPathRef shadowPath =
      CUIPathCreateWithRoundedRect(CGRectInset(shadowRect, -shadow.blurRadius, -shadow.blurRadius), {}, curves, NO);

  CGPathRef layerPath = CUIPathCreateWithRoundedRect(shadowRect, RCTGetCornerInsets(cornerRadii, edgeInsets), curves, NO);
  CGPathAddPath(path, NULL, shadowPath);

  CGRect clearRegionRect = CGRectOffset(shadowRect, shadow.offsetX, shadow.offsetY);
  clearRegionRect = CGRectInset(clearRegionRect, shadow.spreadDistance, shadow.spreadDistance);
  if (CGRectIsNull(clearRegionRect)) {
    clearRegionRect = CGRectMake(0, 0, 0, 0);
  }
  CGPathRef clearRegionPath = CUIPathCreateWithRoundedRect(
      clearRegionRect,
      RCTGetCornerInsets(cornerRadiiForBoxShadow(cornerRadii, -shadow.spreadDistance), edgeInsets),
      curves,
      YES);
  CGPathAddPath(path, NULL, clearRegionPath);

  shadowLayer.shadowPath = path;

  CAShapeLayer *mask = [CAShapeLayer new];
  mask.path = layerPath;
  shadowLayer.mask = mask;

  CGPathRelease(path);
  CGPathRelease(layerPath);
  CGPathRelease(shadowPath);
  CGPathRelease(clearRegionPath);

  return shadowLayer;
}

CALayer *CUIGetBoxShadowLayer(
    const facebook::react::BoxShadow &shadow,
    RCTCornerRadii cornerRadii,
    UIEdgeInsets edgeInsets,
    CGSize layerSize, const CUIMotionCornerCurves &curves)
{
  if (shadow.inset) {
    return CUIGetInsetBoxShadowLayer(shadow, cornerRadii, edgeInsets, layerSize, curves);
  } else {
    return CUIGetOutsetBoxShadowLayer(shadow, cornerRadii, layerSize, curves);
  }
}
