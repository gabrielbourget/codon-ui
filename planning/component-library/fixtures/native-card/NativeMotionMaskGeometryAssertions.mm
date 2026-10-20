#import <UIKit/UIKit.h>
#import <React/RCTBorderDrawing.h>
#import "NativeMotionDrawingAssertionsEnabled.h"
#import "../../../../packages/react-native/ios/CUIMotionMaskGeometry.h"
#import "../../../../packages/react-native/ios/CUIMotionContinuousCorners.h"

static CGPathRef CUIRebuildMaskPath(NSArray<NSArray<NSNumber *> *> *commands) {
  CGMutablePathRef path = CGPathCreateMutable();
  for (NSArray<NSNumber *> *command in commands) {
    switch ([command[0] unsignedIntegerValue]) {
      case kCGPathElementMoveToPoint: CGPathMoveToPoint(path, nullptr, [command[1] doubleValue], [command[2] doubleValue]); break;
      case kCGPathElementAddLineToPoint: CGPathAddLineToPoint(path, nullptr, [command[1] doubleValue], [command[2] doubleValue]); break;
      case kCGPathElementAddQuadCurveToPoint:
        CGPathAddQuadCurveToPoint(path, nullptr, [command[1] doubleValue], [command[2] doubleValue], [command[3] doubleValue], [command[4] doubleValue]); break;
      case kCGPathElementAddCurveToPoint:
        CGPathAddCurveToPoint(path, nullptr, [command[1] doubleValue], [command[2] doubleValue], [command[3] doubleValue], [command[4] doubleValue], [command[5] doubleValue], [command[6] doubleValue]); break;
      case kCGPathElementCloseSubpath: CGPathCloseSubpath(path); break;
      default: NSCAssert(NO, @"Unexpected actual path command");
    }
  }
  return path;
}

static NSData *CUIRasterMask(CALayer *mask) {
  NSMutableData *bytes = [NSMutableData dataWithLength:360 * 240 * 4];
  CGColorSpaceRef colors = CGColorSpaceCreateDeviceRGB();
  CGContextRef context = CGBitmapContextCreate(bytes.mutableBytes, 360, 240, 8, 360 * 4, colors,
      kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big);
  CGColorSpaceRelease(colors);
  NSCAssert(context, @"Native mask raster context required");
  CGContextScaleCTM(context, 3, 3);
  CALayer *root = [CALayer layer];
  root.frame = CGRectMake(0, 0, 120, 80);
  root.backgroundColor = UIColor.whiteColor.CGColor;
  root.mask = mask;
  [root renderInContext:context];
  CGContextRelease(context);
  root.mask = nil;
  return [bytes copy];
}

