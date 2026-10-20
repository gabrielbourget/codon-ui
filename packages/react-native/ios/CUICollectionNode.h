#import <React/RCTViewComponentView.h>

@interface CUICollectionMetadataView : RCTViewComponentView
@property(nonatomic, copy) NSString *ownerId;
@property(nonatomic, copy) NSString *rootId;
@property(nonatomic, copy) NSString *descriptorId;
@property(nonatomic, copy) NSString *descriptorRevision;
- (BOOL)isMetadataOnly;
@end

@interface CUICollectionNode : CUICollectionMetadataView
@end
