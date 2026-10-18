#import "CUIInputWindow.h"
#import <objc/runtime.h>

@interface CUIWindowInputState : NSObject
@property(nonatomic, copy) NSString *identity;
@property(nonatomic, copy) NSString *modality;
@property(nonatomic, strong) NSHashTable<UIView *> *scopes;
@property(nonatomic, assign) NSInteger policyOrder;
@end
@implementation CUIWindowInputState
@end

static const void *CUIWindowInputKey = &CUIWindowInputKey;
static CUIWindowInputState *CUIWindowInput(UIWindow *window)
{
  if (!window) return nil;
  CUIWindowInputState *state = objc_getAssociatedObject(window, CUIWindowInputKey);
  if (!state) {
    state = [CUIWindowInputState new];
    state.identity = NSUUID.UUID.UUIDString;
    state.modality = @"unknown";
    state.scopes = NSHashTable.weakObjectsHashTable;
    objc_setAssociatedObject(window, CUIWindowInputKey, state, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }
  return state;
}

NSString *CUIInputWindowIdentity(UIWindow *window) { return CUIWindowInput(window).identity ?: @""; }
NSString *CUIInputWindowModality(UIWindow *window) { return CUIWindowInput(window).modality ?: @"unknown"; }
void CUIRecordWindowModality(UIWindow *window, NSString *modality) { CUIWindowInput(window).modality = modality; }
void CUIRegisterInputScope(UIWindow *window, UIView *scope) { [CUIWindowInput(window).scopes addObject:scope]; }
void CUIUnregisterInputScope(UIWindow *window, UIView *scope) { [CUIWindowInput(window).scopes removeObject:scope]; }
NSArray<UIView *> *CUIInputScopes(UIWindow *window) { return CUIWindowInput(window).scopes.allObjects ?: @[]; }
NSInteger CUINextInputPolicyOrder(UIWindow *window)
{
  CUIWindowInputState *state = CUIWindowInput(window);
  state.policyOrder++;
  return state.policyOrder;
}

NSString *CUIInputKeyName(UIKey *key)
{
  switch (key.keyCode) {
    case UIKeyboardHIDUsageKeyboardReturnOrEnter:
    case UIKeyboardHIDUsageKeypadEnter: return @"Enter";
    case UIKeyboardHIDUsageKeyboardEscape: return @"Escape";
    case UIKeyboardHIDUsageKeyboardTab: return @"Tab";
    case UIKeyboardHIDUsageKeyboardDeleteOrBackspace: return @"Backspace";
    case UIKeyboardHIDUsageKeyboardDeleteForward: return @"Delete";
    case UIKeyboardHIDUsageKeyboardRightArrow: return @"ArrowRight";
    case UIKeyboardHIDUsageKeyboardLeftArrow: return @"ArrowLeft";
    case UIKeyboardHIDUsageKeyboardDownArrow: return @"ArrowDown";
    case UIKeyboardHIDUsageKeyboardUpArrow: return @"ArrowUp";
    case UIKeyboardHIDUsageKeyboardHome: return @"Home";
    case UIKeyboardHIDUsageKeyboardEnd: return @"End";
    case UIKeyboardHIDUsageKeyboardPageUp: return @"PageUp";
    case UIKeyboardHIDUsageKeyboardPageDown: return @"PageDown";
    case UIKeyboardHIDUsageKeyboardSpacebar: return @" ";
    default: return key.characters.length ? key.characters : @"Unidentified";
  }
}

NSString *CUIInputKeyToken(UIKey *key)
{
  UIKeyModifierFlags flags = key.modifierFlags;
  return [NSString stringWithFormat:@"%d%d%d%d:%@", !!(flags & UIKeyModifierShift),
      !!(flags & UIKeyModifierAlternate), !!(flags & UIKeyModifierControl),
      !!(flags & UIKeyModifierCommand), CUIInputKeyName(key)];
}
