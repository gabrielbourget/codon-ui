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

static NSUInteger assertions = 0;
static void check(BOOL value) {
  assertions++;
  if (!value) throw std::runtime_error("Binding readiness contract failed");
}
static NSString *encoded(NSDictionary *value) {
  return [[NSString alloc] initWithData:[NSJSONSerialization dataWithJSONObject:value options:0 error:nullptr] encoding:NSUTF8StringEncoding];
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
    printf("{\"cases\":9,\"assertions\":%lu,\"nativeActions\":0}\n", (unsigned long)assertions);
  }
}
