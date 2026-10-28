#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN
@interface CUIDragDataStore : NSObject
@property(nonatomic, readonly) NSString *moduleId;
+ (nullable CUIDragDataStore *)storeForModuleId:(NSString *)moduleId;
- (nullable instancetype)initWithModuleId:(NSString *)moduleId
    blobWriter:(NSDictionary *_Nullable (^)(NSData *, NSString *))writer
    blobReleaser:(void (^)(NSString *))releaser;
- (NSString *)importProviders:(NSArray<NSItemProvider *> *)providers completion:(void (^)(NSArray *_Nullable, NSError *_Nullable))completion;
- (NSString *)beginImportTextMaps:(NSArray<NSArray<NSDictionary *> *> *)maps;
- (NSString *)beginImportProviders:(NSArray<NSItemProvider *> *)providers;
- (void)readItems:(NSDictionary *)request completion:(void (^)(NSArray *_Nullable, NSError *_Nullable))completion;
- (BOOL)adoptItems:(NSDictionary *)request;
- (void)readText:(NSDictionary *)request completion:(void (^)(NSString *_Nullable, NSError *_Nullable))completion;
- (void)readFile:(NSDictionary *)request completion:(void (^)(NSDictionary *_Nullable, NSError *_Nullable))completion;
- (BOOL)adoptFile:(NSDictionary *)request;
- (void)readDirectory:(NSDictionary *)request completion:(void (^)(NSDictionary *_Nullable, NSError *_Nullable))completion;
- (void)closeDirectory:(NSDictionary *)request;
- (void)releaseData:(NSDictionary *)request;
- (void)invalidate;
@end
NS_ASSUME_NONNULL_END
