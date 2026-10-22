#import "CUIFocusWithinObserver.h"
#import "CUIInputWindow.h"

@implementation CUIFocusWithinObserver {
  __weak UIView *_root;
  NSDictionary *(^_environment)(void);
  void (^_emit)(NSDictionary *);
  NSString *_binding;
  NSDictionary *_last;
  NSUInteger _sequence, _generation;
  BOOL _observing, _scheduled, _applicationActive;
}
- (instancetype)initWithRoot:(UIView *)root environment:(NSDictionary *(^)(void))environment emit:(void (^)(NSDictionary *))emit
{
  if (self = [super init]) { _root = root; _environment = [environment copy]; _emit = [emit copy]; }
  return self;
}
- (void)configure:(NSString *)binding
{
  if (!binding.length) { [self invalidate]; return; }
  if (![_binding isEqual:binding]) { _binding = [binding copy]; _last = nil; }
  if (!_observing) {
    _observing = YES;
    _applicationActive = UIApplication.sharedApplication.applicationState == UIApplicationStateActive;
    for (NSString *name in @[CUIInputFocusChangedNotification, UITextFieldTextDidBeginEditingNotification, UITextFieldTextDidEndEditingNotification,
        UITextViewTextDidBeginEditingNotification, UITextViewTextDidEndEditingNotification,
        UIApplicationWillResignActiveNotification, UIApplicationDidBecomeActiveNotification,
        UISceneWillDeactivateNotification, UISceneDidActivateNotification,
        UIWindowDidBecomeKeyNotification, UIWindowDidResignKeyNotification])
      [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(changed:) name:name object:nil];
  }
  [self schedule];
}
- (void)changed:(NSNotification *)notification
{
  if ([notification.object isKindOfClass:UIWindowScene.class] && notification.object != _root.window.windowScene) return;
  if ([notification.name isEqual:UIApplicationWillResignActiveNotification] || [notification.name isEqual:UISceneWillDeactivateNotification]) _applicationActive = NO;
  if ([notification.name isEqual:UIApplicationDidBecomeActiveNotification] || [notification.name isEqual:UISceneDidActivateNotification]) _applicationActive = YES;
  BOOL began = [notification.name isEqual:UITextFieldTextDidBeginEditingNotification] ||
    [notification.name isEqual:UITextViewTextDidBeginEditingNotification] ||
    ([notification.name isEqual:CUIInputFocusChangedNotification] && [notification.userInfo[@"focused"] boolValue]);
  // Enter/target changes are observed at the SDK callback. Defer an end until
  // its destination is known, so an internal move cannot become a field blur.
  if (began) [self sample]; else [self schedule];
}
- (void)schedule
{
  if (!_binding.length || _scheduled) return;
  _scheduled = YES;
  NSUInteger generation = _generation;
  __weak CUIFocusWithinObserver *weakSelf = self;
  dispatch_async(dispatch_get_main_queue(), ^{
    CUIFocusWithinObserver *observer = weakSelf;
    if (!observer || observer->_generation != generation) return;
    observer->_scheduled = NO;
    [observer sample];
  });
}
- (void)synchronize { [self sample]; }
- (void)sample
{
  UIView *root = _root;
  if (!_binding.length || !root) return;
  NSDictionary *environment = _environment();
  if (![environment[@"viewOwnerId"] length] || [environment[@"target"] integerValue] <= 0) return;
  UIWindow *window = root.window;
  BOOL sceneActive = window.windowScene == nil || window.windowScene.activationState == UISceneActivationStateForegroundActive;
  BOOL active = window && window.isKeyWindow && !window.hidden && sceneActive && _applicationActive && [environment[@"surfaceId"] integerValue] > 0;
  UIView *focused = active ? CUIInputFocusedView(root) : nil;
  BOOL within = focused && [focused isDescendantOfView:root];
  NSInteger focusedTag = 0;
  for (UIView *view = within ? focused : nil; view && focusedTag <= 0; view = view.superview) focusedTag = view.tag;
  NSDictionary *value = @{@"ownerId":environment[@"viewOwnerId"] ?: @"", @"bindingId":_binding,
    @"target":environment[@"target"] ?: @0, @"surfaceId":environment[@"surfaceId"] ?: @0,
    @"windowId":environment[@"windowId"] ?: @"", @"scopeOwnerId":environment[@"scopeOwnerId"] ?: @"",
    @"scopeEpoch":environment[@"scopeEpoch"] ?: @0, @"attached":@(window != nil), @"active":@(active),
    @"within":@(within), @"focusedTarget":@(focusedTag), @"textInputFocused":@(within && [focused conformsToProtocol:@protocol(UITextInput)]),
    @"origin":window ? (CUIInputWindowModality(window) ?: @"unknown") : @"unknown"};
  if ([_last isEqual:value]) return;
  _last = value;
  NSMutableDictionary *packet = [value mutableCopy];
  packet[@"sequence"] = @(++_sequence);
  NSNumber *timestamp = @(NSProcessInfo.processInfo.systemUptime * 1000);
  packet[@"observedAt"] = timestamp; packet[@"timestamp"] = timestamp;
  packet[@"isFocused"] = @(within);
  packet[@"isFocusVisible"] = @(within && [value[@"origin"] isEqual:@"keyboard"]);
  _emit(packet);
}
- (void)invalidate
{
  [NSNotificationCenter.defaultCenter removeObserver:self];
  _observing = NO; _scheduled = NO; _binding = nil; _last = nil; _generation++;
}
- (void)dealloc { [NSNotificationCenter.defaultCenter removeObserver:self]; }
@end
