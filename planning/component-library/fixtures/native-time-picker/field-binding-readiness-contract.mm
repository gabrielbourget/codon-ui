#import <Foundation/Foundation.h>
#include <stdexcept>

@interface Metadata : NSObject
@property NSString *ownerId;
@property NSString *fieldGroupBinding;
@end
@implementation Metadata
@end

@interface Binding : NSObject {
@public
  Metadata *_metadata;
  NSDictionary *_registration, *_status;
  NSUInteger _statusGeneration;
  BOOL _statusPublished;
  NSMutableArray *_records;
}
- (void)publishReadiness:(BOOL)ready error:(NSString *)error;
- (void)record:(NSDictionary *)record;
@end
@implementation Binding
#include "owned-readiness.inc"
- (void)record:(NSDictionary *)record { [_records addObject:record]; }
@end

@class UIWindow;
@interface UIKey : NSObject
@property(nonatomic) NSInteger keyCode;
@end
@implementation UIKey
@end
@interface UIPress : NSObject
@property(nonatomic, strong) UIKey *key;
@property(nonatomic, weak) UIWindow *window;
@property(nonatomic) NSInteger type;
@property(nonatomic) NSTimeInterval timestamp;
@end
@implementation UIPress
@end
@class UIView;
@class UIPressesEvent;
typedef BOOL (^RCTTextInputPressHandler)(UIView *, UIPress *, NSString *);
static NSMutableArray<NSString *> *trace;
@protocol RCTBackedTextInputViewProtocol
@property(nonatomic, copy) RCTTextInputPressHandler nativeKeyPressHandler;
@end
@interface UIView : NSObject <RCTBackedTextInputViewProtocol>
@property(nonatomic, weak) UIWindow *window;
@property(nonatomic) NSInteger tag;
@property(nonatomic, getter=isFirstResponder) BOOL firstResponder;
@property(nonatomic, copy) RCTTextInputPressHandler nativeKeyPressHandler;
- (void)pressesBegan:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event;
- (void)pressesEnded:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event;
- (void)pressesCancelled:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event;
@end
@implementation UIView
- (void)pressesBegan:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event { (void)event; if (presses.count) [trace addObject:@"default:down"]; }
- (void)pressesEnded:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event { (void)event; if (presses.count) [trace addObject:@"default:up"]; }
- (void)pressesCancelled:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event { (void)event; if (presses.count) [trace addObject:@"default:cancel"]; }
@end
@interface UIWindow : UIView
@property(nonatomic, copy) NSString *identity;
@property(nonatomic) BOOL active;
@end
@implementation UIWindow
@end
@interface CUIFieldInputBinding : Binding
@property(nonatomic, weak) UIWindow *boundWindow;
@property(nonatomic, copy) NSDictionary *identity;
@property(nonatomic) BOOL member;
@property(nonatomic) BOOL captureDown;
@property(nonatomic) BOOL captureUp;
@property(nonatomic, strong) NSMutableArray<NSDictionary *> *dispatches;
@property(nonatomic, copy) void (^onDispatch)(void);
- (NSDictionary *)keyIdentity;
- (BOOL)containsOriginalView:(UIView *)view;
- (BOOL)dispatch:(UIPress *)press phase:(NSString *)phase repeat:(BOOL)repeat;
@end
@implementation CUIFieldInputBinding
- (NSDictionary *)keyIdentity { return self.identity; }
- (BOOL)containsOriginalView:(UIView *)view { return self.member && view.window == self.boundWindow; }
- (BOOL)dispatch:(UIPress *)press phase:(NSString *)phase repeat:(BOOL)repeat {
  [trace addObject:[@"dispatch:" stringByAppendingString:phase]];
  [self.dispatches addObject:@{@"press":press, @"phase":phase, @"repeat":@(repeat)}];
  void (^callback)(void) = self.onDispatch; self.onDispatch = nil;
  if (callback) callback();
  return [phase isEqual:@"down"] ? self.captureDown : self.captureUp;
}
@end
@interface CUIFieldInputWindow : NSObject
@property(nonatomic, weak) UIWindow *window;
@property(nonatomic, strong) NSMapTable<UIPress *, NSMutableDictionary *> *records;
@property(nonatomic, strong) NSMutableDictionary<NSNumber *, NSDictionary *> *held;
@property(nonatomic, strong) NSMutableSet<NSString *> *observedKeyBoundaries;
@property(nonatomic, strong) NSHashTable<UIView<RCTBackedTextInputViewProtocol> *> *editors;
@property(nonatomic, copy) RCTTextInputPressHandler editorHandler;
- (BOOL)handlePress:(UIPress *)press phase:(NSString *)phase receiver:(UIView *)receiver;
- (void)retire;
@end
static NSHashTable<CUIFieldInputBinding *> *CUIFieldInputs;
static NSMapTable<UIWindow *, CUIFieldInputWindow *> *CUIFieldWindows;
static CUIFieldInputBinding *winner;
static CUIFieldInputBinding *CUIFieldWinner(UIWindow *window) { return winner.boundWindow == window ? winner : nil; }
static NSString *CUIInputWindowIdentity(UIWindow *window) { return window.identity; }
static BOOL CUIFieldInputWindowActive(UIWindow *window) { return window.active; }
#include "sdk-press-filter.inc"
#include "owned-key-boundary.inc"
#include "owned-key-entry.inc"
#include "owned-key-route.inc"
@interface RCTUITextField : UIView
@end
@implementation RCTUITextField
#include "sdk-field-presses.inc"
@end
@interface RCTUITextView : UIView
@end
@implementation RCTUITextView
#include "sdk-view-presses.inc"
@end
@interface CUIDateSegment : UIView
@end
@implementation CUIDateSegment
#include "owned-segment-presses.inc"
@end
@interface CUIFocusView : UIView
- (NSSet<UIPress *> *)processPresses:(NSSet<UIPress *> *)presses down:(BOOL)down cancelled:(BOOL)cancelled;
@end
@implementation CUIFocusView
- (NSSet<UIPress *> *)processPresses:(NSSet<UIPress *> *)presses down:(BOOL)down cancelled:(BOOL)cancelled {
  (void)down; (void)cancelled;
  if (presses.count) [trace addObject:@"ordinary-focus"];
  return presses;
}
#include "owned-focus-presses.inc"
@end

