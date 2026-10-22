#import "CUICollectionNode.h"

@interface CUIFormMetadataView : CUICollectionMetadataView
@property (nonatomic, assign) NSInteger originalTarget;
- (BOOL)isFieldBinding;
- (NSDictionary *)formMountSnapshot;
- (UIView *)originalForMountSnapshot:(NSDictionary *)snapshot;
@end

@interface CUIFormRoot : CUIFormMetadataView
@end

@interface CUIFieldBinding : CUIFormMetadataView
@end
