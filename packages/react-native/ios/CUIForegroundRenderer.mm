#import "CUIForegroundRenderer.h"
#import "CUIForegroundCompositionSource+Internal.h"
#import "CUIKeyboardScope.h"
#import <React/RCTAssert.h>
#import <React/RCTConversions.h>
#include "../cpp/overlay/ForegroundFilters.h"
#include <atomic>
#include <cmath>
#include <memory>

using namespace facebook::react;
using namespace codon::overlay;
static void CUIForegroundRequire(BOOL value, NSString *reason) {
  if (!value) @throw [NSException exceptionWithName:@"CUI.Foreground" reason:reason userInfo:nil];
}
static NSDictionary *CUIForegroundEpoch(UIView *view) {
  for (UIView *parent = view; parent; parent = parent.superview)
    if ([parent isKindOfClass:CUIKeyboardScope.class]) return [(CUIKeyboardScope *)parent activationSession];
  return @{};
}
static NSArray<NSNumber *> *CUIForegroundQuad(UIView *view) {
  NSMutableArray *result = [NSMutableArray new];
  const CGRect bounds = view.bounds;
  CGPoint corners[] = {{CGRectGetMinX(bounds), CGRectGetMinY(bounds)}, {CGRectGetMaxX(bounds), CGRectGetMinY(bounds)},
      {CGRectGetMaxX(bounds), CGRectGetMaxY(bounds)}, {CGRectGetMinX(bounds), CGRectGetMaxY(bounds)}};
  for (auto point : corners) {
    point = [view.layer convertPoint:point toLayer:view.window.layer];
    point = [view.window convertPoint:point toCoordinateSpace:view.window.screen.coordinateSpace];
    const auto scale = view.window.screen.scale;
    CUIForegroundRequire(std::isfinite(point.x) && std::isfinite(point.y), @"Foreground screen geometry unavailable");
    [result addObjectsFromArray:@[@(point.x*scale), @(point.y*scale)]];
  }
  return result;
}
static BOOL CUIForegroundOpaque(CALayer *layer) {
  if (layer.hidden || layer.opacity == 0 || (layer.mask && layer.mask.opacity == 0)) return NO;
  for (NSString *name in @[@"CAMetalLayer", @"CAEAGLLayer", @"AVPlayerLayer"])
    if ([layer isKindOfClass:NSClassFromString(name)]) return YES;
  if ([layer.delegate isKindOfClass:UIVisualEffectView.class]) return YES;
  for (CALayer *child in layer.sublayers) if (CUIForegroundOpaque(child)) return YES;
  return NO;
}
static CGRect CUIForegroundInk(CALayer *layer, CALayer *root, CGRect clip) {
  if (layer.hidden || layer.opacity == 0 || (layer.mask && layer.mask.opacity == 0)) return CGRectNull;
  CGRect local = layer.bounds;
  if (layer.shadowOpacity > 0 && layer.shadowColor && CGColorGetAlpha(layer.shadowColor) > 0) {
    CGRect shadow = layer.shadowPath ? CGPathGetBoundingBox(layer.shadowPath) : local;
    shadow = CGRectOffset(CGRectInset(shadow, -6*layer.shadowRadius, -6*layer.shadowRadius), layer.shadowOffset.width, layer.shadowOffset.height);
    local = CGRectUnion(local, shadow);
  }
  CGRect ink = [root convertRect:local fromLayer:layer];
  CUIForegroundRequire(!CGRectIsInfinite(ink) && std::isfinite(ink.origin.x) && std::isfinite(ink.origin.y) &&
      std::isfinite(ink.size.width) && std::isfinite(ink.size.height), @"Foreground visual bounds unavailable");
  if (!CGRectIsNull(clip)) ink = CGRectIntersection(ink, clip);
  if (layer.masksToBounds) {
    CGRect ownClip = [root convertRect:layer.bounds fromLayer:layer];
    clip = CGRectIsNull(clip) ? ownClip : CGRectIntersection(clip, ownClip);
  }
  for (CALayer *child in layer.sublayers) ink = CGRectUnion(ink, CUIForegroundInk(child, root, clip));
  return ink;
}

