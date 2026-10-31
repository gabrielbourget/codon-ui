#import <UIKit/UIKit.h>

@interface CUIMenuPointerPolicies : NSObject
- (instancetype)initWithScope:(UIView *)scope ready:(BOOL (^)(void))ready publish:(void (^)(NSDictionary *))publish;
- (void)update:(NSArray<NSDictionary *> *)registrations revision:(double)revision session:(NSDictionary *)session;
- (void)invalidate;
@end

void CUIRefreshMenuPointerPolicies(UIWindow *window);
BOOL CUIMenuPointerSuppresses(UIView *target);
BOOL CUIMenuPointerPreventsFocus(UIWindow *window);
void CUIRecordMenuPointerDown(UIWindow *window);
void CUIRecordMenuPointerKey(UIWindow *window, UIKey *key);
void CUIRecordMenuPointerVirtual(UIWindow *window);
