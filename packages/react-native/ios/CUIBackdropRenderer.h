#import <React/RCTBridgeModule.h>
#import <React/RCTSurfacePresenter.h>

@interface CUIBackdropRenderer : NSObject
- (void)request:(NSString *)encoded presenter:(RCTSurfacePresenter *)presenter
    resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
- (void)invalidate;
@end
