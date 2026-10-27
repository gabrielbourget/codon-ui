#import "CUIBackdropRenderer.h"
#import "CUIKeyboardScope.h"
#import <React/RCTAssert.h>
#import <UIKit/UIKit.h>
#include "../cpp/backdrop/Gaussian.h"
#include <atomic>
#include <cmath>
#include <climits>
#include <memory>

@interface CUIBackdropFrame : NSObject {
@public std::shared_ptr<std::atomic<bool>> current;
}
@property (nonatomic, weak) UIView *source;
@property (nonatomic, weak) UIView *receiver;
@property (nonatomic, weak) UIWindow *sourceWindow;
@property (nonatomic, weak) UIWindow *receiverWindow;
@property (nonatomic, copy) NSDictionary *sourceSession;
@property (nonatomic, copy) NSDictionary *receiverSession;
@property (nonatomic, copy) NSString *frameId;
@property (nonatomic, strong) NSNumber *generation;
@property (nonatomic, strong) UIImage *staged;
@property (nonatomic, strong) CALayer *output;
@property (nonatomic) CGRect sourceBounds;
@property (nonatomic) CGRect receiverBounds;
@property (nonatomic) CGAffineTransform mapping;
@property (nonatomic) BOOL busy;
@property (nonatomic) NSInteger sourceTag;
@property (nonatomic) NSInteger receiverTag;
@end
@implementation CUIBackdropFrame
@end

static void CUIBackdropRequire(BOOL allowed, NSString *message) {
  if (!allowed) @throw [NSException exceptionWithName:@"CUI.Backdrop" reason:message userInfo:nil];
}
static NSDictionary *CUIBackdropSession(UIView *view) {
  for (UIView *parent = view; parent; parent = parent.superview)
    if ([parent isKindOfClass:CUIKeyboardScope.class]) return [(CUIKeyboardScope *)parent activationSession];
  return nil;
}
static void CUIBackdropCollectSessions(UIView *view, NSMutableArray *sessions) {
  if ([view isKindOfClass:CUIKeyboardScope.class])
    [sessions addObject:@{@"target":@(view.tag), @"session":[(CUIKeyboardScope *)view activationSession]}];
  for (UIView *child in view.subviews) CUIBackdropCollectSessions(child, sessions);
}
static NSDictionary *CUIBackdropSourceSession(UIView *view) {
  NSMutableArray *children = [NSMutableArray new]; CUIBackdropCollectSessions(view, children);
  return @{@"ancestor":CUIBackdropSession(view) ?: @{}, @"children":children};
}
static CGPoint CUIBackdropPoint(UIView *source, UIView *receiver, CGPoint point) {
  CGPoint windowPoint = [source convertPoint:point toView:source.window];
  windowPoint = [source.window convertPoint:windowPoint toWindow:receiver.window];
  return [receiver convertPoint:windowPoint fromView:receiver.window];
}
static CGAffineTransform CUIBackdropMapping(UIView *source, UIView *receiver) {
  const auto origin = source.bounds.origin;
  const auto size = source.bounds.size;
  const auto first = CUIBackdropPoint(source, receiver, origin);
  const auto right = CUIBackdropPoint(source, receiver, CGPointMake(origin.x + size.width, origin.y));
  const auto bottom = CUIBackdropPoint(source, receiver, CGPointMake(origin.x, origin.y + size.height));
  CGAffineTransform mapping = CGAffineTransformMake((right.x-first.x)/size.width, (right.y-first.y)/size.width,
      (bottom.x-first.x)/size.height, (bottom.y-first.y)/size.height, first.x, first.y);
  const auto actual = CUIBackdropPoint(source, receiver, CGPointMake(origin.x+size.width, origin.y+size.height));
  const auto expected = CGPointApplyAffineTransform(CGPointMake(size.width, size.height), mapping);
  CUIBackdropRequire(std::isfinite(mapping.a) && std::isfinite(mapping.b) && std::isfinite(mapping.c) &&
      std::isfinite(mapping.d) && std::isfinite(mapping.tx) && std::isfinite(mapping.ty) &&
      std::abs(actual.x-expected.x) < 0.01 && std::abs(actual.y-expected.y) < 0.01,
      @"Native backdrop: projective capture mapping remains unsupported");
  return mapping;
}
static BOOL CUIBackdropAttached(CUIBackdropFrame *frame) {
  return frame->current && frame->current->load() && frame.source && frame.receiver &&
      frame.source.tag == frame.sourceTag && frame.receiver.tag == frame.receiverTag &&
      frame.source.window == frame.sourceWindow && frame.receiver.window == frame.receiverWindow &&
      frame.sourceWindow && frame.receiverWindow && UIApplication.sharedApplication.applicationState == UIApplicationStateActive &&
      [CUIBackdropSourceSession(frame.source) isEqual:frame.sourceSession] &&
      [CUIBackdropSession(frame.receiver) isEqual:frame.receiverSession];
}
static BOOL CUIBackdropGeometry(CUIBackdropFrame *frame) {
  return CUIBackdropAttached(frame) && CGRectEqualToRect(frame.source.bounds, frame.sourceBounds) &&
      CGRectEqualToRect(frame.receiver.bounds, frame.receiverBounds) &&
      CGAffineTransformEqualToTransform(CUIBackdropMapping(frame.source, frame.receiver), frame.mapping);
}
static void CUIBackdropCheckLayers(CALayer *layer) {
  if (layer.hidden || layer.opacity == 0) return;
  // UIKit does not promise to read externally produced/protected surface contents.
  for (NSString *name in @[@"CAMetalLayer", @"CAEAGLLayer", @"AVPlayerLayer"])
    CUIBackdropRequire(![layer isKindOfClass:NSClassFromString(name)], @"Native backdrop: external surface capture is not complete");
  for (CALayer *child in layer.sublayers) CUIBackdropCheckLayers(child);
}
static void CUIBackdropRetire(CUIBackdropFrame *frame, BOOL clear) {
  if (frame->current) frame->current->store(false);
  frame.staged = nil;
  if (clear) { [frame.output removeFromSuperlayer]; frame.output = nil; }
}

