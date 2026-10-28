#import "CUITableStickyPresentation.h"
#import "CUIKeyboardScope.h"
#import <React/RCTAssert.h>
#import <React/RCTSurfacePresenter.h>
#import <UIKit/UIKit.h>
#import <QuartzCore/QuartzCore.h>
#include <folly/json.h>
#include <cmath>

static CGRect CUITableUntransformedBox(UIView *view, UIWindow *window) {
  CGPoint point = view.bounds.origin;
  for (UIView *current = view; current && current != window; current = current.superview) {
    CALayer *layer = current.layer;
    point.x += layer.position.x - layer.anchorPoint.x * layer.bounds.size.width - layer.bounds.origin.x;
    point.y += layer.position.y - layer.anchorPoint.y * layer.bounds.size.height - layer.bounds.origin.y;
  }
  return CGRectMake(point.x, point.y, view.bounds.size.width, view.bounds.size.height);
}
@interface CUITableStickyAttachment : NSObject
@property(nonatomic, weak) UIView *target;
@property(nonatomic, weak) UIView *root;
@property(nonatomic, weak) UIWindow *window;
@end
@implementation CUITableStickyAttachment
@end
@class CUITableStickyPresentation;
@interface CUITableStickyDisplayTarget : NSObject
@property(nonatomic, weak) CUITableStickyPresentation *driver;
- (void)tick:(CADisplayLink *)link;
@end

