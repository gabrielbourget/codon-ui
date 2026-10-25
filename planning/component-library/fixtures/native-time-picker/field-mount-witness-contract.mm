#import <Foundation/Foundation.h>
#include <iostream>
#include <stdexcept>

// Explicit window and deduplicated form-publication models surround the actual
// owned observer, lifetime and witness methods. No UIKit delivery is modeled.
struct MountingTransaction {
  int surface, number;
  int getSurfaceId() const { return surface; }
  int getNumber() const { return number; }
};
struct SurfaceTelemetry {};
static NSString *CUIInputWindowIdentity(id window) { return [NSString stringWithFormat:@"window:%p", window]; }
@interface WitnessView : NSObject
- (void)didMoveToWindow;
@end
@implementation WitnessView
- (void)didMoveToWindow {}
@end
@interface WitnessMetadata : WitnessView {
 @public
  __weak id _boundWindow;
  id _boundOriginal, _boundEditor;
  NSString *_signature, *_windowId, *_lastMount, *_transactionWitness;
  NSDictionary *_mountSnapshot;
  NSUInteger _epoch;
  int _surface;
  void (^_fieldInputRefresh)(void);
}
@property (nonatomic, strong) id window;
@property (nonatomic) int formCommits;
@property (nonatomic) int semanticRefreshes;
- (NSDictionary *)formMountSnapshot;
- (NSString *)formTransactionWitness;
- (void)mountingTransactionDidMount:(const MountingTransaction &)transaction withSurfaceTelemetry:(const SurfaceTelemetry &)telemetry;
@end
@implementation WitnessMetadata
- (void)publish:(BOOL)attached surface:(int)surface mount:(NSString *)mount
{
  if (!_mountSnapshot) { _mountSnapshot = @{@"descriptorId":@"unchanged", @"mountRevision":mount ?: @"unmounted"}; self.formCommits++; }
}
- (NSDictionary *)formMountSnapshot { return _mountSnapshot; }
- (void)setSemanticContribution:(id)contribution {}
- (void)resetSemanticAccessibilityFocus {}
- (void)refreshSemantics { self.semanticRefreshes++; }
#include "metadata-witness.inc"
@end
@interface WitnessBinding : NSObject { @public WitnessMetadata *_metadata; }
- (NSString *)mountWitness;
@end
@implementation WitnessBinding
#include "binding-witness.inc"
@end
@interface LegacyWitnessBinding : NSObject { @public WitnessMetadata *_metadata; }
- (NSString *)mountWitness;
@end
@implementation LegacyWitnessBinding
#include "legacy-binding-witness.inc"
@end

int main() {
  @autoreleasepool {
    int assertions = 0;
    __block int refreshes = 0;
    const auto check = [&](BOOL value) { if (!value) throw std::runtime_error("original mount witness assertion " + std::to_string(assertions + 1)); assertions++; };
    WitnessMetadata *metadata = [WitnessMetadata new];
    WitnessBinding *binding = [WitnessBinding new]; binding->_metadata = metadata;
    LegacyWitnessBinding *legacy = [LegacyWitnessBinding new]; legacy->_metadata = metadata;
    metadata->_fieldInputRefresh = ^{ refreshes++; };
    check([[binding mountWitness] isEqual:@"unmounted"]);
    metadata.window = [NSObject new]; [metadata didMoveToWindow];
    check([[binding mountWitness] isEqual:@"unmounted"]);
    NSDictionary *form = [metadata formMountSnapshot]; NSString *old = [legacy mountWitness];
    [metadata mountingTransactionDidMount:MountingTransaction{11, 7} withSurfaceTelemetry:SurfaceTelemetry{}];
    check([[binding mountWitness] isEqual:@"ios-surface:11:mount:7"]);
    check([[legacy mountWitness] isEqual:old]);
    NSString *first = [binding mountWitness];
    [metadata mountingTransactionDidMount:MountingTransaction{11, 8} withSurfaceTelemetry:SurfaceTelemetry{}];
    check(![[binding mountWitness] isEqual:first]);
    check([[binding mountWitness] isEqual:@"ios-surface:11:mount:8"]);
    check([[legacy mountWitness] isEqual:old]);
    check([metadata formMountSnapshot] == form && metadata.formCommits == 1);
    check(metadata.semanticRefreshes == 2 && refreshes == 3);
    [binding mountWitness]; [binding mountWitness];
    check(metadata.formCommits == 1 && metadata.semanticRefreshes == 2 && refreshes == 3);
    [metadata didMoveToWindow];
    check([[binding mountWitness] isEqual:@"ios-surface:11:mount:8"] && refreshes == 3);
    metadata.window = nil; [metadata didMoveToWindow];
    check([[binding mountWitness] isEqual:@"unmounted"]);
    [metadata mountingTransactionDidMount:MountingTransaction{11, 9} withSurfaceTelemetry:SurfaceTelemetry{}];
    check([[binding mountWitness] isEqual:@"unmounted"]);
    metadata.window = [NSObject new]; [metadata didMoveToWindow];
    check([[binding mountWitness] isEqual:@"unmounted"]);
    [metadata mountingTransactionDidMount:MountingTransaction{12, 1} withSurfaceTelemetry:SurfaceTelemetry{}];
    check([[binding mountWitness] isEqual:@"ios-surface:12:mount:1"]);
    std::cout << assertions << " actual observer/witness/lifetime assertions passed; explicit window/publication models, no installed verdict\n";
  }
}
