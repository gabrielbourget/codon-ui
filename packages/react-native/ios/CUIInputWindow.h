#import <UIKit/UIKit.h>

@protocol CUIKeyboardObservationScope <NSObject>
- (BOOL)hasKeyboardObservations;
- (BOOL)capturesObservedPress:(UIPress *)press;
- (void)observePress:(UIPress *)press repeat:(BOOL)repeat eventId:(NSUInteger)eventId captured:(BOOL)captured;
@optional
- (void)observeOriginalEditorPress:(UIPress *)press phase:(NSString *)phase frame:(NSDictionary *)frame;
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
void CUIRegisterLocalKeyboardObservation(UIWindow *window, UIView *owner);
void CUIUnregisterLocalKeyboardObservation(UIWindow *window, UIView *owner);
NSDictionary *CUIInputKeyboardPressFrame(UIPress *press, NSString *phase);
NSUInteger CUIInputKeyboardSequence(UIWindow *window, UIKeyboardHIDUsage code);
BOOL CUIInputKeyboardRepeating(UIWindow *window, UIKeyboardHIDUsage code);
void CUIRefreshWindowPointerObservation(UIWindow *window);
void CUIActivateWindowPointer(UIView *target);

extern NSNotificationName const CUIInputFocusChangedNotification;
void CUIReportInputFocusChanged(UIView *target, BOOL focused);
