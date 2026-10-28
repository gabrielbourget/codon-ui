#import <CodonNativeInputSpec/CodonNativeInputSpec.h>
#import <React/RCTBlobManager.h>
#import <React/RCTInvalidating.h>
#import <React/RCTBridgeModule.h>
#import "CUIDragDataStore.h"
#import "CUIDragAction.h"
#import "CUIKeyboardScope.h"
#import <React/RCTScheduler.h>
#import <React/RCTSurfacePresenter.h>
#include "../cpp/drag/ActionMount.h"

namespace {
class DragActionJSI final : public facebook::react::NativeCUIDragAndDropSpecJSI {
 public:
  DragActionJSI(const facebook::react::ObjCTurboModule::InitParams &params, std::shared_ptr<codon::drag::ActionRuntime> action)
      : NativeCUIDragAndDropSpecJSI(params), action_(std::move(action)) {
    action_->install(params.jsInvoker);
    methodMap_["getLease"] = MethodMetadata{0, lease};
    methodMap_["acceptsAction"] = MethodMetadata{1, accepts};
    methodMap_["settleAction"] = MethodMetadata{1, settle};
  }
 private:
  std::shared_ptr<codon::drag::ActionRuntime> action_;
  static facebook::jsi::Value lease(facebook::jsi::Runtime &runtime, facebook::react::TurboModule &module,
      const facebook::jsi::Value *, size_t) {
    const auto &self = static_cast<DragActionJSI &>(module);
    return facebook::jsi::String::createFromUtf8(runtime, self.action_->ready() ? self.action_->moduleId : "");
  }
  static facebook::jsi::Value accepts(facebook::jsi::Runtime &runtime, facebook::react::TurboModule &module,
      const facebook::jsi::Value *args, size_t count) {
    const auto &self = static_cast<DragActionJSI &>(module);
    return count == 1 && args[0].isString() && self.action_->accepts(args[0].getString(runtime).utf8(runtime));
  }
  static facebook::jsi::Value settle(facebook::jsi::Runtime &runtime, facebook::react::TurboModule &module,
      const facebook::jsi::Value *args, size_t count) {
    const auto &self = static_cast<DragActionJSI &>(module);
    return count == 1 && args[0].isString() && self.action_->settle(args[0].getString(runtime).utf8(runtime));
  }
};
}
@class CUIDragAndDrop;
static NSLock *CUIDragModulesLock;
static NSMapTable<NSString *, CUIDragAndDrop *> *CUIDragModules;
static void CUIInitializeDragModules() {
  static dispatch_once_t once; dispatch_once(&once, ^{ CUIDragModulesLock = [NSLock new]; CUIDragModules = NSMapTable.strongToWeakObjectsMapTable; });
}
@interface CUIDragAndDrop : NativeCUIDragAndDropSpecBase <NativeCUIDragAndDropSpec, RCTInvalidating>
@property(nonatomic, weak) RCTModuleRegistry *moduleRegistry;
- (NSString *)runAction:(CUIKeyboardScope *)scope identity:(NSDictionary *)identity payload:(NSDictionary *)payload pointer:(BOOL)pointer current:(BOOL (^)(void))current;
@end

@implementation CUIDragAndDrop {
  CUIDragDataStore *_data;
  std::shared_ptr<codon::drag::ActionRuntime> _action;
  __weak id<RCTSurfacePresenterStub> _presenter;
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
    _action = std::make_shared<codon::drag::ActionRuntime>(_data.moduleId.UTF8String);
    codon::drag::registerRuntime(_action);
    CUIInitializeDragModules(); [CUIDragModulesLock lock]; [CUIDragModules setObject:self forKey:_data.moduleId]; [CUIDragModulesLock unlock];
  }
  return self;
}
- (void)setSurfacePresenter:(id<RCTSurfacePresenterStub>)presenter { _presenter = presenter; }
- (void)invalidate {
  codon::drag::retireRuntime(_data.moduleId.UTF8String);
  [CUIDragModulesLock lock]; [CUIDragModules removeObjectForKey:_data.moduleId]; [CUIDragModulesLock unlock];
  [_data invalidate];
}
- (NSNumber *)acceptsAction:(NSString *)request { return @(_action->accepts(request.UTF8String)); }
- (NSNumber *)settleAction:(NSString *)request { return @(_action->settle(request.UTF8String)); }
- (NSString *)runAction:(CUIKeyboardScope *)scope identity:(NSDictionary *)identity payload:(NSDictionary *)payload pointer:(BOOL)pointer current:(BOOL (^)(void))current {
  if (!NSThread.isMainThread || !current || !current()) @throw [NSException exceptionWithName:@"CUI.DragAction" reason:@"native-drag-original-main-view-required" userInfo:nil];
  RCTSurfacePresenter *presenter = (RCTSurfacePresenter *)_presenter;
  const auto manager = presenter.scheduler.uiManager;
  NSData *idBytes = [NSJSONSerialization dataWithJSONObject:identity options:0 error:nullptr];
  NSData *payloadBytes = [NSJSONSerialization dataWithJSONObject:payload options:0 error:nullptr];
  if (!idBytes || !payloadBytes) @throw [NSException exceptionWithName:@"CUI.DragAction" reason:@"native-drag-original-packet-invalid" userInfo:nil];
  const auto id = codon::drag::identity(folly::parseJson(std::string((const char *)idBytes.bytes, idBytes.length)));
  auto data = folly::parseJson(std::string((const char *)payloadBytes.bytes, payloadBytes.length));
  const auto response = codon::drag::run(_action, manager, id, std::move(data), pointer,
    [scope, current, id] {
      NSDictionary *session = scope.activationSession;
      return NSThread.isMainThread && current() && scope.dragCaptureReady && scope.tag == id.scopeTarget &&
        [session[@"scopeOwnerId"] isEqual:@(id.ownerId.c_str())] && [session[@"windowId"] isEqual:@(id.windowId.c_str())] &&
        [session[@"epoch"] longLongValue] == id.epoch;
    }, [scope] { return std::string(scope.dragMountWitness.UTF8String ?: ""); });
  return @(response.c_str());
}
- (NSString *)getLease { return _action->ready() ? @(_action->moduleId.c_str()) : @""; }
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
  return std::make_shared<DragActionJSI>(params, _action);
}
@end

NSString *CUIRunDragAction(CUIKeyboardScope *scope, NSDictionary *identity, NSDictionary *payload, BOOL pointer, BOOL (^current)(void)) {
  CUIInitializeDragModules(); [CUIDragModulesLock lock]; CUIDragAndDrop *module = [CUIDragModules objectForKey:identity[@"moduleId"]]; [CUIDragModulesLock unlock];
  if (!module) @throw [NSException exceptionWithName:@"CUI.DragAction" reason:@"native-drag-original-module-retired" userInfo:nil];
  return [module runAction:scope identity:identity payload:payload pointer:pointer current:current];
}
