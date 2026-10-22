#import "CUIDateSegment.h"

// Resolves every original segment at the current UI boundary. No values or
// editable text are stored in the form descriptor.
CUIDateSegment *CUIResolveOwnedDateField(UIView *metadata, NSString *binding, NSInteger primaryTarget, NSInteger surface);
NSArray<CUIDateSegment *> *CUIResolveOwnedDateFieldSegments(UIView *metadata, NSString *binding, NSInteger primaryTarget, NSInteger surface);
