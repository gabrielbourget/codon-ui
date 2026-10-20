#import "CUIFloatingObserver.h"
#import "CUINativeDescription.h"

@interface CUIFloatingSample : NSObject
@property(nonatomic, weak) UIView *anchor;
@property(nonatomic, strong) NSArray<NSValue *> *ancestors;
@property(nonatomic, strong) NSArray<NSValue *> *offsets;
@property(nonatomic, strong) NSDictionary *last;
@property(nonatomic, assign) NSInteger scrollRevision;
@end
@implementation CUIFloatingSample
@end

@implementation CUIFloatingObserver {
  __weak UIView *_host;
  void (^_publish)(NSDictionary *);
  NSArray<NSDictionary *> *_targets;
  NSMutableDictionary<NSString *, CUIFloatingSample *> *_samples;
  CADisplayLink *_displayLink;
  NSMutableDictionary<NSString *, CUINativeDescription *> *_descriptions;
  NSUInteger _revision;
}
- (instancetype)initWithHost:(UIView *)host publish:(void (^)(NSDictionary *))publish
{
  if (self = [super init]) {
    _host = host;
    _publish = [publish copy];
    _targets = @[];
    _samples = [NSMutableDictionary dictionary];
    _descriptions = [NSMutableDictionary dictionary];
  }
  return self;
}
- (void)setTargets:(NSArray<NSDictionary *> *)targets active:(BOOL)active
{
  _targets = targets;
  NSMutableSet *ids = [NSMutableSet set];
  for (NSDictionary *target in targets) [ids addObject:target[@"id"]];
  for (NSString *key in _samples.allKeys) if (![ids containsObject:key]) [_samples removeObjectForKey:key];
  for (NSString *key in _descriptions.allKeys) if (![ids containsObject:key]) { [_descriptions[key] invalidate]; [_descriptions removeObjectForKey:key]; }
  if (!active || !targets.count || !_host.window) {
    [_displayLink invalidate]; _displayLink = nil;
    for (CUIFloatingSample *sample in _samples.allValues) { sample.ancestors = nil; sample.offsets = nil; sample.last = nil; }
    for (CUINativeDescription *binding in _descriptions.allValues) [binding invalidate];
    [_descriptions removeAllObjects];
    return;
  }
  if (!_displayLink) {
    _displayLink = [CADisplayLink displayLinkWithTarget:self selector:@selector(sample:)];
    [_displayLink addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
  }
}
static UIView *CUIFindFloatingAnchor(UIView *root, NSInteger tag)
{
  if (root.tag == tag) return root;
  for (UIView *child in root.subviews) { UIView *match = CUIFindFloatingAnchor(child, tag); if (match) return match; }
  return nil;
}
- (void)sample:(CADisplayLink *)link
{
  UIView *host = _host;
  UIWindow *window = host.window;
  if (!window || !window.isKeyWindow) return;
  CGRect visible = window.bounds;
  CGRect keyboard = window.keyboardLayoutGuide.layoutFrame;
  if (keyboard.size.height > window.safeAreaInsets.bottom) {
    CGRect covered = CGRectIntersection(visible, keyboard);
    if (!CGRectIsNull(covered) && CGRectGetMaxY(covered) >= CGRectGetMaxY(visible) && covered.size.width >= visible.size.width) visible.size.height = MAX(0, CGRectGetMinY(covered) - CGRectGetMinY(visible));
  }
  // Intersect actual native frames before converting to host coordinates, avoiding double subtraction from a resized host.
  CGRect hostFrame = [host convertRect:host.bounds toView:window];
  visible = CGRectIntersection(visible, hostFrame);
  if (CGRectIsNull(visible)) visible = CGRectMake(CGRectGetMinX(hostFrame), CGRectGetMinY(hostFrame), 0, 0);
  visible = [host convertRect:visible fromView:window];
  for (NSDictionary *target in _targets) {
    NSString *identity = target[@"id"];
    NSInteger tag = [target[@"targetTag"] integerValue];
    UIView *anchor = tag > 0 ? CUIFindFloatingAnchor(window, tag) : nil;
    if (!anchor || anchor.window != window) { [_samples removeObjectForKey:identity]; [_descriptions[identity] invalidate]; [_descriptions removeObjectForKey:identity]; continue; }
    NSInteger descriptionTag = [target[@"descriptionTag"] integerValue];
    UIView *description = descriptionTag > 0 ? CUIFindFloatingAnchor(window, descriptionTag) : nil;
    if (description) {
      CUINativeDescription *binding = _descriptions[identity];
      if (!binding) { binding = [CUINativeDescription new]; _descriptions[identity] = binding; }
      [binding bindTarget:anchor description:description label:target[@"descriptionLabel"]];
    } else { [_descriptions[identity] invalidate]; [_descriptions removeObjectForKey:identity]; }
    CUIFloatingSample *sample = _samples[identity];
    if (!sample || sample.anchor != anchor) { sample = [CUIFloatingSample new]; sample.anchor = anchor; _samples[identity] = sample; }
    NSMutableArray *ancestors = [NSMutableArray array], *offsets = [NSMutableArray array];
    for (UIView *view = anchor.superview; view && view != window; view = view.superview) {
      if ([view isKindOfClass:UIScrollView.class]) {
        [ancestors addObject:[NSValue valueWithNonretainedObject:view]];
        [offsets addObject:[NSValue valueWithCGPoint:((UIScrollView *)view).contentOffset]];
      }
    }
    if ([sample.ancestors isEqual:ancestors] && ![sample.offsets isEqual:offsets]) sample.scrollRevision++;
    sample.ancestors = ancestors; sample.offsets = offsets;
    NSDictionary *data = @{ @"id": identity, @"targetTag": @(tag), @"x": @(visible.origin.x), @"y": @(visible.origin.y), @"width": @(visible.size.width), @"height": @(visible.size.height), @"scrollRevision": @(sample.scrollRevision) };
    if (![sample.last isEqual:data]) { sample.last = data; NSMutableDictionary *packet = [data mutableCopy]; packet[@"revision"] = @(++_revision); _publish(packet); }
  }
}
- (void)invalidate { [_displayLink invalidate]; _displayLink = nil; [_samples removeAllObjects]; for (CUINativeDescription *binding in _descriptions.allValues) [binding invalidate]; [_descriptions removeAllObjects]; }
- (void)dealloc { [self invalidate]; }
@end
