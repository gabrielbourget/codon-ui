#import "uikit-pointer-model.h"
#import "../../../../packages/react-native/ios/CUIFieldPointerHandler.h"
#include <functional>
#include <iostream>
#include <memory>
#include <optional>
#include <stdexcept>
#include <unordered_map>
#include <vector>

// UIKit, pointer construction and the actual native recognizer arbitration are
// explicit models. The included SDK touch methods and CUI adapter are unchanged.
static NSSet<UITouch *> *originalTouches;
static UIEvent *originalEvent;
static int originalCalls;
static std::function<void(int)> deliver;
static std::vector<bool> recognitionDecisions;
@implementation UITouch
@end
@implementation UIPress
@end
@implementation UIEvent
@end
@implementation UIGestureRecognizer {
  UIGestureRecognizerState _state;
}
@synthesize state = _state;
- (instancetype)initWithTarget:(id)target action:(SEL)action
{
  if ((self = [super init])) self.enabled = YES;
  return self;
}
- (void)setState:(UIGestureRecognizerState)value
{
  _state = value;
  if (value == UIGestureRecognizerStateBegan) recognitionDecisions.push_back(self.cancelsTouchesInView);
}
- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{ originalTouches = touches; originalEvent = event; originalCalls++; }
- (void)touchesMoved:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{ originalTouches = touches; originalEvent = event; originalCalls++; }
- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{ originalTouches = touches; originalEvent = event; originalCalls++; }
- (void)touchesCancelled:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{ originalTouches = touches; originalEvent = event; originalCalls++; }
- (void)reset { _state = UIGestureRecognizerStatePossible; }
@end
@implementation UIHoverGestureRecognizer
@end
@implementation UIView
- (instancetype)init
{
  if ((self = [super init])) _gestureRecognizers = [NSMutableArray new];
  return self;
}
- (void)addGestureRecognizer:(UIGestureRecognizer *)recognizer
{ [self.gestureRecognizers addObject:recognizer]; recognizer.view = self; }
- (void)removeGestureRecognizer:(UIGestureRecognizer *)recognizer
{ if ([self.gestureRecognizers containsObject:recognizer]) [recognizer reset]; [self.gestureRecognizers removeObject:recognizer]; recognizer.view = nil; }
@end
typedef NS_ENUM(NSInteger, RCTPointerEventType) {
  RCTPointerEventTypeStart, RCTPointerEventTypeMove, RCTPointerEventTypeEnd, RCTPointerEventTypeCancel
};
struct ActivePointer { NSInteger identifier; };
struct ModelIdentifierPool { void reset() {} };
struct ModelDecision { void (^receive)(BOOL) = nil; };
#include "sdk-touch-functions.inc"
@implementation RCTSurfacePointerHandler {
  std::unordered_map<const void *, ActivePointer> _activePointers;
  ModelIdentifierPool _identifierPool;
  __weak UIView *_rootComponentView;
  UIHoverGestureRecognizer *_mouseHoverRecognizer, *_penHoverRecognizer;
  NSMutableDictionary *_currentlyHoveredViewsPerPointer;
  NSInteger _primaryTouchPointerId;
}
- (void)_registerTouches:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{ for (UITouch *touch in touches) _activePointers[(__bridge const void *)touch] = {touch.identifier}; }
- (void)_updateTouches:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {}
- (void)_unregisterTouches:(NSSet<UITouch *> *)touches
{ for (UITouch *touch in touches) _activePointers.erase((__bridge const void *)touch); }
- (std::vector<ActivePointer>)_activePointersFromTouches:(NSSet<UITouch *> *)touches
{ std::vector<ActivePointer> result; for (UITouch *touch in touches) result.push_back(_activePointers.at((__bridge const void *)touch)); return result; }
- (void)_dispatchActivePointers:(std::vector<ActivePointer>)pointers eventType:(RCTPointerEventType)type
{ if (!pointers.empty() && deliver) deliver(type); }
- (void)mouseHovering:(UIHoverGestureRecognizer *)recognizer {}
- (void)penHovering:(UIHoverGestureRecognizer *)recognizer {}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceiveTouch:(UITouch *)touch { return YES; }
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceivePress:(UIPress *)press { return YES; }
#include "sdk-touch-methods.inc"
@end

