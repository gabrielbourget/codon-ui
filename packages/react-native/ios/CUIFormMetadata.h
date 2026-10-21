#import "CUICollectionNode.h"

@interface CUIFormMetadataView : CUICollectionMetadataView
@property (nonatomic, assign) NSInteger originalTarget;
- (BOOL)isFieldBinding;
@end

@interface CUIFormRoot : CUIFormMetadataView
@end

@interface CUIFieldBinding : CUIFormMetadataView
@end
