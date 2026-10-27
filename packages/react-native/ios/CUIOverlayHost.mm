#import "CUIOverlayHost.h"

#import <QuartzCore/QuartzCore.h>
#import <react/renderer/components/CodonNativeInputSpec/ComponentDescriptors.h>
#import <react/renderer/components/CodonNativeInputSpec/Props.h>
#include <algorithm>
#include <cmath>

using namespace facebook::react;

@implementation CUIOverlayHost {
  CALayer *_paintMask;
  CGFloat _paintOpacity;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<CUIOverlayHostComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    _props = std::make_shared<const CUIOverlayHostProps>();
    _paintOpacity = 1;
    _paintMask = [CALayer layer];
    _paintMask.backgroundColor = UIColor.blackColor.CGColor;
  }
  return self;
}

- (void)restoreContentMask
{
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  if (self.layer.mask == _paintMask) self.layer.mask = _paintMask.mask;
  _paintMask.mask = nil;
  [CATransaction commit];
}

- (void)synchronizePaintMask
{
  CALayer *contentMask = self.layer.mask == _paintMask ? _paintMask.mask : self.layer.mask;
  // The pinned View renderer implements opacity filters through the host layer's opacity.
  // Transfer that existing paint factor as well, so it cannot disqualify native input.
  CGFloat opacity = _paintOpacity * _props->opacity;
  for (const auto &filter : _props->filter)
    if (filter.type == FilterType::Opacity && std::holds_alternative<Float>(filter.parameters))
      opacity *= std::clamp(std::get<Float>(filter.parameters), Float{0}, Float{1});
  CGRect coverage = self.bounds;
  if (self.window) {
    CGRect windowCoverage = [self convertRect:self.window.bounds fromView:self.window];
    if (!CGRectIsNull(windowCoverage) && !CGRectIsInfinite(windowCoverage) &&
        std::isfinite(windowCoverage.origin.x) && std::isfinite(windowCoverage.origin.y) &&
        std::isfinite(windowCoverage.size.width) && std::isfinite(windowCoverage.size.height))
      coverage = CGRectUnion(coverage, windowCoverage);
  }
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  // Native alpha stays one after every component update, including paint opacity zero.
  self.layer.opacity = 1;
  if (opacity == 1) {
    self.layer.mask = contentMask;
    _paintMask.mask = nil;
  } else {
    _paintMask.bounds = coverage;
    _paintMask.position = CGPointMake(CGRectGetMidX(coverage), CGRectGetMidY(coverage));
    _paintMask.opacity = opacity;
    _paintMask.mask = contentMask;
    self.layer.mask = _paintMask;
  }
  [CATransaction commit];
}

- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps
{
  const auto &next = *std::static_pointer_cast<const CUIOverlayHostProps>(props);
  if (!std::isfinite(next.paintOpacity) || next.paintOpacity < 0 || next.paintOpacity > 1)
    @throw [NSException exceptionWithName:@"CUI.OverlayPaint" reason:@"Overlay paint opacity must be calibrated before native admission" userInfo:nil];
  if (![self.propKeysManagedByAnimated_DO_NOT_USE_THIS_IS_BROKEN containsObject:@"paintOpacity"])
    _paintOpacity = next.paintOpacity;
  [self restoreContentMask];
  [super updateProps:props oldProps:oldProps];
  [self synchronizePaintMask];
}

- (void)updateLayoutMetrics:(const LayoutMetrics &)layoutMetrics oldLayoutMetrics:(const LayoutMetrics &)oldLayoutMetrics
{
  [self restoreContentMask];
  [super updateLayoutMetrics:layoutMetrics oldLayoutMetrics:oldLayoutMetrics];
  [self synchronizePaintMask];
}

- (void)finalizeUpdates:(RNComponentViewUpdateMask)updateMask
{
  [self restoreContentMask];
  [super finalizeUpdates:updateMask];
  [self synchronizePaintMask];
}

- (void)layoutSubviews
{
  [self restoreContentMask];
  [super layoutSubviews];
  [self synchronizePaintMask];
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  [self synchronizePaintMask];
}

- (void)prepareForRecycle
{
  [self restoreContentMask];
  [super prepareForRecycle];
  _paintOpacity = 1;
  _paintMask.opacity = 1;
  self.layer.mask = nil;
  self.layer.opacity = 1;
}
@end

Class<RCTComponentViewProtocol> CUIOverlayHostCls(void)
{
  return CUIOverlayHost.class;
}
