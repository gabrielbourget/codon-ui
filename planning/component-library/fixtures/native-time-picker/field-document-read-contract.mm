#import <Foundation/Foundation.h>
#include <stdexcept>
#include <string>
#include <functional>
#include <vector>
#include "owned-read-difference.inc"

static NSUInteger assertions = 0;
static void check(BOOL condition) {
  assertions++;
  if (!condition) throw std::runtime_error("Document read diagnostic contract failed");
}
static NSDictionary *difference(const std::string &before, const std::string &after) {
  NSString *encoded = CUIFieldInputReadDifference(before, after);
  return [NSJSONSerialization JSONObjectWithData:[encoded dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nullptr];
}
int main() {
  @autoreleasepool {
    const std::string before = R"({"documentId":"document:1","surfaceId":11,"rootTarget":1,"revision":"41","nodes":[{"target":3}],"fieldGroup":{"inputTarget":3}})";
    const std::string reordered = R"({"fieldGroup":{"inputTarget":3},"nodes":[{"target":3}],"revision":"41","rootTarget":1,"surfaceId":11,"documentId":"document:1"})";
    NSDictionary *same = difference(before, before), *order = difference(before, reordered);
    check([same[@"structuralEqual"] boolValue]);
    check([same[@"changedTopLevelKeys"] count] == 0);
    check([order[@"structuralEqual"] boolValue]);
    check([order[@"changedTopLevelKeys"] count] == 0);
    check([order[@"before"] isEqual:order[@"after"]]);
    check(![order.allKeys containsObject:@"nodes"]);
    const auto changed = [&](NSString *key, id value) {
      NSMutableDictionary *data = [[NSJSONSerialization JSONObjectWithData:[@(before.c_str()) dataUsingEncoding:NSUTF8StringEncoding] options:NSJSONReadingMutableContainers error:nullptr] mutableCopy];
      data[key] = value;
      NSData *encoded = [NSJSONSerialization dataWithJSONObject:data options:NSJSONWritingSortedKeys error:nullptr];
      return difference(before, std::string([[[NSString alloc] initWithData:encoded encoding:NSUTF8StringEncoding] UTF8String]));
    };
    NSDictionary *revision = changed(@"revision", @"42");
    check(![revision[@"structuralEqual"] boolValue]);
    check([revision[@"changedTopLevelKeys"] isEqual:@[@"revision"]]);
    check([revision[@"before"][@"revision"] isEqual:@"41"]);
    check([revision[@"after"][@"revision"] isEqual:@"42"]);
    NSDictionary *nodes = changed(@"nodes", @[@{@"target":@4}]);
    check([nodes[@"changedTopLevelKeys"] isEqual:@[@"nodes"]]);
    check([nodes[@"before"] isEqual:nodes[@"after"]]);
    NSDictionary *group = changed(@"fieldGroup", @{@"inputTarget":@4});
    check([group[@"changedTopLevelKeys"] isEqual:@[@"fieldGroup"]]);
    NSDictionary *added = changed(@"newOwnedKey", @YES);
    check([added[@"changedTopLevelKeys"] isEqual:@[@"newOwnedKey"]]);
    NSDictionary *removed = difference(before, R"({"documentId":"document:1","surfaceId":11,"rootTarget":1,"revision":"41","nodes":[{"target":3}]})");
    check([removed[@"changedTopLevelKeys"] isEqual:@[@"fieldGroup"]]);
    NSUInteger cases = 7;
    const auto revise = [&](const std::string &source, NSString *key, id value) {
      NSMutableDictionary *data = [NSJSONSerialization JSONObjectWithData:[@(source.c_str()) dataUsingEncoding:NSUTF8StringEncoding] options:NSJSONReadingMutableContainers error:nullptr];
      data[key] = value;
      NSData *encoded = [NSJSONSerialization dataWithJSONObject:data options:NSJSONWritingSortedKeys error:nullptr];
      return std::string([[[NSString alloc] initWithData:encoded encoding:NSUTF8StringEncoding] UTF8String]);
    };
    const std::string next = revise(before, @"revision", @"42"), later = revise(before, @"revision", @"43");
    check(CUIFieldInputOnlyRevisionChanged(before, next));
    check(!CUIFieldInputOnlyRevisionChanged(before, before));
    check(!CUIFieldInputOnlyRevisionChanged(before, reordered));
    check(!CUIFieldInputOnlyRevisionChanged(before, revise(before, @"revision", @42)));
    cases++;
    NSObject *original = [NSObject new];
    NSUInteger queries = 0, reads = 0;
    NSMutableArray *observedRevisions = [NSMutableArray new];
    const auto readOriginals = [&](NSDictionary *document) -> NSDictionary * {
      reads++;
      [observedRevisions addObject:document[@"revision"]];
      return @{@"original":original, @"observedRevision":document[@"revision"], @"read":@(reads)};
    };
    NSDictionary *stable = CUIReadCoherentFieldInputDocument([&] { queries++; return before; }, readOriginals);
    check(queries == 2 && reads == 1);
    check([stable[@"encodedDocument"] isEqual:@(before.c_str())]);
    check(stable[@"fieldGroupSnapshot"][@"original"] == original);
    check([stable[@"fieldGroupSnapshot"][@"observedRevision"] isEqual:@"41"]);
    cases++;
    queries = 0; reads = 0; [observedRevisions removeAllObjects];
    const std::vector<std::string> singlePublication{before, next, next};
    NSDictionary *coherent = CUIReadCoherentFieldInputDocument([&] {
      check(queries < singlePublication.size()); return singlePublication[queries++];
    }, readOriginals);
    check(queries == 3 && reads == 2);
    check([observedRevisions isEqual:@[@"41", @"42"]]);
    check([coherent[@"revision"] isEqual:@"42"]);
    check([coherent[@"encodedDocument"] isEqual:@(next.c_str())]);
    check([coherent[@"fieldGroupSnapshot"][@"read"] unsignedIntegerValue] == 2);
    check([coherent[@"fieldGroupSnapshot"][@"observedRevision"] isEqual:coherent[@"revision"]]);
    check(coherent[@"fieldGroupSnapshot"][@"original"] == original);
    check(before.find("41") != std::string::npos);
    cases++;
    const auto reject = [&](const std::vector<std::string> &publications, NSUInteger expectedQueries, NSUInteger expectedReads) {
      cases++;
      queries = 0; reads = 0;
      BOOL rejected = NO;
      @try {
        CUIReadCoherentFieldInputDocument([&] {
          check(queries < publications.size()); return publications[queries++];
        }, readOriginals);
      } @catch (NSException *error) {
        rejected = [error.reason hasPrefix:@"field-input-document-retired-during-read "];
      }
      check(rejected && queries == expectedQueries && reads == expectedReads);
    };
    reject({before, next, later}, 3, 2);
    reject({before, revise(next, @"nodes", @[@{@"target":@4}])}, 2, 1);
    reject({before, revise(next, @"fieldGroup", @{@"inputTarget":@4})}, 2, 1);
    reject({before, revise(next, @"documentId", @"replacement-document")}, 2, 1);
    reject({before, revise(next, @"surfaceId", @12)}, 2, 1);
    reject({before, revise(next, @"rootTarget", @2)}, 2, 1);
    reject({before, next, revise(next, @"nodes", @[])}, 3, 2);
    reject({before, reordered}, 2, 1);
    queries = 0; reads = 0;
    BOOL queryFailure = NO;
    try {
      CUIReadCoherentFieldInputDocument([&]() -> std::string {
        if (++queries == 2) throw std::runtime_error("original-module-retired");
        return before;
      }, readOriginals);
    } catch (const std::runtime_error &error) { queryFailure = std::string(error.what()) == "original-module-retired"; }
    check(queryFailure && queries == 2 && reads == 1);
    cases++;
    queries = 0;
    BOOL originalFailure = NO;
    @try {
      CUIReadCoherentFieldInputDocument([&] { queries++; return before; }, [](NSDictionary *) -> NSDictionary * {
        @throw [NSException exceptionWithName:@"OriginalSDK" reason:@"original-editor-retired" userInfo:nil];
      });
    } @catch (NSException *error) { originalFailure = [error.reason isEqual:@"original-editor-retired"]; }
    check(originalFailure && queries == 1);
    cases++;
    queries = 0;
    BOOL missingOriginal = NO;
    @try {
      CUIReadCoherentFieldInputDocument([&] { queries++; return before; }, [](NSDictionary *) -> NSDictionary * { return nil; });
    } @catch (NSException *error) { missingOriginal = [error.reason isEqual:@"field-input-snapshot-unavailable"]; }
    check(missingOriginal && queries == 1);
    cases++;
    printf("{\"cases\":%lu,\"assertions\":%lu,\"nativeActions\":0}\n", (unsigned long)cases, (unsigned long)assertions);
  }
}
