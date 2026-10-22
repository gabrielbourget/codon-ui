#import "CUIFormMetadata.h"
#import <React/RCTSurfacePresenter.h>
#import <React/RCTTextInputComponentView.h>
#import "CUIDateSegment.h"

id<CUIFieldSemanticContribution> CUIBindFieldSemantics(
    RCTSurfacePresenter *presenter, RCTTextInputComponentView *core, NSDictionary *plan, BOOL (^isCurrent)(void));
id<CUIFieldSemanticContribution> CUIBindDateFieldSemantics(
    RCTSurfacePresenter *presenter, NSArray<CUIDateSegment *> *segments, NSDictionary *plan, BOOL (^isCurrent)(void));
NSString *CUIReadOwnedDateFieldText(UIView *editor, NSString *base, BOOL hint);
