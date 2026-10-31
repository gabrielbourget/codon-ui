#import "CUIForegroundCompositionSource+Internal.h"
#import <React/RCTAssert.h>
#include <limits>

@implementation CUIForegroundCompositionRequest {
  BOOL _cancelled;
}
- (instancetype)initWithRoot:(UIView *)root owner:(UIView *)owner source:(UIView *)source output:(UIView *)output
    sourceEpoch:(NSDictionary *)sourceEpoch outputEpoch:(NSDictionary *)outputEpoch
    ownerId:(NSString *)ownerId generation:(NSUInteger)generation frame:(NSUInteger)frame bounds:(CGRect)bounds scale:(CGFloat)scale
    sourceQuad:(NSArray<NSNumber *> *)sourceQuad outputQuad:(NSArray<NSNumber *> *)outputQuad {
  if ((self = [super init])) {
    _registrationRoot = root; _owner = owner; _source = source; _output = output;
    _sourceWindow = source.window; _outputWindow = output.window;
    _sourceEpoch = [sourceEpoch copy]; _outputEpoch = [outputEpoch copy];
    _ownerId = [ownerId copy];
    _frameId = [NSString stringWithFormat:@"%@-%lu-%lu", _ownerId, (unsigned long)generation, (unsigned long)frame];
    _generation = generation; _rasterBounds = bounds; _scale = scale;
    _sourceScreenQuad = [sourceQuad copy]; _outputScreenQuad = [outputQuad copy];
  }
  return self;
}
- (BOOL)isCancelled { @synchronized (self) { return _cancelled; } }
- (void)cancel { @synchronized (self) { _cancelled = YES; } }
@end

@implementation CUIForegroundCompositionFrame
- (instancetype)initWithRequest:(CUIForegroundCompositionRequest *)request rgba:(NSData *)rgba
    width:(NSUInteger)width height:(NSUInteger)height complete:(BOOL)complete
    excludesOwnerEffectsAndOutput:(BOOL)excludes protectedContent:(BOOL)protectedContent {
  if (!request || !width || !height || width > std::numeric_limits<NSUInteger>::max()/height/4 ||
      !rgba || rgba.length != width*height*4)
    @throw [NSException exceptionWithName:NSInvalidArgumentException reason:@"Native foreground: invalid capture raster" userInfo:nil];
  if ((self = [super init])) {
    _request = request; _rgba = [rgba copy]; _width = width; _height = height;
    _complete = complete; _excludesOwnerEffectsAndOutput = excludes; _protectedContent = protectedContent;
  }
  return self;
}
@end
@implementation CUIForegroundCompositionPresentation
- (instancetype)initWithFrame:(CUIForegroundCompositionFrame *)frame bounds:(CGRect)bounds {
  if ((self = [super init])) { _sourceFrame = frame; _outputBounds = bounds; }
  return self;
}
@end

@interface CUIForegroundCompositionRegistration ()
- (instancetype)initWithRoot:(UIView *)root source:(id<CUIForegroundCompositionSource>)source;
@end
@implementation CUIForegroundCompositionRegistration {
  id<CUIForegroundCompositionSource> _source;
  NSMutableDictionary<NSUUID *, dispatch_block_t> *_retirements;
}
- (instancetype)initWithRoot:(UIView *)root source:(id<CUIForegroundCompositionSource>)source {
  if ((self = [super init])) { _root = root; _source = source; _retirements = [NSMutableDictionary new]; }
  return self;
}
- (BOOL)isActive { RCTAssertMainQueue(); return _source && _root; }
- (id<CUIForegroundCompositionSource>)source {
  RCTAssertMainQueue();
  if (!self.active) @throw [NSException exceptionWithName:@"CUI.Foreground" reason:@"Foreground registration retired" userInfo:nil];
  return _source;
}
- (id)observeRetirement:(dispatch_block_t)callback {
  (void)[self source]; NSUUID *key = [NSUUID UUID]; _retirements[key] = [callback copy]; return key;
}
- (void)removeRetirementObserver:(id)key { RCTAssertMainQueue(); [_retirements removeObjectForKey:key]; }
- (void)dispose {
  RCTAssertMainQueue();
  if (!_source) return;
  _source = nil;
  NSArray<dispatch_block_t> *pending = _retirements.allValues; [_retirements removeAllObjects];
  for (dispatch_block_t callback in pending) callback();
}
- (void)dealloc {
  NSArray<dispatch_block_t> *pending = _retirements.allValues;
  if (NSThread.isMainThread) { for (dispatch_block_t callback in pending) callback(); }
  else dispatch_async(dispatch_get_main_queue(), ^{ for (dispatch_block_t callback in pending) callback(); });
}
@end
@implementation CUIForegroundCompositionRegistry
+ (NSMapTable<UIView *, CUIForegroundCompositionRegistration *> *)entries {
  static NSMapTable *entries; static dispatch_once_t once;
  dispatch_once(&once, ^{ entries = [NSMapTable mapTableWithKeyOptions:NSPointerFunctionsWeakMemory | NSPointerFunctionsObjectPointerPersonality
      valueOptions:NSPointerFunctionsWeakMemory | NSPointerFunctionsObjectPointerPersonality]; });
  return entries;
}
+ (CUIForegroundCompositionRegistration *)registerSource:(id<CUIForegroundCompositionSource>)source forRoot:(UIView *)root {
  RCTAssertMainQueue();
  if (!root || !source) @throw [NSException exceptionWithName:NSInvalidArgumentException reason:@"Foreground root/source required" userInfo:nil];
  [[[self entries] objectForKey:root] dispose];
  CUIForegroundCompositionRegistration *token = [[CUIForegroundCompositionRegistration alloc] initWithRoot:root source:source];
  [[self entries] setObject:token forKey:root]; return token;
}
+ (CUIForegroundCompositionRegistration *)registrationForOwner:(UIView *)owner {
  RCTAssertMainQueue();
  for (UIView *view = owner; view; view = view.superview) {
    CUIForegroundCompositionRegistration *value = [[self entries] objectForKey:view];
    if (value.active) return value;
  }
  return nil;
}
@end
