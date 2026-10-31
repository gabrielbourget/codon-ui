#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@protocol CUIBackdropCaptureCancellation <NSObject>
- (void)cancel;
@end

/** Immutable identity/geometry of the original target and excluded effect. Views/windows are weak.
 * Capture must not hide, replace, reparent or mutate controls or input. */
@interface CUIBackdropCaptureRequest : NSObject
@property (nonatomic, weak, readonly, nullable) UIView *target;
@property (nonatomic, weak, readonly, nullable) UIView *receiver;
@property (nonatomic, weak, readonly, nullable) UIWindow *targetWindow;
@property (nonatomic, weak, readonly, nullable) UIWindow *receiverWindow;
@property (nonatomic, copy, readonly) NSDictionary *targetEpoch;
@property (nonatomic, copy, readonly) NSDictionary *receiverEpoch;
@property (nonatomic, copy, readonly) NSString *ownerId;
@property (nonatomic, copy, readonly) NSString *frameId;
@property (nonatomic, copy, readonly) NSNumber *generation;
@property (nonatomic, readonly) CGRect targetBounds;
@property (nonatomic, readonly) CGRect receiverBounds;
@property (nonatomic, copy, readonly) NSArray<NSNumber *> *targetScreenQuad;
@property (nonatomic, copy, readonly) NSArray<NSNumber *> *receiverScreenQuad;
@property (nonatomic, readonly) CGFloat scale;
@property (atomic, readonly, getter=isCancelled) BOOL cancelled;
- (instancetype)init NS_UNAVAILABLE;
@end

/** Tightly packed top-to-bottom premultiplied RGBA8/sRGB, copied into immutable storage.
 * Echo the exact request whose complete compositor state was captured. */
@interface CUIBackdropCapturedFrame : NSObject
@property (nonatomic, strong, readonly) CUIBackdropCaptureRequest *request;
@property (nonatomic, copy, readonly) NSData *rgba;
@property (nonatomic, readonly) NSUInteger width;
@property (nonatomic, readonly) NSUInteger height;
@property (nonatomic, readonly) BOOL complete;
@property (nonatomic, readonly) BOOL excludesEffect;
@property (nonatomic, readonly) BOOL protectedContent;
- (instancetype)initWithRequest:(CUIBackdropCaptureRequest *)request width:(NSUInteger)width
    height:(NSUInteger)height rgba:(NSData *)rgba complete:(BOOL)complete
    excludesEffect:(BOOL)excludesEffect protectedContent:(BOOL)protectedContent;
- (instancetype)init NS_UNAVAILABLE;
@end

/** Called on the main thread. Complete once on any queue, with the entire original parent-target
 * composition including custom/hardware producers and excluding the requesting effect subtree. */
@protocol CUIBackdropCaptureSource <NSObject>
- (id<CUIBackdropCaptureCancellation>)captureBackdrop:(CUIBackdropCaptureRequest *)request
    completion:(void (^)(CUIBackdropCapturedFrame *_Nullable, NSError *_Nullable))completion;
@end

/** Caller-retained provider ownership. Registration/replacement/disposal are main-thread operations. */
@interface CUIBackdropCaptureRegistration : NSObject
@property (nonatomic, weak, readonly, nullable) UIView *target;
@property (nonatomic, readonly, getter=isActive) BOOL active;
- (void)dispose;
- (instancetype)init NS_UNAVAILABLE;
@end

/** Weak view/token index; retaining the returned token keeps its provider registered. */
@interface CUIBackdropCaptureRegistry : NSObject
+ (CUIBackdropCaptureRegistration *)registerSource:(id<CUIBackdropCaptureSource>)source forTarget:(UIView *)target;
@end

NS_ASSUME_NONNULL_END
