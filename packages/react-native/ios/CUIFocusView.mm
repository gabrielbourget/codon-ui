#import "CUIFocusView.h"
#import "CUIAccessibilityReferences.h"
#import "CUIInputWindow.h"
#import "CUIMenuPointerPolicies.h"
#import "CUIKeyboardScope.h"
#import "CUIFloatingScrollAnchor.h"
#import "CUIMotionColorSampler.h"
#import "CUIMotionGeometryObserver.h"
#import <React/RCTMountingTransactionObserving.h>
#import <react/featureflags/ReactNativeFeatureFlags.h>

#import <react/renderer/components/CodonNativeInputSpec/ComponentDescriptors.h>
#import <react/renderer/components/CodonNativeInputSpec/EventEmitters.h>
#import <react/renderer/components/CodonNativeInputSpec/Props.h>
#import <react/renderer/components/CodonNativeInputSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface CUIFocusView () <RCTCUIFocusViewViewProtocol, RCTMountingTransactionObserving>
@end

@implementation CUIFocusView {
  BOOL _keyboardFocusable;
  BOOL _nativeTabStop;
  BOOL _nativePressable;
  BOOL _nativeNavigation;
  double _activationId;
  BOOL _focusAcknowledged;
  NSString *_ownerId;
  NSString *_nativeCollectionBinding;
  NSDictionary *_nativeCollectionSemantics;
  NSSet<NSString *> *_capturedKeys;
  NSMutableDictionary<NSNumber *, UIPress *> *_held;
  NSMutableSet<NSNumber *> *_consumed;
  NSArray<NSString *> *_nativeLabelledBy;
  NSArray<NSString *> *_nativeDescribedBy;
  NSArray<NSString *> *_nativeDetailsBy;
  NSInteger _nativeDescriptionTag;
  NSString *_nativeDescriptionLabel;
  NSString *_nativeDetailsLabel;
  NSArray<AXCustomContent *> *_callerAccessibilityContent;
  CUIFloatingScrollAnchor *_scrollAnchor;
  CUIMotionColorSampler *_motionColors;
  CUIMotionGeometryObserver *_motionGeometry;
  BOOL _nativeMotionVisible;
  BOOL _authoredHidden;
  BOOL _motionVisibilityReady;
  NSString *_motionProjectionRevision;
  CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin _origin;
}

- (BOOL)menuPointerTriggerEnabled { return _nativePressable && _keyboardFocusable; }
- (BOOL)shouldUpdateFocusInContext:(UIFocusUpdateContext *)context
{
  if (context.nextFocusedView == self && _origin != CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Programmatic && CUIMenuPointerPreventsFocus(self.window)) return NO;
  return [super shouldUpdateFocusInContext:context];
}
- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event
{
  return CUIMenuPointerSuppresses(self) ? nil : [super hitTest:point withEvent:event];
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<CUIFocusViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    _props = std::make_shared<const CUIFocusViewProps>();
    _keyboardFocusable = YES;
    _nativeTabStop = YES;
    _nativeMotionVisible = YES;
    _authoredHidden = self.hidden;
    _motionVisibilityReady = YES;
    _motionProjectionRevision = @"";
    _ownerId = @"";
    _nativeCollectionBinding = @"";
    _capturedKeys = [NSSet set];
    _held = [NSMutableDictionary dictionary];
    _consumed = [NSMutableSet set];
    _nativeDescriptionLabel = @"Description";
    _nativeDetailsLabel = @"Details";
    _origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Unknown;
    _scrollAnchor = [[CUIFloatingScrollAnchor alloc] initWithRoot:self];
    __weak CUIFocusView *weakSelf = self;
    _motionColors = [[CUIMotionColorSampler alloc] initWithRoot:self emit:^(NSDictionary *data) {
      [weakSelf emitMotionColors:data];
    }];
    _motionGeometry = [[CUIMotionGeometryObserver alloc] initWithRoot:self emit:^(NSDictionary *data) { [weakSelf emitMotionGeometry:data]; }];
    [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(applicationWillResignActive:) name:UIApplicationWillResignActiveNotification object:nil];
  }
  return self;
}

- (NSString *)nativeCollectionBinding { return _nativeCollectionBinding; }

static NSInteger CUICollectionInteger(NSDictionary *fields, NSString *key)
{
  id value = fields[key];
  if (![value isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)value) == CFBooleanGetTypeID()) return -1;
  double number = [value doubleValue];
  return isfinite(number) && number >= 0 && number <= INT_MAX && number == floor(number) ? (NSInteger)number : -1;
}

