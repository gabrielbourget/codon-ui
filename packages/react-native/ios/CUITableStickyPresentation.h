#import <Foundation/Foundation.h>
#include "../cpp/table/StickyPresentation.h"
@class RCTSurfacePresenter;

@interface CUITableStickyPresentation : NSObject
- (instancetype)initWithPresenter:(RCTSurfacePresenter *)presenter
                         service:(std::shared_ptr<codon::table::NativeTableStickyPresentation>)service;
- (void)synchronize;
- (void)invalidate;
@end
