#import <UIKit/UIKit.h>
#import "NativeMotionDrawingAssertionsEnabled.h"
#import "../../../../packages/react-native/ios/CUIMotionDrawingView.h"
#include <react/renderer/components/view/ViewComponentDescriptor.h>
#include <react/utils/ContextContainer.h>
#include <folly/dynamic.h>
#include <array>
#include <algorithm>
#include <cstring>
#include <cstdlib>
#include <string>
#include <vector>

@interface CUIMotionDrawingView (CUIRasterMetadata)
- (facebook::react::BorderMetrics)cuiBorderMetrics;
@end

namespace {
constexpr size_t scale = 3, margin = 24, width = 504, height = 384;
struct Profile {
  const char *name;
  const char *control;
  folly::dynamic props;
  std::array<double, 4> borders{}; // top/right/bottom/left in the explicit fixture layout
  bool numeric = true;
};

std::vector<Profile> profiles() {
  std::vector<Profile> result;
  for (const bool continuous : {false, true}) {
    const auto base = [&]() -> folly::dynamic {
      return folly::dynamic::object("borderRadius", 16)("borderCurve", continuous ? "continuous" : "circular")
          ("backgroundColor", static_cast<int64_t>(0xffe0e8f0));
    };
    result.push_back({continuous ? "solid-continuous" : "solid-circular", "plain", base()});
    auto nativeBorder = base(); nativeBorder["borderWidth"] = 3;
    nativeBorder["borderColor"] = static_cast<int64_t>(0xff102030); nativeBorder["overflow"] = "hidden";
    result.push_back({continuous ? "native-border-continuous" : "native-border-circular", "border", nativeBorder, {3, 3, 3, 3}});
    auto outline = base();
    outline["outlineWidth"] = 2; outline["outlineOffset"] = 1;
    outline["outlineColor"] = static_cast<int64_t>(0xff8090a0);
    result.push_back({continuous ? "outline-continuous" : "outline-circular", "outline", outline});
    auto asymmetric = base();
    asymmetric["borderTopLeftRadius"] = 30; asymmetric["borderTopRightRadius"] = 12;
    asymmetric["borderBottomLeftRadius"] = 5; asymmetric["borderBottomRightRadius"] = 22;
    const std::array<const char *, 4> sides{"Top", "Right", "Bottom", "Left"};
    const std::array<double, 4> borders{2, 5, 7, 3};
    const std::array<int64_t, 4> colors{0xffff0000, 0xff00ff00, 0xff0000ff, 0xffffff00};
    for (size_t index = 0; index < sides.size(); index++) {
      asymmetric["border" + std::string(sides[index]) + "Width"] = borders[index];
      asymmetric["border" + std::string(sides[index]) + "Color"] = colors[index];
    }
    result.push_back({continuous ? "asymmetric-continuous" : "asymmetric-circular", "border", asymmetric, borders});
    for (const bool inset : {false, true}) {
      auto shadow = base();
      shadow["boxShadow"] = folly::dynamic::array(
          folly::dynamic::object("offsetX", 2)("offsetY", 2)("blurRadius", 4)("spreadDistance", 1)
              ("color", static_cast<int64_t>(0x99000000))("inset", inset));
      result.push_back({continuous ? (inset ? "inset-continuous" : "outer-continuous")
                                  : (inset ? "inset-circular" : "outer-circular"),
          inset ? "inset-shadow" : "outer-shadow", shadow});
    }
    for (const bool dotted : {false, true}) {
      auto contour = base(); contour["borderWidth"] = 3;
      contour["borderColor"] = static_cast<int64_t>(0xff102030); contour["borderStyle"] = dotted ? "dotted" : "dashed";
      result.push_back({continuous ? (dotted ? "dotted-continuous" : "dashed-continuous")
                                  : (dotted ? "dotted-circular" : "dashed-circular"),
          "border", contour, {3, 3, 3, 3}});
    }
    auto percentage = base(); percentage["borderRadius"] = "25%";
    result.push_back({continuous ? "percentage-continuous" : "percentage-circular", "plain", percentage, {}, false});
  }
  folly::dynamic raised = folly::dynamic::object("borderRadius", 10)("backgroundColor", static_cast<int64_t>(0xffe0e8f0))
      ("boxShadow", folly::dynamic::array(
          folly::dynamic::object("offsetX", 0)("offsetY", 2)("blurRadius", 3)("color", static_cast<int64_t>(0x1f000000)),
          folly::dynamic::object("offsetX", 0)("offsetY", 2)("blurRadius", 2)("color", static_cast<int64_t>(0x3d000000))));
  result.push_back({"raised-default", "outer-shadow", raised});
  return result;
}

NSData *raster(UIView *view) {
  NSMutableData *data = [NSMutableData dataWithLength:width * height * 4];
  CGColorSpaceRef colors = CGColorSpaceCreateDeviceRGB();
  CGContextRef context = CGBitmapContextCreate(data.mutableBytes, width, height, 8, width * 4, colors,
      static_cast<CGBitmapInfo>(kCGImageAlphaPremultipliedLast) | static_cast<CGBitmapInfo>(kCGBitmapByteOrder32Big));
  CGColorSpaceRelease(colors);
  NSCAssert(context, @"Native full-receiver bitmap context required");
  CGContextScaleCTM(context, scale, scale);
  CGContextTranslateCTM(context, margin, margin);
  [view.layer renderInContext:context];
  CGContextRelease(context);
  return [data copy];
}

NSDictionary *observations(NSData *reference, NSData *actual) {
  const auto *expected = static_cast<const uint8_t *>(reference.bytes);
  const auto *received = static_cast<const uint8_t *>(actual.bytes);
  const auto center = ((margin + 40) * scale * width + (margin + 60) * scale) * 4;
  size_t changed = 0, opaqueDifferent = 0, opaque = 0, outside = 0, transparent = 0, maximum = 0;
  for (size_t offset = 0; offset < reference.length; offset++) {
    const size_t difference = abs(static_cast<int>(expected[offset]) - received[offset]);
    changed += difference != 0; maximum = std::max(maximum, difference);
    if (offset % 4 != 0) continue;
    const size_t pixel = offset / 4, x = pixel % width, y = pixel / width;
    transparent += expected[offset + 3] == 0;
    opaque += expected[offset + 3] == 255;
    opaqueDifferent += expected[offset + 3] == 255 && memcmp(expected + offset, expected + center, 3) != 0;
    if (x < margin * scale || x >= (margin + 120) * scale || y < margin * scale || y >= (margin + 80) * scale)
      outside += expected[offset + 3] > 0;
  }
  return @{@"changedBytes": @(changed), @"maximumChannelDifference": @(maximum),
      @"referenceCenterAlpha": @(expected[center + 3]), @"referenceTransparentPixels": @(transparent),
      @"referenceOpaquePixels": @(opaque),
      @"referenceOpaqueDifferentPixels": @(opaqueDifferent), @"referenceOutsideAlphaPixels": @(outside)};
}
}

