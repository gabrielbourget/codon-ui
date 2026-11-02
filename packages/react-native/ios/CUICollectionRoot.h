#import <React/RCTViewComponentView.h>

@interface CUICollectionOptionAdmission : NSObject
@property(nonatomic, readonly) UIView *originalOption;
@property(nonatomic, readonly) NSString *opaqueFocusIdentity;
- (BOOL)current;
@end

@interface CUICollectionRoot : RCTViewComponentView
+ (BOOL)acceptsCurrentBinding:(NSString *)binding original:(UIView *)original;
@end

CUICollectionOptionAdmission *CUIResolveCurrentCollectionOption(NSString *binding, NSInteger target, UIView *editor, BOOL (^currentFieldGuard)(void));
void CUICollectionOriginalDidChange(UIView *original);
