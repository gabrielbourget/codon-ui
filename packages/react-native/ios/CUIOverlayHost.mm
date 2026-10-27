#import "CUIOverlayHost.h"
#include "../cpp/overlay/NativeOverlayLayout.h"
#import <react/renderer/components/CodonNativeInputSpec/Props.h>
#include <cmath>
using namespace facebook::react;
@implementation CUIOverlayHost {
  CGFloat _paintOpacity;
}
+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<CUIOwnedOverlayHostComponentDescriptor>();
}
- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    _props = std::make_shared<const CUIOverlayHostProps>(); _paintOpacity = 1;
    [self setCuiDrawingEnabled:YES]; [self setCuiForegroundEnabled:YES];
  }
  return self;
}
- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps {
  [self setCuiDrawingEnabled:YES]; [self setCuiForegroundEnabled:YES];
  const auto &next = *std::static_pointer_cast<const CUIOverlayHostProps>(props);
  if (!std::isfinite(next.paintOpacity) || next.paintOpacity < 0 || next.paintOpacity > 1)
    @throw [NSException exceptionWithName:@"CUI.OverlayPaint" reason:@"Overlay paint opacity must be calibrated before native admission" userInfo:nil];
  if (![self.propKeysManagedByAnimated_DO_NOT_USE_THIS_IS_BROKEN containsObject:@"paintOpacity"]) _paintOpacity = next.paintOpacity;
  [super updateProps:props oldProps:oldProps];
  [self setCuiPaintOpacity:_paintOpacity];
}
- (void)prepareForRecycle { [super prepareForRecycle]; _paintOpacity = 1; }
@end
Class<RCTComponentViewProtocol> CUIOverlayHostCls(void) { return CUIOverlayHost.class; }
