#import <UIKit/UIKit.h>
#import <React/RCTAccessibilityProjection.h>
@class CUIKeyboardScope;

// Private original-view/session owner shared by native focus and read-time accessibility.
@interface CUIVirtualDragFocus : NSObject
- (instancetype)initWithScope:(CUIKeyboardScope *)scope;
- (void)update:(NSDictionary *)manifest binding:(NSDictionary *)binding;
- (void)refresh;
- (void)invalidate;
- (BOOL)active;
- (BOOL)allowsFocus:(UIFocusUpdateContext *)context;
- (RCTAccessibilityProjectionMode)accessibilityModeForView:(UIView *)view;
- (void)rejectAccessibilityProjection:(NSString *)error;
- (BOOL)allowsInteractionWithView:(UIView *)view;
@end
CUIVirtualDragFocus *CUIActiveVirtualDragFocus(UIWindow *window);
