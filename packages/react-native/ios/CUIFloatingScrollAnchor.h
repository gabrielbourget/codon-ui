#import <UIKit/UIKit.h>

@interface CUIFloatingScrollAnchor : NSObject
- (instancetype)initWithRoot:(UIView *)root;
- (void)prepareTag:(NSInteger)tag key:(NSString *)key revision:(NSString *)revision;
- (void)invalidate;
@end