int main() {
  @autoreleasepool {
    int checks = 0;
    const auto check = [&](bool value) { if (!value) throw std::runtime_error("UIKit pointer source assertion failed"); checks++; };
    for (bool veto : {false, true}) {
      for (bool outsideActive : {false, true}) {
      UIView *surface = [UIView new];
      UIHoverGestureRecognizer *existingHover = [[UIHoverGestureRecognizer alloc] initWithTarget:nil action:nil];
      [surface addGestureRecognizer:existingHover];
      __block BOOL admitted = YES;
      __block int admissions = 0, emissions = 0;
      const auto decision = std::make_shared<ModelDecision>();
      CUIFieldPointerHandler *handler = [[CUIFieldPointerHandler alloc] initWithSurface:surface accepts:^BOOL(UITouch *touch) {
        admissions++; return admitted;
      } emission:^(void (^original)(void), void (^receive)(BOOL)) {
        emissions++; decision->receive = receive; original(); decision->receive = nil;
      }];
      check(handler.view == surface && surface.gestureRecognizers.count == 4);
      check(existingHover.enabled);
      int disabledHovers = 0;
      for (UIGestureRecognizer *recognizer in surface.gestureRecognizers)
        if ([recognizer isKindOfClass:UIHoverGestureRecognizer.class] && !recognizer.enabled) disabledHovers++;
      check(disabledHovers == 2 && !handler.cancelsTouchesInView && !handler.delaysTouchesBegan && !handler.delaysTouchesEnded);
      UITouch *touch = [UITouch new]; touch.phase = UITouchPhaseBegan; touch.identifier = 7;
      NSSet *touches = [NSSet setWithObject:touch]; UIEvent *event = [UIEvent new]; event.allTouches = touches;
      check([handler gestureRecognizer:handler shouldReceiveTouch:touch]);
      admitted = NO; check(![handler gestureRecognizer:handler shouldReceiveTouch:touch] && admissions == 2);
      check(![handler gestureRecognizer:handler shouldReceivePress:[UIPress new]]);
      if (outsideActive) {
        UITouch *outside = [UITouch new]; outside.phase = UITouchPhaseStationary;
        check(![handler gestureRecognizer:handler shouldReceiveTouch:outside]);
        event.allTouches = [NSSet setWithObjects:touch, outside, nil];
      }
      admitted = YES;
      recognitionDecisions.clear(); originalCalls = 0;
      std::vector<int> phases;
      deliver = [&](int phase) {
        check(originalTouches == touches && originalEvent == event);
        check(decision->receive != nil);
        if (phase == RCTPointerEventTypeStart) check(handler.state == UIGestureRecognizerStatePossible);
        phases.push_back(phase); decision->receive(veto);
      };
      [handler touchesBegan:touches withEvent:event];
      check(originalCalls == 1 && handler.state == UIGestureRecognizerStateBegan);
      check(recognitionDecisions == std::vector<bool>{veto});
      touch.phase = UITouchPhaseMoved; [handler touchesMoved:touches withEvent:event];
      check(originalCalls == 2 && handler.state == UIGestureRecognizerStateChanged);
      touch.phase = UITouchPhaseEnded; [handler touchesEnded:touches withEvent:event];
      check(originalCalls == 3 && handler.state == UIGestureRecognizerStateEnded && emissions == 3);
      check(phases == (std::vector<int>{RCTPointerEventTypeStart, RCTPointerEventTypeMove, RCTPointerEventTypeEnd}));
      [handler reset]; check(handler.state == UIGestureRecognizerStatePossible && !handler.cancelsTouchesInView);
      touch.phase = UITouchPhaseBegan; [handler touchesBegan:touches withEvent:event];
      touch.phase = UITouchPhaseCancelled; [handler touchesCancelled:touches withEvent:event];
      check(phases.back() == RCTPointerEventTypeCancel && handler.state == UIGestureRecognizerStateCancelled);
      [handler reset]; touch.phase = UITouchPhaseBegan; [handler touchesBegan:touches withEvent:event];
      [handler retire];
      check(phases.back() == RCTPointerEventTypeCancel && handler.view == nil);
      check(surface.gestureRecognizers.count == 1 && surface.gestureRecognizers[0] == existingHover && existingHover.enabled);
      check(![handler gestureRecognizer:handler shouldReceiveTouch:touch]);
      deliver = {};
      }
    }
    {
      UIView *surface = [UIView new];
      const auto failure = std::make_shared<const std::string>("original SDK emission failure");
      __block int emissions = 0;
      CUIFieldPointerHandler *handler = [[CUIFieldPointerHandler alloc] initWithSurface:surface accepts:^BOOL(UITouch *) { return YES; }
        emission:^(void (^original)(void), void (^decision)(BOOL)) { emissions++; original(); }];
      UITouch *touch = [UITouch new]; touch.phase = UITouchPhaseBegan;
      NSSet *touches = [NSSet setWithObject:touch]; UIEvent *event = [UIEvent new]; event.allTouches = touches;
      originalCalls = 0;
      deliver = [failure](int) { throw failure; };
      try { [handler touchesBegan:touches withEvent:event]; check(false); }
      catch (const std::shared_ptr<const std::string> &actual) { check(actual == failure); }
      check(originalCalls == 1 && emissions == 1 && originalTouches == touches && originalEvent == event);
      check(handler.state == UIGestureRecognizerStatePossible);
      deliver = {};
      [handler reset]; check(!handler.cancelsTouchesInView);
      [handler retire]; check(handler.view == nil && surface.gestureRecognizers.count == 0);
    }
    std::cout << checks << " actual CUI adapter/original SDK touch-method assertions; explicit UIKit/pointer/arbitration models, no installed verdict\n";
  }
}
