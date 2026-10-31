#import "CUIMotionColorSampler.h"
#import "CUIInputWindow.h"
#import "CUIKeyboardScope.h"
#import <React/RCTConvert.h>
#import <cmath>

@implementation CUIMotionColorSampler {
  __weak UIView *_root;
  void (^_emit)(NSDictionary *);
  NSString *_owner;
  NSString *_signature;
  UITraitCollection *_lastTraits;
  UIColor *_lastTint;
  BOOL _enabled;
  NSUInteger _revision;
}

- (instancetype)initWithRoot:(UIView *)root emit:(void (^)(NSDictionary *))emit
{
  if (self = [super init]) { _root = root; _emit = [emit copy]; _owner = @""; }
  return self;
}

- (void)updateOwner:(NSString *)owner enabled:(BOOL)enabled
{
  if (![_owner isEqualToString:owner] || _enabled != enabled) { _revision++; _signature = nil; }
  _owner = [owner copy];
  _enabled = enabled;
}

- (NSDictionary *)environment
{
  UIView *root = _root;
  UIWindow *window = root.window;
  NSString *scopeOwner = @"";
  double epoch = 0;
  for (UIView *parent = window ? root.superview : nil; parent; parent = parent.superview) {
    if ([parent isKindOfClass:CUIKeyboardScope.class]) {
      NSDictionary *session = [(CUIKeyboardScope *)parent activationSession];
      scopeOwner = session[@"scopeOwnerId"] ?: @"";
      epoch = [session[@"epoch"] doubleValue];
      break;
    }
  }
  return @{@"ownerId": _owner, @"target": @(root.tag), @"windowId": window ? CUIInputWindowIdentity(window) : @"",
           @"scopeOwnerId": scopeOwner, @"epoch": @(epoch), @"environmentRevision": @(_revision),
           @"attached": @(window != nil), @"observedAt": @(NSProcessInfo.processInfo.systemUptime * 1000)};
}

- (NSMutableDictionary *)refreshEnvironment
{
  NSMutableDictionary *environment = [[self environment] mutableCopy];
  NSString *signature = [NSString stringWithFormat:@"%@|%@|%@", environment[@"windowId"], environment[@"scopeOwnerId"], environment[@"epoch"]];
  UITraitCollection *traits = _root.traitCollection;
  UIColor *tint = _root.tintColor;
  BOOL sameTraits = traits == _lastTraits || [traits isEqual:_lastTraits];
  BOOL sameTint = tint == _lastTint || [tint isEqual:_lastTint];
  if (![_signature isEqualToString:signature] || !sameTraits || !sameTint) {
    _signature = signature;
    _lastTraits = [traits copy];
    _lastTint = tint;
    _revision++;
    environment[@"environmentRevision"] = @(_revision);
  }
  return environment;
}

- (void)emitEnvironment:(NSDictionary *)environment requestId:(NSString *)requestId
{
  if (!_enabled || !_emit) return;
  NSMutableDictionary *data = [environment mutableCopy];
  data[@"kind"] = @"environment";
  data[@"requestId"] = requestId ?: @"";
  data[@"colors"] = @"[]";
  data[@"error"] = @"";
  _emit(data);
}

- (void)synchronize
{
  if (!_enabled) return;
  NSUInteger before = _revision;
  NSDictionary *environment = [self refreshEnvironment];
  if (before != _revision) [self emitEnvironment:environment requestId:@""];
}

- (void)sampleOwner:(NSString *)owner requestId:(NSString *)requestId request:(NSString *)request
{
  if (!_enabled || ![_owner isEqualToString:owner] || requestId.length == 0) return;
  NSMutableDictionary *environment = [self refreshEnvironment];
  NSError *parseError = nil;
  id parsed = [NSJSONSerialization JSONObjectWithData:[request dataUsingEncoding:NSUTF8StringEncoding] options:0 error:&parseError];
  if ([parsed isKindOfClass:NSDictionary.class] && [parsed[@"kind"] isEqual:@"environment"]) {
    [self emitEnvironment:environment requestId:requestId];
    return;
  }
  NSString *error = @"";
  NSArray *input = [parsed isKindOfClass:NSDictionary.class] ? parsed[@"colors"] : nil;
  if (parseError || ![parsed isKindOfClass:NSDictionary.class] || ![input isKindOfClass:NSArray.class]) error = @"invalid-color-request";
  else if (![environment[@"attached"] boolValue]) error = @"native-color-view-detached";
  else if (![parsed[@"windowId"] isEqual:environment[@"windowId"]] || ![parsed[@"scopeOwnerId"] isEqual:environment[@"scopeOwnerId"]] || ![parsed[@"epoch"] isEqual:environment[@"epoch"]] || ![parsed[@"environmentRevision"] isEqual:environment[@"environmentRevision"]]) error = @"stale-native-color-environment";
  NSMutableArray *colors = [NSMutableArray array];
  if (error.length == 0) {
    for (id encoded in input) {
      if (![encoded isKindOfClass:NSNumber.class] && ![encoded isKindOfClass:NSDictionary.class]) { error = @"unresolved-native-color"; [colors addObject:NSNull.null]; continue; }
      UIColor *source = [RCTConvert UIColor:encoded];
      UIColor *resolved = [source resolvedColorWithTraitCollection:_root.traitCollection];
      CGFloat red, green, blue, alpha;
      BOOL available = resolved && [resolved getRed:&red green:&green blue:&blue alpha:&alpha];
      BOOL wide = resolved && CGColorSpaceIsWideGamutRGB(CGColorGetColorSpace(resolved.CGColor));
      if (!available || wide || !std::isfinite(red) || !std::isfinite(green) || !std::isfinite(blue) || !std::isfinite(alpha) || red < 0 || red > 1 || green < 0 || green > 1 || blue < 0 || blue > 1 || alpha < 0 || alpha > 1) {
        error = wide ? @"unsupported-native-color-space" : @"unresolved-native-color";
        [colors addObject:NSNull.null];
      } else [colors addObject:@[@(red), @(green), @(blue), @(alpha)]];
    }
  }
  if (error.length) [self emitEnvironment:environment requestId:@""];
  environment[@"kind"] = @"sample";
  environment[@"requestId"] = requestId;
  environment[@"colors"] = [[NSString alloc] initWithData:[NSJSONSerialization dataWithJSONObject:colors options:0 error:nil] encoding:NSUTF8StringEncoding];
  environment[@"error"] = error;
  if (_emit) _emit(environment);
}

- (void)invalidate
{
  _enabled = NO;
  _revision++;
  _signature = nil;
  _lastTraits = nil;
  _lastTint = nil;
  _owner = @"";
}
@end
