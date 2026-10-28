#import "CUIClampHost.h"
#import <React/RCTParagraphComponentView.h>
#include "../cpp/table/ClampHost.h"

using namespace facebook::react;
using namespace codon::table;

@interface CUIClampHost () <UIScrollViewDelegate>
@end

@interface CUIClampScrollView : UIScrollView
@end
@implementation CUIClampScrollView
- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event {
  if (!self.clipsToBounds && !self.hidden && self.userInteractionEnabled && self.alpha >= 0.01) {
    for (UIView *child in self.subviews.reverseObjectEnumerator) {
      UIView *hit = [child hitTest:[child convertPoint:point fromView:self] withEvent:event];
      if (hit) return hit;
    }
  }
  return [super hitTest:point withEvent:event];
}
@end

@implementation CUIClampHost {
  UIScrollView *_viewport;
  std::shared_ptr<CUIClampPlan> _plan;
  NSHashTable<RCTParagraphComponentView *> *_paragraphs;
  BOOL _hasClamp;
}
+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<CUIOwnedClampHostComponentDescriptor>();
}
- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    _props = std::make_shared<const CUIClampHostProps>();
    _paragraphs = [NSHashTable weakObjectsHashTable];
    _viewport = [CUIClampScrollView new];
    _viewport.delegate = self;
    _viewport.scrollEnabled = NO;
    _viewport.bounces = NO;
    _viewport.delaysContentTouches = NO;
    _viewport.canCancelContentTouches = NO;
    _viewport.showsHorizontalScrollIndicator = NO;
    _viewport.showsVerticalScrollIndicator = NO;
    _viewport.contentInsetAdjustmentBehavior = UIScrollViewContentInsetAdjustmentNever;
    self.contentView = _viewport;
    for (NSNotificationName name in @[UITextFieldTextDidBeginEditingNotification, UITextViewTextDidBeginEditingNotification])
      [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(editorFocused:) name:name object:nil];
    [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(applicationBackgrounded:) name:UIApplicationDidEnterBackgroundNotification object:nil];
    [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(applicationBecameActive:) name:UIApplicationDidBecomeActiveNotification object:nil];
  }
  return self;
}
- (void)dealloc {
  [NSNotificationCenter.defaultCenter removeObserver:self];
  [self retirePresentation];
  _viewport.delegate = nil;
}
- (void)mountChildComponentView:(UIView<RCTComponentViewProtocol> *)child index:(NSInteger)index {
  [_viewport insertSubview:child atIndex:index];
  [self setNeedsLayout];
}
- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)child index:(NSInteger)index {
  [self retirePresentation];
  [child removeFromSuperview];
}
- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps {
  _hasClamp = static_cast<const CUIClampHostProps &>(*props).hasClamp;
  [super updateProps:props oldProps:oldProps];
  _viewport.clipsToBounds = _hasClamp;
  [self setNeedsLayout];
}
- (void)updateState:(const State::Shared &)state oldState:(const State::Shared &)oldState {
  [self retirePresentation];
  _plan = std::static_pointer_cast<const CUIOwnedClampHostShadowNode::ConcreteState>(state)->getData().plan;
  [self setNeedsLayout];
}
- (UIView *)originalView:(NSInteger)tag inView:(UIView *)root {
  if (root.tag == tag) return root;
  for (UIView *child in root.subviews) {
    UIView *found = [self originalView:tag inView:child];
    if (found) return found;
  }
  return nil;
}
- (void)applyPresentation {
  if (!_plan || !self.window || UIApplication.sharedApplication.applicationState != UIApplicationStateActive) return;
  const auto offset = _viewport.contentOffset.y;
  try {
    for (const auto &paragraph : _plan->paragraphs) {
      UIView *view = [self originalView:paragraph.tag inView:_viewport];
      if (!view) return;
      if (![view isKindOfClass:RCTParagraphComponentView.class] || view.window != self.window)
        throw std::runtime_error("Table clamp lost its original paragraph/window");
      auto target = (RCTParagraphComponentView *)view;
      const int lines = paragraph.noWrap ? 1 : offset <= 0 ? paragraph.lines : 0;
      if (![target cuiSetClampOwner:_plan->owner lines:lines
          props:reinterpret_cast<uintptr_t>(paragraph.props.get())
          state:paragraph.stateIdentity])
        throw std::runtime_error("Table clamp paragraph props/state changed before native presentation");
      [_paragraphs addObject:target];
    }
    presentClampPlan(_plan->owner, offset);
  } catch (const std::exception &error) {
    [self retirePresentation];
    @throw [NSException exceptionWithName:@"CUI.TableClamp" reason:@(error.what()) userInfo:nil];
  }
}
- (void)retirePresentation {
  if (!_plan) return;
  for (RCTParagraphComponentView *paragraph in _paragraphs) [paragraph cuiClearClampOwner:_plan->owner];
  [_paragraphs removeAllObjects];
  retireClampPlan(_plan->owner);
}
- (void)layoutSubviews {
  [super layoutSubviews];
  _viewport.frame = self.bounds;
  _viewport.clipsToBounds = _hasClamp;
  if (!_plan) return;
  _viewport.contentSize = CGSizeMake(_plan->contentSize.width, _plan->contentSize.height);
  const auto offset = revealClampRect(_viewport.contentOffset.y, _viewport.bounds.size.height,
      _plan->contentSize.height, _viewport.contentOffset.y, _viewport.contentOffset.y);
  if (_viewport.contentOffset.y != offset) _viewport.contentOffset = CGPointMake(0, offset);
  [self applyPresentation];
  UIView *focused = [self firstResponderInView:_viewport];
  if (focused) [self revealOriginalView:focused];
}
- (UIView *)firstResponderInView:(UIView *)root {
  if (root.isFirstResponder) return root;
  for (UIView *child in root.subviews) {
    UIView *focused = [self firstResponderInView:child];
    if (focused) return focused;
  }
  return nil;
}
- (void)revealOriginalView:(UIView *)view {
  if (!_hasClamp || !_plan || ![view isDescendantOfView:_viewport] || view.window != self.window) return;
  CGRect rect = [view convertRect:view.bounds toView:_viewport];
  // UIScrollView coordinates include its current bounds origin; these are full-content coordinates.
  const double offset = revealClampRect(_viewport.contentOffset.y, _viewport.bounds.size.height,
      _plan->contentSize.height, CGRectGetMinY(rect), CGRectGetMaxY(rect));
  [_viewport setContentOffset:CGPointMake(0, offset) animated:NO];
  [self applyPresentation];
}
- (void)editorFocused:(NSNotification *)notification {
  if ([notification.object isKindOfClass:UIView.class]) [self revealOriginalView:notification.object];
}
- (void)applicationBackgrounded:(NSNotification *)notification { [self retirePresentation]; }
- (void)applicationBecameActive:(NSNotification *)notification { [self setNeedsLayout]; }
- (void)didUpdateFocusInContext:(UIFocusUpdateContext *)context withAnimationCoordinator:(UIFocusAnimationCoordinator *)coordinator {
  [super didUpdateFocusInContext:context withAnimationCoordinator:coordinator];
  [self revealOriginalView:context.nextFocusedView];
}
- (void)scrollViewDidScroll:(UIScrollView *)scrollView { [self applyPresentation]; }
- (void)didMoveToWindow {
  [super didMoveToWindow];
  if (!self.window) [self retirePresentation];
  else [self setNeedsLayout];
}
- (void)prepareForRecycle {
  [self retirePresentation];
  _plan.reset();
  _viewport.contentOffset = CGPointZero;
  _viewport.contentSize = CGSizeZero;
  _hasClamp = NO;
  [super prepareForRecycle];
}
@end

Class<RCTComponentViewProtocol> CUIClampHostCls(void) { return CUIClampHost.class; }
