#import <UIKit/UIKit.h>

NSString *CUIInputWindowIdentity(UIWindow *window);
NSString *CUIInputWindowModality(UIWindow *window);
void CUIRecordWindowModality(UIWindow *window, NSString *modality);
NSString *CUIInputKeyName(UIKey *key);
NSString *CUIInputKeyToken(UIKey *key);
void CUIRegisterInputScope(UIWindow *window, UIView *scope);
void CUIUnregisterInputScope(UIWindow *window, UIView *scope);
NSArray<UIView *> *CUIInputScopes(UIWindow *window);
NSInteger CUINextInputPolicyOrder(UIWindow *window);