- (BOOL)isCollectionRoot
{
  NSString *mode = _nativeCollectionSemantics[@"selectionMode"];
  return self.window && _nativeCollectionBinding.length && [_nativeCollectionSemantics[@"kind"] isEqual:@"root"]
    && CUICollectionInteger(_nativeCollectionSemantics, @"rowCount") >= 0 && CUICollectionInteger(_nativeCollectionSemantics, @"columnCount") >= 0
    && [@[@"none", @"single", @"multiple"] containsObject:mode ?: @""];
}

- (BOOL)conformsToProtocol:(Protocol *)protocol
{
  if (protocol == @protocol(UIAccessibilityContainerDataTable)) return [self isCollectionRoot];
  if (protocol == @protocol(UIAccessibilityContainerDataTableCell)) return [self collectionParent] != nil;
  return [super conformsToProtocol:protocol];
}

- (BOOL)respondsToSelector:(SEL)selector
{
  if (selector == @selector(accessibilityRowRange) || selector == @selector(accessibilityColumnRange)) return [self collectionParent] != nil;
  if (selector == @selector(accessibilityDataTableCellElementForRow:column:) || selector == @selector(accessibilityRowCount)
    || selector == @selector(accessibilityColumnCount) || selector == @selector(accessibilityHeaderElementsForRow:)
    || selector == @selector(accessibilityHeaderElementsForColumn:)) return [self isCollectionRoot];
  return [super respondsToSelector:selector];
}

