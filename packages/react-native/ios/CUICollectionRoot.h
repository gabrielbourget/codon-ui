#import "CUICollectionNode.h"

@interface CUICollectionRoot : CUICollectionMetadataView
- (BOOL)acceptsPointerBinding:(NSString *)serialized visibleTarget:(NSInteger)target;
@end
