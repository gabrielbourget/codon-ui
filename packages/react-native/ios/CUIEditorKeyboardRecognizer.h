#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN
@interface CUIEditorKeyboardRecognizer : UIGestureRecognizer <UIGestureRecognizerDelegate>
@property(nonatomic, copy, nullable) NSNumber *(^prepareOriginalEditorPress)(UIPress *press, NSString *phase, BOOL repeat);
@property(nonatomic, copy, nullable) void (^retireOriginalEditorPresses)(void);
- (BOOL)capturesPressCode:(UIKeyboardHIDUsage)code;
- (instancetype)initWithAdmission:(BOOL (^)(UIPress *press))admission
                        dispatch:(BOOL (^)(UIPress *press, NSString *phase, BOOL repeat))dispatch;
@end
NS_ASSUME_NONNULL_END
