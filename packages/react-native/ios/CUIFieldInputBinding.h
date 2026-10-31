#import "CUIFormMetadata.h"
#import <React/RCTSurfacePresenter.h>
#include <react/renderer/uimanager/UIManager.h>

@interface CUIFieldInputBinding : NSObject
- (instancetype)initWithMetadata:(CUIFieldBinding *)metadata
                      presenter:(RCTSurfacePresenter *)presenter
                        manager:(std::shared_ptr<facebook::react::UIManager>)manager
                   registration:(NSDictionary *)registration
                          outer:(UIView *)outer
                          input:(UIView *)input
                       snapshot:(NSDictionary *(^)(void))snapshot;
- (NSDictionary *)registrationReceipt;
- (void)refresh;
- (void)retire;
@end

BOOL CUIFieldInputOwnsPress(UIPress *press, UIWindow *window);
BOOL CUIFieldInputOwnsView(UIView *view);

void CUIEmitOwnedFieldInput(UIView *view, void (^emit)(void));

BOOL CUIHandleFieldResponderPress(UIView *receiver, UIPress *press, NSString *phase);
NSSet<UIPress *> *CUIFieldInputRemainingPresses(UIView *receiver, NSSet<UIPress *> *presses, NSString *phase);