static NSUInteger assertions = 0;
static void check(BOOL value) {
  assertions++;
  if (!value) throw std::runtime_error("Binding readiness contract failed");
}
static NSString *encoded(NSDictionary *value) {
  return [[NSString alloc] initWithData:[NSJSONSerialization dataWithJSONObject:value options:0 error:nullptr] encoding:NSUTF8StringEncoding];
}
static NSUInteger responderCases = 0;
static void responderChecks() {
  trace = [NSMutableArray new];
  UIWindow *window = [UIWindow new]; window.identity = @"original-window"; window.active = YES;
  UIWindow *foreign = [UIWindow new]; foreign.identity = @"foreign-window"; foreign.active = YES;
  CUIFieldInputWindow *router = [CUIFieldInputWindow new]; router.window = window;
  router.observedKeyBoundaries = [NSMutableSet new]; router.records = [NSMapTable weakToStrongObjectsMapTable];
  router.held = [NSMutableDictionary new]; router.editors = [NSHashTable weakObjectsHashTable];
  router.editorHandler = ^BOOL(UIView *view, UIPress *press, NSString *phase) { return CUIHandleFieldResponderPress(view, press, phase); };
  CUIFieldWindows = [NSMapTable weakToStrongObjectsMapTable]; [CUIFieldWindows setObject:router forKey:window];
  winner = [CUIFieldInputBinding new]; winner.boundWindow = window; winner.member = YES;
  winner->_records = [NSMutableArray new]; winner.dispatches = [NSMutableArray new];
  CUIFieldInputs = [NSHashTable weakObjectsHashTable]; [CUIFieldInputs addObject:winner];
  for (Class type in @[RCTUITextField.class, RCTUITextView.class, CUIDateSegment.class, CUIFocusView.class]) {
    UIView *view = [type new]; view.window = window; view.firstResponder = YES; view.tag = 17;
    view.nativeKeyPressHandler = router.editorHandler; [router.editors addObject:view];
    winner.identity = @{@"owner":@"original", @"epoch":@1}; winner.captureDown = YES; winner.captureUp = NO;
    UIPress *press = [UIPress new]; press.key = [UIKey new]; press.key.keyCode = 82; press.window = window; press.timestamp = 10;
    NSSet *presses = [NSSet setWithObject:press];
    [trace removeAllObjects]; [winner.dispatches removeAllObjects];
    [view pressesBegan:presses withEvent:nil];
    check([trace isEqual:@[@"dispatch:down"]]); check(winner.dispatches.lastObject[@"press"] == press);
    check(![winner.dispatches.lastObject[@"repeat"] boolValue]); responderCases++;
    [view pressesBegan:presses withEvent:nil]; check(winner.dispatches.count == 1); check(trace.count == 1); responderCases++;
    press.timestamp = 11; [view pressesBegan:presses withEvent:nil];
    check(winner.dispatches.count == 2); check([winner.dispatches.lastObject[@"repeat"] boolValue]); responderCases++;
    winner.identity = @{@"owner":@"replacement", @"epoch":@2}; press.timestamp = 12;
    [view pressesBegan:presses withEvent:nil]; check(winner.dispatches.count == 2);
    [view pressesEnded:presses withEvent:nil]; check(winner.dispatches.count == 2); check(router.held.count == 0); responderCases++;
    [trace removeAllObjects]; [winner.dispatches removeAllObjects];
    winner.captureDown = NO; press.timestamp = 13; [view pressesBegan:presses withEvent:nil];
    check([trace.firstObject isEqual:@"dispatch:down"]); check([trace.lastObject isEqual:@"default:down"]);
    check(winner.dispatches.count == 1); responderCases++;
    [trace removeAllObjects]; [view pressesCancelled:presses withEvent:nil];
    check([trace.firstObject isEqual:@"dispatch:cancel"]); check([trace.lastObject isEqual:@"default:cancel"]);
    check(router.held.count == 0); responderCases++;
    winner.captureDown = YES; press.timestamp = 14; [view pressesBegan:presses withEvent:nil];
    [trace removeAllObjects]; [view pressesEnded:presses withEvent:nil];
    check([trace isEqual:@[@"dispatch:up"]]); check(router.held.count == 0); responderCases++;
    NSUInteger count = winner.dispatches.count;
    press.window = foreign; check(!CUIHandleFieldResponderPress(view, press, @"down"));
    press.window = window; view.firstResponder = NO; check(!CUIHandleFieldResponderPress(view, press, @"down"));
    view.firstResponder = YES; window.active = NO; check(!CUIHandleFieldResponderPress(view, press, @"down"));
    window.active = YES; check(!CUIHandleFieldResponderPress(view, press, @"invented"));
    press.key = nil; check(!CUIHandleFieldResponderPress(view, press, @"down"));
    check(winner.dispatches.count == count); responderCases++;
    [trace removeAllObjects]; [CUIFieldWindows removeObjectForKey:window];
    [view pressesBegan:presses withEvent:nil]; check([trace.lastObject isEqual:@"default:down"]);
    check(winner.dispatches.count == count); [CUIFieldWindows setObject:router forKey:window]; responderCases++;
  }
  UIView *original = [UIView new]; original.window = window; original.firstResponder = YES;
  UIPress *cancelled = [UIPress new]; cancelled.key = [UIKey new]; cancelled.key.keyCode = 9; cancelled.window = window; cancelled.timestamp = 20;
  winner.onDispatch = ^{ [router retire]; };
  check(CUIHandleFieldResponderPress(original, cancelled, @"down"));
  check(router.held.count == 0); responderCases++;
  NSUInteger count = winner.dispatches.count;
  winner.member = NO; cancelled.timestamp = 21;
  check(!CUIHandleFieldResponderPress(original, cancelled, @"down")); check(winner.dispatches.count == count); responderCases++;
  winner.member = YES;
  UIPress *unrelated = [UIPress new]; NSSet *mixed = [NSSet setWithObjects:cancelled, unrelated, nil];
  check(RCTTextInputRemainingPresses(original, mixed, @"down", nil) == mixed); responderCases++;
  RCTTextInputPressHandler pass = ^BOOL(UIView *view, UIPress *press, NSString *phase) { (void)view; (void)press; (void)phase; return NO; };
  check(RCTTextInputRemainingPresses(original, mixed, @"down", pass) == mixed); responderCases++;
  NSSet *remaining = RCTTextInputRemainingPresses(original, mixed, @"down", ^BOOL(UIView *view, UIPress *press, NSString *phase) {
    check(view == original); check([phase isEqual:@"down"]); return press == cancelled;
  });
  check(remaining.count == 1 && remaining.anyObject == unrelated); check(mixed.count == 2); responderCases++;
  UIView<RCTBackedTextInputViewProtocol> *owned = [UIView new], *occupied = [UIView new];
  owned.nativeKeyPressHandler = router.editorHandler;
  RCTTextInputPressHandler other = ^BOOL(UIView *view, UIPress *press, NSString *phase) { (void)view; (void)press; (void)phase; return NO; };
  occupied.nativeKeyPressHandler = other; [router.editors addObject:owned]; [router.editors addObject:occupied];
  [router retire]; check(owned.nativeKeyPressHandler == nil); check(occupied.nativeKeyPressHandler == other);
  check(router.editors.count == 0 && router.records.count == 0 && router.held.count == 0); responderCases++;
  check([winner->_records.firstObject[@"stage"] isEqual:@"original-responder-entry"]);
  check([winner->_records.firstObject[@"receiverTarget"] integerValue] == 17);
  check([winner->_records.firstObject[@"nativeCode"] integerValue] == 82);
  check([winner->_records.firstObject[@"timestamp"] doubleValue] == 10); responderCases++;
}

