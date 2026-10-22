#import "CUICollectionNode.h"

@protocol CUIFieldSemanticContribution <NSObject>
- (void)retire;
@end

@interface CUIFormMetadataView : CUICollectionMetadataView
@property (nonatomic, assign) NSInteger originalTarget;
@property (nonatomic, copy) NSString *semanticBinding;
@property (nonatomic, copy) NSString *ownedEditorBinding;
@property (nonatomic, copy) NSString *fieldGroupBinding;
- (BOOL)isFieldBinding;
- (NSDictionary *)formMountSnapshot;
- (UIView *)originalForMountSnapshot:(NSDictionary *)snapshot;
- (void)setSemanticContribution:(id<CUIFieldSemanticContribution>)contribution;
- (void)setSemanticRefresh:(void (^)(void))refresh owner:(NSString *)owner;
- (void)clearSemanticRefreshForOwner:(NSString *)owner;
- (void)refreshSemantics;
- (void)setFieldInputRefresh:(void (^)(void))refresh owner:(NSString *)owner;
- (void)clearFieldInputRefreshForOwner:(NSString *)owner;
- (void)emitFieldInputRecord:(NSString *)record;
- (void)resetSemanticAccessibilityFocus;
- (void)requestSemanticAccessibilityFocus:(UIView *)target identity:(NSString *)identity returningToEditor:(BOOL)returning;
@end

@interface CUIFormRoot : CUIFormMetadataView
@end

@interface CUIFieldBinding : CUIFormMetadataView
@end
