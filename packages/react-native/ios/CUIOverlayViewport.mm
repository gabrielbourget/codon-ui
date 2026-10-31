#import "CUIOverlayViewport.h"
#include "../cpp/overlay/NativeOverlayLayout.h"

using namespace facebook::react;

@implementation CUIOverlayViewport
+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<CUIOwnedOverlayViewportComponentDescriptor>();
}
- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) _props = std::make_shared<const CUIOverlayViewportProps>();
  return self;
}
@end

Class<RCTComponentViewProtocol> CUIOverlayViewportCls(void)
{
  return CUIOverlayViewport.class;
}

@implementation CUIOverlaySlot
+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<CUIOwnedOverlaySlotComponentDescriptor>();
}
- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) _props = std::make_shared<const CUIOverlaySlotProps>();
  return self;
}
@end

Class<RCTComponentViewProtocol> CUIOverlaySlotCls(void)
{
  return CUIOverlaySlot.class;
}
