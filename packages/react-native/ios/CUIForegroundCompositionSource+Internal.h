#import "CUIForegroundCompositionSource.h"
@interface CUIForegroundCompositionRequest (Internal)
- (instancetype)initWithRoot:(UIView *)root owner:(UIView *)owner source:(UIView *)source output:(UIView *)output
    sourceEpoch:(NSDictionary *)sourceEpoch outputEpoch:(NSDictionary *)outputEpoch
    ownerId:(NSString *)ownerId generation:(NSUInteger)generation frame:(NSUInteger)frame bounds:(CGRect)bounds scale:(CGFloat)scale
    sourceQuad:(NSArray<NSNumber *> *)sourceQuad outputQuad:(NSArray<NSNumber *> *)outputQuad;
- (void)cancel;
@end
@interface CUIForegroundCompositionPresentation (Internal)
- (instancetype)initWithFrame:(CUIForegroundCompositionFrame *)frame bounds:(CGRect)bounds;
@end
@interface CUIForegroundCompositionRegistration (Internal)
- (id<CUIForegroundCompositionSource>)source;
- (id)observeRetirement:(dispatch_block_t)callback;
- (void)removeRetirementObserver:(id)key;
@end
@interface CUIForegroundCompositionRegistry (Internal)
+ (CUIForegroundCompositionRegistration *)registrationForOwner:(UIView *)owner;
@end
