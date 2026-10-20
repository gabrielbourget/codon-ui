#import "CUIMotionGeometryObserver.h"
#import "CUIInputWindow.h"
#import "CUIKeyboardScope.h"
#import <QuartzCore/QuartzCore.h>
#import <cmath>

static NSUInteger CUIGeometrySequence = 0;
static NSString *CUIIdentity(id object) {
  static NSMapTable *identities;
  static NSUInteger sequence = 0;
  if (!identities) identities = [NSMapTable mapTableWithKeyOptions:NSPointerFunctionsWeakMemory | NSPointerFunctionsObjectPointerPersonality valueOptions:NSPointerFunctionsStrongMemory];
  NSString *value = [identities objectForKey:object];
  if (!value) { value = [NSString stringWithFormat:@"ios-geometry:%lu", (unsigned long)++sequence]; [identities setObject:value forKey:object]; }
  return value;
}
static NSArray *CUIRect(CGRect rect) { return @[@(rect.origin.x), @(rect.origin.y), @(rect.size.width), @(rect.size.height)]; }
static NSArray *CUIMatrix(CATransform3D matrix) {
  return @[@(matrix.m11), @(matrix.m12), @(matrix.m13), @(matrix.m14), @(matrix.m21), @(matrix.m22), @(matrix.m23), @(matrix.m24), @(matrix.m31), @(matrix.m32), @(matrix.m33), @(matrix.m34), @(matrix.m41), @(matrix.m42), @(matrix.m43), @(matrix.m44)];
}
static NSDictionary *CUIBox(CALayer *layer, CALayer *window) {
  CGRect bounds = layer.bounds;
  CGPoint input[] = {{CGRectGetMinX(bounds), CGRectGetMinY(bounds)}, {CGRectGetMaxX(bounds), CGRectGetMinY(bounds)}, {CGRectGetMaxX(bounds), CGRectGetMaxY(bounds)}, {CGRectGetMinX(bounds), CGRectGetMaxY(bounds)}};
  NSMutableArray *quad = [NSMutableArray array];
  CGFloat minX = INFINITY, minY = INFINITY, maxX = -INFINITY, maxY = -INFINITY;
  for (CGPoint point : input) {
    CGPoint mapped = [layer convertPoint:point toLayer:window];
    [quad addObjectsFromArray:@[@(mapped.x), @(mapped.y)]];
    minX = MIN(minX, mapped.x); minY = MIN(minY, mapped.y); maxX = MAX(maxX, mapped.x); maxY = MAX(maxY, mapped.y);
  }
  return @{@"quad": quad, @"box": CUIRect(CGRectMake(minX, minY, maxX - minX, maxY - minY))};
}
static CGRect CUILayout(CALayer *layer) {
  return CGRectMake(layer.position.x - layer.anchorPoint.x * layer.bounds.size.width, layer.position.y - layer.anchorPoint.y * layer.bounds.size.height, layer.bounds.size.width, layer.bounds.size.height);
}
static NSDictionary *CUIUntransformed(CALayer *layer, CALayer *window) {
  CGPoint point = layer.bounds.origin;
  for (CALayer *current = layer; current && current != window; current = current.superlayer) {
    point.x += current.position.x - current.anchorPoint.x * current.bounds.size.width - current.bounds.origin.x;
    point.y += current.position.y - current.anchorPoint.y * current.bounds.size.height - current.bounds.origin.y;
  }
  CGFloat width = layer.bounds.size.width, height = layer.bounds.size.height;
  return @{@"quad": @[@(point.x), @(point.y), @(point.x + width), @(point.y), @(point.x + width), @(point.y + height), @(point.x), @(point.y + height)], @"box": CUIRect(CGRectMake(point.x, point.y, width, height))};
}
static NSDictionary *CUIClip(CALayer *layer) {
  CALayer *mask = layer.mask; NSMutableArray *path = [NSMutableArray array];
  BOOL complete = mask == nil;
  if ([mask isKindOfClass:CAShapeLayer.class]) {
    CGPathRef shape = ((CAShapeLayer *)mask).path;
    if (shape) CGPathApplyWithBlock(shape, ^(const CGPathElement *element) {
      NSUInteger count = element->type == kCGPathElementAddCurveToPoint ? 3 : element->type == kCGPathElementAddQuadCurveToPoint ? 2 : element->type == kCGPathElementCloseSubpath ? 0 : 1;
      NSMutableArray *command = [NSMutableArray arrayWithObject:@(element->type)];
      for (NSUInteger index = 0; index < count; index++) [command addObjectsFromArray:@[@(element->points[index].x), @(element->points[index].y)]];
      [path addObject:command];
    });
  }
  return @{@"bounds": @(layer.masksToBounds), @"cornerRadius": @(layer.cornerRadius), @"maskedCorners": @(layer.maskedCorners), @"cornerCurve": layer.cornerCurve ?: @"", @"mask": mask ? @{@"bounds": CUIRect(mask.bounds), @"layout": CUIRect(CUILayout(mask)), @"matrix": CUIMatrix(mask.transform), @"path": path, @"fillRule": [mask isKindOfClass:CAShapeLayer.class] ? ((CAShapeLayer *)mask).fillRule : @""} : NSNull.null, @"complete": @(complete)};
}

