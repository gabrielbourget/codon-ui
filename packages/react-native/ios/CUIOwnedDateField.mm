#import "CUIOwnedDateField.h"
#import "CUIInputWindow.h"
#import <cmath>

static BOOL CUIDatePositiveInteger(id value, BOOL tag)
{
  if (![value isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)value) == CFBooleanGetTypeID()) return NO;
  double number = [value doubleValue];
  return std::isfinite(number) && number > 0 && std::floor(number) == number && number <= (tag ? INT_MAX : 9007199254740991.0);
}
static void CUICollectDateSegments(UIView *view, NSString *owner, NSMutableArray<CUIDateSegment *> *segments)
{
  if ([view isKindOfClass:CUIDateSegment.class] && [[(CUIDateSegment *)view fieldOwnerId] isEqual:owner]) [segments addObject:(CUIDateSegment *)view];
  for (UIView *child in view.subviews) CUICollectDateSegments(child, owner, segments);
}
NSArray<CUIDateSegment *> *CUIResolveOwnedDateFieldSegments(UIView *metadata, NSString *binding, NSInteger primaryTarget, NSInteger surface)
{
  @try {
    if (!metadata.window || !binding.length || surface <= 0) return nil;
    id value = [NSJSONSerialization JSONObjectWithData:[binding dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    if (![value isKindOfClass:NSDictionary.class] || ![value[@"kind"] isEqual:@"date-field"] ||
        !CUIDatePositiveInteger(value[@"rootTarget"], YES) || ![value[@"segments"] isKindOfClass:NSArray.class] ||
        ![value[@"segments"] count]) return nil;
    UIView *root = [metadata.window viewWithTag:[value[@"rootTarget"] integerValue]];
    if (!root || root == metadata || ![metadata isDescendantOfView:root] ||
        ![root isKindOfClass:RCTViewComponentView.class] || [root isKindOfClass:CUIDateSegment.class]) return nil;
    NSArray *expected = value[@"segments"];
    id first = expected.firstObject;
    if (![first isKindOfClass:NSDictionary.class] || ![first[@"ownerId"] isKindOfClass:NSString.class] || ![first[@"ownerId"] length]) return nil;
    NSMutableArray<CUIDateSegment *> *originals = [NSMutableArray new]; CUICollectDateSegments(root, first[@"ownerId"], originals);
    if (originals.count != expected.count || originals.firstObject.tag != primaryTarget) return nil;
    NSMutableSet *ids = [NSMutableSet new], *targets = [NSMutableSet new];
    NSString *owner = nil, *window = CUIInputWindowIdentity(metadata.window);
    for (NSUInteger index = 0; index < expected.count; index++) {
      id row = expected[index]; CUIDateSegment *original = originals[index];
      if (![row isKindOfClass:NSDictionary.class] || [row count] != 8) return nil;
      for (NSString *key in @[@"ownerId", @"segmentId", @"bindingRevision", @"nativeInstance", @"windowId"])
        if (![row[key] isKindOfClass:NSString.class] || ![row[key] length]) return nil;
      if (!CUIDatePositiveInteger(row[@"target"], YES) || !CUIDatePositiveInteger(row[@"surfaceId"], YES) ||
          !CUIDatePositiveInteger(row[@"epoch"], NO) || [row[@"surfaceId"] integerValue] != surface ||
          ![row[@"windowId"] isEqual:window] || original.window != metadata.window ||
          (owner && ![owner isEqual:row[@"ownerId"]]) || [ids containsObject:row[@"segmentId"]] ||
          [targets containsObject:row[@"target"]] || ![[original formSegmentIdentity] isEqual:row]) return nil;
      owner = row[@"ownerId"]; [ids addObject:row[@"segmentId"]]; [targets addObject:row[@"target"]];
    }
    id groups = value[@"groups"];
    if (groups) {
      if (![groups isKindOfClass:NSArray.class] || ([groups count] != 1 && [groups count] != 2)) return nil;
      NSMutableSet *groupTargets = [NSMutableSet new]; NSUInteger offset = 0;
      for (NSUInteger index = 0; index < [groups count]; index++) {
        id group = groups[index]; NSString *slot = [groups count] == 1 ? @"value" : index == 0 ? @"start" : @"end";
        if (![group isKindOfClass:NSDictionary.class] || [group count] != 3 || ![group[@"slot"] isEqual:slot] ||
            !CUIDatePositiveInteger(group[@"target"], YES) || ![group[@"segmentIds"] isKindOfClass:NSArray.class] ||
            ![group[@"segmentIds"] count] || [groupTargets containsObject:group[@"target"]] || [targets containsObject:group[@"target"]]) return nil;
        UIView *groupRoot = [metadata.window viewWithTag:[group[@"target"] integerValue]];
        if (!groupRoot || groupRoot == root || ![groupRoot isKindOfClass:RCTViewComponentView.class] ||
            ![groupRoot isDescendantOfView:root] || groupRoot.window != metadata.window) return nil;
        [groupTargets addObject:group[@"target"]];
        NSMutableArray<CUIDateSegment *> *members = [NSMutableArray new]; CUICollectDateSegments(groupRoot, owner, members);
        NSArray *segmentIds = group[@"segmentIds"];
        if (members.count != segmentIds.count || offset + members.count > originals.count) return nil;
        for (NSUInteger member = 0; member < members.count; member++) {
          if (members[member] != originals[offset + member] || ![segmentIds[member] isKindOfClass:NSString.class] ||
              ![segmentIds[member] isEqual:expected[offset + member][@"segmentId"]]) return nil;
        }
        offset += members.count;
      }
      if (offset != originals.count) return nil;
    }
    return [originals copy];
  } @catch (NSException *retired) { return nil; }
}
CUIDateSegment *CUIResolveOwnedDateField(UIView *metadata, NSString *binding, NSInteger primaryTarget, NSInteger surface)
{
  return CUIResolveOwnedDateFieldSegments(metadata, binding, primaryTarget, surface).firstObject;
}
