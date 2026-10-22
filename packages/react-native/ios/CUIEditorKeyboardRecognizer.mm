#import "CUIEditorKeyboardRecognizer.h"
#import <UIKit/UIGestureRecognizerSubclass.h>

@implementation CUIEditorKeyboardRecognizer {
  BOOL (^_admission)(UIPress *);
  BOOL (^_dispatch)(UIPress *, NSString *, BOOL);
  NSMutableSet<NSNumber *> *_heldCodes;
}
- (instancetype)initWithAdmission:(BOOL (^)(UIPress *))admission
                        dispatch:(BOOL (^)(UIPress *, NSString *, BOOL))dispatch
{
  if ((self = [super initWithTarget:nil action:nil])) {
    _admission = [admission copy];
    _dispatch = [dispatch copy];
    _heldCodes = [NSMutableSet set];
    self.delegate = self;
    self.cancelsTouchesInView = YES;
    self.delaysTouchesBegan = NO;
    self.delaysTouchesEnded = NO;
  }
  return self;
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceivePress:(UIPress *)press
{
  return press.key != nil && _admission(press);
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceiveTouch:(UITouch *)touch { return NO; }
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)other { return YES; }
- (BOOL)canPreventGestureRecognizer:(UIGestureRecognizer *)other { return NO; }
- (BOOL)canBePreventedByGestureRecognizer:(UIGestureRecognizer *)other { return NO; }
- (void)pressesBegan:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
  BOOL prevented = NO;
  for (UIPress *press in presses) {
    if (!press.key || !_admission(press)) continue;
    NSNumber *code = @(press.key.keyCode);
    BOOL repeat = [_heldCodes containsObject:code];
    [_heldCodes addObject:code];
    prevented |= _dispatch(press, @"down", repeat);
  }
  if (prevented) self.state = self.state == UIGestureRecognizerStatePossible ? UIGestureRecognizerStateBegan : UIGestureRecognizerStateChanged;
}
- (void)finishPresses:(NSSet<UIPress *> *)presses cancelled:(BOOL)cancelled
{
  BOOL prevented = NO;
  for (UIPress *press in presses) {
    if (!press.key) continue;
    NSNumber *code = @(press.key.keyCode);
    if ([_heldCodes containsObject:code] && _admission(press)) prevented |= _dispatch(press, cancelled ? @"cancel" : @"up", NO);
    [_heldCodes removeObject:code];
  }
  if (!_heldCodes.count) self.state = prevented || self.state != UIGestureRecognizerStatePossible ? UIGestureRecognizerStateEnded : UIGestureRecognizerStateFailed;
}
- (void)pressesEnded:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event { [self finishPresses:presses cancelled:NO]; }
- (void)pressesCancelled:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event { [self finishPresses:presses cancelled:YES]; }
- (void)reset { [_heldCodes removeAllObjects]; [super reset]; }
@end
