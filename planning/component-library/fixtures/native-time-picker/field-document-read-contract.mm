#import <Foundation/Foundation.h>
#include <stdexcept>
#include <string>
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
    printf("{\"cases\":7,\"assertions\":%lu,\"nativeActions\":0}\n", (unsigned long)assertions);
  }
}
