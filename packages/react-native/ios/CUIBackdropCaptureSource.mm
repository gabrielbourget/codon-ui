#import "CUIBackdropCaptureSource+Internal.h"
#import <React/RCTAssert.h>
#include <limits>

@implementation CUIBackdropCaptureRequest {
  BOOL _cancelled;
}
- (instancetype)initWithTarget:(UIView *)target receiver:(UIView *)receiver
    targetEpoch:(NSDictionary *)targetEpoch receiverEpoch:(NSDictionary *)receiverEpoch
    ownerId:(NSString *)ownerId frameId:(NSString *)frameId generation:(NSNumber *)generation
    targetScreenQuad:(NSArray<NSNumber *> *)targetQuad receiverScreenQuad:(NSArray<NSNumber *> *)receiverQuad {
  if ((self = [super init])) {
    _target = target; _receiver = receiver; _targetWindow = target.window; _receiverWindow = receiver.window;
    _targetEpoch = [targetEpoch copy]; _receiverEpoch = [receiverEpoch copy];
    _ownerId = [ownerId copy]; _frameId = [frameId copy]; _generation = [generation copy];
    _targetBounds = target.bounds; _receiverBounds = receiver.bounds;
    _targetScreenQuad = [targetQuad copy]; _receiverScreenQuad = [receiverQuad copy];
    _scale = target.window.screen.scale;
  }
  return self;
}
- (void)cancel { @synchronized (self) { _cancelled = YES; } }
- (BOOL)isCancelled { @synchronized (self) { return _cancelled; } }
@end

@implementation CUIBackdropCapturedFrame
- (instancetype)initWithRequest:(CUIBackdropCaptureRequest *)request width:(NSUInteger)width
    height:(NSUInteger)height rgba:(NSData *)rgba complete:(BOOL)complete
    excludesEffect:(BOOL)excludesEffect protectedContent:(BOOL)protectedContent {
  if (!request || !width || !height || width > std::numeric_limits<NSUInteger>::max()/4/height ||
      !rgba || rgba.length != width*height*4)
    @throw [NSException exceptionWithName:NSInvalidArgumentException reason:@"Native backdrop: invalid capture raster" userInfo:nil];
  if ((self = [super init])) {
    _request = request; _width = width; _height = height; _rgba = [rgba copy];
    _complete = complete; _excludesEffect = excludesEffect; _protectedContent = protectedContent;
  }
  return self;
}
@end

@interface CUIBackdropCaptureRegistration ()
- (instancetype)initWithTarget:(UIView *)target source:(id<CUIBackdropCaptureSource>)source;
@end
@implementation CUIBackdropCaptureRegistration {
  id<CUIBackdropCaptureSource> _source;
  NSMutableDictionary<NSUUID *, dispatch_block_t> *_retirements;
}
- (instancetype)initWithTarget:(UIView *)target source:(id<CUIBackdropCaptureSource>)source {
  if ((self = [super init])) { _target = target; _source = source; _retirements = [NSMutableDictionary new]; }
  return self;
}
- (BOOL)isActive {
  RCTAssertMainQueue();
  return _source && _target && [CUIBackdropCaptureRegistry registrationForTarget:_target] == self;
}
- (id<CUIBackdropCaptureSource>)source {
  RCTAssertMainQueue();
  if (!self.active) @throw [NSException exceptionWithName:NSInternalInconsistencyException
      reason:@"Native backdrop: capture registration retired" userInfo:nil];
  return _source;
}
- (id)observeRetirement:(dispatch_block_t)callback {
  (void)[self source];
  NSUUID *key = [NSUUID UUID]; _retirements[key] = [callback copy]; return key;
}
- (void)removeRetirementObserver:(id)key { RCTAssertMainQueue(); [_retirements removeObjectForKey:key]; }
- (void)dispose {
  RCTAssertMainQueue();
  if (!_source) return;
  _source = nil;
  [CUIBackdropCaptureRegistry removeRegistration:self];
  NSArray<dispatch_block_t> *pending = _retirements.allValues; [_retirements removeAllObjects];
  for (dispatch_block_t callback in pending) callback();
}
- (void)dealloc {
  NSArray<dispatch_block_t> *pending = _retirements.allValues;
  if (NSThread.isMainThread) { for (dispatch_block_t callback in pending) callback(); }
  else dispatch_async(dispatch_get_main_queue(), ^{ for (dispatch_block_t callback in pending) callback(); });
}
@end

@implementation CUIBackdropCaptureRegistry
+ (NSMapTable<UIView *, CUIBackdropCaptureRegistration *> *)entries {
  static NSMapTable *entries;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    entries = [NSMapTable mapTableWithKeyOptions:NSPointerFunctionsWeakMemory | NSPointerFunctionsObjectPointerPersonality
        valueOptions:NSPointerFunctionsWeakMemory | NSPointerFunctionsObjectPointerPersonality];
  });
  return entries;
}
+ (CUIBackdropCaptureRegistration *)registrationForTarget:(UIView *)target {
  RCTAssertMainQueue(); return [[self entries] objectForKey:target];
}
+ (void)removeRegistration:(CUIBackdropCaptureRegistration *)registration {
  UIView *target = registration.target;
  if (target && [self registrationForTarget:target] == registration) [[self entries] removeObjectForKey:target];
}
+ (CUIBackdropCaptureRegistration *)registerSource:(id<CUIBackdropCaptureSource>)source forTarget:(UIView *)target {
  RCTAssertMainQueue();
  if (!source || !target) @throw [NSException exceptionWithName:NSInvalidArgumentException
      reason:@"Native backdrop: target/source required" userInfo:nil];
  [[self registrationForTarget:target] dispose];
  CUIBackdropCaptureRegistration *token = [[CUIBackdropCaptureRegistration alloc] initWithTarget:target source:source];
  [[self entries] setObject:token forKey:target]; return token;
}
@end