NSDictionary *CUIAssertOwnedMaskGeometry(NSString *directory) {
  NSCAssert(NSThread.isMainThread, @"Run native mask assertions on the main thread");
  NSUInteger assertions = 0;
  const auto check = [&](BOOL condition, NSString *message) { assertions++; NSCAssert(condition, @"%@", message); };
  const CGRect bounds = CGRectMake(0, 0, 120, 80);
  const RCTCornerRadii radii{40, 8, 12, 24, 5, 13, 22, 6};
  CGPathRef path = RCTPathCreateWithRoundedRect(bounds, RCTGetCornerInsets(radii, UIEdgeInsetsZero), nil, NO);
  CAShapeLayer *owned = CUICreateOwnedShapeMask(path);
  CAShapeLayer *reference = [CAShapeLayer layer];
  reference.path = path;
  CALayer *host = [CALayer layer];
  host.frame = bounds;
  host.mask = owned;
  NSDictionary *clip = CUIGetLayerClipDescription(host);
  NSDictionary *mask = clip[@"mask"];
  check([clip[@"complete"] boolValue] && [mask[@"pathAvailable"] boolValue] &&
      [mask[@"nativePrimitive"][@"kind"] isEqual:@"cui-owned-path-mask"], @"Actual owned clipping must describe its immutable path");
  CGPathRef rebuilt = CUIRebuildMaskPath(mask[@"path"]);
  check(CGPathEqualToPath(rebuilt, path), @"Observed path commands must reconstruct the exact pinned native path");
  CGPathRelease(rebuilt);
  check([NSJSONSerialization isValidJSONObject:clip], @"Native clip description must be serializable data");

  host.mask = nil;
  NSData *native = CUIRasterMask(reference), *actual = CUIRasterMask(owned);
  const uint8_t *nativeBytes = (const uint8_t *)native.bytes;
  check(nativeBytes[3] == 0 && nativeBytes[(120 * 360 + 180) * 4 + 3] == 255,
      @"Native shape-mask raster control must expose both excluded corner and opaque interior");
  check([native isEqualToData:actual], @"Owned shape-mask subclass must retain byte-exact pinned native raster behavior");
  check([native writeToFile:[directory stringByAppendingPathComponent:@"shape-mask-native.rgba"] atomically:YES] &&
      [actual writeToFile:[directory stringByAppendingPathComponent:@"shape-mask-owned.rgba"] atomically:YES], @"Preserve original native raster bytes");

  CGMutablePathRef mutablePath = CGPathCreateMutable();
  CGPathMoveToPoint(mutablePath, nullptr, 1, 2);
  CGPathAddLineToPoint(mutablePath, nullptr, 3, 4);
  CGPathAddQuadCurveToPoint(mutablePath, nullptr, 5, 12, 7, 8);
  CGPathAddCurveToPoint(mutablePath, nullptr, 9, 3, 11, 19, 13, 14);
  CGPathCloseSubpath(mutablePath);
  CAShapeLayer *copied = CUICreateOwnedShapeMask(mutablePath);
  NSArray *originalCommands = CUIOwnedShapeMaskDescription(copied)[@"path"];
  rebuilt = CUIRebuildMaskPath(originalCommands);
  check(CGPathEqualToPath(rebuilt, mutablePath) && originalCommands.count == 5,
      @"Every supported native element must preserve actual coordinates and winding commands");
  CGPathRelease(rebuilt);
  CGPathAddRect(mutablePath, nullptr, CGRectMake(100, 200, 30, 40));
  check([CUIOwnedShapeMaskDescription(copied)[@"path"] isEqual:originalCommands], @"Later source-path mutations cannot change the retained description");
  copied.path = mutablePath;
  check(CUIOwnedShapeMaskDescription(copied) == nil, @"A replaced path cannot reuse the registered immutable commands");
  CGPathRelease(mutablePath);

  host.mask = owned;
  owned.opacity = 0.5;
  check(![CUIGetLayerClipDescription(host)[@"complete"] boolValue], @"Translucent mask changes must revoke complete geometry");
  owned.opacity = 1;
  check([CUIGetLayerClipDescription(host)[@"complete"] boolValue], @"Restored unchanged mask geometry must remain observable");
  owned.fillRule = kCAFillRuleEvenOdd;
  check([CUIGetLayerClipDescription(host)[@"mask"][@"fillRule"] isEqual:kCAFillRuleEvenOdd], @"Actual winding rule must be preserved");
  owned.fillRule = kCAFillRuleNonZero;
  owned.strokeColor = UIColor.redColor.CGColor;
  check(CUIOwnedShapeMaskDescription(owned) == nil, @"Unencoded stroke coverage must withhold completeness");
  owned.strokeColor = nil;
  owned.backgroundColor = UIColor.whiteColor.CGColor;
  check(CUIOwnedShapeMaskDescription(owned) == nil, @"Background coverage outside the path must reject");
  owned.backgroundColor = nil;
  owned.fillColor = [UIColor colorWithWhite:1 alpha:0.5].CGColor;
  check(CUIOwnedShapeMaskDescription(owned) == nil, @"Unencoded fill alpha must reject");
  owned.fillColor = UIColor.blackColor.CGColor;
  [owned addSublayer:[CALayer layer]];
  check(CUIOwnedShapeMaskDescription(owned) == nil, @"Unencoded mask descendants must reject");
  [owned.sublayers.firstObject removeFromSuperlayer];
  CABasicAnimation *animation = [CABasicAnimation animationWithKeyPath:@"opacity"];
  animation.duration = 10;
  [owned addAnimation:animation forKey:@"guard"];
  check(CUIOwnedShapeMaskDescription(owned) == nil, @"Animated mask geometry must reject");
  [owned removeAllAnimations];
  owned.affineTransform = CGAffineTransformMakeTranslation(3, 7);
  NSDictionary *translated = CUIGetLayerClipDescription(host)[@"mask"];
  check([translated[@"matrix"][12] doubleValue] == 3 && [translated[@"matrix"][13] doubleValue] == 7,
      @"Actual mask transform must reach the native description");
  owned.affineTransform = CGAffineTransformIdentity;
  host.mask = reference;
  NSDictionary *foreign = CUIGetLayerClipDescription(host);
  check(![foreign[@"complete"] boolValue] && ![foreign[@"mask"][@"pathAvailable"] boolValue],
      @"A foreign shape layer cannot gain owned immutable-path authority");
  host.mask = CUICreateOwnedShapeMask(nullptr);
  NSDictionary *empty = CUIGetLayerClipDescription(host);
  check([empty[@"complete"] boolValue] && [empty[@"mask"][@"path"] count] == 0,
      @"An actual empty owned mask must describe empty coverage");
  CGMutablePathRef oversizedPath = CGPathCreateMutable();
  CGPathMoveToPoint(oversizedPath, nullptr, 0, 0);
  for (NSUInteger index = 0; index < 2050; index++) CGPathAddLineToPoint(oversizedPath, nullptr, index, index % 11);
  CAShapeLayer *oversized = CUICreateOwnedShapeMask(oversizedPath);
  host.mask = oversized;
  check(![CUIGetLayerClipDescription(host)[@"complete"] boolValue] && CGPathEqualToPath(oversized.path, oversizedPath),
      @"An oversized path must retain drawing while withholding bounded geometry authority");
  CGPathRelease(oversizedPath);
  CALayer *continuous = [CUIMotionContinuousCorners layerForBounds:bounds cornerSize:CGSizeMake(40, 8) contentsScale:3];
  host.mask = continuous;
  NSDictionary *continuousClip = CUIGetLayerClipDescription(host);
  check([continuousClip[@"complete"] boolValue] &&
      [continuousClip[@"mask"][@"nativePrimitive"][@"kind"] isEqual:@"cui-owned-native-continuous"] &&
      [continuousClip[@"mask"][@"bounds"] isEqual:@[@0, @0, @3, @10]], @"The existing continuous primitive must retain actual normalized geometry");
  continuous.opacity = 0.5;
  check(![CUIGetLayerClipDescription(host)[@"complete"] boolValue], @"A modified continuous mask cannot gain shape-mask authority");
  host.mask = nil;
  check([CUIGetLayerClipDescription(host)[@"complete"] boolValue], @"A mask-free layer retains complete native clipping metadata");
  CGPathRelease(path);
  return @{@"assertions": @(assertions), @"rasterWidth": @360, @"rasterHeight": @240,
      @"rasterBytesPerPixel": @4, @"byteExactRaster": @YES, @"scope": @"Owned model mask geometry and native CPU raster only"};
}