@interface CUIMotionGeometryDisplayTarget : NSObject
@property (nonatomic, weak) CUIMotionGeometryObserver *observer;
- (void)tick:(CADisplayLink *)link;
@end
@implementation CUIMotionGeometryObserver {
  __weak UIView *_root;
  void (^_emit)(NSDictionary *);
  NSString *_owner, *_binding, *_revision, *_attachment, *_lastFrame;
  NSString *_lastWindow, *_lastScope;
  double _lastEpoch;
  NSUInteger _attachmentRevision;
  CADisplayLink *_displayLink;
}
- (instancetype)initWithRoot:(UIView *)root emit:(void (^)(NSDictionary *))emit {
  if (self = [super init]) { _root = root; _emit = [emit copy]; _owner = @""; _binding = @""; _revision = @""; _attachment = @""; }
  return self;
}
- (void)configureOwner:(NSString *)owner binding:(NSString *)binding revision:(NSString *)revision {
  if (![_owner isEqual:owner] || ![_binding isEqual:binding]) { _attachmentRevision++; _attachment = @""; _lastFrame = nil; _lastWindow = @""; _lastScope = @""; _lastEpoch = 0; }
  _owner = [owner copy]; _binding = [binding copy]; _revision = [revision copy];
  [self synchronizeDisplayLink];
}
- (NSMutableDictionary *)envelope:(NSString *)kind requestId:(NSString *)requestId transaction:(NSString *)transaction {
  UIView *root = _root; UIWindow *window = root.window;
  NSString *scopeOwner = @""; double epoch = 0;
  for (UIView *parent = root.superview; window && parent; parent = parent.superview) {
    if ([parent isKindOfClass:CUIKeyboardScope.class]) { NSDictionary *session = [(CUIKeyboardScope *)parent activationSession]; scopeOwner = session[@"scopeOwnerId"] ?: @""; epoch = [session[@"epoch"] doubleValue]; break; }
  }
  NSString *windowId = window ? CUIInputWindowIdentity(window) : @"";
  if (window) { _lastWindow = windowId; _lastScope = scopeOwner; _lastEpoch = epoch; }
  else { windowId = _lastWindow ?: @""; scopeOwner = _lastScope ?: @""; epoch = _lastEpoch; }
  NSString *attachment = [NSString stringWithFormat:@"%@|%@|%.0f", windowId, scopeOwner, epoch];
  if (![_attachment isEqual:attachment]) { _attachment = attachment; _attachmentRevision++; _lastFrame = nil; }
  return [@{@"ownerId": _owner, @"bindingId": _binding, @"target": @(root.tag), @"windowId": windowId, @"scopeOwnerId": scopeOwner, @"epoch": @(epoch), @"attachmentRevision": @(_attachmentRevision), @"geometryRevision": @(++CUIGeometrySequence), @"commitRevision": _revision, @"transactionId": transaction, @"kind": kind, @"requestId": requestId, @"attached": @(window != nil), @"observedAt": @(NSProcessInfo.processInfo.systemUptime * 1000)} mutableCopy];
}
- (NSDictionary *)snapshot {
  UIView *root = _root; UIWindow *window = root.window;
  NSMutableArray *ancestors = [NSMutableArray array], *layers = [NSMutableArray array];
  for (UIView *view = root; view; view = view.superview) {
    CALayer *layer = view.layer;
    [ancestors addObject:@{@"tag": @(view.tag), @"identity": CUIIdentity(view), @"bounds": CUIRect(view.bounds), @"layout": CUIRect(CUILayout(layer)), @"visible": @(!view.hidden), @"opacity": @(view.alpha), @"scroll": @[@(view.bounds.origin.x), @(view.bounds.origin.y)], @"matrix": CUIMatrix(layer.transform), @"model": CUIBox(layer, window.layer), @"clip": CUIClip(layer)}];
    if (view == window) break;
  }
  for (CALayer *layer = root.layer; layer; layer = layer.superlayer) {
    [layers addObject:@{@"identity": CUIIdentity(layer), @"bounds": CUIRect(layer.bounds), @"position": @[@(layer.position.x), @(layer.position.y)], @"zPosition": @(layer.zPosition), @"anchor": @[@(layer.anchorPoint.x), @(layer.anchorPoint.y), @(layer.anchorPointZ)], @"matrix": CUIMatrix(layer.transform), @"sublayerMatrix": CUIMatrix(layer.sublayerTransform), @"clip": CUIClip(layer)}];
    if (layer == window.layer) break;
  }
  CALayer *presentation = root.layer.presentationLayer, *presentationWindow = window.layer.presentationLayer;
  UIEdgeInsets safe = window.safeAreaInsets;
  return @{@"platform": @"ios", @"coordinateSpace": @"window", @"units": @"points", @"density": @(window.screen.scale), @"matrixFormat": @"core-animation-4x4", @"rootTag": @(window.tag), @"rootIdentity": CUIIdentity(window), @"root": CUIBox(window.layer, window.layer), @"safeArea": @[@(safe.left), @(safe.top), @(safe.right), @(safe.bottom)], @"layout": CUIRect(CUILayout(root.layer)), @"untransformed": CUIUntransformed(root.layer, window.layer), @"model": CUIBox(root.layer, window.layer), @"presentation": presentation && presentationWindow ? CUIBox(presentation, presentationWindow) : (id)NSNull.null, @"presentationSource": @"core-animation-presentation-layer", @"ancestors": ancestors, @"layers": layers, @"mountObservationAvailable": @YES};
}
- (void)captureKind:(NSString *)kind requestId:(NSString *)requestId transaction:(NSString *)transaction {
  if (!_binding.length) return;
  NSMutableDictionary *data = [self envelope:kind requestId:requestId transaction:transaction];
  NSString *snapshot = @"", *error = @"";
  if (![data[@"attached"] boolValue]) error = @"native-geometry-view-detached";
  else {
    NSDictionary *value = [self snapshot]; NSError *failure = nil;
    NSData *encoded = [NSJSONSerialization isValidJSONObject:value] ? [NSJSONSerialization dataWithJSONObject:value options:NSJSONWritingSortedKeys error:&failure] : nil;
    if (encoded && !failure) snapshot = [[NSString alloc] initWithData:encoded encoding:NSUTF8StringEncoding];
    else error = @"invalid-native-geometry";
  }
  if ([kind isEqual:@"frame"] && [_lastFrame isEqual:snapshot] && error.length == 0) return;
  if ([kind isEqual:@"frame"]) _lastFrame = snapshot;
  data[@"snapshot"] = snapshot; data[@"error"] = error;
  if (_emit) _emit(data);
}
- (void)queryOwner:(NSString *)owner binding:(NSString *)binding requestId:(NSString *)requestId {
  if ([_owner isEqual:owner] && [_binding isEqual:binding] && requestId.length) [self captureKind:@"sample" requestId:requestId transaction:@""];
}
- (void)windowChanged {
  [self synchronizeDisplayLink];
  [self captureKind:_root.window ? @"sample" : @"detached" requestId:@"" transaction:@""];
}
- (void)synchronizeDisplayLink {
  if (!_binding.length || !_root.window) { [_displayLink invalidate]; _displayLink = nil; return; }
  if (!_displayLink) {
    CUIMotionGeometryDisplayTarget *target = [CUIMotionGeometryDisplayTarget new]; target.observer = self;
    _displayLink = [CADisplayLink displayLinkWithTarget:target selector:@selector(tick:)];
    [_displayLink addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
  }
}
- (void)invalidate { [_displayLink invalidate]; _displayLink = nil; _binding = @""; _owner = @""; _attachment = @""; _lastFrame = nil; _attachmentRevision++; }
- (void)dealloc { [_displayLink invalidate]; }
@end

@implementation CUIMotionGeometryDisplayTarget
- (void)tick:(CADisplayLink *)link { [_observer captureKind:@"frame" requestId:@"" transaction:@""]; }
@end
