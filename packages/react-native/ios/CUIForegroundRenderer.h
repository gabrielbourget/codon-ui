#import <UIKit/UIKit.h>
#include <react/renderer/components/view/ViewProps.h>

// Stable private paint planes; original Fabric controls are mounted into source from their first mount.
@interface CUIForegroundRenderer : NSObject
@property (nonatomic, strong, readonly) UIView *source;
- (instancetype)initWithOwner:(UIView *)owner;
- (void)configure:(const facebook::react::ViewProps &)props paintOpacity:(CGFloat)paintOpacity;
- (void)synchronize;
- (void)retire;
@end
