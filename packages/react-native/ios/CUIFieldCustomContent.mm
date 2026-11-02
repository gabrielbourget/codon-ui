#import "CUIFieldCustomContent.h"
#import "CUIDateSegment.h"
#import <React/RCTAssert.h>

@interface CUIFieldCustomContentLease ()
@property (nonatomic, weak) UIView *editor;
@property (nonatomic, copy) NSArray<AXCustomContent *> *(^content)(void);
@property (nonatomic, copy) BOOL (^isCurrent)(void);
@end

static NSMapTable<UIView *, CUIFieldCustomContentLease *> *CUIFieldContentLeases;

static NSArray<AXCustomContent *> *CUIFieldReadCustomContent(UIView *target)
{
  RCTAssertMainQueue();
  CUIFieldCustomContentLease *lease = [CUIFieldContentLeases objectForKey:target];
  if (!lease) return @[];
  @try {
    if (!lease.isCurrent || !lease.isCurrent()) { [lease retire]; return @[]; }
    NSArray *content = lease.content ? lease.content() : nil;
    for (id item in content) if (![item isKindOfClass:AXCustomContent.class]) { [lease retire]; return @[]; }
    return content ?: @[];
  } @catch (NSException *retired) { [lease retire]; return @[]; }
}

@implementation CUIFieldCustomContentLease
- (void)retire
{
  RCTAssertMainQueue();
  UIView *editor = self.editor;
  if (editor && [CUIFieldContentLeases objectForKey:editor] == self)
    [CUIFieldContentLeases removeObjectForKey:editor];
  self.editor = nil;
  self.content = nil;
  self.isCurrent = nil;
}
@end

CUIFieldCustomContentLease *CUIBindLiveFieldCustomContent(UIView *editor, NSArray<AXCustomContent *> *(^content)(void), BOOL (^isCurrent)(void))
{
  RCTAssertMainQueue();
  if (!editor || !content || !isCurrent) return nil;
  if (!CUIFieldContentLeases) {
    CUIFieldContentLeases = [NSMapTable weakToStrongObjectsMapTable];
  }
  if (![editor isMemberOfClass:CUIDateSegment.class]) return nil;
  [[CUIFieldContentLeases objectForKey:editor] retire];
  CUIFieldCustomContentLease *lease = [CUIFieldCustomContentLease new];
  lease.editor = editor;
  lease.content = content;
  lease.isCurrent = isCurrent;
  [CUIFieldContentLeases setObject:lease forKey:editor];
  return lease;
}

NSArray<AXCustomContent *> *CUIReadOwnedDateFieldCustomContent(UIView *editor)
{
  return [editor isMemberOfClass:CUIDateSegment.class] ? CUIFieldReadCustomContent(editor) : @[];
}
