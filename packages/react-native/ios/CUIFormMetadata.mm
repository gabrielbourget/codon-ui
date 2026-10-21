#import "CUIFormMetadata.h"
#import <react/renderer/components/CodonNativeInputSpec/ComponentDescriptors.h>
#import <react/renderer/components/CodonNativeInputSpec/Props.h>

using namespace facebook::react;

@implementation CUIFormRoot
+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<CUIFormRootComponentDescriptor>();
}
- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) _props = std::make_shared<const CUIFormRootProps>();
  return self;
}
@end

@implementation CUIFieldBinding
+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<CUIFieldBindingComponentDescriptor>();
}
- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) _props = std::make_shared<const CUIFieldBindingProps>();
  return self;
}
@end

Class<RCTComponentViewProtocol> CUIFormRootCls(void) { return CUIFormRoot.class; }
Class<RCTComponentViewProtocol> CUIFieldBindingCls(void) { return CUIFieldBinding.class; }
