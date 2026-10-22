#import "CUICollectionNode.h"

@protocol CUIFieldSemanticContribution <NSObject>
- (void)retire;
@end

@interface CUIFormMetadataView : CUICollectionMetadataView
@property (nonatomic, assign) NSInteger originalTarget;
@property (nonatomic, copy) NSString *semanticBinding;
- (BOOL)isFieldBinding;
- (NSDictionary *)formMountSnapshot;
- (UIView *)originalForMountSnapshot:(NSDictionary *)snapshot;
- (void)setSemanticContribution:(id<CUIFieldSemanticContribution>)contribution;
- (void)setSemanticRefresh:(void (^)(void))refresh owner:(NSString *)owner;
- (void)clearSemanticRefreshForOwner:(NSString *)owner;
- (void)refreshSemantics;
- (void)resetSemanticAccessibilityFocus;
- (void)requestSemanticAccessibilityFocus:(UIView *)target identity:(NSString *)identity returningToEditor:(BOOL)returning;
@end

@interface CUIFormRoot : CUIFormMetadataView
@end

@interface CUIFieldBinding : CUIFormMetadataView
@end
