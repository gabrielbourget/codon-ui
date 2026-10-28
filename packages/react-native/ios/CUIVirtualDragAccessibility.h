#import <UIKit/UIKit.h>
#import <React/RCTAccessibilityProjection.h>

NS_ASSUME_NONNULL_BEGIN

// Opaque producers retain their original nodes, ordering, actions and defaults. Their final
// native getters call the projection functions below, including for cached original nodes.
@protocol CUIVirtualDragAccessibilitySource <NSObject>
- (BOOL)cuiAppliesVirtualDragAccessibilityProjection;
- (nullable UIView *)cuiOriginalViewForAccessibilityElement:(id)element;
@end

FOUNDATION_EXPORT void CUIRegisterVirtualDragAccessibilitySource(UIView *view, id<CUIVirtualDragAccessibilitySource> source);
FOUNDATION_EXPORT void CUIUnregisterVirtualDragAccessibilitySource(UIView *view, id<CUIVirtualDragAccessibilitySource> source);
FOUNDATION_EXPORT BOOL CUIProjectVirtualDragAccessibilityElement(UIView *view, BOOL original);
FOUNDATION_EXPORT BOOL CUIProjectVirtualDragAccessibilityHidden(UIView *view, BOOL original);
FOUNDATION_EXPORT NSArray *_Nullable CUIProjectVirtualDragAccessibilityChildren(UIView *view, id container, NSArray *_Nullable original);
FOUNDATION_EXPORT BOOL CUIAllowsVirtualDragInteraction(UIView *view);
FOUNDATION_EXPORT void CUIInstallVirtualDragAccessibilityProjection(void);
FOUNDATION_EXPORT BOOL CUIValidateVirtualDragAccessibilityView(UIView *view);

NS_ASSUME_NONNULL_END
