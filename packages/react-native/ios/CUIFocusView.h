#import "CUIMotionDrawingView.h"
#import <Accessibility/AXCustomContent.h>

@interface CUIFocusView : CUIMotionDrawingView <AXCustomContentProvider>
- (BOOL)capturesObservedKey:(UIKey *)key;
- (NSDictionary *)motionSnapshotIdentity;
- (NSString *)motionProjectionRevision;
@end