@class CUIForegroundRenderer;
@interface CUIForegroundTick : NSObject
@property (nonatomic, weak) CUIForegroundRenderer *renderer;
- (void)tick:(CADisplayLink *)link;
@end
@interface CUIForegroundRenderer ()
- (void)tick;
@end
@implementation CUIForegroundTick
- (void)tick:(CADisplayLink *)link { CUIForegroundRenderer *renderer = self.renderer; if (renderer) [renderer tick]; else [link invalidate]; }
@end

@implementation CUIForegroundRenderer {
  __weak UIView *_owner;
  NSString *_ownerId;
  UIView *_sourceMask;
  UIView *_output;
  CALayer *_mask;
  CADisplayLink *_displayLink;
  id _activeObserver, _inactiveObserver;
  std::vector<TForegroundFilter> _filters;
  CGFloat _opacity;
  BOOL _busy;
  BOOL _filtering;
  BOOL _failed;
  NSUInteger _generation, _frame;
  std::shared_ptr<std::atomic<bool>> _current;
  CUIForegroundCompositionRequest *_request;
  CUIForegroundCompositionRegistration *_registration;
  id _registrationObserver;
  id<CUIForegroundCompositionSession> _session;
  CUIForegroundCompositionRequest *_sessionIdentity;
  CUIForegroundCompositionRequest *_presentedIdentity;
}
- (instancetype)initWithOwner:(UIView *)owner {
  if ((self = [super init])) {
    _owner = owner; _ownerId = [@"foreground-" stringByAppendingString:NSUUID.UUID.UUIDString]; _opacity = 1;
    _sourceMask = [UIView new]; _source = [UIView new]; _output = [UIView new];
    _sourceMask.accessibilityElementsHidden = NO;
    _output.userInteractionEnabled = NO; _output.accessibilityElementsHidden = YES;
    _mask = [CALayer layer]; _mask.backgroundColor = UIColor.blackColor.CGColor;
    [_sourceMask addSubview:_source]; [owner addSubview:_sourceMask]; [owner addSubview:_output];
    _output.hidden = YES;
    __weak CUIForegroundRenderer *weak = self;
    _activeObserver = [NSNotificationCenter.defaultCenter addObserverForName:UIApplicationDidBecomeActiveNotification object:nil queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *) { [weak synchronize]; }];
    _inactiveObserver = [NSNotificationCenter.defaultCenter addObserverForName:UIApplicationWillResignActiveNotification object:nil queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *) { [weak pause]; }];
  }
  return self;
}
- (void)configure:(const ViewProps &)props paintOpacity:(CGFloat)paintOpacity {
  RCTAssertMainQueue();
  std::vector<TForegroundFilter> filters;
  const auto scale = _owner.window.screen.scale ?: UIScreen.mainScreen.scale;
  for (const auto &primitive : props.filter) {
    TForegroundFilter filter;
    switch (primitive.type) {
      case FilterType::Blur: filter.kind = TForegroundFilterKind::Blur; break;
      case FilterType::Brightness: filter.kind = TForegroundFilterKind::Brightness; break;
      case FilterType::Contrast: filter.kind = TForegroundFilterKind::Contrast; break;
      case FilterType::Grayscale: filter.kind = TForegroundFilterKind::Grayscale; break;
      case FilterType::HueRotate: filter.kind = TForegroundFilterKind::HueRotate; break;
      case FilterType::Invert: filter.kind = TForegroundFilterKind::Invert; break;
      case FilterType::Opacity: filter.kind = TForegroundFilterKind::Opacity; break;
      case FilterType::Saturate: filter.kind = TForegroundFilterKind::Saturate; break;
      case FilterType::Sepia: filter.kind = TForegroundFilterKind::Sepia; break;
      case FilterType::DropShadow: filter.kind = TForegroundFilterKind::DropShadow; break;
    }
    if (filter.kind == TForegroundFilterKind::DropShadow) {
      CUIForegroundRequire(std::holds_alternative<DropShadowParams>(primitive.parameters), @"Foreground shadow parameters unavailable");
      const auto &shadow = std::get<DropShadowParams>(primitive.parameters);
      CGFloat red, green, blue, alpha;
      UIColor *color = RCTUIColorFromSharedColor(shadow.color);
      CUIForegroundRequire(color && [[color resolvedColorWithTraitCollection:_owner.traitCollection] getRed:&red green:&green blue:&blue alpha:&alpha],
          @"Foreground shadow color unavailable in current environment");
      filter.amount = shadow.standardDeviation * scale; filter.offsetX = shadow.offsetX * scale; filter.offsetY = shadow.offsetY * scale;
      filter.color = {red, green, blue, alpha};
    } else {
      CUIForegroundRequire(std::holds_alternative<Float>(primitive.parameters), @"Foreground scalar parameters unavailable");
      filter.amount = std::get<Float>(primitive.parameters) * (filter.kind == TForegroundFilterKind::Blur ? scale : 1);
    }
    filters.push_back(filter);
  }
  _filters = std::move(filters); _opacity = props.opacity * paintOpacity;
  CUIForegroundRequire(std::isfinite(_opacity) && _opacity >= 0 && _opacity <= 1, @"Foreground opacity unavailable");
  [self cancelFrame];
  _generation++;
  [self synchronize];
}
- (void)pause { [_displayLink invalidate]; _displayLink = nil; [self restore]; }
- (void)cancelFrame {
  if (_current) _current->store(false);
  [_request cancel]; _request = nil;
  if (!_filtering) _busy = NO;
}
- (void)restore {
  [self cancelFrame];
  id<CUIForegroundCompositionSession> session = _session; _session = nil; _sessionIdentity = nil;
  if (_registrationObserver) [_registration removeRetirementObserver:_registrationObserver];
  _registrationObserver = nil; _registration = nil;
  [CATransaction begin]; [CATransaction setDisableActions:YES];
  @try { [session retireForeground]; }
  @finally { _sourceMask.layer.mask = nil; _output.hidden = YES; _output.layer.contents = nil; _presentedIdentity = nil; [CATransaction commit]; }
}
- (void)synchronize {
  UIView *owner = _owner;
  _sourceMask.frame = owner.bounds; _source.frame = _sourceMask.bounds;
  owner.layer.opacity = 1;
  if (!owner.window || UIApplication.sharedApplication.applicationState != UIApplicationStateActive ||
      (_filters.empty() && _opacity == 1)) {
    [_displayLink invalidate]; _displayLink = nil; [self restore]; return;
  }
  if (!_displayLink && !_failed) {
    CUIForegroundTick *tick = [CUIForegroundTick new]; tick.renderer = self;
    _displayLink = [CADisplayLink displayLinkWithTarget:tick selector:@selector(tick:)];
    [_displayLink addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
  }
}
- (BOOL)admit:(CUIForegroundCompositionRequest *)request {
  UIView *owner = _owner;
  return !_failed && request == _request && !request.cancelled && owner.window &&
      request.owner == owner && request.source == _source && request.output == _output &&
      request.sourceWindow == _source.window && request.outputWindow == _output.window &&
      UIApplication.sharedApplication.applicationState == UIApplicationStateActive &&
      [request.sourceEpoch isEqual:CUIForegroundEpoch(_source)] && [request.outputEpoch isEqual:CUIForegroundEpoch(_output)] &&
      [request.sourceScreenQuad isEqual:CUIForegroundQuad(_source)] && [request.outputScreenQuad isEqual:CUIForegroundQuad(_output)] &&
      [CUIForegroundCompositionRegistry registrationForOwner:owner] == _registration && (!_registration || _registration.active);
}
- (void)fail:(NSString *)reason {
  _failed = YES; [_displayLink invalidate]; _displayLink = nil; [self restore];
  CUIForegroundRequire(NO, reason);
}
- (void)tick {
  if (!_owner.window || UIApplication.sharedApplication.applicationState != UIApplicationStateActive) { [self synchronize]; return; }
  if (_busy || _failed) return;
  @try {
    if (_registration != [CUIForegroundCompositionRegistry registrationForOwner:_owner] ||
        (_sessionIdentity && (_sessionIdentity.sourceWindow != _source.window || _sessionIdentity.outputWindow != _output.window ||
          ![_sessionIdentity.sourceEpoch isEqual:CUIForegroundEpoch(_source)] || ![_sessionIdentity.outputEpoch isEqual:CUIForegroundEpoch(_output)]))) [self restore];
    if (_presentedIdentity && (_presentedIdentity.sourceWindow != _source.window || _presentedIdentity.outputWindow != _output.window ||
        ![_presentedIdentity.sourceEpoch isEqual:CUIForegroundEpoch(_source)] || ![_presentedIdentity.outputEpoch isEqual:CUIForegroundEpoch(_output)])) [self restore];
    CUIForegroundCompositionRegistration *registration = [CUIForegroundCompositionRegistry registrationForOwner:_owner];
    CUIForegroundRequire(registration || !CUIForegroundOpaque(_source.layer), @"Opaque foreground requires a registered composition source");
    const auto scale = _owner.window.screen.scale;
    CGRect bounds = CUIForegroundInk(_source.layer, _source.layer, CGRectNull);
    if (CGRectIsNull(bounds) || CGRectIsEmpty(bounds)) { [self restore]; return; }
    bounds = CGRectMake(std::floor(CGRectGetMinX(bounds)*scale)/scale, std::floor(CGRectGetMinY(bounds)*scale)/scale,
        0, 0);
    CGRect full = CUIForegroundInk(_source.layer, _source.layer, CGRectNull);
    bounds.size = CGSizeMake(std::ceil((CGRectGetMaxX(full)-bounds.origin.x)*scale)/scale,
        std::ceil((CGRectGetMaxY(full)-bounds.origin.y)*scale)/scale);
    _request = [[CUIForegroundCompositionRequest alloc] initWithRoot:registration.root ?: _owner owner:_owner source:_source output:_output
        sourceEpoch:CUIForegroundEpoch(_source) outputEpoch:CUIForegroundEpoch(_output) ownerId:_ownerId generation:_generation frame:++_frame
        bounds:bounds scale:scale sourceQuad:CUIForegroundQuad(_source) outputQuad:CUIForegroundQuad(_output)];
    _current = std::make_shared<std::atomic<bool>>(true); _busy = YES;
    if (registration) {
      if (!_session) {
        _registration = registration;
        __weak CUIForegroundRenderer *weak = self;
        _registrationObserver = [registration observeRetirement:^{ [weak restore]; }];
        _sessionIdentity = _request;
        _session = [[registration source] prepareForeground:_request];
        CUIForegroundRequire(_session != nil, @"Foreground provider did not prepare a session");
      }
      CUIForegroundCompositionRequest *request = _request;
      auto once = std::make_shared<std::atomic<bool>>(false);
      __weak CUIForegroundRenderer *weak = self;
      [_session captureForeground:request completion:^(CUIForegroundCompositionFrame *frame, NSError *error) {
        const bool duplicate = once->exchange(true);
        dispatch_async(dispatch_get_main_queue(), ^{
          CUIForegroundRenderer *renderer = weak;
          if (!renderer || request.cancelled) return;
          if (duplicate || error || !frame) { renderer->_busy = NO; [renderer fail:duplicate ? @"Foreground capture completed twice" : error.localizedDescription ?: @"Foreground capture missing"]; return; }
          @try {
            CUIForegroundRequire(frame.request == request, @"Foreground provider returned another request");
            [renderer process:frame];
          } @catch (NSException *failure) { renderer->_busy = NO; [renderer fail:failure.reason]; }
        });
      }];
    } else {
      const size_t width = static_cast<size_t>(std::llround(bounds.size.width*scale));
      const size_t height = static_cast<size_t>(std::llround(bounds.size.height*scale));
      CUIForegroundRequire(width && height && width <= SIZE_MAX/height/4, @"Foreground capture extent invalid");
      NSMutableData *rgba = [NSMutableData dataWithLength:width*height*4];
      CGColorSpaceRef color = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
      CGContextRef context = CGBitmapContextCreate(rgba.mutableBytes, width, height, 8, width*4, color,
          static_cast<CGBitmapInfo>(kCGImageAlphaPremultipliedLast) | kCGBitmapByteOrder32Big);
      CGColorSpaceRelease(color);
      CUIForegroundRequire(context != nil, @"Foreground capture context unavailable");
      CGContextTranslateCTM(context, 0, height); CGContextScaleCTM(context, scale, -scale);
      CGContextTranslateCTM(context, -bounds.origin.x, -bounds.origin.y);
      @try { [(_source.layer.presentationLayer ?: _source.layer) renderInContext:context]; }
      @finally { CGContextRelease(context); }
      [self process:[[CUIForegroundCompositionFrame alloc] initWithRequest:_request rgba:rgba width:width height:height
          complete:YES excludesOwnerEffectsAndOutput:YES protectedContent:NO]];
    }
  } @catch (NSException *error) { _busy = NO; [self fail:error.reason]; }
}
- (void)process:(CUIForegroundCompositionFrame *)frame {
  CUIForegroundCompositionRequest *request = frame.request;
  if (![self admit:request]) { _busy = NO; return; }
  CUIForegroundRequire(frame.complete && frame.excludesOwnerEffectsAndOutput && !frame.protectedContent &&
      frame.width == std::llround(request.rasterBounds.size.width*request.scale) &&
      frame.height == std::llround(request.rasterBounds.size.height*request.scale), @"Foreground provider returned incomplete or mismatched pixels");
  _filtering = YES;
  auto token = _current; auto filters = _filters; const auto opacity = _opacity;
  if (opacity != 1) filters.push_back({TForegroundFilterKind::Opacity, opacity});
  __weak CUIForegroundRenderer *weak = self;
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    auto result = std::make_shared<TForegroundRaster>();
    NSString *failure = nil;
    try { *result = filterForeground(static_cast<const uint8_t *>(frame.rgba.bytes), frame.width, frame.height, filters, [token] { return token->load(); }); }
    catch (const std::exception &error) { failure = @(error.what()); }
    dispatch_async(dispatch_get_main_queue(), ^{
      CUIForegroundRenderer *renderer = weak; if (!renderer) return;
      renderer->_busy = NO; renderer->_filtering = NO;
      if (![renderer admit:request] || !token->load()) return;
      if (failure) { [renderer fail:failure]; return; }
      @try {
        NSData *data = [NSData dataWithBytes:result->rgba.data() length:result->rgba.size()];
        CGDataProviderRef provider = CGDataProviderCreateWithCFData((__bridge CFDataRef)data);
        CGColorSpaceRef space = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
        CGImageRef image = CGImageCreate(result->width, result->height, 8, 32, result->width*4, space,
            static_cast<CGBitmapInfo>(kCGImageAlphaPremultipliedLast) | kCGBitmapByteOrder32Big, provider, nil, NO, kCGRenderingIntentDefault);
        CGColorSpaceRelease(space); CGDataProviderRelease(provider);
        CUIForegroundRequire(image != nil, @"Foreground output image unavailable");
        CGRect outputBounds = CGRectMake(request.rasterBounds.origin.x+result->x/request.scale,
            request.rasterBounds.origin.y+result->y/request.scale, result->width/request.scale, result->height/request.scale);
        [CATransaction begin]; [CATransaction setDisableActions:YES];
        @try {
          [renderer->_session presentForeground:[[CUIForegroundCompositionPresentation alloc] initWithFrame:frame bounds:outputBounds]];
          renderer->_presentedIdentity = request;
          renderer->_output.frame = outputBounds; renderer->_output.layer.contents = (__bridge id)image;
          renderer->_output.layer.contentsScale = request.scale; renderer->_output.hidden = NO;
          renderer->_mask.frame = renderer->_sourceMask.bounds; renderer->_mask.opacity = 0;
          renderer->_sourceMask.layer.mask = renderer->_mask;
        } @finally { CGImageRelease(image); [CATransaction commit]; }
      } @catch (NSException *error) { [renderer fail:error.reason]; }
    });
  });
}
- (void)retire {
  RCTAssertMainQueue(); [_displayLink invalidate]; _displayLink = nil; [self restore];
  [_sourceMask removeFromSuperview]; [_output removeFromSuperview]; _owner = nil;
}
- (void)dealloc { [NSNotificationCenter.defaultCenter removeObserver:_activeObserver]; [NSNotificationCenter.defaultCenter removeObserver:_inactiveObserver]; [_displayLink invalidate]; if (_current) _current->store(false); [_request cancel]; }
@end
