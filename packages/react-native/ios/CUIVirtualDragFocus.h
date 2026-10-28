#import <UIKit/UIKit.h>
@class CUIKeyboardScope;

// Private original-view focus owner. Accessibility projection is a separate, unadopted scope.
@interface CUIVirtualDragFocus : NSObject
- (instancetype)initWithScope:(CUIKeyboardScope *)scope;
- (void)update:(NSDictionary *)manifest binding:(NSDictionary *)binding;
- (void)refresh;
- (void)invalidate;
- (BOOL)active;
- (BOOL)allowsFocus:(UIFocusUpdateContext *)context;
@end
CUIVirtualDragFocus *CUIActiveVirtualDragFocus(UIWindow *window);
