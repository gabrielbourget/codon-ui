#import "CUIBackdropCaptureSource.h"

@interface CUIBackdropCaptureRequest (Internal)
- (instancetype)initWithTarget:(UIView *)target receiver:(UIView *)receiver
    targetEpoch:(NSDictionary *)targetEpoch receiverEpoch:(NSDictionary *)receiverEpoch
    ownerId:(NSString *)ownerId frameId:(NSString *)frameId generation:(NSNumber *)generation
    targetScreenQuad:(NSArray<NSNumber *> *)targetQuad receiverScreenQuad:(NSArray<NSNumber *> *)receiverQuad;
- (void)cancel;
@end
@interface CUIBackdropCaptureRegistration (Internal)
- (id<CUIBackdropCaptureSource>)source;
- (id)observeRetirement:(dispatch_block_t)callback;
- (void)removeRetirementObserver:(id)key;
@end
@interface CUIBackdropCaptureRegistry (Internal)
+ (CUIBackdropCaptureRegistration *)registrationForTarget:(UIView *)target;
+ (void)removeRegistration:(CUIBackdropCaptureRegistration *)registration;
@end
