#import "CUIFormMetadata.h"
#import <React/RCTSurfacePresenter.h>
#import <React/RCTTextInputComponentView.h>

id<CUIFieldSemanticContribution> CUIBindFieldSemantics(
    RCTSurfacePresenter *presenter, RCTTextInputComponentView *core, NSDictionary *plan, BOOL (^isCurrent)(void));