int main() {
  @autoreleasepool {
    Binding *binding = [Binding new];
    binding->_registration = @{@"kind":@"binding-status", @"requestId":@"request:1", @"ownerToken":@"owner:1", @"metadataTarget":@17,
      @"ownerId":@"field:1", @"moduleLease":@"module:1", @"bindingId":@"binding:1", @"bindingRevision":@"revision:1",
      @"generation":@0, @"ready":@NO, @"error":@"awaiting-current-document"};
    binding->_status = binding->_registration; binding->_records = [NSMutableArray new]; binding->_metadata = [Metadata new];
    binding->_metadata.ownerId = @"field:1";
    NSMutableDictionary *declaration = [@{@"ownerId":@"field:1", @"moduleLease":@"module:1", @"bindingId":@"binding:1", @"bindingRevision":@"revision:1"} mutableCopy];
    binding->_metadata.fieldGroupBinding = encoded(declaration);
    [binding publishReadiness:NO error:@"original-read-changed-4-to-5"];
    check(binding->_records.count == 1); check([binding->_status[@"generation"] integerValue] == 1);
    [binding publishReadiness:NO error:@"original-read-changed-5-to-6"];
    check(binding->_records.count == 1); check([binding->_status[@"error"] isEqual:@"original-read-changed-4-to-5"]);
    [binding publishReadiness:YES error:@""];
    check(binding->_records.count == 2); check([binding->_status[@"ready"] boolValue]);
    declaration[@"bindingRevision"] = @"revision:2"; binding->_metadata.fieldGroupBinding = encoded(declaration);
    [binding publishReadiness:YES error:@""];
    check(binding->_records.count == 3); check([binding->_status[@"bindingRevision"] isEqual:@"revision:2"]);
    for (NSString *key in @[@"ownerId", @"moduleLease", @"bindingId"]) {
      NSMutableDictionary *foreign = [declaration mutableCopy]; foreign[key] = @"foreign"; foreign[@"bindingRevision"] = @"foreign-revision";
      binding->_metadata.fieldGroupBinding = encoded(foreign);
      [binding publishReadiness:NO error:@"original-retired"];
      check(![binding->_status[@"ready"] boolValue]); check([binding->_status[@"bindingRevision"] isEqual:@"revision:2"]);
      binding->_metadata.fieldGroupBinding = encoded(declaration); [binding publishReadiness:YES error:@""];
    }
    binding->_metadata.ownerId = @"foreign"; declaration[@"bindingRevision"] = @"foreign-revision";
    binding->_metadata.fieldGroupBinding = encoded(declaration); [binding publishReadiness:NO error:@"owner-retired"];
    check([binding->_status[@"bindingRevision"] isEqual:@"revision:2"]);
    binding->_metadata.fieldGroupBinding = @"[]"; [binding publishReadiness:NO error:@"malformed"];
    check([binding->_status[@"error"] isEqual:@"owner-retired"]);
    binding->_metadata.fieldGroupBinding = @"invalid"; [binding publishReadiness:NO error:@"malformed"];
    check([binding->_status[@"bindingRevision"] isEqual:@"revision:2"]);
    NSUInteger generation = 0;
    for (NSDictionary *record in binding->_records) {
      check([record[@"generation"] unsignedIntegerValue] == ++generation);
      check(record.count == 11); check([record[@"ownerToken"] isEqual:@"owner:1"]);
    }
    responderChecks();
    printf("{\"responderCases\":%lu,\"assertions\":%lu,\"nativeActions\":0}\n", (unsigned long)responderCases, (unsigned long)assertions);
  }
}
