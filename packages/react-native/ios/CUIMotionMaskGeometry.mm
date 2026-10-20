#import "CUIMotionMaskGeometry.h"
#import "CUIMotionContinuousCorners.h"
#include <cmath>

static NSArray *CUIImmutablePath(CGPathRef path) {
  if (!path) return @[];
  NSMutableArray *commands = [NSMutableArray array];
  __block BOOL complete = YES;
  CGPathApplyWithBlock(path, ^(const CGPathElement *element) {
    if (!complete) return;
    if (commands.count == 2048) { complete = NO; return; }
    NSUInteger count;
    switch (element->type) {
      case kCGPathElementMoveToPoint:
      case kCGPathElementAddLineToPoint: count = 1; break;
      case kCGPathElementAddQuadCurveToPoint: count = 2; break;
      case kCGPathElementAddCurveToPoint: count = 3; break;
      case kCGPathElementCloseSubpath: count = 0; break;
      default: complete = NO; return;
    }
    NSMutableArray *command = [NSMutableArray arrayWithObject:@(element->type)];
    for (NSUInteger index = 0; index < count; index++) {
      CGPoint point = element->points[index];
      if (!std::isfinite(point.x) || !std::isfinite(point.y)) { complete = NO; return; }
      [command addObjectsFromArray:@[@(point.x), @(point.y)]];
    }
    [commands addObject:[command copy]];
  });
  return complete ? [commands copy] : nil;
}

__attribute__((objc_subclassing_restricted))
@interface CUIOwnedPathMaskLayer : CAShapeLayer {
@public
  CGPathRef _cuiRegisteredPath;
  NSArray *_cuiPathCommands;
}
@end
@implementation CUIOwnedPathMaskLayer
- (void)dealloc { if (_cuiRegisteredPath) CGPathRelease(_cuiRegisteredPath); }
@end

CAShapeLayer *CUICreateOwnedShapeMask(CGPathRef path) {
  CUIOwnedPathMaskLayer *mask = [CUIOwnedPathMaskLayer layer];
  CGPathRef immutable = path ? CGPathCreateCopy(path) : nullptr;
  mask.path = immutable;
  if (immutable) CGPathRelease(immutable);
  mask->_cuiRegisteredPath = mask.path ? CGPathRetain(mask.path) : nullptr;
  mask->_cuiPathCommands = CUIImmutablePath(mask->_cuiRegisteredPath);
  return mask;
}

NSDictionary *CUIOwnedShapeMaskDescription(CALayer *layer) {
  if (!NSThread.isMainThread || layer.class != CUIOwnedPathMaskLayer.class) return nil;
  CUIOwnedPathMaskLayer *mask = (CUIOwnedPathMaskLayer *)layer;
  if (!mask->_cuiPathCommands || mask.path != mask->_cuiRegisteredPath || !mask.fillColor ||
      CGColorGetAlpha(mask.fillColor) != 1 || CGColorGetPattern(mask.fillColor) || mask.strokeColor || mask.backgroundColor ||
      mask.delegate || mask.mask || mask.contents || mask.sublayers.count ||
      mask.animationKeys.count || mask.filters.count || mask.backgroundFilters.count || mask.compositingFilter ||
      mask.style.count || mask.actions.count || mask.borderWidth != 0 || mask.shadowOpacity != 0 || mask.opacity != 1 ||
      mask.hidden || mask.opaque || mask.shouldRasterize || mask.geometryFlipped || mask.masksToBounds ||
      mask.cornerRadius != 0 || mask.anchorPointZ != 0 || mask.zPosition != 0 ||
      mask.bounds.size.width < 0 || mask.bounds.size.height < 0 || mask.contentsScale <= 0 ||
      !CATransform3DIsAffine(mask.transform) ||
      (![mask.fillRule isEqualToString:kCAFillRuleNonZero] && ![mask.fillRule isEqualToString:kCAFillRuleEvenOdd])) return nil;
  CGRect bounds = mask.bounds;
  CGAffineTransform transform = mask.affineTransform;
  const CGFloat values[] = {bounds.origin.x, bounds.origin.y, bounds.size.width, bounds.size.height,
      mask.position.x, mask.position.y, mask.anchorPoint.x, mask.anchorPoint.y, mask.contentsScale,
      transform.a, transform.b, transform.c, transform.d, transform.tx, transform.ty};
  for (CGFloat value : values) if (!std::isfinite(value)) return nil;
  return @{@"kind": @"cui-owned-path-mask", @"path": mask->_cuiPathCommands, @"fillRule": mask.fillRule};
}

static NSArray *CUIClipRect(CGRect rect) { return @[@(rect.origin.x), @(rect.origin.y), @(rect.size.width), @(rect.size.height)]; }
static NSArray *CUIClipMatrix(CATransform3D matrix) {
  return @[@(matrix.m11), @(matrix.m12), @(matrix.m13), @(matrix.m14), @(matrix.m21), @(matrix.m22), @(matrix.m23), @(matrix.m24), @(matrix.m31), @(matrix.m32), @(matrix.m33), @(matrix.m34), @(matrix.m41), @(matrix.m42), @(matrix.m43), @(matrix.m44)];
}

NSDictionary *CUIGetLayerClipDescription(CALayer *layer) {
  CALayer *mask = layer.mask;
  NSDictionary *shape = mask ? CUIOwnedShapeMaskDescription(mask) : nil;
  NSDictionary *primitive = mask ? [CUIMotionContinuousCorners nativeMaskDescriptionForLayer:mask] : nil;
  NSArray *path = shape ? shape[@"path"] : @[];
  if (shape) primitive = @{@"kind": shape[@"kind"], @"pathElementCount": @(path.count)};
  CGRect layout = mask ? CGRectMake(mask.position.x - mask.anchorPoint.x * mask.bounds.size.width,
      mask.position.y - mask.anchorPoint.y * mask.bounds.size.height, mask.bounds.size.width, mask.bounds.size.height) : CGRectZero;
  return @{@"bounds": @(layer.masksToBounds), @"cornerRadius": @(layer.cornerRadius), @"maskedCorners": @(layer.maskedCorners), @"cornerCurve": layer.cornerCurve ?: @"",
      @"mask": mask ? @{@"bounds": CUIClipRect(mask.bounds), @"layout": CUIClipRect(layout), @"matrix": CUIClipMatrix(mask.transform),
          @"path": path, @"pathAvailable": @(shape != nil), @"fillRule": shape ? shape[@"fillRule"] : @"", @"nativePrimitive": primitive ?: NSNull.null} : NSNull.null,
      @"complete": @(mask == nil || primitive != nil)};
}