- (CUIFocusView *)collectionParent
{
  if (![_nativeCollectionSemantics[@"kind"] isEqual:@"cell"] || !self.window) return nil;
  UIView *candidate = [self.window viewWithTag:CUICollectionInteger(_nativeCollectionSemantics, @"parentTarget")];
  if (![candidate isKindOfClass:CUIFocusView.class] || candidate == self || ![self isDescendantOfView:candidate]) return nil;
  CUIFocusView *parent = (CUIFocusView *)candidate;
  if (![parent isCollectionRoot] || parent.window != self.window) return nil;
  NSDictionary *own = [NSJSONSerialization JSONObjectWithData:[_nativeCollectionBinding dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
  NSDictionary *root = [NSJSONSerialization JSONObjectWithData:[parent.nativeCollectionBinding dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
  if (![own isKindOfClass:NSDictionary.class] || ![root isKindOfClass:NSDictionary.class]) return nil;
  for (NSString *key in @[@"ownerId", @"rootId", @"rootRevision", @"target", @"surfaceId", @"windowId", @"epoch", @"sequence"])
    if (!own[key] || ![own[key] isEqual:root[key]]) return nil;
  NSInteger row = CUICollectionInteger(_nativeCollectionSemantics, @"rowIndex"), column = CUICollectionInteger(_nativeCollectionSemantics, @"columnIndex");
  NSInteger rows = CUICollectionInteger(_nativeCollectionSemantics, @"rowSpan"), columns = CUICollectionInteger(_nativeCollectionSemantics, @"columnSpan");
  if (row < 0 || column < 0 || rows < 1 || columns < 1 || row + rows > [parent accessibilityRowCount] || column + columns > [parent accessibilityColumnCount]) return nil;
  return parent;
}

- (NSArray<CUIFocusView *> *)collectionCells
{
  if (![self isCollectionRoot]) return @[];
  NSMutableArray<CUIFocusView *> *cells = [NSMutableArray array];
  NSMutableArray<UIView *> *pending = [self.subviews mutableCopy];
  while (pending.count) {
    UIView *view = pending.firstObject;
    [pending removeObjectAtIndex:0];
    if (view.hidden || view.alpha <= 0) continue;
    if ([view isKindOfClass:CUIFocusView.class]) {
      CUIFocusView *cell = (CUIFocusView *)view;
      if ([cell collectionParent] == self) [cells addObject:cell];
      if ([cell isCollectionRoot]) continue;
    }
    [pending addObjectsFromArray:view.subviews];
  }
  return cells;
}

- (NSUInteger)accessibilityRowCount { return [self isCollectionRoot] ? CUICollectionInteger(_nativeCollectionSemantics, @"rowCount") : 0; }
- (NSUInteger)accessibilityColumnCount { return [self isCollectionRoot] ? CUICollectionInteger(_nativeCollectionSemantics, @"columnCount") : 0; }
- (NSRange)accessibilityRowRange
{
  return [self collectionParent] ? NSMakeRange(CUICollectionInteger(_nativeCollectionSemantics, @"rowIndex"), CUICollectionInteger(_nativeCollectionSemantics, @"rowSpan")) : NSMakeRange(NSNotFound, 0);
}
- (NSRange)accessibilityColumnRange
{
  return [self collectionParent] ? NSMakeRange(CUICollectionInteger(_nativeCollectionSemantics, @"columnIndex"), CUICollectionInteger(_nativeCollectionSemantics, @"columnSpan")) : NSMakeRange(NSNotFound, 0);
}
- (id<UIAccessibilityContainerDataTableCell>)accessibilityDataTableCellElementForRow:(NSUInteger)row column:(NSUInteger)column
{
  for (CUIFocusView *cell in [self collectionCells])
    if (NSLocationInRange(row, cell.accessibilityRowRange) && NSLocationInRange(column, cell.accessibilityColumnRange)) return cell;
  return nil;
}

- (NSArray<id<UIAccessibilityContainerDataTableCell>> *)collectionHeadersForIndex:(NSUInteger)index row:(BOOL)row
{
  NSMutableOrderedSet<CUIFocusView *> *headers = [NSMutableOrderedSet orderedSet];
  for (CUIFocusView *cell in [self collectionCells]) {
    if (!NSLocationInRange(index, row ? cell.accessibilityRowRange : cell.accessibilityColumnRange)) continue;
    if (cell.accessibilityTraits & UIAccessibilityTraitHeader) [headers addObject:cell];
    id references = cell->_nativeCollectionSemantics[row ? @"rowHeaderTargets" : @"columnHeaderTargets"];
    if (![references isKindOfClass:NSArray.class]) continue;
    for (id target in references) {
      NSInteger tag = CUICollectionInteger(@{@"target":target}, @"target");
      UIView *view = tag > 0 ? [self.window viewWithTag:tag] : nil;
      if ([view isKindOfClass:CUIFocusView.class]) {
        CUIFocusView *header = (CUIFocusView *)view;
        if ([header collectionParent] == self && (header.accessibilityTraits & UIAccessibilityTraitHeader)) [headers addObject:header];
      }
    }
  }
  return (NSArray<id<UIAccessibilityContainerDataTableCell>> *)headers.array;
}
- (NSArray<id<UIAccessibilityContainerDataTableCell>> *)accessibilityHeaderElementsForRow:(NSUInteger)row { return [self collectionHeadersForIndex:row row:YES]; }
- (NSArray<id<UIAccessibilityContainerDataTableCell>> *)accessibilityHeaderElementsForColumn:(NSUInteger)column { return [self collectionHeadersForIndex:column row:NO]; }

- (UIAccessibilityTraits)accessibilityTraits
{
  UIAccessibilityTraits traits = [super accessibilityTraits];
  if ([self collectionParent]) {
    traits = [_nativeCollectionSemantics[@"selected"] boolValue] ? traits | UIAccessibilityTraitSelected : traits & ~UIAccessibilityTraitSelected;
    traits = [_nativeCollectionSemantics[@"heading"] boolValue] ? traits | UIAccessibilityTraitHeader : traits & ~UIAccessibilityTraitHeader;
  }
  return traits;
}

- (NSString *)collectionAccessibilitySnapshot
{
  NSMutableDictionary *snapshot = [NSMutableDictionary dictionary];
  if ([self isCollectionRoot]) {
    snapshot[@"kind"] = @"root";
    snapshot[@"rowCount"] = @([self accessibilityRowCount]); snapshot[@"columnCount"] = @([self accessibilityColumnCount]);
    NSMutableArray *cells = [NSMutableArray array];
    for (CUIFocusView *cell in [self collectionCells]) {
      NSRange row = [cell accessibilityRowRange], column = [cell accessibilityColumnRange];
      id resolved = [self accessibilityDataTableCellElementForRow:row.location column:column.location];
      NSMutableArray *rowHeaders = [NSMutableArray array], *columnHeaders = [NSMutableArray array];
      for (CUIFocusView *header in [self accessibilityHeaderElementsForRow:row.location]) [rowHeaders addObject:@(header.tag)];
      for (CUIFocusView *header in [self accessibilityHeaderElementsForColumn:column.location]) [columnHeaders addObject:@(header.tag)];
      [cells addObject:@{@"target":@(cell.tag), @"resolved":@(resolved == cell), @"rowIndex":@(row.location), @"rowSpan":@(row.length),
        @"columnIndex":@(column.location), @"columnSpan":@(column.length), @"rowHeaderTargets":rowHeaders, @"columnHeaderTargets":columnHeaders}];
    }
    snapshot[@"materializedCells"] = cells;
  } else if ([self collectionParent]) {
    NSRange row = [self accessibilityRowRange], column = [self accessibilityColumnRange];
    snapshot[@"kind"] = @"cell"; snapshot[@"parentTarget"] = @([self collectionParent].tag);
    snapshot[@"rowIndex"] = @(row.location); snapshot[@"rowSpan"] = @(row.length);
    snapshot[@"columnIndex"] = @(column.location); snapshot[@"columnSpan"] = @(column.length);
    snapshot[@"selected"] = @((self.accessibilityTraits & UIAccessibilityTraitSelected) != 0);
    snapshot[@"heading"] = @((self.accessibilityTraits & UIAccessibilityTraitHeader) != 0);
  }
  NSData *data = [NSJSONSerialization dataWithJSONObject:snapshot options:NSJSONWritingSortedKeys error:nil];
  return data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : @"{}";
}

- (NSString *)accessibilityLabel
{
  if (CUIAccessibilityIsResolving(self)) return nil;
  const auto &props = *std::static_pointer_cast<const CUIFocusViewProps>(_props);
  NSString *ownLabel = props.accessibilityLabel.empty() ? nil : [NSString stringWithUTF8String:props.accessibilityLabel.c_str()];
  NSString *label = CUIAccessibilityResolveLabel(self, _nativeLabelledBy, ownLabel);
  return label != nil ? label : [super accessibilityLabel];
}

- (UIAccessibilityContainerType)accessibilityContainerType
{
  if ([self isCollectionRoot]) return UIAccessibilityContainerTypeDataTable;
  return _nativeNavigation ? UIAccessibilityContainerTypeLandmark : [super accessibilityContainerType];
}

- (void)setAccessibilityCustomContent:(NSArray<AXCustomContent *> *)content
{
  _callerAccessibilityContent = [content copy];
}

- (NSArray<AXCustomContent *> *)accessibilityCustomContent
{
  NSMutableArray<AXCustomContent *> *content = [_callerAccessibilityContent mutableCopy] ?: [NSMutableArray array];
  NSString *description = CUIAccessibilityResolve(self, _nativeDescribedBy, _nativeDescriptionTag, YES);
  NSString *details = CUIAccessibilityResolve(self, _nativeDetailsBy, 0, YES);
  if (description != nil) [content addObject:[AXCustomContent customContentWithLabel:_nativeDescriptionLabel value:description]];
  if (details != nil) [content addObject:[AXCustomContent customContentWithLabel:_nativeDetailsLabel value:details]];
  return content;
}

- (void)inspectAccessibility:(NSString *)ownerId
{
  if (![_ownerId isEqualToString:ownerId] || !_eventEmitter || !self.window.isKeyWindow) return;
  NSArray<AXCustomContent *> *content = self.accessibilityCustomContent;
  NSUInteger index = _callerAccessibilityContent.count;
  BOOL descriptionAvailable = CUIAccessibilityResolve(self, _nativeDescribedBy, _nativeDescriptionTag, YES) != nil;
  BOOL detailsAvailable = CUIAccessibilityResolve(self, _nativeDetailsBy, 0, YES) != nil;
  CUIFocusViewEventEmitter::OnNativeAccessibilitySnapshot value{};
  value.ownerId = _ownerId.UTF8String;
  value.target = (int)self.tag;
  value.windowId = CUIInputWindowIdentity(self.window).UTF8String;
  value.platform = CUIFocusViewEventEmitter::OnNativeAccessibilitySnapshotPlatform::Ios;
  value.selected = (self.accessibilityTraits & UIAccessibilityTraitSelected) != 0;
  value.containerType = (int)self.accessibilityContainerType;
  value.containerTitle = "";
  value.roleDescription = "";
  value.label = self.accessibilityLabel.UTF8String ?: "";
  value.hint = self.accessibilityHint.UTF8String ?: "";
  value.value = self.accessibilityValue.UTF8String ?: "";
  value.description = descriptionAvailable ? content[index++].value.UTF8String : "";
  value.details = detailsAvailable ? content[index].value.UTF8String : "";
  value.descriptionAvailable = descriptionAvailable;
  value.detailsAvailable = detailsAvailable;
  value.collection = [self collectionAccessibilitySnapshot].UTF8String;
  value.observedAt = NSProcessInfo.processInfo.systemUptime * 1000;
  std::static_pointer_cast<const CUIFocusViewEventEmitter>(_eventEmitter)->onNativeAccessibilitySnapshot(value);
}

- (void)emitMotionGeometry:(NSDictionary *)data
{
  if (!_eventEmitter) return;
  CUIFocusViewEventEmitter::OnNativeMotionGeometry value{};
  value.ownerId = [data[@"ownerId"] UTF8String]; value.bindingId = [data[@"bindingId"] UTF8String]; value.target = [data[@"target"] intValue];
  NSString *kind = data[@"kind"];
  value.kind = [kind isEqual:@"mount-before"] ? CUIFocusViewEventEmitter::OnNativeMotionGeometryKind::MountBefore : [kind isEqual:@"mount-after"] ? CUIFocusViewEventEmitter::OnNativeMotionGeometryKind::MountAfter : [kind isEqual:@"frame"] ? CUIFocusViewEventEmitter::OnNativeMotionGeometryKind::Frame : [kind isEqual:@"detached"] ? CUIFocusViewEventEmitter::OnNativeMotionGeometryKind::Detached : CUIFocusViewEventEmitter::OnNativeMotionGeometryKind::Sample;
  value.requestId = [data[@"requestId"] UTF8String]; value.windowId = [data[@"windowId"] UTF8String]; value.scopeOwnerId = [data[@"scopeOwnerId"] UTF8String];
  value.epoch = [data[@"epoch"] doubleValue]; value.attachmentRevision = [data[@"attachmentRevision"] doubleValue]; value.geometryRevision = [data[@"geometryRevision"] doubleValue];
  value.commitRevision = [data[@"commitRevision"] UTF8String]; value.transactionId = [data[@"transactionId"] UTF8String]; value.attached = [data[@"attached"] boolValue];
  value.snapshot = [data[@"snapshot"] UTF8String]; value.error = [data[@"error"] UTF8String]; value.observedAt = [data[@"observedAt"] doubleValue];
  std::static_pointer_cast<const CUIFocusViewEventEmitter>(_eventEmitter)->onNativeMotionGeometry(value);
}
- (void)queryMotionGeometry:(NSString *)owner bindingId:(NSString *)binding requestId:(NSString *)requestId
{
  [_motionGeometry queryOwner:owner binding:binding requestId:requestId];
}
- (NSDictionary *)motionSnapshotIdentity { return [_motionGeometry snapshotIdentity]; }
- (void)mountingTransactionWillMount:(const MountingTransaction &)transaction withSurfaceTelemetry:(const SurfaceTelemetry &)surfaceTelemetry
{
  [_motionGeometry captureKind:@"mount-before" requestId:@"" transaction:[NSString stringWithFormat:@"ios-surface:%d:mount:%lld", transaction.getSurfaceId(), (long long)transaction.getNumber()]];
}
- (void)mountingTransactionDidMount:(const MountingTransaction &)transaction withSurfaceTelemetry:(const SurfaceTelemetry &)surfaceTelemetry
{
  [_motionGeometry captureKind:@"mount-after" requestId:@"" transaction:[NSString stringWithFormat:@"ios-surface:%d:mount:%lld", transaction.getSurfaceId(), (long long)transaction.getNumber()]];
}

- (void)emitMotionColors:(NSDictionary *)data
{
  if (!_eventEmitter) return;
  CUIFocusViewEventEmitter::OnNativeMotionColors value{};
  value.ownerId = [data[@"ownerId"] UTF8String];
  value.target = [data[@"target"] intValue];
  value.kind = [data[@"kind"] isEqual:@"sample"] ? CUIFocusViewEventEmitter::OnNativeMotionColorsKind::Sample : CUIFocusViewEventEmitter::OnNativeMotionColorsKind::Environment;
  value.requestId = [data[@"requestId"] UTF8String];
  value.windowId = [data[@"windowId"] UTF8String];
  value.scopeOwnerId = [data[@"scopeOwnerId"] UTF8String];
  value.epoch = [data[@"epoch"] doubleValue];
  value.environmentRevision = [data[@"environmentRevision"] doubleValue];
  value.attached = [data[@"attached"] boolValue];
  value.colors = [data[@"colors"] UTF8String];
  value.error = [data[@"error"] UTF8String];
  value.observedAt = [data[@"observedAt"] doubleValue];
  std::static_pointer_cast<const CUIFocusViewEventEmitter>(_eventEmitter)->onNativeMotionColors(value);
}

- (void)sampleMotionColors:(NSString *)ownerId requestId:(NSString *)requestId request:(NSString *)request
{
  [_motionColors sampleOwner:ownerId requestId:requestId request:request];
}

- (void)traitCollectionDidChange:(UITraitCollection *)previousTraitCollection
{
  [super traitCollectionDidChange:previousTraitCollection];
  [_motionColors synchronize];
}

- (void)tintColorDidChange
{
  [super tintColorDidChange];
  [_motionColors synchronize];
}

- (BOOL)accessibilityActivate
{
  if (!_nativePressable) return [super accessibilityActivate];
  CUIRecordMenuPointerVirtual(self.window);
  UIWindow *window = self.window;
  BOOL sceneActive = window.windowScene == nil || window.windowScene.activationState == UISceneActivationStateForegroundActive;
  if (!_eventEmitter || !window.isKeyWindow || window.hidden || self.hidden || self.alpha <= 0 || !sceneActive || UIApplication.sharedApplication.applicationState != UIApplicationStateActive) return NO;
  CUIFocusViewEventEmitter::OnNativeActivation value{};
  value.kind = "activation";
  value.ownerId = _ownerId.UTF8String;
  value.target = (int)self.tag;
  value.source = CUIFocusViewEventEmitter::OnNativeActivationSource::IosAccessibilityActivate;
  value.observedAt = NSProcessInfo.processInfo.systemUptime * 1000;
  value.activationId = ++_activationId;
  value.scopeOwnerId = "";
  value.windowId = CUIInputWindowIdentity(window).UTF8String;
  value.epoch = 0;
  for (UIView *parent = self.superview; parent; parent = parent.superview) {
    if ([parent isKindOfClass:CUIKeyboardScope.class]) {
      NSDictionary *session = [(CUIKeyboardScope *)parent activationSession];
      value.scopeOwnerId = [session[@"scopeOwnerId"] UTF8String];
      value.windowId = [session[@"windowId"] UTF8String];
      value.epoch = [session[@"epoch"] doubleValue];
      break;
    }
  }
  std::static_pointer_cast<const CUIFocusViewEventEmitter>(_eventEmitter)->onNativeActivation(value);
  [super accessibilityActivate];
  CUIActivateWindowPointer(self);
  return YES;
}

- (BOOL)canBecomeFocused { return _nativeTabStop && [self canBecomeFirstResponder]; }
- (BOOL)canBecomeFirstResponder { return _keyboardFocusable && self.window != nil && !self.hidden && self.alpha > 0; }

- (void)emitFocus:(BOOL)focused
{
  if (_focusAcknowledged == focused) return;
  _focusAcknowledged = focused;
  CUIAdvanceInputRevision(self.window);
  if (!focused) [self cancelHeldKeys];
  const auto origin = _origin;
  if (!focused) _origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Unknown;
  if (!_eventEmitter) return;
  CUIFocusViewEventEmitter::OnNativeFocusChange value{};
  value.ownerId = _ownerId.UTF8String;
  value.target = (int)self.tag;
  value.isFocused = focused;
  value.isFocusVisible = focused && self.window.isKeyWindow && [CUIInputWindowModality(self.window) isEqualToString:@"keyboard"];
  value.origin = origin;
  if (origin == CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Unknown) {
    NSString *modality = CUIInputWindowModality(self.window);
    if ([modality isEqualToString:@"keyboard"]) value.origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Keyboard;
    else if ([modality isEqualToString:@"pointer"]) value.origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Pointer;
  }
  value.timestamp = NSProcessInfo.processInfo.systemUptime * 1000;
  std::static_pointer_cast<const CUIFocusViewEventEmitter>(_eventEmitter)->onNativeFocusChange(value);
  if (!ReactNativeFeatureFlags::enableImperativeFocus()) {
    if (focused) _eventEmitter->onFocus();
    else _eventEmitter->onBlur();
  }
}

- (BOOL)becomeFirstResponder
{
  BOOL accepted = [super becomeFirstResponder];
  if (accepted) [self emitFocus:YES];
  return accepted;
}

- (BOOL)resignFirstResponder
{
  BOOL accepted = [super resignFirstResponder];
  if (accepted) [self emitFocus:NO];
  return accepted;
}

- (void)didUpdateFocusInContext:(UIFocusUpdateContext *)context withAnimationCoordinator:(UIFocusAnimationCoordinator *)coordinator
{
  [super didUpdateFocusInContext:context withAnimationCoordinator:coordinator];
  if (context.nextFocusedView == self) {
    [self becomeFirstResponder];
    [self emitFocus:YES];
  } else if (context.previouslyFocusedView == self) {
    [self resignFirstResponder];
    [self emitFocus:NO];
  }
}

- (void)requestKeyboardFocus:(NSString *)ownerId
{
  if (![_ownerId isEqualToString:ownerId] || ![self canBecomeFirstResponder]) return;
  UIWindow *window = self.window;
  BOOL sceneActive = window.windowScene == nil || window.windowScene.activationState == UISceneActivationStateForegroundActive;
  if (!window.isKeyWindow || window.hidden || !sceneActive || UIApplication.sharedApplication.applicationState != UIApplicationStateActive) return;
  _origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Programmatic;
  [self becomeFirstResponder];
  UIFocusSystem *system = [UIFocusSystem focusSystemForEnvironment:self];
  [system requestFocusUpdateToEnvironment:self];
  [system updateFocusIfNeeded];
}

- (void)requestKeyboardBlur:(NSString *)ownerId
{
  if ([_ownerId isEqualToString:ownerId]) [self resignFirstResponder];
}
- (void)requestContainerFocus:(NSString *)ownerId
{
  if (![_ownerId isEqualToString:ownerId]) return;
  UIView *focused = CUIInputFocusedView(self.window);
  if (focused && [focused isDescendantOfView:self]) return;
  [self requestKeyboardFocus:ownerId];
}

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
  RCTCUIFocusViewHandleCommand(self, commandName, args);
}

- (NSString *)captureToken:(UIKey *)key
{
  UIKeyModifierFlags flags = key.modifierFlags;
  return [NSString stringWithFormat:@"%d%d%d%d:%@", !!(flags & UIKeyModifierShift),
      !!(flags & UIKeyModifierAlternate), !!(flags & UIKeyModifierControl),
      !!(flags & UIKeyModifierCommand), CUIInputKeyName(key)];
}

- (void)emitKey:(UIPress *)press down:(BOOL)down repeat:(BOOL)repeat cancelled:(BOOL)cancelled handled:(BOOL)handled
{
  UIKey *key = press.key;
  if (!key || !_eventEmitter) return;
  UIKeyModifierFlags flags = key.modifierFlags;
  CUIFocusViewEventEmitter::OnNativeKey value{};
  value.kind = "keyboard";
  value.ownerId = _ownerId.UTF8String;
  value.target = (int)self.tag;
  value.key = CUIInputKeyName(key).UTF8String;
  value.nativeCode = (int)key.keyCode;
  value.characters = key.characters.UTF8String ?: "";
  value.phase = down ? CUIFocusViewEventEmitter::OnNativeKeyPhase::Down : CUIFocusViewEventEmitter::OnNativeKeyPhase::Up;
  value.repeat = repeat;
  value.cancelled = cancelled;
  value.shiftKey = flags & UIKeyModifierShift;
  value.altKey = flags & UIKeyModifierAlternate;
  value.ctrlKey = flags & UIKeyModifierControl;
  value.metaKey = flags & UIKeyModifierCommand;
  value.capsLock = flags & UIKeyModifierAlphaShift;
  value.nativeModifierData = std::to_string((unsigned long long)flags);
  value.nativeDefaultHandled = handled;
  value.timestamp = (cancelled ? NSProcessInfo.processInfo.systemUptime : press.timestamp) * 1000;
  std::static_pointer_cast<const CUIFocusViewEventEmitter>(_eventEmitter)->onNativeKey(value);
}

- (BOOL)capturesObservedKey:(UIKey *)key
{
  NSNumber *code = @(key.keyCode);
  return _keyboardFocusable && (self.isFirstResponder || self.isFocused) && (_held[code] ? [_consumed containsObject:code] : [_capturedKeys containsObject:[self captureToken:key]]);
}

- (NSSet<UIPress *> *)processPresses:(NSSet<UIPress *> *)presses down:(BOOL)down cancelled:(BOOL)cancelled
{
  NSMutableSet<UIPress *> *unhandled = [NSMutableSet set];
  for (UIPress *press in presses) {
    if (!press.key || !_keyboardFocusable || (!self.isFirstResponder && !self.isFocused)) {
      [unhandled addObject:press];
      continue;
    }
    NSNumber *code = @(press.key.keyCode);
    BOOL repeat = down && _held[code] != nil;
    BOOL handled = [_consumed containsObject:code];
    if (down) {
      if (!repeat) handled = [_capturedKeys containsObject:[self captureToken:press.key]];
      _held[code] = press;
      if (handled) [_consumed addObject:code];
    }
    _origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Keyboard;
    CUIRecordWindowModality(self.window, @"keyboard");
    [self emitKey:press down:down repeat:repeat cancelled:cancelled handled:handled];
    if (!down) {
      [_held removeObjectForKey:code];
      [_consumed removeObject:code];
    }
    if (!handled) [unhandled addObject:press];
  }
  return unhandled;
}

- (void)pressesBegan:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
  NSSet *remaining = [self processPresses:presses down:YES cancelled:NO];
  if (remaining.count) [super pressesBegan:remaining withEvent:event];
}

- (void)pressesEnded:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
  NSSet *remaining = [self processPresses:presses down:NO cancelled:NO];
  if (remaining.count) [super pressesEnded:remaining withEvent:event];
}

- (void)pressesCancelled:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
  NSSet *remaining = [self processPresses:presses down:NO cancelled:YES];
  if (remaining.count) [super pressesCancelled:remaining withEvent:event];
}