@implementation CUITableStickyPresentation {
  __weak RCTSurfacePresenter *_presenter;
  std::shared_ptr<codon::table::NativeTableStickyPresentation> _service;
  NSMutableDictionary<NSString *, CUITableStickyAttachment *> *_attachments;
  CADisplayLink *_displayLink;
  id _backgroundObserver, _foregroundObserver;
  BOOL _valid, _ticking, _failed, _suspended;
}
- (instancetype)initWithPresenter:(RCTSurfacePresenter *)presenter
                         service:(std::shared_ptr<codon::table::NativeTableStickyPresentation>)service {
  RCTAssertMainQueue();
  if (self = [super init]) {
    _presenter = presenter; _service = std::move(service); _valid = YES;
    _attachments = [NSMutableDictionary dictionary];
    __weak CUITableStickyPresentation *weakSelf = self;
    _service->setMountCallback([weakSelf] {
      if (NSThread.isMainThread) [weakSelf synchronize];
      else dispatch_async(dispatch_get_main_queue(), ^{ [weakSelf synchronize]; });
    });
    _backgroundObserver = [NSNotificationCenter.defaultCenter addObserverForName:UIApplicationWillResignActiveNotification
        object:nil queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *) {
      CUITableStickyPresentation *driver = weakSelf;
      if (!driver || !driver->_valid) return;
      driver->_suspended = YES;
      [driver->_displayLink invalidate]; driver->_displayLink = nil;
      const BOOL wasTicking = driver->_ticking;
      driver->_ticking = YES;
      try {
        for (const auto &target : driver->_service->targets()) driver->_service->retire(target.lease);
      } catch (const std::exception &error) { driver->_service->fail(error.what()); driver->_failed = YES; }
      driver->_ticking = wasTicking;
      [driver->_attachments removeAllObjects];
    }];
    _foregroundObserver = [NSNotificationCenter.defaultCenter addObserverForName:UIApplicationDidBecomeActiveNotification
        object:nil queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *) {
      CUITableStickyPresentation *driver = weakSelf;
      if (!driver || !driver->_valid) return;
      driver->_suspended = NO;
      [driver synchronize];
    }];
  }
  return self;
}
- (void)synchronize {
  RCTAssertMainQueue();
  if (!_valid || _ticking || _failed || _suspended) return;
  _ticking = YES;
  try {
    _service->synchronize();
    const auto targets = _service->targets();
    NSMutableSet<NSString *> *retained = [NSMutableSet set];
    for (const auto &entry : targets) {
      NSString *lease = [NSString stringWithUTF8String:entry.lease.c_str()];
      [retained addObject:lease];
      UIView *target = [_presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:entry.target];
      UIView *root = [_presenter findComponentViewWithTag_DO_NOT_USE_DEPRECATED:entry.containingRoot];
      CUITableStickyAttachment *attachment = _attachments[lease];
      if (!target || !root || !target.window || !root.window) {
        if (attachment) { _service->retire(entry.lease); [_attachments removeObjectForKey:lease]; }
        continue;
      }
      if (target.window != root.window || ![target isDescendantOfView:root] ||
          (attachment && (attachment.target != target || attachment.root != root || attachment.window != target.window))) {
        _service->retire(entry.lease); [_attachments removeObjectForKey:lease]; continue;
      }
      if (!attachment) {
        attachment = [CUITableStickyAttachment new];
        attachment.target = target; attachment.root = root; attachment.window = target.window;
        _attachments[lease] = attachment;
      }
      CUIKeyboardScope *scope = nil;
      UIScrollView *nearest = nil;
      BOOL visible = YES, reachedRoot = NO;
      CGPoint below = CGPointZero;
      for (UIView *ancestor = target.superview; ancestor; ancestor = ancestor.superview) {
        if (ancestor.hidden) visible = NO;
        if (!scope && [ancestor isKindOfClass:CUIKeyboardScope.class]) scope = (CUIKeyboardScope *)ancestor;
        if ([ancestor isKindOfClass:UIScrollView.class]) {
          if (!nearest) nearest = (UIScrollView *)ancestor;
          if (!reachedRoot) { below.x += ancestor.bounds.origin.x; below.y += ancestor.bounds.origin.y; }
        }
        if (ancestor == root) reachedRoot = YES;
        if (ancestor == target.window) break;
      }
      if (target.hidden || !visible) continue;
      if (!entry.session.isNull()) {
        NSDictionary *actual = scope.activationSession;
        NSString *owner = [NSString stringWithUTF8String:entry.session.at("scopeOwnerId").asString().c_str()];
        NSString *window = [NSString stringWithUTF8String:entry.session.at("windowId").asString().c_str()];
        if (!actual || ![actual[@"scopeOwnerId"] isEqual:owner] || ![actual[@"windowId"] isEqual:window] ||
            [actual[@"epoch"] doubleValue] != entry.session.at("epoch").asDouble()) {
          _service->retire(entry.lease); continue;
        }
      }
      CGRect tableBox = CUITableUntransformedBox(root, target.window);
      CGRect viewport = nearest ? CUITableUntransformedBox(nearest, target.window) : target.window.bounds;
      if (nearest) viewport = UIEdgeInsetsInsetRect(viewport, nearest.adjustedContentInset);
      _service->frame(entry.lease, {tableBox.origin.x, tableBox.origin.y,
          viewport.origin.x, viewport.origin.y, MAX(0, viewport.size.width), MAX(0, viewport.size.height), below.x, below.y});
    }
    for (NSString *key in _attachments.allKeys) if (![retained containsObject:key]) [_attachments removeObjectForKey:key];
    if (targets.empty()) { [_displayLink invalidate]; _displayLink = nil; }
    else if (!_displayLink) {
      CUITableStickyDisplayTarget *target = [CUITableStickyDisplayTarget new]; target.driver = self;
      _displayLink = [CADisplayLink displayLinkWithTarget:target selector:@selector(tick:)];
      [_displayLink addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
    }
  } catch (const std::exception &error) {
    // The service retains the failure for the next owner-held check; no native
    // callback or background frame can create a replacement logical lease.
    _failed = YES;
    _service->fail(error.what());
    for (const auto &entry : _service->targets()) { try { _service->retire(entry.lease); } catch (...) {} }
    [_displayLink invalidate]; _displayLink = nil;
  }
  _ticking = NO;
}
- (void)invalidate {
  RCTAssertMainQueue();
  if (!_valid) return;
  _valid = NO;
  [_displayLink invalidate]; _displayLink = nil;
  if (_backgroundObserver) [NSNotificationCenter.defaultCenter removeObserver:_backgroundObserver];
  if (_foregroundObserver) [NSNotificationCenter.defaultCenter removeObserver:_foregroundObserver];
  _backgroundObserver = nil; _foregroundObserver = nil;
  _service->setMountCallback({});
  _service->close();
  [_attachments removeAllObjects];
}
- (void)dealloc {
  [_displayLink invalidate];
  if (_backgroundObserver) [NSNotificationCenter.defaultCenter removeObserver:_backgroundObserver];
  if (_foregroundObserver) [NSNotificationCenter.defaultCenter removeObserver:_foregroundObserver];
}
@end
@implementation CUITableStickyDisplayTarget
- (void)tick:(CADisplayLink *)link { [self.driver synchronize]; }
@end
