#import <UIKit/UIKit.h>
@class CUIKeyboardScope;
@class CUIVirtualDragFocus;
NS_ASSUME_NONNULL_BEGIN
@interface CUIDragInteractions : NSObject
- (instancetype)initWithScope:(CUIKeyboardScope *)scope;
- (void)update:(NSString *)encoded;
- (void)refresh;
- (void)refreshWindow;
- (void)invalidate;
- (CUIVirtualDragFocus *)virtualFocus;
- (NSDictionary *)session;
- (BOOL)available;
- (NSDictionary *)geometry:(NSDictionary *)request;
@end
NS_ASSUME_NONNULL_END
