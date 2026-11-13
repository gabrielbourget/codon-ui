#import <Foundation/Foundation.h>
#import <objc/runtime.h>
#include <cmath>
#include <cstring>
#include <stdexcept>

#include "owned-geometry-comparison.inc"

static NSUInteger encodings = 0, assertions = 0, cases = 0;
static BOOL failEncoding = NO;
@interface NSJSONSerialization (GeometryContract)
+ (NSData *)contractDataWithJSONObject:(id)object options:(NSJSONWritingOptions)options error:(NSError **)error;
@end
@implementation NSJSONSerialization (GeometryContract)
+ (NSData *)contractDataWithJSONObject:(id)object options:(NSJSONWritingOptions)options error:(NSError **)error {
  encodings++;
  if (failEncoding) {
    failEncoding = NO;
    if (error) *error = [NSError errorWithDomain:@"geometry-contract" code:1 userInfo:nil];
    return nil;
  }
  return [self contractDataWithJSONObject:object options:options error:error];
}
@end

@class UIView;
@interface CADisplayLink : NSObject
- (void)invalidate;
@end
@interface GeometryContract : NSObject {
#include "owned-geometry-ivars.inc"
}
@property(nonatomic) BOOL attached;
@property(nonatomic, copy) NSDictionary *input;
@property(nonatomic, strong) NSMutableArray *events;
@property(nonatomic) NSUInteger sequence;
- (void)resetFrame;
- (void)configureOwner:(NSString *)owner binding:(NSString *)binding revision:(NSString *)revision observeFrames:(BOOL)frames;
- (void)captureKind:(NSString *)kind requestId:(NSString *)requestId transaction:(NSString *)transaction;
- (void)queryOwner:(NSString *)owner binding:(NSString *)binding requestId:(NSString *)requestId;
- (void)invalidate;
@end
@implementation GeometryContract
- (instancetype)init {
  if ((self = [super init])) {
    _attached = YES;
    _events = [NSMutableArray new];
    __weak GeometryContract *weakSelf = self;
    _emit = ^(NSDictionary *event) { [weakSelf.events addObject:[event copy]]; };
    [self configureOwner:@"owner" binding:@"binding" revision:@"1" observeFrames:YES];
  }
  return self;
}
- (void)synchronizeDisplayLink {}
- (NSDictionary *)snapshot { return self.input; }
- (NSMutableDictionary *)envelope:(NSString *)kind requestId:(NSString *)requestId transaction:(NSString *)transaction {
  return [@{@"attached": @(self.attached), @"kind": kind, @"requestId": requestId,
      @"transactionId": transaction, @"ownerId": _owner, @"bindingId": _binding,
      @"commitRevision": _revision, @"geometryRevision": @(++self.sequence)} mutableCopy];
}
#include "owned-geometry-methods.inc"
@end

static void check(BOOL condition, const char *message) {
  assertions++;
  if (!condition) throw std::runtime_error(message);
}
static NSDictionary *geometry(double position) {
  return @{@"layout": @[@(position), @0.0, @100.0, @40.0],
      @"presentation": @{@"quad": @[@(position), @0.0, @100.0, @40.0]},
      @"ancestors": @[@{@"identity": @"ancestor", @"clip": @{@"mask": NSNull.null}, @"visible": @YES}],
      @"mountObservationAvailable": @YES};
}
static void capture(GeometryContract *observer, NSString *kind) {
  [observer captureKind:kind requestId:@"" transaction:@""];
}
static void frame(GeometryContract *observer, NSDictionary *value) {
  observer.input = value;
  capture(observer, @"frame");
}
static NSString *encode(NSDictionary *value) {
  return [[NSString alloc] initWithData:[NSJSONSerialization dataWithJSONObject:value
      options:NSJSONWritingSortedKeys error:nullptr] encoding:NSUTF8StringEncoding];
}

