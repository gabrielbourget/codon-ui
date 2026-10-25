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

@interface UIWindow : NSObject
@property(nonatomic, copy) NSString *identity;
@property(nonatomic) BOOL active;
@end
@implementation UIWindow
@end
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
@interface CUIFieldKeyRecognizer : NSObject
@property(nonatomic, weak) UIWindow *view;
@property(nonatomic) BOOL enabled;
@property(nonatomic, copy) NSArray<NSNumber *> *allowedPressTypes;
@end
@implementation CUIFieldKeyRecognizer
@end
@interface CUIFieldInputWindow : NSObject
@property(nonatomic, weak) UIWindow *window;
@property(nonatomic, strong) CUIFieldKeyRecognizer *observer;
@property(nonatomic, strong) CUIFieldKeyRecognizer *veto;
@property(nonatomic, strong) NSMutableSet<NSString *> *observedKeyBoundaries;
@end
@implementation CUIFieldInputWindow
@end
@interface CUIFieldInputBinding : Binding
@property(nonatomic, weak) UIWindow *boundWindow;
@end
@implementation CUIFieldInputBinding
@end
static NSHashTable<CUIFieldInputBinding *> *CUIFieldInputs;
static NSString *CUIInputWindowIdentity(UIWindow *window) { return window.identity; }
static BOOL CUIFieldInputWindowActive(UIWindow *window) { return window.active; }
#include "owned-key-boundary.inc"

static NSUInteger assertions = 0;
static void check(BOOL value) {
  assertions++;
  if (!value) throw std::runtime_error("Binding readiness contract failed");
}
static NSString *encoded(NSDictionary *value) {
  return [[NSString alloc] initWithData:[NSJSONSerialization dataWithJSONObject:value options:0 error:nullptr] encoding:NSUTF8StringEncoding];
}
static void keyBoundaryChecks() {
  UIWindow *window = [UIWindow new]; window.identity = @"original-window"; window.active = YES;
  UIWindow *foreign = [UIWindow new]; foreign.identity = @"foreign-window";
  CUIFieldInputWindow *router = [CUIFieldInputWindow new]; router.window = window;
  router.observedKeyBoundaries = [NSMutableSet new];
  router.observer = [CUIFieldKeyRecognizer new]; router.observer.view = window; router.observer.enabled = YES;
  router.veto = [CUIFieldKeyRecognizer new]; router.veto.view = window; router.veto.enabled = YES;
  router.veto.allowedPressTypes = @[@0, @4];
  CUIFieldInputBinding *binding = [CUIFieldInputBinding new]; binding.boundWindow = foreign; binding->_records = [NSMutableArray new];
  CUIFieldInputs = [NSHashTable weakObjectsHashTable]; [CUIFieldInputs addObject:binding];
  CUIRecordFieldKeyBoundary(nil, @"installation", nil, nil);
  CUIRecordFieldKeyBoundary(router, @"installation", nil, nil);
  check(binding->_records.count == 0); check(router.observedKeyBoundaries.count == 0);
  binding.boundWindow = window;
  CUIRecordFieldKeyBoundary(router, @"installation", nil, nil);
  NSDictionary *installed = binding->_records.lastObject;
  check(binding->_records.count == 1); check([installed[@"windowId"] isEqual:window.identity]);
  check([installed[@"observerAttached"] boolValue] && [installed[@"vetoAttached"] boolValue]);
  check([installed[@"observerEnabled"] boolValue] && [installed[@"vetoEnabled"] boolValue]);
  check(installed[@"observerPressTypes"] == NSNull.null); check([installed[@"vetoPressTypes"] isEqual:@[@0, @4]]);
  check(![installed[@"hasOriginalPress"] boolValue]); check(installed[@"nativeCode"] == NSNull.null);
  UIPress *press = [UIPress new]; press.key = [UIKey new]; press.key.keyCode = 82; press.window = window; press.timestamp = 7.5;
  CUIRecordFieldKeyBoundary(router, @"delegate", press, nil);
  NSDictionary *original = binding->_records.lastObject;
  check([original[@"hasOriginalPress"] boolValue] && [original[@"hasOriginalKey"] boolValue]);
  check([original[@"pressWindowMatches"] boolValue]); check([original[@"nativeCode"] integerValue] == 82);
  check([original[@"timestamp"] doubleValue] == 7.5); check(![original[@"hasSelectedBinding"] boolValue]);
  for (NSUInteger index = 0; index < 100; index++) CUIRecordFieldKeyBoundary(router, @"delegate", press, binding);
  check(binding->_records.count == 2); check([binding->_records.lastObject isEqual:original]);
  CUIRecordFieldKeyBoundary(router, @"selection", press, binding);
  check([binding->_records.lastObject[@"hasSelectedBinding"] boolValue]);
  press.window = foreign; press.key = nil;
  CUIRecordFieldKeyBoundary(router, @"foreign", press, nil);
  check(![binding->_records.lastObject[@"pressWindowMatches"] boolValue]);
  check(![binding->_records.lastObject[@"hasOriginalKey"] boolValue]); check(binding->_records.lastObject[@"nativeCode"] == NSNull.null);
  NSUInteger count = binding->_records.count;
  router.window = nil; binding.boundWindow = nil;
  CUIRecordFieldKeyBoundary(router, @"retired", press, nil);
  check(binding->_records.count == count); check(![router.observedKeyBoundaries containsObject:@"retired"]);
  check(press.window == foreign && press.key == nil && press.timestamp == 7.5);
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
    keyBoundaryChecks();
    printf("{\"cases\":15,\"assertions\":%lu,\"nativeActions\":0}\n", (unsigned long)assertions);
  }
}
