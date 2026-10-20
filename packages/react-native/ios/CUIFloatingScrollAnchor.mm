#import "CUIFloatingScrollAnchor.h"
#import "CUIFloatingScrollAnchorModel.h"
#import "CUIInputWindow.h"
#import <React/RCTScrollViewComponentView.h>

static UIView *CUIAnchorFocusMatch(UIView *root, BOOL responder) {
  if (responder ? root.isFirstResponder : root.isFocused) return root;
  for (UIView *child in root.subviews) { UIView *target = CUIAnchorFocusMatch(child, responder); if (target) return target; }
  return nil;
}
static UIView *CUIAnchorFocused(UIView *root) { return CUIAnchorFocusMatch(root, YES) ?: CUIAnchorFocusMatch(root, NO); }
static UIView *CUIAnchorTagged(UIView *root, NSInteger tag) {
  if (root.tag == tag) return root;
  for (UIView *child in root.subviews) { UIView *target = CUIAnchorTagged(child, tag); if (target) return target; }
  return nil;
}
static NSInteger CUIAnchorFocusTag(UIView *view) { while (view && view.tag <= 0) view = view.superview; return view.tag; }

@implementation CUIFloatingScrollAnchor {
  __weak UIView *_root;
  __weak UIView *_focus;
  __weak UIView *_scrollOwner;
  __weak UIScrollView *_scroll;
  __weak UIWindow *_window;
  NSInteger _tag;
  NSInteger _focusTag;
  NSString *_key;
  NSString *_revision;
  NSUInteger _inputRevision;
  CGPoint _offset;
  std::optional<cui::ScrollAnchor> _anchor;
  CADisplayLink *_frame;
}
- (instancetype)initWithRoot:(UIView *)root {
  if (self = [super init]) {
    _root = root; _key = @""; _revision = @"";
    for (NSNotificationName name in @[UIWindowDidResignKeyNotification, UIApplicationWillResignActiveNotification, UITextFieldTextDidBeginEditingNotification, UITextFieldTextDidEndEditingNotification, UITextViewTextDidBeginEditingNotification, UITextViewTextDidEndEditingNotification]) [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(retireForEvent:) name:name object:nil];
  }
  return self;
}
- (void)retireForEvent:(NSNotification *)notification {
  if ([notification.name isEqualToString:UIApplicationWillResignActiveNotification] || notification.object == _window || ([notification.object isKindOfClass:UIView.class] && ((UIView *)notification.object).window == _window)) [self invalidate];
}
- (void)prepareTag:(NSInteger)tag key:(NSString *)key revision:(NSString *)revision {
  BOOL replaced = tag != _tag || ![_key isEqualToString:key];
  BOOL repositioned = ![_revision isEqualToString:revision];
  if (replaced) [self invalidate];
  _tag = tag; _key = [key copy]; _revision = [revision copy];
  if (tag <= 0 || !repositioned) return;
  if (!replaced && _anchor && _window == _root.window && _window.isKeyWindow && CUIAnchorFocused(_window) == _focus && CUIAnchorFocusTag(_focus) == _focusTag && CUIAnchorTagged(_window, tag) == _scrollOwner && _scroll && !_scroll.dragging && !_scroll.decelerating && !_scroll.tracking && CUIInputWindowRevision(_window) == _inputRevision) {
    CGFloat minimum = -_scroll.adjustedContentInset.top;
    CGFloat maximum = MAX(minimum, _scroll.contentSize.height - _scroll.bounds.size.height + _scroll.adjustedContentInset.bottom);
    if (_scroll.contentOffset.x == _offset.x && (_scroll.contentOffset.y == _offset.y || _scroll.contentOffset.y == MIN(maximum, MAX(minimum, _offset.y)))) return;
  }
  [self invalidate];
  UIView *root = _root; UIWindow *window = root.window;
  if (!window.isKeyWindow || window.hidden || UIApplication.sharedApplication.applicationState != UIApplicationStateActive) return;
  UIView *owner = CUIAnchorTagged(window, tag);
  UIScrollView *scroll = [owner isKindOfClass:UIScrollView.class] ? (UIScrollView *)owner : [owner isKindOfClass:RCTScrollViewComponentView.class] ? ((RCTScrollViewComponentView *)owner).scrollView : nil;
  UIView *focus = CUIAnchorFocused(window);
  if (!scroll || !focus || ![focus isDescendantOfView:scroll] || scroll.dragging || scroll.decelerating || scroll.tracking) return;
  CGRect focusFrame = [focus convertRect:focus.bounds toView:window], viewport = [scroll convertRect:scroll.bounds toView:window];
  _anchor = cui::captureScrollAnchor(CGRectGetMinY(focusFrame), CGRectGetMaxY(focusFrame), CGRectGetMinY(viewport), CGRectGetMaxY(viewport));
  if (!_anchor) return;
  _focus = focus; _focusTag = CUIAnchorFocusTag(focus); _scroll = scroll; _scrollOwner = owner; _window = window;
  _offset = scroll.contentOffset; _inputRevision = CUIInputWindowRevision(window);
  _frame = [CADisplayLink displayLinkWithTarget:self selector:@selector(restore:)];
  [_frame addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
}
- (void)restore:(CADisplayLink *)frame {
  [_frame invalidate]; _frame = nil;
  UIView *root = _root, *focus = _focus; UIScrollView *scroll = _scroll; UIWindow *window = _window;
  [window layoutIfNeeded];
  auto anchor = _anchor; _anchor.reset();
  if (!anchor || !root || root.window != window || !window.isKeyWindow || window.hidden || !focus || CUIAnchorFocused(window) != focus || CUIAnchorFocusTag(focus) != _focusTag || !scroll || scroll.window != window || CUIAnchorTagged(window, _tag) != _scrollOwner || ![focus isDescendantOfView:scroll] || CUIInputWindowRevision(window) != _inputRevision || scroll.dragging || scroll.decelerating || scroll.tracking) return;
  CGFloat minimum = -scroll.adjustedContentInset.top;
  CGFloat maximum = MAX(minimum, scroll.contentSize.height - scroll.bounds.size.height + scroll.adjustedContentInset.bottom);
  CGFloat clamped = MIN(maximum, MAX(minimum, _offset.y));
  if (scroll.contentOffset.x != _offset.x || (scroll.contentOffset.y != _offset.y && scroll.contentOffset.y != clamped)) return;
  CGRect focusFrame = [focus convertRect:focus.bounds toView:window], viewport = [scroll convertRect:scroll.bounds toView:window];
  auto next = cui::restoreScrollAnchor(*anchor, CGRectGetMinY(focusFrame), CGRectGetMaxY(focusFrame), CGRectGetMinY(viewport), CGRectGetMaxY(viewport), scroll.contentOffset.y, minimum, maximum);
  if (next && *next != scroll.contentOffset.y) [scroll setContentOffset:CGPointMake(scroll.contentOffset.x, *next) animated:NO];
}
- (void)invalidate { [_frame invalidate]; _frame = nil; _anchor.reset(); _focus = nil; _scroll = nil; _scrollOwner = nil; _window = nil; }
- (void)dealloc { [self invalidate]; [NSNotificationCenter.defaultCenter removeObserver:self]; }
@end