int main(int argc, const char *argv[]) {
  const BOOL compatibilityOnly = argc == 2 && std::strcmp(argv[1], "--compatibility-only") == 0;
  @autoreleasepool {
    Method original = class_getClassMethod(NSJSONSerialization.class, @selector(dataWithJSONObject:options:error:));
    Method counted = class_getClassMethod(NSJSONSerialization.class, @selector(contractDataWithJSONObject:options:error:));
    method_exchangeImplementations(original, counted);
    GeometryContract *observer = [GeometryContract new];
    NSString *expected = encode(geometry(0));
    encodings = 0;
    frame(observer, geometry(0));
    frame(observer, geometry(0));
    check(observer.events.count == 1, "stable frames must still emit once");
    if (!compatibilityOnly) check(encodings == 1, "stable frames must skip repeated JSON encoding");
    check([observer.events[0][@"snapshot"] isEqual:expected], "encoded packet must remain byte-identical");
    check([observer.events[0][@"error"] isEqual:@""], "valid frame must retain empty error");
    check(observer.sequence == 2, "suppressed frames must retain envelope sequence behavior");
    cases++;

    frame(observer, geometry(1));
    check(observer.events.count == 2, "changed geometry must emit");
    if (!compatibilityOnly) check(encodings == 2, "changed geometry must encode");
    check([observer.events.lastObject[@"snapshot"] isEqual:encode(geometry(1))], "changed frame bytes must match sorted JSON");
    cases++;
    NSMutableDictionary *presentation = [geometry(1) mutableCopy];
    presentation[@"presentation"] = @{@"quad": @[@2.0, @0.0, @100.0, @40.0]};
    NSUInteger before = observer.events.count;
    frame(observer, presentation);
    check(observer.events.count == before + 1, "presentation-only motion must emit");
    cases++;

    // Explicit samples/mount events must not replace the frame cache or be suppressed.
    frame(observer, geometry(0));
    before = observer.events.count;
    encodings = 0;
    observer.input = geometry(8);
    [observer queryOwner:@"owner" binding:@"binding" requestId:@"query:1"];
    [observer queryOwner:@"other" binding:@"binding" requestId:@"query:ignored"];
    for (NSString *kind in @[@"mount-before", @"mount-after", @"sample"]) capture(observer, kind);
    frame(observer, geometry(0));
    check(observer.events.count == before + 4, "explicit samples must emit without replacing the last frame");
    if (!compatibilityOnly) check(encodings == 4, "only the repeated frame may skip encoding");
    check([observer.events[before][@"requestId"] isEqual:@"query:1"], "query identity must survive");
    cases++;

    before = observer.events.count;
    observer.attached = NO;
    capture(observer, @"frame");
    capture(observer, @"frame");
    capture(observer, @"detached");
    check(observer.events.count == before + 3, "repeated detached errors must not be suppressed");
    check([observer.events.lastObject[@"error"] isEqual:@"native-geometry-view-detached"], "detached error must survive");
    observer.attached = YES;
    frame(observer, geometry(0));
    check(observer.events.count == before + 4, "reattached geometry must emit after frame error");
    cases++;

    before = observer.events.count;
    for (NSNumber *invalid in @[@(NAN), @(INFINITY), @(-INFINITY)]) {
      frame(observer, @{@"layout": @[invalid]});
      frame(observer, @{@"layout": @[invalid]});
    }
    check(observer.events.count == before + 6, "invalid numeric frames must emit every error");
    check([observer.events.lastObject[@"snapshot"] isEqual:@""], "invalid frames must keep the empty snapshot");
    check([observer.events.lastObject[@"error"] isEqual:@"invalid-native-geometry"], "invalid geometry error must survive");
    frame(observer, geometry(0));
    check(observer.events.count == before + 7, "valid frame after invalid geometry must emit");
    cases++;

    before = observer.events.count;
    failEncoding = YES;
    frame(observer, geometry(9));
    check([observer.events.lastObject[@"error"] isEqual:@"invalid-native-geometry"], "serialization failure must emit error");
    frame(observer, geometry(0));
    check(observer.events.count == before + 2, "serialization failure must invalidate the earlier cached frame");
    cases++;

    for (NSArray *identity in @[@[@"owner:2", @"binding"], @[@"owner:2", @"binding:2"]]) {
      before = observer.events.count;
      [observer configureOwner:identity[0] binding:identity[1] revision:@"2" observeFrames:YES];
      frame(observer, geometry(0));
      check(observer.events.count == before + 1, "owner/binding changes must invalidate the cache");
      cases++;
    }
    before = observer.events.count;
    [observer configureOwner:@"owner:2" binding:@"binding:2" revision:@"3" observeFrames:YES];
    frame(observer, geometry(0));
    check(observer.events.count == before, "commit revision alone must retain existing suppression semantics");
    [observer configureOwner:@"owner:2" binding:@"binding:2" revision:@"3" observeFrames:NO];
    frame(observer, geometry(3));
    capture(observer, @"sample");
    check(observer.events.count == before + 1, "observation disabled must still allow explicit samples");
    [observer configureOwner:@"owner:2" binding:@"binding:2" revision:@"3" observeFrames:YES];
    frame(observer, geometry(0));
    check(observer.events.count == before + 2, "observation re-enable must invalidate the cache");
    cases++;
    before = observer.events.count;
    [observer resetFrame]; // The real envelope calls this on window/scope/epoch change.
    frame(observer, geometry(0));
    check(observer.events.count == before + 1, "attachment reset must invalidate the cache");
    [observer invalidate];
    frame(observer, geometry(0));
    check(observer.events.count == before + 1, "retired observer must emit nothing");
    cases++;

    #if CUI_GEOMETRY_CACHE_CONTRACT
    // Numeric equality must be conservative: Foundation considers YES and 1 equal,
    // and ordinary floating equality loses the sign of zero.
    for (NSArray *values in @[@[@YES, @1], @[@0.0, @(-0.0)], @[@1, @1.0], @[@0, @0.0]]) {
      NSDictionary *left = @{@"value": values[0]}, *right = @{@"value": values[1]};
      check(!CUIEqualGeometrySnapshot(left, right), "JSON-distinct numeric representation must not take the fast path");
      GeometryContract *numeric = [GeometryContract new];
      encodings = 0;
      frame(numeric, left);
      frame(numeric, right);
      check(encodings == 2, "changed numeric representation must reach the original encoder");
      BOOL sameJSON = [encode(left) isEqual:encode(right)];
      check(numeric.events.count == (sameJSON ? 1 : 2), "numeric events must retain original encoded-string suppression");
      cases++;
    }
    check(CUIEqualGeometrySnapshot(@{@"a": @[@1.0, NSNull.null], @"b": @YES},
        @{@"b": @YES, @"a": @[@1.0, NSNull.null]}), "dictionary insertion order must not matter");
    check(!CUIEqualGeometrySnapshot(@{@"a": @1}, @{@"b": @1}), "different keys must not compare equal");
    check(!CUIEqualGeometrySnapshot(@{@"a": @[@1, @2]}, @{@"a": @[@2, @1]}), "array order must matter");
    check(!CUIEqualGeometrySnapshot(@{@"a": @[@1]}, @{@"a": @[@1, @2]}), "array length must matter");
    check(!CUIEqualGeometrySnapshot(@{@"a": @"1"}, @{@"a": @1}), "string/number changes must matter");
    cases++;
    #endif
    method_exchangeImplementations(original, counted);
    NSDictionary *result = @{@"cases": @(cases), @"assertions": @(assertions), @"nativeActions": @0,
        @"performanceChecked": @(!compatibilityOnly), @"eventTrace": observer.events};
    NSData *data = [NSJSONSerialization dataWithJSONObject:result options:NSJSONWritingSortedKeys error:nullptr];
    puts([[[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] UTF8String]);
  }
}
