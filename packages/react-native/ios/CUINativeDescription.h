#import <UIKit/UIKit.h>

// A scoped lease on an existing accessibility element; no extra view or editor mutation.
@interface CUINativeDescription : NSObject
- (void)bindTarget:(UIView *)target description:(UIView *)description label:(NSString *)label;
- (void)invalidate;
@end
