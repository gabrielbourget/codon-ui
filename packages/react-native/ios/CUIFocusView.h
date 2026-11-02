#import "CUIMotionDrawingView.h"
#import <Accessibility/AXCustomContent.h>

@interface CUIFocusView : CUIMotionDrawingView <AXCustomContentProvider, UIAccessibilityContainerDataTable, UIAccessibilityContainerDataTableCell>
@property (nonatomic, copy, readonly) NSString *nativeCollectionBinding;
- (BOOL)capturesObservedKey:(UIKey *)key;
- (NSDictionary *)motionSnapshotIdentity;
- (NSArray<NSNumber *> *)motionContentBox;
- (NSString *)motionProjectionRevision;
- (NSDictionary *)formActionSnapshot;
- (NSString *)fieldInputOwnerId;
- (BOOL)fieldFocusTabStop;
- (void)requestKeyboardFocus:(NSString *)ownerId;
@end
