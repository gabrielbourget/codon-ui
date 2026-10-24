#import "CUIFieldPointerHandler.h"
#import <UIKit/UIGestureRecognizerSubclass.h>

@implementation CUIFieldPointerHandler {
  CUIFieldPointerAdmission _accepts;
  CUIFieldPointerEmission _emission;
  NSHashTable<UITouch *> *_contacts;
  BOOL _prevented;
}
- (instancetype)initWithSurface:(UIView *)surface
                       accepts:(CUIFieldPointerAdmission)accepts
                      emission:(CUIFieldPointerEmission)emission
{
  if ((self = [super init])) {
    _accepts = [accepts copy]; _emission = [emission copy];
    _contacts = [NSHashTable weakObjectsHashTable];
    NSArray<UIGestureRecognizer *> *previous = [surface.gestureRecognizers copy];
    [super attachToView:surface];
    // This instance owns contact streams. Its two newly created SDK hover
    // recognizers must not introduce pointer delivery outside an admitted field.
    for (UIGestureRecognizer *recognizer in surface.gestureRecognizers)
      if (![previous containsObject:recognizer] && [recognizer isKindOfClass:UIHoverGestureRecognizer.class])
        recognizer.enabled = NO;
  }
  return self;
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceiveTouch:(UITouch *)touch
{
  return _accepts && _accepts(touch);
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceivePress:(UIPress *)press { return NO; }
- (void)emitOriginal:(void (^)(void))original
{
  if (!_emission) { original(); return; }
  _emission(original, ^(BOOL prevented) {
    self->_prevented = self->_prevented || prevented;
    // The decision runs inside the original SDK emission, before its next
    // recognizer-state transition. Native arbitration still needs qualification.
    self.cancelsTouchesInView = self->_prevented;
  });
}
- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{
  for (UITouch *touch in touches) [_contacts addObject:touch];
  [self emitOriginal:^{ [super touchesBegan:touches withEvent:event]; }];
}
- (void)touchesMoved:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{
  [self emitOriginal:^{ [super touchesMoved:touches withEvent:event]; }];
}
- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{
  [self emitOriginal:^{ [super touchesEnded:touches withEvent:event]; }];
  for (UITouch *touch in touches) [_contacts removeObject:touch];
  // SDK termination checks all window contacts; this scoped recognizer only
  // owns its admitted contacts, including when an outside contact stays down.
  if (!_contacts.count && (self.state == UIGestureRecognizerStateBegan || self.state == UIGestureRecognizerStateChanged))
    self.state = UIGestureRecognizerStateEnded;
}
- (void)touchesCancelled:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{
  [self emitOriginal:^{ [super touchesCancelled:touches withEvent:event]; }];
  for (UITouch *touch in touches) [_contacts removeObject:touch];
  if (!_contacts.count && (self.state == UIGestureRecognizerStateBegan || self.state == UIGestureRecognizerStateChanged))
    self.state = UIGestureRecognizerStateCancelled;
}
- (void)reset
{
  [self emitOriginal:^{ [super reset]; }];
  [_contacts removeAllObjects];
  _prevented = NO; self.cancelsTouchesInView = NO;
}
- (void)retire
{
  UIView *surface = self.view;
  if (surface) [super detachFromView:surface];
  _accepts = nil; _emission = nil;
}
@end