- (void)cancelHeldKeys
{
  for (NSNumber *code in _held.allKeys) {
    [self emitKey:_held[code] down:NO repeat:NO cancelled:YES handled:[_consumed containsObject:code]];
  }
  [_held removeAllObjects];
  [_consumed removeAllObjects];
}

- (void)applicationWillResignActive:(NSNotification *)notification
{
  [self cancelHeldKeys];
  [_scrollAnchor invalidate];
}

- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{
  _origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Pointer;
  CUIRecordWindowModality(self.window, @"pointer");
  [super touchesBegan:touches withEvent:event];
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &next = *std::static_pointer_cast<const CUIFocusViewProps>(props);
  [self setCuiDrawingEnabled:next.nativeMotionDrawingOwner];
  [self setCuiProjectionRadii:[NSString stringWithUTF8String:next.nativeMotionProjectionRadii.c_str()]];
  [_scrollAnchor prepareTag:next.nativeScrollAnchorTag key:[NSString stringWithUTF8String:next.nativeScrollAnchorKey.c_str()] revision:[NSString stringWithUTF8String:next.nativeScrollAnchorRevision.c_str()]];
  NSString *owner = [NSString stringWithUTF8String:next.ownerId.c_str()];
  NSMutableSet *capture = [NSMutableSet set];
  for (const auto &key : next.capturedKeys) [capture addObject:[NSString stringWithUTF8String:key.c_str()]];
  if (![_ownerId isEqualToString:owner] || !next.keyboardFocusable || ![_capturedKeys isEqual:capture]) [self cancelHeldKeys];
  _ownerId = owner;
  _nativeCollectionBinding = [NSString stringWithUTF8String:next.nativeCollectionBinding.c_str()];
  id collection = [NSJSONSerialization JSONObjectWithData:[[NSString stringWithUTF8String:next.nativeCollectionSemantics.c_str()] dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
  _nativeCollectionSemantics = [collection isKindOfClass:NSDictionary.class] ? collection : nil;
  _keyboardFocusable = next.keyboardFocusable;
  _nativeTabStop = next.nativeTabStop;
  _nativePressable = next.nativePressable;
  _nativeNavigation = next.nativeNavigation;
  _capturedKeys = capture;
  NSMutableArray<NSString *> *labelledBy = [NSMutableArray array];
  for (const auto &id : next.nativeLabelledBy) [labelledBy addObject:[NSString stringWithUTF8String:id.c_str()]];
  NSMutableArray<NSString *> *describedBy = [NSMutableArray array];
  for (const auto &id : next.nativeDescribedBy) [describedBy addObject:[NSString stringWithUTF8String:id.c_str()]];
  NSMutableArray<NSString *> *detailsBy = [NSMutableArray array];
  for (const auto &id : next.nativeDetailsBy) [detailsBy addObject:[NSString stringWithUTF8String:id.c_str()]];
  _nativeLabelledBy = labelledBy;
  _nativeDescribedBy = describedBy;
  _nativeDetailsBy = detailsBy;
  _nativeDescriptionTag = next.nativeDescriptionTag;
  _nativeDescriptionLabel = [NSString stringWithUTF8String:next.nativeDescriptionLabel.c_str()];
  _nativeDetailsLabel = [NSString stringWithUTF8String:next.nativeDetailsLabel.c_str()];
  if (!_keyboardFocusable) [self resignFirstResponder];
  [super updateProps:props oldProps:oldProps];
  _nativeMotionVisible = next.nativeMotionVisible;
  _motionProjectionRevision = [NSString stringWithUTF8String:next.nativeMotionProjectionRevision.c_str()];
  [super setHidden:_authoredHidden || !_nativeMotionVisible];
  [_motionGeometry configureOwner:_ownerId binding:[NSString stringWithUTF8String:next.nativeMotionGeometryBinding.c_str()] revision:[NSString stringWithUTF8String:next.nativeMotionGeometryRevision.c_str()]];
  [_motionColors updateOwner:_ownerId enabled:next.nativeMotionColorObservation];
  [_motionColors synchronize];
}

- (void)setHidden:(BOOL)hidden {
  if (!_motionVisibilityReady) { [super setHidden:hidden]; return; }
  _authoredHidden = hidden;
  [super setHidden:hidden || !_nativeMotionVisible];
}

- (NSString *)motionProjectionRevision { return _motionProjectionRevision ?: @""; }

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  [_motionGeometry windowChanged];
  [_motionColors synchronize];
  if (!self.window) {
    [_scrollAnchor invalidate];
    [self cancelHeldKeys];
    [self emitFocus:NO];
    _origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Unknown;
  }
}

- (void)prepareForRecycle
{
  [_motionGeometry invalidate];
  [_motionColors invalidate];
  [_scrollAnchor invalidate];
  [self cancelHeldKeys];
  [self resignFirstResponder];
  _ownerId = @"";
  _nativeCollectionBinding = @"";
  _nativeCollectionSemantics = nil;
  _capturedKeys = [NSSet set];
  _keyboardFocusable = YES;
  _nativeTabStop = YES;
  _nativePressable = NO;
  _nativeNavigation = NO;
  _nativeLabelledBy = nil;
  _nativeDescribedBy = nil;
  _nativeDetailsBy = nil;
  _nativeDescriptionTag = 0;
  _nativeDescriptionLabel = @"Description";
  _nativeDetailsLabel = @"Details";
  _callerAccessibilityContent = nil;
  _focusAcknowledged = NO;
  _origin = CUIFocusViewEventEmitter::OnNativeFocusChangeOrigin::Unknown;
  [super prepareForRecycle];
}

- (void)dealloc
{
  [_scrollAnchor invalidate];
  [NSNotificationCenter.defaultCenter removeObserver:self];
}

@end

Class<RCTComponentViewProtocol> CUIFocusViewCls(void) { return CUIFocusView.class; }
