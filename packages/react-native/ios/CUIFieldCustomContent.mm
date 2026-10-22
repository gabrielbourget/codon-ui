#import "CUIFieldCustomContent.h"
#import <React/RCTAssert.h>
#import <React/RCTUITextField.h>
#import <React/RCTUITextView.h>
#import <objc/runtime.h>

@interface CUIFieldCustomContentLease ()
@property (nonatomic, weak) UIView *editor;
@property (nonatomic, copy) NSArray<AXCustomContent *> *(^content)(void);
@property (nonatomic, copy) BOOL (^isCurrent)(void);
@end

static NSMapTable<UIView *, CUIFieldCustomContentLease *> *CUIFieldContentLeases;
static NSMutableDictionary<NSValue *, NSValue *> *CUIFieldContentOriginals;

static NSArray<AXCustomContent *> *CUIFieldReadCustomContent(id target, SEL selector)
{
  RCTAssertMainQueue();
  IMP original = (IMP)[CUIFieldContentOriginals[[NSValue valueWithPointer:(__bridge const void *)object_getClass(target)]] pointerValue];
  NSArray<AXCustomContent *> *base = original ? ((id (*)(id, SEL))original)(target, selector) : nil;
  CUIFieldCustomContentLease *lease = [CUIFieldContentLeases objectForKey:target];
  if (!lease) return base;
  @try {
    if (!lease.isCurrent || !lease.isCurrent()) { [lease retire]; return base; }
    NSArray *content = lease.content ? lease.content() : nil;
    for (id item in content) if (![item isKindOfClass:AXCustomContent.class]) { [lease retire]; return base; }
    return content.count ? (base.count ? [base arrayByAddingObjectsFromArray:content] : content) : base;
  } @catch (NSException *retired) { [lease retire]; return base; }
}

static BOOL CUIFieldInstallCustomContent(Class exactClass)
{
  if (exactClass != RCTUITextField.class && exactClass != RCTUITextView.class) return NO;
  NSValue *key = [NSValue valueWithPointer:(__bridge const void *)exactClass];
  if (CUIFieldContentOriginals[key]) return YES;
  SEL selector = @selector(accessibilityCustomContent);
  Method inherited = class_getInstanceMethod(exactClass, selector);
  IMP original = inherited ? method_getImplementation(inherited) : NULL;
  if (original == (IMP)CUIFieldReadCustomContent) return NO;
  const char *encoding = inherited ? method_getTypeEncoding(inherited) : "@@:";
  // Add an exact-class method before replacing it so an inherited UIKit
  // implementation is never modified for unrelated editor classes.
  if (!class_addMethod(exactClass, selector, (IMP)CUIFieldReadCustomContent, encoding)) {
    Method owned = class_getInstanceMethod(exactClass, selector);
    if (!owned) return NO;
    original = method_setImplementation(owned, (IMP)CUIFieldReadCustomContent);
  }
  CUIFieldContentOriginals[key] = [NSValue valueWithPointer:(const void *)original];
  class_addProtocol(exactClass, @protocol(AXCustomContentProvider));
  return YES;
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

CUIFieldCustomContentLease *CUIBindFieldCustomContent(UIView *editor, NSArray<AXCustomContent *> *content)
{
  RCTAssertMainQueue();
  if (!editor || ![content isKindOfClass:NSArray.class]) return nil;
  for (id item in content) if (![item isKindOfClass:AXCustomContent.class]) return nil;
  NSArray *copied = [[NSArray alloc] initWithArray:content copyItems:YES];
  return CUIBindLiveFieldCustomContent(editor, ^{ return copied; }, ^{ return YES; });
}

CUIFieldCustomContentLease *CUIBindLiveFieldCustomContent(UIView *editor, NSArray<AXCustomContent *> *(^content)(void), BOOL (^isCurrent)(void))
{
  RCTAssertMainQueue();
  if (!editor || !content || !isCurrent) return nil;
  if (!CUIFieldContentLeases) {
    CUIFieldContentLeases = [NSMapTable weakToStrongObjectsMapTable];
    CUIFieldContentOriginals = [NSMutableDictionary dictionary];
  }
  if (!CUIFieldInstallCustomContent(object_getClass(editor))) return nil;
  [[CUIFieldContentLeases objectForKey:editor] retire];
  CUIFieldCustomContentLease *lease = [CUIFieldCustomContentLease new];
  lease.editor = editor;
  lease.content = content;
  lease.isCurrent = isCurrent;
  [CUIFieldContentLeases setObject:lease forKey:editor];
  return lease;
}
