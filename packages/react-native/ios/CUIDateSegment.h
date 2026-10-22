#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>

// This owned symbolic editor never subclasses or mutates a core TextInput.
@interface CUIDateSegment : RCTViewComponentView <UITextInput>
@end
