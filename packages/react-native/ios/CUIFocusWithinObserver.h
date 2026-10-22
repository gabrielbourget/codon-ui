#import <UIKit/UIKit.h>

@interface CUIFocusWithinObserver : NSObject
- (instancetype)initWithRoot:(UIView *)root environment:(NSDictionary *(^)(void))environment emit:(void (^)(NSDictionary *))emit;
- (void)configure:(NSString *)binding;
- (void)schedule;
- (void)invalidate;
@end
