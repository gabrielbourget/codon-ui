#import "CUIVirtualDragAccessibility.h"
#import "CUIVirtualDragFocus.h"
#import "CUIInputWindow.h"
#import "CUIKeyboardScope.h"
#import <React/RCTViewComponentView.h>
#import <objc/runtime.h>

static NSMapTable<UIView *, id<CUIVirtualDragAccessibilitySource>> *CUISources;
static CUIVirtualDragFocus *CUIProjectionOwner(UIWindow *window) {
  CUIVirtualDragFocus *found=nil;
  for (UIView *scope in CUIInputScopes(window)) if ([scope isKindOfClass:CUIKeyboardScope.class]) {
    CUIVirtualDragFocus *candidate=[(CUIKeyboardScope *)scope virtualDragFocus];
    if (![candidate active]) continue;
    if (found && found!=candidate) {
      [found rejectAccessibilityProjection:@"native-virtual-accessibility-owners-ambiguous"];
      [candidate rejectAccessibilityProjection:@"native-virtual-accessibility-owners-ambiguous"];
    } else found=candidate;
  }
  return found;
}

static id<CUIVirtualDragAccessibilitySource> CUISource(UIView *view) {
  id<CUIVirtualDragAccessibilitySource> source=[CUISources objectForKey:view];
  return source && [source cuiAppliesVirtualDragAccessibilityProjection] ? source : nil;
}
BOOL CUIValidateVirtualDragAccessibilityView(UIView *view) {
  if (CUISource(view)) return YES;
  Class type=view.class;
  if ([view isKindOfClass:RCTViewComponentView.class]) {
    // Core Paragraph supplies original UIAccessibilityElement objects through its patched getter.
    if ([NSStringFromClass(type) isEqual:@"RCTParagraphComponentView"]) return YES;
    for (NSString *name in @[@"isAccessibilityElement", @"accessibilityElementsHidden", @"accessibilityElements"])
      if (class_getMethodImplementation(type,NSSelectorFromString(name)) != class_getMethodImplementation(RCTViewComponentView.class,NSSelectorFromString(name))) return NO;
    return ((RCTViewComponentView *)view).contentView==nil;
  }
  return NO;
}

@interface CUIVirtualDragAccessibilityReceiver : NSObject <RCTAccessibilityProjectionReceiver>
@end
@implementation CUIVirtualDragAccessibilityReceiver
- (RCTAccessibilityProjectionMode)accessibilityProjectionForView:(UIView *)view {
  CUIVirtualDragFocus *owner=CUIProjectionOwner(view.window);
  return owner ? [owner accessibilityModeForView:view] : RCTAccessibilityProjectionOriginal;
}
- (NSArray *)projectAccessibilityChildren:(NSArray *)children container:(id)container view:(UIView *)view {
  CUIVirtualDragFocus *owner=CUIProjectionOwner(view.window);
  if (!owner) return children;
  if ([owner accessibilityModeForView:view]==RCTAccessibilityProjectionExcluded) return @[];
  id<CUIVirtualDragAccessibilitySource> source=CUISource(view);
  NSMutableArray *result=[NSMutableArray new];
  for (id element in children) {
    UIView *original=nil;
    if ([element isKindOfClass:UIView.class]) original=element;
    else if (source) original=[source cuiOriginalViewForAccessibilityElement:element];
    else if ([NSStringFromClass(view.class) isEqual:@"RCTParagraphComponentView"] && [element isKindOfClass:UIAccessibilityElement.class]) original=view;
    if (!original || original.window!=view.window || (original!=view && ![original isDescendantOfView:view])) {
      [owner rejectAccessibilityProjection:@"native-virtual-accessibility-original-node-unregistered"];
      return @[];
    }
    if ([owner accessibilityModeForView:original]==RCTAccessibilityProjectionAllowed && !CUIValidateVirtualDragAccessibilityView(original)) {
      [owner rejectAccessibilityProjection:@"native-virtual-accessibility-opaque-source-unregistered"];
      return @[];
    }
    if ([owner accessibilityModeForView:original]!=RCTAccessibilityProjectionExcluded) [result addObject:element];
  }
  return result;
}
@end

void CUIInstallVirtualDragAccessibilityProjection(void) {
  static CUIVirtualDragAccessibilityReceiver *receiver;
  static dispatch_once_t once;
  dispatch_once(&once, ^{ receiver=[CUIVirtualDragAccessibilityReceiver new]; });
  if (!RCTRegisterAccessibilityProjectionReceiver(receiver))
    @throw [NSException exceptionWithName:NSInternalInconsistencyException reason:@"Native virtual accessibility receiver already owned" userInfo:nil];
}
void CUIRegisterVirtualDragAccessibilitySource(UIView *view,id<CUIVirtualDragAccessibilitySource> source) {
  NSCAssert(NSThread.isMainThread,@"Native accessibility sources require the main thread");
  if (!view || !source || ![source cuiAppliesVirtualDragAccessibilityProjection])
    @throw [NSException exceptionWithName:NSInvalidArgumentException reason:@"Complete native accessibility source required" userInfo:nil];
  if (!CUISources) CUISources=[NSMapTable weakToWeakObjectsMapTable];
  id previous=[CUISources objectForKey:view];
  if (previous && previous!=source) @throw [NSException exceptionWithName:NSInvalidArgumentException reason:@"Original native accessibility source already owned" userInfo:nil];
  [CUISources setObject:source forKey:view]; CUIInstallVirtualDragAccessibilityProjection();
}
void CUIUnregisterVirtualDragAccessibilitySource(UIView *view,id<CUIVirtualDragAccessibilitySource> source) {
  if ([CUISources objectForKey:view]==source) [CUISources removeObjectForKey:view];
}
BOOL CUIProjectVirtualDragAccessibilityElement(UIView *view,BOOL original) { return RCTProjectAccessibilityElement(view,original); }
BOOL CUIProjectVirtualDragAccessibilityHidden(UIView *view,BOOL original) { return RCTProjectAccessibilityHidden(view,original); }
NSArray *CUIProjectVirtualDragAccessibilityChildren(UIView *view,id container,NSArray *original) { return RCTProjectAccessibilityChildren(view,container,original); }
BOOL CUIAllowsVirtualDragInteraction(UIView *view) {
  CUIVirtualDragFocus *owner=CUIActiveVirtualDragFocus(view.window);
  return owner ? [owner allowsInteractionWithView:view] : YES;
}