// Actual unmounted CPU drawing only. Never infer mounted/GPU/projection fidelity.
NSDictionary *CUIAssertPinnedDrawingRaster(NSString *directory) {
  using namespace facebook::react;
  NSCAssert(NSThread.isMainThread, @"Run the actual paired receivers on the main thread");
  auto container = std::make_shared<const ContextContainer>();
  PropsParserContext context{1, *container};
  ComponentDescriptorParameters parameters; parameters.contextContainer = container;
  ViewComponentDescriptor descriptor(parameters);
  const auto original = descriptor.cloneProps(context, nullptr, RawProps{});
  NSMutableArray *rows = [NSMutableArray new], *names = [NSMutableArray new];
  const auto selected = profiles();
  for (const auto &profile : selected) {
    [names addObject:@(profile.name)];
    for (const bool identity : {false, true}) {
      if (identity && !profile.numeric) continue;
      @autoreleasepool {
        const auto props = std::static_pointer_cast<const ViewProps>(
            descriptor.cloneProps(context, original, RawProps(profile.props)));
        LayoutMetrics layout; layout.frame = {{0, 0}, {120, 80}};
        layout.layoutDirection = LayoutDirection::LeftToRight;
        layout.borderWidth.top = profile.borders[0]; layout.borderWidth.right = profile.borders[1];
        layout.borderWidth.bottom = profile.borders[2]; layout.borderWidth.left = profile.borders[3];
        const auto metrics = props->resolveBorderMetrics(layout);
        const auto expectedCurve = std::string(profile.name).find("continuous") != std::string::npos
            ? BorderCurve::Continuous : BorderCurve::Circular;
        NSCAssert(metrics.borderCurves.topLeft == expectedCurve && metrics.borderCurves.topRight == expectedCurve &&
            metrics.borderCurves.bottomLeft == expectedCurve && metrics.borderCurves.bottomRight == expectedCurve,
            @"The selected curve must reach the actual decoded native props");
        NSCAssert(metrics.borderWidths.top == profile.borders[0] && metrics.borderWidths.right == profile.borders[1] &&
            metrics.borderWidths.bottom == profile.borders[2] && metrics.borderWidths.left == profile.borders[3],
            @"Explicit fixture widths must reach the actual decoded renderer metrics");
        const std::string control(profile.control);
        if (control == "outer-shadow" || control == "inset-shadow")
          NSCAssert(props->boxShadow.size() == profile.props["boxShadow"].size() &&
              std::all_of(props->boxShadow.begin(), props->boxShadow.end(), [&](const auto &shadow) {
                return shadow.inset == (control == "inset-shadow");
              }),
              @"The selected native shadow must actually decode");
        CUIMotionDrawingView *owned = [[CUIMotionDrawingView alloc] initWithFrame:CGRectMake(0, 0, 120, 80)];
        RCTViewComponentView *reference = [[RCTViewComponentView alloc] initWithFrame:owned.frame];
        [CATransaction begin]; [CATransaction setDisableActions:YES];
        [owned setCuiDrawingEnabled:YES];
        [owned updateProps:props oldProps:original]; [reference updateProps:props oldProps:original];
        [owned updateLayoutMetrics:layout oldLayoutMetrics:LayoutMetrics{}];
        [reference updateLayoutMetrics:layout oldLayoutMetrics:LayoutMetrics{}];
        if (identity) {
          const auto corner = [](const auto &value) { return @{@"x": @(value.horizontal), @"y": @(value.vertical)}; };
          NSDictionary *values = @{@"topLeft": corner(metrics.borderRadii.topLeft), @"topRight": corner(metrics.borderRadii.topRight),
              @"bottomLeft": corner(metrics.borderRadii.bottomLeft), @"bottomRight": corner(metrics.borderRadii.bottomRight)};
          [owned setCuiProjectionRadii:[[NSString alloc] initWithData:[NSJSONSerialization dataWithJSONObject:values options:0 error:nil]
              encoding:NSUTF8StringEncoding]];
        }
        [owned finalizeUpdates:RNComponentViewUpdateMaskProps]; [reference finalizeUpdates:RNComponentViewUpdateMaskProps];
        [owned layoutIfNeeded]; [reference layoutIfNeeded];
        [owned.layer layoutIfNeeded]; [reference.layer layoutIfNeeded];
        [CATransaction commit];
        NSData *native = raster(reference), *actual = raster(owned);
        NSString *key = [NSString stringWithFormat:@"%s-%@", profile.name, identity ? @"identity" : @"authored"];
        NSString *nativeName = [@"drawing-" stringByAppendingFormat:@"%@-native.rgba", key];
        NSString *ownedName = [@"drawing-" stringByAppendingFormat:@"%@-owned.rgba", key];
        NSCAssert([native writeToFile:[directory stringByAppendingPathComponent:nativeName] atomically:YES] &&
            [actual writeToFile:[directory stringByAppendingPathComponent:ownedName] atomically:YES], @"Retain both original raster buffers");
        NSDictionary *facts = observations(native, actual);
        const auto radii = [](const auto &value) {
          return @[@(value.topLeft.horizontal), @(value.topLeft.vertical), @(value.topRight.horizontal), @(value.topRight.vertical),
              @(value.bottomLeft.horizontal), @(value.bottomLeft.vertical), @(value.bottomRight.horizontal), @(value.bottomRight.vertical)];
        };
        NSDictionary *row = @{@"profile": @(profile.name), @"mode": identity ? @"identity" : @"authored", @"control": @(profile.control),
            @"nativeFile": nativeName, @"ownedFile": ownedName, @"width": @(width), @"height": @(height), @"bytesPerPixel": @4,
            @"scale": @(scale), @"margin": @(margin), @"facts": facts,
            @"borderWidths": @[@(metrics.borderWidths.top), @(metrics.borderWidths.right), @(metrics.borderWidths.bottom), @(metrics.borderWidths.left)],
            @"outlineWidth": @(props->outlineWidth), @"shadowCount": @(props->boxShadow.size()),
            @"decodedCornerRadii": radii(metrics.borderRadii), @"ownedCornerRadii": radii([owned cuiBorderMetrics].borderRadii),
            @"decodedCornerCurve": @(static_cast<int>(expectedCurve)),
            @"referenceRootRadius": @(reference.layer.cornerRadius), @"ownedRootRadius": @(owned.layer.cornerRadius),
            @"referenceRootCurve": reference.layer.cornerCurve ?: NSNull.null, @"ownedRootCurve": owned.layer.cornerCurve ?: NSNull.null,
            @"referenceContentsScale": @(reference.layer.contentsScale), @"ownedContentsScale": @(owned.layer.contentsScale)};
        [rows addObject:row];
        NSData *journal = [NSJSONSerialization dataWithJSONObject:rows options:NSJSONWritingPrettyPrinted error:nil];
        NSCAssert([journal writeToFile:[directory stringByAppendingPathComponent:@"drawing-raster-observations.json"] atomically:YES],
            @"Preserve the original native comparison before its verdict");
        NSCAssert([facts[@"referenceCenterAlpha"] unsignedIntegerValue] == 255 &&
            [facts[@"referenceTransparentPixels"] unsignedIntegerValue] > 0 &&
            [facts[@"referenceOpaquePixels"] unsignedIntegerValue] > 43200, @"Nonblank native raster controls required: %@", row);
        if (control == "outline" || control == "border" || control == "inset-shadow")
          NSCAssert([facts[@"referenceOpaqueDifferentPixels"] unsignedIntegerValue] > 0, @"The selected native painter must be visible: %@", row);
        if (control == "outline" || control == "outer-shadow")
          NSCAssert([facts[@"referenceOutsideAlphaPixels"] unsignedIntegerValue] > 0, @"Native outside-ink control required: %@", row);
        NSCAssert([native isEqualToData:actual], @"Full native receiver raster mismatch: %@", row);
        [owned prepareForRecycle]; [reference prepareForRecycle];
      }
    }
  }
  return @{@"pairs": @(rows.count), @"profileNames": names, @"byteExactRaster": @YES,
      @"rasterWidth": @(width), @"rasterHeight": @(height), @"rasterBytesPerPixel": @4,
      @"scope": @"Actual unmounted UIKit CPU full-receiver comparisons; no mounted/GPU/full Card verdict"};
}