@implementation CUIBackdropRenderer {
  NSMutableDictionary<NSString *, CUIBackdropFrame *> *_frames;
  dispatch_queue_t _worker;
  id _background;
  CADisplayLink *_display;
  BOOL _retired;
}
- (instancetype)init {
  if ((self = [super init])) {
    _frames = [NSMutableDictionary new];
    _worker = dispatch_queue_create("com.codonui.backdrop.filter", DISPATCH_QUEUE_SERIAL);
    __weak CUIBackdropRenderer *weakSelf = self;
    _background = [NSNotificationCenter.defaultCenter addObserverForName:UIApplicationDidEnterBackgroundNotification
        object:nil queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *notification) {
      CUIBackdropRenderer *owner = weakSelf;
      if (!owner) return;
      for (CUIBackdropFrame *frame in owner->_frames.allValues) CUIBackdropRetire(frame, YES);
    }];
  }
  return self;
}
- (void)dealloc { if (_background) [NSNotificationCenter.defaultCenter removeObserver:_background]; }
- (void)invalidate {
  RCTAssertMainQueue();
  _retired = YES;
  [_display invalidate]; _display = nil;
  for (CUIBackdropFrame *frame in _frames.allValues) CUIBackdropRetire(frame, YES);
  [_frames removeAllObjects];
}
- (void)observeAttachments:(CADisplayLink *)display {
  for (CUIBackdropFrame *frame in _frames.allValues) {
    const BOOL attached = frame.source && frame.receiver && frame.source.window && frame.receiver.window &&
        frame.source.tag == frame.sourceTag && frame.receiver.tag == frame.receiverTag &&
        frame.source.window == frame.sourceWindow && frame.receiver.window == frame.receiverWindow;
    if (!attached || (frame->current && frame->current->load() && !CUIBackdropAttached(frame)))
      CUIBackdropRetire(frame, YES);
  }
}
- (void)request:(NSString *)encoded presenter:(RCTSurfacePresenter *)presenter
    resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  RCTAssertMainQueue();
  @try {
    NSError *error = nil;
    NSDictionary *request = [NSJSONSerialization JSONObjectWithData:[encoded dataUsingEncoding:NSUTF8StringEncoding]
        options:0 error:&error];
    CUIBackdropRequire(!error && [request isKindOfClass:NSDictionary.class], @"Native backdrop: invalid request");
    NSString *owner = request[@"ownerId"], *action = request[@"action"];
    CUIBackdropRequire([owner isKindOfClass:NSString.class] && owner.length &&
        [action isKindOfClass:NSString.class], @"Native backdrop: owner/action required");
    CUIBackdropFrame *frame = _frames[owner];
    NSMutableDictionary *response = [@{@"ownerId":owner} mutableCopy];
    const auto reply = ^(NSDictionary *result) {
      NSData *data = [NSJSONSerialization dataWithJSONObject:result options:0 error:nil];
      resolve([[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]);
    };
    if ([action isEqual:@"release"]) {
      if (frame) CUIBackdropRetire(frame, YES);
      [_frames removeObjectForKey:owner];
      if (!_frames.count) { [_display invalidate]; _display = nil; }
      response[@"released"] = @YES; reply(response); return;
    }
    CUIBackdropRequire(!_retired && presenter, @"Native backdrop: renderer retired");
    if ([action isEqual:@"pause"]) {
      if (frame) CUIBackdropRetire(frame, NO);
      response[@"paused"] = @YES; reply(response); return;
    }
    if ([action isEqual:@"discard"] || [action isEqual:@"publish"]) {
      const BOOL matches = frame && [frame.frameId isEqual:request[@"frameId"]] &&
          [frame.generation isEqual:request[@"generation"]];
      response[@"frameId"] = request[@"frameId"] ?: @"";
      response[@"generation"] = request[@"generation"] ?: @0;
      if ([action isEqual:@"discard"]) {
        if (matches) frame.staged = nil;
        response[@"discarded"] = @YES; reply(response); return;
      }
      const BOOL publish = matches && frame.staged && CUIBackdropGeometry(frame);
      if (publish) {
        if (!frame.output) {
          frame.output = [CALayer layer];
          [frame.receiver.layer addSublayer:frame.output];
        }
        [CATransaction begin]; [CATransaction setDisableActions:YES];
        frame.output.frame = frame.receiver.bounds;
        frame.output.contents = (__bridge id)frame.staged.CGImage;
        frame.output.contentsScale = frame.staged.scale;
        [CATransaction commit];
      }
      if (matches) frame.staged = nil;
      response[@"published"] = @(publish); response[@"superseded"] = @(!publish);
      reply(response); return;
    }
    CUIBackdropRequire([action isEqual:@"capture"], @"Native backdrop: unknown action");
    for (NSString *key in @[@"target", @"receiver", @"generation", @"epoch", @"radius"]) {
      id value = request[key];
      CUIBackdropRequire([value isKindOfClass:NSNumber.class] &&
          CFGetTypeID((__bridge CFTypeRef)value) != CFBooleanGetTypeID() && std::isfinite([value doubleValue]) &&
          [value doubleValue] >= 0, @"Native backdrop: invalid numeric value");
    }
    for (NSString *key in @[@"target", @"receiver"])
      CUIBackdropRequire([request[key] doubleValue] > 0 && [request[key] doubleValue] <= INT_MAX &&
          [request[key] doubleValue] == std::floor([request[key] doubleValue]), @"Native backdrop: invalid native tag");
    CUIBackdropRequire([request[@"frameId"] isKindOfClass:NSString.class] && [request[@"frameId"] length],
        @"Native backdrop: frame identity required");
    UIView *source = [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[request[@"target"] integerValue]];
    UIView *receiver = [presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:[request[@"receiver"] integerValue]];
    const auto retire = ^{
      if (frame) CUIBackdropRetire(frame, YES);
      response[@"frameId"] = request[@"frameId"]; response[@"generation"] = request[@"generation"];
      response[@"retired"] = @YES; response[@"staged"] = @NO; reply(response);
    };
    if (!source.window || !receiver.window || UIApplication.sharedApplication.applicationState != UIApplicationStateActive) {
      retire(); return;
    }
    CUIBackdropRequire(source.window.screen == receiver.window.screen &&
        source != receiver && ![receiver isDescendantOfView:source],
        @"Native backdrop: source/effect exclusion is not established");
    CUIBackdropRequire(source.bounds.size.width > 0 && source.bounds.size.height > 0 &&
        receiver.bounds.size.width > 0 && receiver.bounds.size.height > 0,
        @"Native backdrop: empty capture bounds");
    NSDictionary *session = CUIBackdropSession(receiver);
    if (!session || ![session[@"scopeOwnerId"] isEqual:request[@"scopeOwnerId"]] ||
        ![session[@"windowId"] isEqual:request[@"windowId"]] || ![session[@"epoch"] isEqual:request[@"epoch"]]) {
      retire(); return;
    }
    CUIBackdropRequire(!frame.busy, @"Native backdrop: capture already in flight");
    if (frame && (frame.source != source || frame.receiver != receiver)) {
      CUIBackdropRetire(frame, YES); [_frames removeObjectForKey:owner]; frame = nil;
    }
    if (!frame) { frame = [CUIBackdropFrame new]; _frames[owner] = frame; }
    if (!_display) {
      _display = [CADisplayLink displayLinkWithTarget:self selector:@selector(observeAttachments:)];
      [_display addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
    }
    frame->current = std::make_shared<std::atomic<bool>>(true);
    frame.source = source; frame.receiver = receiver;
    frame.sourceTag = source.tag; frame.receiverTag = receiver.tag;
    frame.sourceWindow = source.window; frame.receiverWindow = receiver.window;
    frame.sourceSession = CUIBackdropSourceSession(source); frame.receiverSession = session;
    frame.sourceBounds = source.bounds; frame.receiverBounds = receiver.bounds;
    frame.mapping = CUIBackdropMapping(source, receiver);
    frame.frameId = request[@"frameId"]; frame.generation = request[@"generation"];
    frame.staged = nil;
    CUIBackdropCheckLayers(source.layer);
    const CGFloat scale = receiver.window.screen.scale;
    UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat preferredFormat];
    format.scale = scale; format.opaque = NO; format.preferredRange = UIGraphicsImageRendererFormatRangeStandard;
    UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:receiver.bounds.size format:format];
    __block BOOL complete = NO;
    UIImage *captured = [renderer imageWithActions:^(UIGraphicsImageRendererContext *context) {
      CGContextTranslateCTM(context.CGContext, -receiver.bounds.origin.x, -receiver.bounds.origin.y);
      CGContextConcatCTM(context.CGContext, frame.mapping);
      complete = [source drawViewHierarchyInRect:(CGRect){CGPointZero, source.bounds.size} afterScreenUpdates:NO];
    }];
    CUIBackdropRequire(complete && captured.CGImage, @"Native backdrop: UIKit capture is incomplete");
    frame.busy = YES;
    auto token = frame->current;
    const double sigma = [request[@"radius"] doubleValue] * scale;
    dispatch_async(_worker, ^{
      @autoreleasepool {
        UIImage *filtered;
        NSString *failure;
        try {
          const size_t width = CGImageGetWidth(captured.CGImage), height = CGImageGetHeight(captured.CGImage);
          std::vector<uint8_t> pixels(width * height * 4);
          CGColorSpaceRef color = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
          CGContextRef bitmap = CGBitmapContextCreate(pixels.data(), width, height, 8, width * 4, color,
              kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big);
          CGColorSpaceRelease(color);
          if (!bitmap) throw std::runtime_error("Native backdrop: sRGB bitmap unavailable");
          CGContextDrawImage(bitmap, CGRectMake(0, 0, width, height), captured.CGImage);
          CGContextRelease(bitmap);
          auto output = codon::backdrop::gaussianBlur(pixels.data(), width, height, sigma, [token] { return token->load(); });
          NSData *data = [NSData dataWithBytes:output.data() length:output.size()];
          CGDataProviderRef provider = CGDataProviderCreateWithCFData((__bridge CFDataRef)data);
          color = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
          CGImageRef image = CGImageCreate(width, height, 8, 32, width * 4, color,
              kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big, provider, nullptr, false, kCGRenderingIntentDefault);
          CGColorSpaceRelease(color); CGDataProviderRelease(provider);
          if (!image) throw std::runtime_error("Native backdrop: output image unavailable");
          filtered = [UIImage imageWithCGImage:image scale:scale orientation:UIImageOrientationUp];
          CGImageRelease(image);
        } catch (const std::exception &error) { failure = [NSString stringWithUTF8String:error.what()]; }
        dispatch_async(dispatch_get_main_queue(), ^{
          frame.busy = NO;
          if (failure && token->load()) { reject(@"E_CUI_BACKDROP", failure, nil); return; }
          @try {
            const BOOL staged = !_retired && _frames[owner] == frame && token->load() && CUIBackdropGeometry(frame);
            if (staged) frame.staged = filtered;
            response[@"frameId"] = request[@"frameId"]; response[@"generation"] = request[@"generation"];
            response[@"staged"] = @(staged); response[@"superseded"] = @(!staged);
            reply(response);
          } @catch (NSException *error) { reject(@"E_CUI_BACKDROP", error.reason, nil); }
        });
      }
    });
  } @catch (NSException *error) { reject(@"E_CUI_BACKDROP", error.reason, nil); }
}
@end
