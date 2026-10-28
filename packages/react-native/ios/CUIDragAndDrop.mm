#import <CodonNativeInputSpec/CodonNativeInputSpec.h>
#import <React/RCTBlobManager.h>
#import <React/RCTInvalidating.h>
#import <React/RCTBridgeModule.h>
#import "CUIDragDataStore.h"

@interface CUIDragAndDrop : NativeCUIDragAndDropSpecBase <NativeCUIDragAndDropSpec, RCTInvalidating>
@property(nonatomic, weak) RCTModuleRegistry *moduleRegistry;
@end

@implementation CUIDragAndDrop {
  CUIDragDataStore *_data;
}
@synthesize moduleRegistry = _moduleRegistry;
RCT_EXPORT_MODULE(CUIDragAndDrop)
+ (BOOL)requiresMainQueueSetup { return NO; }
- (instancetype)init {
  if (self = [super init]) {
    __weak CUIDragAndDrop *weakSelf = self;
    _data = [[CUIDragDataStore alloc] initWithModuleId:NSUUID.UUID.UUIDString
      blobWriter:^NSDictionary *(NSData *bytes, NSString *type) {
        RCTBlobManager *blobs = [weakSelf.moduleRegistry moduleForName:"BlobModule"];
        if (![blobs isKindOfClass:RCTBlobManager.class]) return nil;
        NSString *identity = [blobs store:bytes];
        return identity ? @{ @"blobId": identity } : nil;
      } blobReleaser:^(NSString *identity) {
        RCTBlobManager *blobs = [weakSelf.moduleRegistry moduleForName:"BlobModule"];
        if ([blobs isKindOfClass:RCTBlobManager.class]) [blobs remove:identity];
      }];
  }
  return self;
}
- (void)invalidate { [_data invalidate]; }
- (NSString *)getLease { return _data.moduleId ?: @""; }
- (NSDictionary *)request:(NSString *)encoded {
  NSError *error;
  id result = [NSJSONSerialization JSONObjectWithData:[encoded dataUsingEncoding:NSUTF8StringEncoding] options:0 error:&error];
  if (error || ![result isKindOfClass:NSDictionary.class])
    @throw [NSException exceptionWithName:@"CUI.DragData" reason:@"Native drag data: invalid module request" userInfo:nil];
  return result;
}
- (void)resolveRecord:(id)record error:(NSError *)error resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  if (error) { reject(@"E_CUI_DRAG_DATA", error.localizedDescription, error); return; }
  NSError *encoding;
  NSData *bytes = record ? [NSJSONSerialization dataWithJSONObject:record options:0 error:&encoding] : nil;
  if (!bytes || encoding) { reject(@"E_CUI_DRAG_DATA", @"Native drag data: invalid native response", encoding); return; }
  resolve([[NSString alloc] initWithData:bytes encoding:NSUTF8StringEncoding]);
}
- (void)readItems:(NSString *)encoded resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  @try { [_data readItems:[self request:encoded] completion:^(NSArray *value, NSError *error) {
    [self resolveRecord:value error:error resolve:resolve reject:reject];
  }]; } @catch (NSException *error) { reject(@"E_CUI_DRAG_DATA", error.reason, nil); }
}
- (NSNumber *)adoptItems:(NSString *)encoded { @try { return @([_data adoptItems:[self request:encoded]]); } @catch (NSException *error) { return @NO; } }
- (void)readText:(NSString *)encoded resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  @try { [_data readText:[self request:encoded] completion:^(NSString *value, NSError *error) {
    if (error) reject(@"E_CUI_DRAG_DATA", error.localizedDescription, error); else resolve(value);
  }]; } @catch (NSException *error) { reject(@"E_CUI_DRAG_DATA", error.reason, nil); }
}
- (void)readFile:(NSString *)encoded resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  @try { [_data readFile:[self request:encoded] completion:^(NSDictionary *value, NSError *error) {
    [self resolveRecord:value error:error resolve:resolve reject:reject];
  }]; } @catch (NSException *error) { reject(@"E_CUI_DRAG_DATA", error.reason, nil); }
}
- (NSNumber *)adoptFile:(NSString *)encoded { @try { return @([_data adoptFile:[self request:encoded]]); } @catch (NSException *error) { return @NO; } }
- (void)readDirectory:(NSString *)encoded resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  @try { [_data readDirectory:[self request:encoded] completion:^(NSDictionary *value, NSError *error) {
    [self resolveRecord:value error:error resolve:resolve reject:reject];
  }]; } @catch (NSException *error) { reject(@"E_CUI_DRAG_DATA", error.reason, nil); }
}
- (void)closeDirectory:(NSString *)encoded { [_data closeDirectory:[self request:encoded]]; }
- (void)releaseData:(NSString *)encoded { [_data releaseData:[self request:encoded]]; }
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeCUIDragAndDropSpecJSI>(params);
}
@end
