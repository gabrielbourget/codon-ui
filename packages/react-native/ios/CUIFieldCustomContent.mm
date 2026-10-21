#import "CUIFieldCustomContent.h"
#import <React/RCTAssert.h>
#import <React/RCTUITextField.h>
#import <React/RCTUITextView.h>
#import <objc/runtime.h>

@interface CUIFieldCustomContentLease ()
@property (nonatomic, weak) UIView *editor;
@property (nonatomic, copy) NSArray<AXCustomContent *> *content;
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
  return base.count ? [base arrayByAddingObjectsFromArray:lease.content] : lease.content;
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
  self.content = @[];
}
@end

CUIFieldCustomContentLease *CUIBindFieldCustomContent(UIView *editor, NSArray<AXCustomContent *> *content)
{
  RCTAssertMainQueue();
  if (!editor || !content || ![content isKindOfClass:NSArray.class]) return nil;
  if (!CUIFieldContentLeases) {
    CUIFieldContentLeases = [NSMapTable weakToStrongObjectsMapTable];
    CUIFieldContentOriginals = [NSMutableDictionary dictionary];
  }
  for (id item in content) if (![item isKindOfClass:AXCustomContent.class]) return nil;
  if (!CUIFieldInstallCustomContent(object_getClass(editor))) return nil;
  [[CUIFieldContentLeases objectForKey:editor] retire];
  CUIFieldCustomContentLease *lease = [CUIFieldCustomContentLease new];
  lease.editor = editor;
  lease.content = [[NSArray alloc] initWithArray:content copyItems:YES];
  [CUIFieldContentLeases setObject:lease forKey:editor];
  return lease;
}
