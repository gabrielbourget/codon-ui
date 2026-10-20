#import <UIKit/UIKit.h>

@interface CUIFloatingObserver : NSObject
- (instancetype)initWithHost:(UIView *)host publish:(void (^)(NSDictionary *))publish;
- (void)setTargets:(NSArray<NSDictionary *> *)targets active:(BOOL)active;
- (void)invalidate;
@end
