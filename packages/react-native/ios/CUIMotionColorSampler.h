#import <UIKit/UIKit.h>

@interface CUIMotionColorSampler : NSObject
- (instancetype)initWithRoot:(UIView *)root emit:(void (^)(NSDictionary *))emit;
- (void)updateOwner:(NSString *)owner enabled:(BOOL)enabled;
- (void)synchronize;
- (void)sampleOwner:(NSString *)owner requestId:(NSString *)requestId request:(NSString *)request;
- (void)invalidate;
@end
