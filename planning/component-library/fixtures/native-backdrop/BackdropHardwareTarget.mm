#import <React/RCTViewManager.h>
#import <React/RCTView.h>
#import <React/RCTComponentViewProtocol.h>
#import <Metal/Metal.h>
#import <QuartzCore/CAMetalLayer.h>
#import "CUIBackdropCaptureSource.h"
#include <atomic>
#include <cmath>
#include <limits>

// Non-shipping compositor: its exact Metal upload buffer is composed with original UIKit controls.
@class CUIBackdropHardwareTarget;
@interface CUIFixtureCaptureTask : NSObject <CUIBackdropCaptureCancellation>
@property (nonatomic, weak) CUIBackdropHardwareTarget *owner;
@property (nonatomic, strong) CUIBackdropCapturedFrame *frame;
@property (nonatomic, strong) NSError *failure;
@property (nonatomic, copy) void (^completion)(CUIBackdropCapturedFrame *, NSError *);
@property (nonatomic) BOOL cancelled;
@property (nonatomic) BOOL ready;
@property (nonatomic) BOOL requested;
@property (nonatomic) BOOL delivered;
- (void)deliver;
@end
@interface CUIFixtureCaptureSource : NSObject <CUIBackdropCaptureSource>
@property (nonatomic, weak) CUIBackdropHardwareTarget *owner;
@end
@interface CUIBackdropHardwareTarget : RCTView
@property (nonatomic, copy) RCTDirectEventBlock onCaptureState;
@property (nonatomic) NSInteger captureMode;
@property (nonatomic) NSInteger providerVersion;
@property (nonatomic) NSInteger deliverVersion;
@property (nonatomic) NSInteger inspectVersion;
- (CUIFixtureCaptureTask *)capture:(CUIBackdropCaptureRequest *)request
    completion:(void (^)(CUIBackdropCapturedFrame *, NSError *))completion;
- (void)cancelledCapture;
- (void)emit;
@end

static NSError *CUIFixtureFailure(NSString *reason) {
  return [NSError errorWithDomain:@"CUI.Fixture.Capture" code:1 userInfo:@{NSLocalizedDescriptionKey:reason}];
}
static void CUIFixtureRequire(BOOL allowed, NSString *reason) {
  if (!allowed) @throw [NSException exceptionWithName:@"CUI.Fixture.Capture" reason:reason userInfo:nil];
}
static void CUIFixtureCheckOrdinaryLayers(CALayer *layer) {
  for (NSString *name in @[@"CAMetalLayer", @"CAEAGLLayer", @"AVPlayerLayer"])
    CUIFixtureRequire(![layer isKindOfClass:NSClassFromString(name)], @"Fixture contains an unowned external producer");
  for (CALayer *child in layer.sublayers) CUIFixtureCheckOrdinaryLayers(child);
}
@implementation CUIFixtureCaptureTask
- (void)cancel { if (!_cancelled) { _cancelled = YES; [_owner cancelledCapture]; } }
- (void)deliver {
  _requested = YES;
  if (!_ready || _delivered) return;
  _delivered = YES;
  void (^completion)(CUIBackdropCapturedFrame *, NSError *) = _completion; _completion = nil;
  if (completion) completion(_frame, _failure);
}
@end
@implementation CUIFixtureCaptureSource
- (id<CUIBackdropCaptureCancellation>)captureBackdrop:(CUIBackdropCaptureRequest *)request
    completion:(void (^)(CUIBackdropCapturedFrame *, NSError *))completion {
  CUIBackdropHardwareTarget *target = _owner;
  if (target) return [target capture:request completion:completion];
  CUIFixtureCaptureTask *task = [CUIFixtureCaptureTask new]; task.completion = completion;
  task.failure = CUIFixtureFailure(@"Fixture target retired"); task.ready = YES; [task deliver]; return task;
}
@end

