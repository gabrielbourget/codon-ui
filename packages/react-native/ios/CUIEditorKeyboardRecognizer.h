#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN
@interface CUIEditorKeyboardRecognizer : UIGestureRecognizer <UIGestureRecognizerDelegate>
- (instancetype)initWithAdmission:(BOOL (^)(UIPress *press))admission
                        dispatch:(BOOL (^)(UIPress *press, NSString *phase, BOOL repeat))dispatch;
@end
NS_ASSUME_NONNULL_END
