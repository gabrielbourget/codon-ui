#import <UIKit/UIKit.h>
#ifdef __cplusplus
#include <react/renderer/mounting/MountingTransaction.h>
#endif

@interface CUIOrdinaryEditorKeys : NSObject
- (instancetype)initWithScope:(UIView *)scope session:(NSDictionary *(^)(void))session ready:(BOOL (^)(void))ready status:(void (^)(NSDictionary *))status;
- (void)update:(NSArray<NSDictionary *> *)bindings;
- (BOOL)hasBindings;
- (BOOL)canObserveTarget:(UIView *)target;
- (void)appendToolbarObservers:(NSMutableArray *)observers;
- (BOOL)acceptsPress:(UIPress *)press;
- (void)dispatchPress:(UIPress *)press phase:(NSString *)phase repeat:(BOOL)repeat captured:(BOOL)captured;
- (void)publish;
#ifdef __cplusplus
- (void)didMount:(const facebook::react::MountingTransaction &)transaction;
#endif
@end
