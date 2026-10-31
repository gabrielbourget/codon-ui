#import <Foundation/Foundation.h>

typedef NS_ENUM(NSInteger, UITouchPhase) {
  UITouchPhaseBegan, UITouchPhaseMoved, UITouchPhaseStationary, UITouchPhaseEnded, UITouchPhaseCancelled
};
typedef NS_ENUM(NSInteger, UIGestureRecognizerState) {
  UIGestureRecognizerStatePossible, UIGestureRecognizerStateBegan, UIGestureRecognizerStateChanged,
  UIGestureRecognizerStateEnded, UIGestureRecognizerStateCancelled, UIGestureRecognizerStateFailed
};
typedef NS_ENUM(NSInteger, UITouchType) { UITouchTypeDirect, UITouchTypePencil, UITouchTypeIndirectPointer };
@class UIView, UIEvent;
@interface UITouch : NSObject
@property(nonatomic) UITouchPhase phase;
@property(nonatomic) NSInteger identifier;
@end
@interface UIPress : NSObject
@end
@interface UIEvent : NSObject
@property(nonatomic, strong) NSSet<UITouch *> *allTouches;
@end
@interface UIGestureRecognizer : NSObject
@property(nonatomic, weak) UIView *view;
@property(nonatomic, weak) id delegate;
@property(nonatomic) UIGestureRecognizerState state;
@property(nonatomic) BOOL cancelsTouchesInView;
@property(nonatomic) BOOL delaysTouchesBegan;
@property(nonatomic) BOOL delaysTouchesEnded;
@property(nonatomic) BOOL enabled;
- (instancetype)initWithTarget:(id)target action:(SEL)action;
- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event;
- (void)touchesMoved:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event;
- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event;
- (void)touchesCancelled:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event;
- (void)reset;
@end
@interface UIHoverGestureRecognizer : UIGestureRecognizer
@property(nonatomic, strong) NSArray<NSNumber *> *allowedTouchTypes;
@end
@interface UIView : NSObject
@property(nonatomic, strong) NSMutableArray<UIGestureRecognizer *> *gestureRecognizers;
- (void)addGestureRecognizer:(UIGestureRecognizer *)recognizer;
- (void)removeGestureRecognizer:(UIGestureRecognizer *)recognizer;
@end
@interface RCTSurfacePointerHandler : UIGestureRecognizer
- (void)attachToView:(UIView *)view;
- (void)detachFromView:(UIView *)view;
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceiveTouch:(UITouch *)touch;
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceivePress:(UIPress *)press;
@end

#define RCTAssert(value, ...) NSCAssert((value), @"Original SDK assertion")
#define RCTAssertParam(value) NSCAssert((value) != nil, @"Original SDK argument")
