#import <React/RCTViewComponentView.h>

@protocol CUIFieldSemanticContribution <NSObject>
- (void)retire;
@end

@interface CUIFormMetadataView : RCTViewComponentView
@property(nonatomic, copy) NSString *ownerId;
@property(nonatomic, copy) NSString *descriptorId;
@property(nonatomic, copy) NSString *descriptorRevision;
- (BOOL)isMetadataOnly;
@property (nonatomic, assign) NSInteger originalTarget;
@property (nonatomic, copy) NSString *semanticBinding;
@property (nonatomic, copy) NSString *ownedEditorBinding;
@property (nonatomic, copy) NSString *ownedControlBinding;
- (BOOL)isFieldBinding;
- (NSDictionary *)formMountSnapshot;
- (NSString *)formTransactionWitness;
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
