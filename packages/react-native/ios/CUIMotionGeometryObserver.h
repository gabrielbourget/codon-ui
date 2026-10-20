#import <UIKit/UIKit.h>

@interface CUIMotionGeometryObserver : NSObject
- (instancetype)initWithRoot:(UIView *)root emit:(void (^)(NSDictionary *))emit;
- (void)configureOwner:(NSString *)owner binding:(NSString *)binding revision:(NSString *)revision;
- (void)captureKind:(NSString *)kind requestId:(NSString *)requestId transaction:(NSString *)transaction;
- (void)queryOwner:(NSString *)owner binding:(NSString *)binding requestId:(NSString *)requestId;
- (void)windowChanged;
- (void)invalidate;
@end
