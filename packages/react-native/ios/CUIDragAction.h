#import <Foundation/Foundation.h>
@class CUIKeyboardScope;
NS_ASSUME_NONNULL_BEGIN
FOUNDATION_EXPORT NSString *CUIRunDragAction(CUIKeyboardScope *scope, NSDictionary *identity, NSDictionary *payload,
    BOOL pointer, BOOL (^current)(void));
NS_ASSUME_NONNULL_END
