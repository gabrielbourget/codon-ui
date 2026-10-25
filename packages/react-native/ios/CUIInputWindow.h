#import <UIKit/UIKit.h>

@protocol CUIKeyboardObservationScope
- (BOOL)hasKeyboardObservations;
- (BOOL)capturesObservedPress:(UIPress *)press;
- (void)observePress:(UIPress *)press repeat:(BOOL)repeat eventId:(NSUInteger)eventId captured:(BOOL)captured;
@end

@protocol CUIWindowPointerScope
- (NSArray<NSDictionary *> *)windowPointerRegistrationsForAncestry:(NSArray<NSNumber *> *)ancestry;
- (void)publishWindowPointerStatus:(BOOL)available error:(NSString *)error;
- (void)emitWindowPointer:(NSDictionary *)packet;
@end

NSString *CUIInputWindowIdentity(UIWindow *window);
NSString *CUIInputWindowModality(UIWindow *window);
void CUIRecordWindowModality(UIWindow *window, NSString *modality);
NSUInteger CUIInputWindowRevision(UIWindow *window);
void CUIAdvanceInputRevision(UIWindow *window);
UIView *CUIInputFocusedView(UIView *root);
NSString *CUIInputKeyName(UIKey *key);
NSString *CUIInputKeyToken(UIKey *key);
void CUIRegisterInputScope(UIWindow *window, UIView *scope);
void CUIUnregisterInputScope(UIWindow *window, UIView *scope);
NSArray<UIView *> *CUIInputScopes(UIWindow *window);
NSInteger CUINextInputPolicyOrder(UIWindow *window);
void CUIRefreshKeyboardObservation(UIWindow *window);
void CUIObserveKeyboardPress(UIPress *press, NSString *phase);
void CUIRefreshWindowPointerObservation(UIWindow *window);
void CUIActivateWindowPointer(UIView *target);

extern NSNotificationName const CUIInputFocusChangedNotification;
void CUIReportInputFocusChanged(UIView *target, BOOL focused);
