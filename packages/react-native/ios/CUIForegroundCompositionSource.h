#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/** Immutable pre-owner-effects source identity. No business value, text or selection mirror. */
@interface CUIForegroundCompositionRequest : NSObject
@property (nonatomic, weak, readonly, nullable) UIView *registrationRoot;
@property (nonatomic, weak, readonly, nullable) UIView *owner;
@property (nonatomic, weak, readonly, nullable) UIView *source;
@property (nonatomic, weak, readonly, nullable) UIView *output;
@property (nonatomic, weak, readonly, nullable) UIWindow *sourceWindow;
@property (nonatomic, weak, readonly, nullable) UIWindow *outputWindow;
@property (nonatomic, copy, readonly) NSDictionary *sourceEpoch;
@property (nonatomic, copy, readonly) NSDictionary *outputEpoch;
@property (nonatomic, copy, readonly) NSString *ownerId;
@property (nonatomic, copy, readonly) NSString *frameId;
@property (nonatomic, readonly) NSUInteger generation;
@property (nonatomic, readonly) CGRect rasterBounds;
@property (nonatomic, readonly) CGFloat scale;
@property (nonatomic, copy, readonly) NSArray<NSNumber *> *sourceScreenQuad;
@property (nonatomic, copy, readonly) NSArray<NSNumber *> *outputScreenQuad;
@property (atomic, readonly, getter=isCancelled) BOOL cancelled;
- (instancetype)init NS_UNAVAILABLE;
@end

/** Complete, immutable top-down premultiplied RGBA8/sRGB at the exact request raster bounds.
 * Capture must include the original producers even while a preceding frame is presented. */
@interface CUIForegroundCompositionFrame : NSObject
@property (nonatomic, strong, readonly) CUIForegroundCompositionRequest *request;
@property (nonatomic, copy, readonly) NSData *rgba;
@property (nonatomic, readonly) NSUInteger width;
@property (nonatomic, readonly) NSUInteger height;
@property (nonatomic, readonly) BOOL complete;
@property (nonatomic, readonly) BOOL excludesOwnerEffectsAndOutput;
@property (nonatomic, readonly) BOOL protectedContent;
- (instancetype)initWithRequest:(CUIForegroundCompositionRequest *)request rgba:(NSData *)rgba
    width:(NSUInteger)width height:(NSUInteger)height complete:(BOOL)complete
    excludesOwnerEffectsAndOutput:(BOOL)excludesOwnerEffectsAndOutput protectedContent:(BOOL)protectedContent;
- (instancetype)init NS_UNAVAILABLE;
@end

/** The library owns the filtered image. This token admits only its exact original capture frame. */
@interface CUIForegroundCompositionPresentation : NSObject
@property (nonatomic, strong, readonly) CUIForegroundCompositionFrame *sourceFrame;
@property (nonatomic, readonly) CGRect outputBounds;
- (instancetype)init NS_UNAVAILABLE;
@end

@protocol CUIForegroundCompositionSession <NSObject>
/** Main-thread call; complete exactly once on any queue. One capture at a time. */
- (void)captureForeground:(CUIForegroundCompositionRequest *)request
    completion:(void (^)(CUIForegroundCompositionFrame *_Nullable, NSError *_Nullable))completion;
/** Main-thread transaction: withdraw only independently presented producer ink for this frame.
 * Never hide/mutate/reparent original controls or change their alpha, values, selection or defaults.
 * Throw before admission if the complete original producer presentation cannot be handed over. */
- (void)presentForeground:(CUIForegroundCompositionPresentation *)presentation;
/** Main-thread, exactly once. Cancel capture and restore this session's own original producer ink. */
- (void)retireForeground;
@end

@protocol CUIForegroundCompositionSource <NSObject>
/** Main thread. Explicitly accept the contained owner and prepare without changing original ink.
 * The session must retain real producer provenance and support restoration after detach/replacement. */
- (id<CUIForegroundCompositionSession>)prepareForeground:(CUIForegroundCompositionRequest *)request;
@end

@interface CUIForegroundCompositionRegistration : NSObject
@property (nonatomic, weak, readonly, nullable) UIView *root;
@property (nonatomic, readonly, getter=isActive) BOOL active;
- (void)dispose;
- (instancetype)init NS_UNAVAILABLE;
@end

/** Caller retains the disposable token. Root/provider replacement retires admitted sessions. */
@interface CUIForegroundCompositionRegistry : NSObject
+ (CUIForegroundCompositionRegistration *)registerSource:(id<CUIForegroundCompositionSource>)source
    forRoot:(UIView *)root;
@end
NS_ASSUME_NONNULL_END
