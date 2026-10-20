#import "CUICollectionNode.h"
#import <react/renderer/components/CodonNativeInputSpec/ComponentDescriptors.h>
#import <react/renderer/components/CodonNativeInputSpec/Props.h>

using namespace facebook::react;

@implementation CUICollectionMetadataView
- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    _ownerId = @""; _rootId = @""; _descriptorId = @""; _descriptorRevision = @"";
    self.alpha = 0; self.userInteractionEnabled = NO;
  }
  return self;
}
- (BOOL)isAccessibilityElement { return NO; }
- (BOOL)accessibilityElementsHidden { return YES; }
- (NSArray *)accessibilityElements { return @[]; }
- (NSInteger)accessibilityElementCount { return 0; }
- (id)accessibilityElementAtIndex:(NSInteger)index { return nil; }
- (NSInteger)indexOfAccessibilityElement:(id)element { return NSNotFound; }
- (BOOL)canBecomeFocused { return NO; }
- (BOOL)canBecomeFirstResponder { return NO; }
- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event { return nil; }
- (void)finalizeUpdates:(RNComponentViewUpdateMask)updateMask
{
  [super finalizeUpdates:updateMask];
  self.alpha = 0; self.userInteractionEnabled = NO;
}
- (BOOL)isMetadataOnly
{
  return self.alpha == 0 && CGSizeEqualToSize(self.bounds.size, CGSizeZero) && !self.userInteractionEnabled &&
    !self.isAccessibilityElement && self.accessibilityElementsHidden && self.accessibilityElementCount == 0;
}
- (void)prepareForRecycle
{
  self.ownerId = @""; self.rootId = @""; self.descriptorId = @""; self.descriptorRevision = @"";
  [super prepareForRecycle];
}
@end

@implementation CUICollectionNode
+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<CUICollectionNodeComponentDescriptor>();
}
- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) _props = std::make_shared<const CUICollectionNodeProps>();
  return self;
}
- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps
{
  const auto &value = *std::static_pointer_cast<const CUICollectionNodeProps>(props);
  self.ownerId = [NSString stringWithUTF8String:value.ownerId.c_str()];
  self.rootId = [NSString stringWithUTF8String:value.rootId.c_str()];
  self.descriptorId = [NSString stringWithUTF8String:value.descriptorId.c_str()];
  self.descriptorRevision = [NSString stringWithUTF8String:value.descriptorRevision.c_str()];
  [super updateProps:props oldProps:oldProps];
}
@end

Class<RCTComponentViewProtocol> CUICollectionNodeCls(void) { return CUICollectionNode.class; }
