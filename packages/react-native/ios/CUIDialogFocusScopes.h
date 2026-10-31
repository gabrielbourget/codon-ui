#import <UIKit/UIKit.h>

@interface CUIDialogFocusScopes : NSObject
- (instancetype)initWithOwner:(UIView *)owner ready:(BOOL (^)(void))ready
                      session:(NSDictionary *(^)(void))session emit:(void (^)(NSString *, NSDictionary *))emit;
- (void)update:(NSArray<NSDictionary *> *)bindings revision:(double)revision;
- (void)refresh;
- (void)invalidate;
- (BOOL)isDialogRoot:(UIView *)view;
- (BOOL)handlePress:(UIPress *)press;
- (BOOL)shouldAllowFocusUpdate:(UIFocusUpdateContext *)context;
@end

BOOL CUIIsDialogFocusRoot(UIView *view);
BOOL CUIHandleDialogFocusPress(UIView *receiver, UIPress *press);
