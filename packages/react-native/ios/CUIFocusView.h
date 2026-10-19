#import <React/RCTViewComponentView.h>
#import <Accessibility/AXCustomContent.h>

@interface CUIFocusView : RCTViewComponentView <AXCustomContentProvider>
- (BOOL)capturesObservedKey:(UIKey *)key;
- (NSDictionary *)motionSnapshotIdentity;
- (NSString *)motionProjectionRevision;
@end