@implementation CUIBackdropHardwareTarget {
  CAMetalLayer *_surface;
  id<MTLDevice> _device;
  id<MTLCommandQueue> _commands;
  dispatch_queue_t _worker;
  UIImage *_submitted;
  CGSize _rasterSize;
  NSInteger _sequence, _captures, _cancellations, _staleDeliveries;
  NSString *_failure;
  __weak UIView *_original;
  CUIBackdropCaptureRegistration *_registration;
  NSMutableArray<CUIFixtureCaptureTask *> *_held;
}
- (instancetype)initWithFrame:(CGRect)frame {
  if ((self = [super initWithFrame:frame])) {
    _device = MTLCreateSystemDefaultDevice(); _commands = [_device newCommandQueue];
    _worker = dispatch_queue_create("com.codonui.fixture.hardware", DISPATCH_QUEUE_SERIAL);
    _surface = [CAMetalLayer layer]; _surface.device = _device;
    _surface.pixelFormat = MTLPixelFormatBGRA8Unorm;
    _surface.framebufferOnly = NO; _surface.opaque = YES;
    CGColorSpaceRef color = CGColorSpaceCreateWithName(kCGColorSpaceSRGB); _surface.colorspace = color; CGColorSpaceRelease(color);
    [self.layer insertSublayer:_surface atIndex:0]; _held = [NSMutableArray new]; _failure = @"";
  }
  return self;
}
- (void)didUpdateReactSubviews {
  [super didUpdateReactSubviews]; [self.layer insertSublayer:_surface atIndex:0];
}
- (void)didMoveToWindow {
  [super didMoveToWindow];
  if (!self.window) {
    _sequence++; [_registration dispose]; _registration = nil; _original = nil; _submitted = nil; _rasterSize = CGSizeZero;
    for (CUIFixtureCaptureTask *task in _held) [task cancel]; [_held removeAllObjects]; return;
  }
  [self registerSource]; [self setNeedsLayout];
}
- (void)registerSource {
  [_registration dispose]; _registration = nil;
  if (!self.window) return;
  UIView *original = nil;
  for (UIView *parent = self.superview; parent; parent = parent.superview) {
    if (self.reactTag && parent.tag == self.reactTag.integerValue &&
        [parent conformsToProtocol:@protocol(RCTComponentViewProtocol)]) { original = parent; break; }
  }
  _original = original;
  if (!original) { _failure = @"Fixture original Fabric target is unavailable"; [self emit]; return; }
  if (_captureMode != 1) {
    CUIFixtureCaptureSource *source = [CUIFixtureCaptureSource new]; source.owner = self;
    _registration = [CUIBackdropCaptureRegistry registerSource:source forTarget:original];
  }
  [self emit];
}
- (void)setCaptureMode:(NSInteger)value {
  CUIFixtureRequire(value >= 0 && value <= 3, @"Fixture capture mode");
  if (_captureMode != value) { _captureMode = value; [self registerSource]; }
}
- (void)setProviderVersion:(NSInteger)value {
  if (_providerVersion != value) { _providerVersion = value; [self registerSource]; }
}
- (void)setDeliverVersion:(NSInteger)value {
  if (_deliverVersion == value) return; _deliverVersion = value;
  NSArray<CUIFixtureCaptureTask *> *pending = [_held copy]; [_held removeAllObjects];
  for (CUIFixtureCaptureTask *task in pending) { if (task.cancelled) _staleDeliveries++; [task deliver]; }
  [self emit];
}
- (void)setInspectVersion:(NSInteger)value { _inspectVersion = value; [self emit]; }
- (void)cancelledCapture { _cancellations++; [self emit]; }
- (void)emit {
  if (!_onCaptureState || !self.window) return;
  _onCaptureState(@{@"target":@(_original.tag), @"engineSequence":@(_sequence), @"hardwareReady":@(_submitted != nil),
      @"registered":@(_registration.active), @"captures":@(_captures), @"cancellations":@(_cancellations),
      @"held":@(_held.count), @"staleDeliveries":@(_staleDeliveries), @"failure":_failure ?: @""});
}
- (void)layoutSubviews {
  [super layoutSubviews];
  [CATransaction begin]; [CATransaction setDisableActions:YES]; _surface.frame = self.bounds; [CATransaction commit];
  const CGFloat scale = self.window.screen.scale;
  const CGSize size = CGSizeMake(std::ceil(self.bounds.size.width*scale), std::ceil(self.bounds.size.height*scale));
  if (!self.window || size.width <= 0 || size.height <= 0 || CGSizeEqualToSize(size, _rasterSize) || _failure.length) return;
  _rasterSize = size; _surface.contentsScale = scale; _surface.drawableSize = size; _submitted = nil;
  const NSInteger sequence = ++_sequence;
  __weak CUIBackdropHardwareTarget *weakSelf = self;
  CAMetalLayer *surface = _surface; id<MTLDevice> device = _device; id<MTLCommandQueue> commands = _commands;
  dispatch_async(_worker, ^{
    @autoreleasepool {
      @try {
        CUIFixtureRequire(device && commands && std::isfinite(size.width) && std::isfinite(size.height) &&
            size.width < std::ldexp(1.0, std::numeric_limits<NSUInteger>::digits) &&
            size.height < std::ldexp(1.0, std::numeric_limits<NSUInteger>::digits), @"Fixture Metal device/raster unavailable");
        const NSUInteger width = size.width, height = size.height;
        CUIFixtureRequire(width <= std::numeric_limits<NSUInteger>::max()/4/height, @"Fixture raster overflow");
        NSMutableData *rgba = [NSMutableData dataWithLength:width*height*4], *bgra = [NSMutableData dataWithLength:width*height*4];
        uint8_t *pixels = static_cast<uint8_t *>(rgba.mutableBytes), *upload = static_cast<uint8_t *>(bgra.mutableBytes);
        for (NSUInteger y = 0; y < height; y++) for (NSUInteger x = 0; x < width; x++) {
          const BOOL alternate = ((x/16 + y/16) & 1) != 0; const NSUInteger index = (y*width+x)*4;
          pixels[index] = alternate ? 24 : 232; pixels[index+1] = alternate ? 136 : 60;
          pixels[index+2] = alternate ? 220 : 96; pixels[index+3] = 255;
          upload[index] = pixels[index+2]; upload[index+1] = pixels[index+1]; upload[index+2] = pixels[index]; upload[index+3] = 255;
        }
        MTLTextureDescriptor *descriptor = [MTLTextureDescriptor texture2DDescriptorWithPixelFormat:MTLPixelFormatBGRA8Unorm
            width:width height:height mipmapped:NO]; descriptor.storageMode = MTLStorageModeShared;
        id<MTLTexture> texture = [device newTextureWithDescriptor:descriptor];
        CUIFixtureRequire(texture != nil, @"Fixture Metal upload texture unavailable");
        [texture replaceRegion:MTLRegionMake2D(0, 0, width, height) mipmapLevel:0 withBytes:upload bytesPerRow:width*4];
        id<CAMetalDrawable> drawable = [surface nextDrawable];
        CUIFixtureRequire(drawable && drawable.texture.width == width && drawable.texture.height == height,
            @"Fixture Metal drawable does not match the frame");
        id<MTLCommandBuffer> command = [commands commandBuffer]; id<MTLBlitCommandEncoder> blit = [command blitCommandEncoder];
        CUIFixtureRequire(command && blit, @"Fixture Metal command unavailable");
        [blit copyFromTexture:texture sourceSlice:0 sourceLevel:0 sourceOrigin:MTLOriginMake(0, 0, 0)
            sourceSize:MTLSizeMake(width, height, 1) toTexture:drawable.texture destinationSlice:0 destinationLevel:0
            destinationOrigin:MTLOriginMake(0, 0, 0)];
        [blit endEncoding]; [command presentDrawable:drawable];
        [command addCompletedHandler:^(id<MTLCommandBuffer> completed) {
          dispatch_async(dispatch_get_main_queue(), ^{
            CUIBackdropHardwareTarget *owner = weakSelf;
            if (!owner || !owner.window || owner->_sequence != sequence) return;
            if (completed.status != MTLCommandBufferStatusCompleted) {
              owner->_failure = completed.error.localizedDescription ?: @"Fixture Metal submission failed";
            } else {
              CGColorSpaceRef color = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
              CGDataProviderRef provider = CGDataProviderCreateWithCFData((__bridge CFDataRef)rgba);
              CGImageRef image = CGImageCreate(width, height, 8, 32, width*4, color,
                  static_cast<CGBitmapInfo>(kCGImageAlphaPremultipliedLast) | kCGBitmapByteOrder32Big,
                  provider, nullptr, false, kCGRenderingIntentDefault);
              CGDataProviderRelease(provider); CGColorSpaceRelease(color);
              owner->_submitted = image ? [UIImage imageWithCGImage:image scale:scale orientation:UIImageOrientationUp] : nil;
              if (image) CGImageRelease(image); else owner->_failure = @"Fixture upload image unavailable";
            }
            [owner emit];
          });
        }];
        [command commit];
      } @catch (NSException *error) {
        dispatch_async(dispatch_get_main_queue(), ^{
          CUIBackdropHardwareTarget *owner = weakSelf;
          if (owner && owner.window && owner->_sequence == sequence) { owner->_failure = error.reason; [owner emit]; }
        });
      }
    }
  });
}
- (CUIFixtureCaptureTask *)capture:(CUIBackdropCaptureRequest *)request
    completion:(void (^)(CUIBackdropCapturedFrame *, NSError *))completion {
  CUIFixtureCaptureTask *task = [CUIFixtureCaptureTask new]; task.owner = self; task.completion = completion;
  @try {
    CUIFixtureRequire(self.window && request.target == _original && request.targetWindow == self.window && _submitted &&
        CGSizeEqualToSize(request.targetBounds.size, self.bounds.size), @"Fixture complete Metal frame unavailable");
    CUIFixtureRequire(request.receiverWindow != request.targetWindow, @"Fixture requires an effect in its distinct native window");
    CUIFixtureRequire(_held.count < 2, @"Fixture held-frame ownership exhausted");
    // This controlled fixture paints an opaque underlay under ordinary UIKit children. Fail on other outer paint.
    for (UIView *view = self; view; view = view.superview) {
      CALayer *layer = view.layer;
      CUIFixtureRequire(layer.opacity == 1 && layer.cornerRadius == 0 && layer.borderWidth == 0 && layer.shadowOpacity == 0 &&
          !layer.mask && !layer.contents && CATransform3DIsIdentity(layer.sublayerTransform) &&
          (!layer.backgroundColor || CGColorGetAlpha(layer.backgroundColor) == 0),
          @"Fixture outer paint is outside its compositor contract");
      if (view == _original) break;
      CUIFixtureRequire(view.superview && view.superview.subviews.count == 1 &&
          CGRectEqualToRect(view.frame, view.superview.bounds) && CATransform3DIsIdentity(layer.transform),
          @"Fixture outer composition contains other content or geometry");
    }
    CUIFixtureRequire(self.layer.sublayers.firstObject == _surface && self.layer.sublayers.count == self.subviews.count + 1,
        @"Fixture Metal underlay order or composition changed");
    UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat preferredFormat];
    format.scale = request.scale; format.opaque = NO; format.preferredRange = UIGraphicsImageRendererFormatRangeStandard;
    UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:self.bounds.size format:format];
    UIImage *captured = [renderer imageWithActions:^(UIGraphicsImageRendererContext *context) {
      [_submitted drawInRect:(CGRect){CGPointZero, self.bounds.size}];
      for (UIView *child in self.subviews) {
        if (child.hidden || child.alpha == 0 || child.bounds.size.width == 0 || child.bounds.size.height == 0) continue;
        CUIFixtureRequire(child.alpha == 1 && child.layer.zPosition == 0 && CATransform3DIsAffine(child.layer.transform),
            @"Fixture direct UIKit child composition is unsupported");
        CUIFixtureCheckOrdinaryLayers(child.layer);
        CGContextRef paint = context.CGContext; CGContextSaveGState(paint);
        CGContextTranslateCTM(paint, child.layer.position.x, child.layer.position.y);
        CGContextConcatCTM(paint, CATransform3DGetAffineTransform(child.layer.transform));
        CGContextTranslateCTM(paint, -child.layer.anchorPoint.x*child.bounds.size.width-child.bounds.origin.x,
            -child.layer.anchorPoint.y*child.bounds.size.height-child.bounds.origin.y);
        const BOOL complete = [child drawViewHierarchyInRect:child.bounds afterScreenUpdates:NO];
        CGContextRestoreGState(paint); CUIFixtureRequire(complete, @"Fixture ordinary controls capture is incomplete");
      }
    }];
    CUIFixtureRequire(captured.CGImage != nil, @"Fixture composed raster unavailable");
    _captures++;
    const BOOL hold = _captureMode == 3, complete = _captureMode != 2;
    if (hold) [_held addObject:task];
    __weak CUIBackdropHardwareTarget *weakSelf = self;
    dispatch_async(_worker, ^{
      @autoreleasepool {
        const size_t width = CGImageGetWidth(captured.CGImage), height = CGImageGetHeight(captured.CGImage);
        NSMutableData *rgba = [NSMutableData dataWithLength:width*height*4];
        CGColorSpaceRef color = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
        CGContextRef bitmap = CGBitmapContextCreate(rgba.mutableBytes, width, height, 8, width*4, color,
            static_cast<CGBitmapInfo>(kCGImageAlphaPremultipliedLast) | kCGBitmapByteOrder32Big); CGColorSpaceRelease(color);
        NSError *failure = nil;
        if (bitmap) { CGContextDrawImage(bitmap, CGRectMake(0, 0, width, height), captured.CGImage); CGContextRelease(bitmap); }
        else failure = CUIFixtureFailure(@"Fixture sRGB composition unavailable");
        dispatch_async(dispatch_get_main_queue(), ^{
          task.failure = failure;
          if (!failure) task.frame = [[CUIBackdropCapturedFrame alloc] initWithRequest:request width:width height:height
              rgba:rgba complete:complete excludesEffect:YES protectedContent:NO];
          task.ready = YES;
          if (task.requested || (!hold && !task.cancelled)) [task deliver];
          CUIBackdropHardwareTarget *owner = weakSelf; if (owner && (owner->_captures == 1 || hold)) [owner emit];
        });
      }
    });
  } @catch (NSException *error) { task.failure = CUIFixtureFailure(error.reason); task.ready = YES; [task deliver]; }
  return task;
}
@end

@interface CUIBackdropHardwareTargetManager : RCTViewManager
@end
@implementation CUIBackdropHardwareTargetManager
RCT_EXPORT_MODULE(CUIBackdropHardwareTarget)
- (UIView *)view { return [CUIBackdropHardwareTarget new]; }
RCT_EXPORT_VIEW_PROPERTY(onCaptureState, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(captureMode, NSInteger)
RCT_EXPORT_VIEW_PROPERTY(providerVersion, NSInteger)
RCT_EXPORT_VIEW_PROPERTY(deliverVersion, NSInteger)
RCT_EXPORT_VIEW_PROPERTY(inspectVersion, NSInteger)
@end
