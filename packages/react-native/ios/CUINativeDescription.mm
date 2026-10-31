#import "CUINativeDescription.h"
#import "CUIAccessibilityReferences.h"
#import <Accessibility/Accessibility.h>
#import <React/RCTViewComponentView.h>
#import <objc/runtime.h>

@class CUINativeDescription;
@interface CUINativeDescriptionState : NSObject
@property(nonatomic, assign) Class originalClass;
@property(nonatomic, assign) Class adapterClass;
@property(nonatomic, strong) NSMutableArray<CUINativeDescription *> *bindings;
@property(nonatomic, copy) NSArray<AXCustomContent *> *authored;
@end
@implementation CUINativeDescriptionState
@end

static const void *CUIDescriptionStateKey = &CUIDescriptionStateKey;
@interface CUINativeDescription ()
@property(nonatomic, weak) UIView *element;
@property(nonatomic, weak) UIView *descriptionView;
@property(nonatomic, copy) NSString *label;
@end

static NSArray<AXCustomContent *> *CUIDescriptionContent(id element, SEL selector)
{
  CUINativeDescriptionState *state = objc_getAssociatedObject(element, CUIDescriptionStateKey);
  Method inherited = class_getInstanceMethod(state.originalClass, selector);
  NSArray *original = inherited ? ((NSArray *(*)(id, SEL))method_getImplementation(inherited))(element, selector) : state.authored;
  NSMutableArray *content = original ? [original mutableCopy] : [NSMutableArray array];
  // Most recent live lease wins; caller-owned supplementary content remains in its original order.
  for (CUINativeDescription *binding in state.bindings.reverseObjectEnumerator) {
    UIView *source = binding.element, *description = binding.descriptionView;
    if (!source.window || description.window != source.window || [source.window viewWithTag:description.tag] != description) continue;
    NSString *text = CUIAccessibilityResolve(source, @[], description.tag, YES);
    if (text != nil) { [content addObject:[AXCustomContent customContentWithLabel:binding.label value:text]]; break; }
  }
  return content;
}
static void CUISetDescriptionContent(id element, SEL selector, NSArray *content)
{
  CUINativeDescriptionState *state = objc_getAssociatedObject(element, CUIDescriptionStateKey);
  Method inherited = class_getInstanceMethod(state.originalClass, selector);
  if (inherited) ((void (*)(id, SEL, NSArray *))method_getImplementation(inherited))(element, selector, content);
  else state.authored = content;
}
static Class CUIDescriptionAdapterClass(Class original)
{
  // Like per-instance observation, only the leased element adopts the subclass. RN and UIKit classes are never patched.
  NSString *name = [@"CUISupplementary_" stringByAppendingString:NSStringFromClass(original)];
  Class adapter = NSClassFromString(name);
  if (adapter) return adapter;
  adapter = objc_allocateClassPair(original, name.UTF8String, 0);
  class_addProtocol(adapter, @protocol(AXCustomContentProvider));
  class_addMethod(adapter, @selector(accessibilityCustomContent), (IMP)CUIDescriptionContent, "@@:");
  class_addMethod(adapter, @selector(setAccessibilityCustomContent:), (IMP)CUISetDescriptionContent, "v@:@");
  objc_registerClassPair(adapter);
  return adapter;
}

@implementation CUINativeDescription
- (void)bindTarget:(UIView *)target description:(UIView *)description label:(NSString *)label
{
  UIView *element = target;
  if ([target isKindOfClass:RCTViewComponentView.class]) {
    NSObject *accessible = ((RCTViewComponentView *)target).accessibilityElement;
    if ([accessible isKindOfClass:UIView.class]) element = (UIView *)accessible;
  }
  if (!element.window || element.window != description.window) { [self invalidate]; return; }
  if (self.element == element && self.descriptionView == description && [self.label isEqualToString:label]) return;
  [self invalidate];
  self.element = element; self.descriptionView = description; self.label = label;
  CUINativeDescriptionState *state = objc_getAssociatedObject(element, CUIDescriptionStateKey);
  if (!state) {
    state = [CUINativeDescriptionState new]; state.originalClass = object_getClass(element);
    state.adapterClass = CUIDescriptionAdapterClass(state.originalClass); state.bindings = [NSMutableArray array];
    objc_setAssociatedObject(element, CUIDescriptionStateKey, state, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    object_setClass(element, state.adapterClass);
  }
  [state.bindings addObject:self];
}
- (void)invalidate
{
  UIView *element = self.element;
  CUINativeDescriptionState *state = element ? objc_getAssociatedObject(element, CUIDescriptionStateKey) : nil;
  [state.bindings removeObjectIdenticalTo:self];
  if (state && !state.bindings.count) {
    // A foreign observer may have subsequently subclassed the instance. Never remove its class or behavior.
    if (object_getClass(element) == state.adapterClass && !state.authored.count) {
      object_setClass(element, state.originalClass);
      objc_setAssociatedObject(element, CUIDescriptionStateKey, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    }
  }
  self.element = nil; self.descriptionView = nil;
}
- (void)dealloc { [self invalidate]; }
@end
