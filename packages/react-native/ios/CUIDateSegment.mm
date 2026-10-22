#import "CUIDateSegment.h"
#import "CUIInputWindow.h"
#import <React/RCTConversions.h>
#import <React/RCTMountingTransactionObserving.h>
#import <react/renderer/components/CodonNativeInputSpec/ComponentDescriptors.h>
#import <react/renderer/components/CodonNativeInputSpec/EventEmitters.h>
#import <react/renderer/components/CodonNativeInputSpec/Props.h>
#import <react/renderer/components/CodonNativeInputSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface CUIDatePosition : UITextPosition
@property(nonatomic, weak) CUIDateSegment *owner;
@property(nonatomic) NSUInteger generation;
@property(nonatomic) NSInteger index;
@end
@implementation CUIDatePosition
@end

@interface CUIDateRange : UITextRange
@property(nonatomic, strong) CUIDatePosition *first;
@property(nonatomic, strong) CUIDatePosition *last;
@end
@implementation CUIDateRange
- (UITextPosition *)start { return self.first; }
- (UITextPosition *)end { return self.last; }
- (BOOL)isEmpty { return self.first.index == self.last.index; }
- (id)copyWithZone:(NSZone *)zone { return self; }
@end

@interface CUIDateSegment () <RCTCUIDateSegmentViewProtocol, RCTMountingTransactionObserving>
@end

@implementation CUIDateSegment {
  NSString *_ownerId, *_segmentId, *_bindingRevision, *_displayText, *_locale, *_keyboardMode;
  NSMutableString *_document;
  NSRange _selection, _marked;
  NSUInteger _epoch, _sequence;
  SurfaceId _surface;
  BOOL _disabled, _readOnly, _editable, _wasActive;
  UITextInputStringTokenizer *_tokenizer;
  __weak id<UITextInputDelegate> _inputDelegate;
  NSDictionary<NSAttributedStringKey, id> *_markedTextStyle;
  UIView *_readOnlyKeyboard;
  NSWritingDirection _writingDirection;
}
@synthesize inputDelegate = _inputDelegate;
@synthesize markedTextStyle = _markedTextStyle;

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<CUIDateSegmentComponentDescriptor>();
}
- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    _props = std::make_shared<const CUIDateSegmentProps>();
    _ownerId = @""; _segmentId = @""; _bindingRevision = @""; _displayText = @""; _locale = @""; _keyboardMode = @"numeric";
    _document = [NSMutableString new]; _marked = NSMakeRange(NSNotFound, 0);
    _surface = -1; _epoch = 1; _tokenizer = [[UITextInputStringTokenizer alloc] initWithTextInput:self];
    _readOnlyKeyboard = [[UIView alloc] initWithFrame:CGRectZero];
    _writingDirection = NSWritingDirectionNatural;
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(applicationChanged:) name:UIApplicationDidBecomeActiveNotification object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(applicationChanged:) name:UIApplicationWillResignActiveNotification object:nil];
  }
  return self;
}
- (void)dealloc { [[NSNotificationCenter defaultCenter] removeObserver:self]; }
- (BOOL)active
{
  for (UIView *view = self; view; view = view.superview) if (view.hidden) return NO;
  return self.window.isKeyWindow && !self.window.hidden && UIApplication.sharedApplication.applicationState == UIApplicationStateActive &&
    (!self.window.windowScene || self.window.windowScene.activationState == UISceneActivationStateForegroundActive);
}
- (BOOL)canEdit { return [self active] && self.isFirstResponder && !_disabled && !_readOnly && _editable; }
- (void)clearTransientDocument
{
  [_inputDelegate textWillChange:self]; [_inputDelegate selectionWillChange:self];
  [_document setString:@""]; _selection = NSMakeRange(0, 0); _marked = NSMakeRange(NSNotFound, 0);
  [_inputDelegate textDidChange:self]; [_inputDelegate selectionDidChange:self];
}
- (void)applicationChanged:(NSNotification *)note
{
  _epoch++; [self clearTransientDocument];
  if ([note.name isEqualToString:UIApplicationWillResignActiveNotification]) [self resignFirstResponder];
  [self emit:@"status" text:@"" replacement:NSMakeRange(0, 0)];
}
- (void)didMoveToWindow
{
  [super didMoveToWindow]; _epoch++; [self clearTransientDocument];
  [self emit:@"status" text:@"" replacement:NSMakeRange(0, 0)];
}
- (void)finalizeUpdates:(RNComponentViewUpdateMask)mask
{
  [super finalizeUpdates:mask]; [self emit:@"status" text:@"" replacement:NSMakeRange(0, 0)];
}
- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps
{
  const auto &next = *std::static_pointer_cast<const CUIDateSegmentProps>(props);
  NSString *owner = RCTNSStringFromString(next.ownerId), *segment = RCTNSStringFromString(next.segmentId), *revision = RCTNSStringFromString(next.bindingRevision);
  BOOL ownerChanged = ![_ownerId isEqual:owner] || ![_segmentId isEqual:segment];
  BOOL replaced = ownerChanged || ![_bindingRevision isEqual:revision];
  if (replaced) { if (ownerChanged) [self resignFirstResponder]; _epoch++; [self clearTransientDocument]; }
  _ownerId = owner; _segmentId = segment; _bindingRevision = revision; _displayText = RCTNSStringFromString(next.displayText); _locale = RCTNSStringFromString(next.locale);
  NSString *keyboardMode = RCTNSStringFromString(next.keyboardMode);
  BOOL modeChanged = ![_keyboardMode isEqual:keyboardMode];
  _keyboardMode = keyboardMode;
  BOOL traitsChanged = modeChanged || _readOnly != next.segmentReadOnly || _disabled != next.segmentDisabled || _editable != next.segmentEditable;
  _disabled = next.segmentDisabled; _readOnly = next.segmentReadOnly; _editable = next.segmentEditable;
  if (_disabled || !_editable) [self resignFirstResponder];
  if (traitsChanged) { _epoch++; [self clearTransientDocument]; [self reloadInputViews]; }
  self.isAccessibilityElement = YES;
  self.accessibilityValue = _displayText;
  [super updateProps:props oldProps:oldProps];
}
- (BOOL)canBecomeFirstResponder { return !_disabled && _editable; }
- (BOOL)canBecomeFocused { return !_disabled && _editable; }
- (UIView *)inputView { return _readOnly ? _readOnlyKeyboard : nil; }
- (UIKeyboardType)keyboardType { return !_readOnly && [_keyboardMode isEqualToString:@"numeric"] ? UIKeyboardTypeNumberPad : UIKeyboardTypeDefault; }
- (UITextAutocorrectionType)autocorrectionType { return UITextAutocorrectionTypeNo; }
- (UITextAutocapitalizationType)autocapitalizationType { return UITextAutocapitalizationTypeNone; }
- (UITextSpellCheckingType)spellCheckingType { return UITextSpellCheckingTypeNo; }
- (BOOL)becomeFirstResponder
{
  if (![self active] || ![self canBecomeFirstResponder]) return NO;
  BOOL was = self.isFirstResponder, result = [super becomeFirstResponder];
  if (result && !was) { [self clearTransientDocument]; [self emit:@"focus" text:@"" replacement:NSMakeRange(0, 0)]; }
  return result;
}
- (BOOL)resignFirstResponder
{
  BOOL was = self.isFirstResponder, result = [super resignFirstResponder];
  if (was && result) { [self emit:@"blur" text:@"" replacement:NSMakeRange(0, 0)]; [self clearTransientDocument]; }
  return result;
}
- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{
  [super touchesEnded:touches withEvent:event];
  if (touches.count == 1 && CGRectContainsPoint(self.bounds, [touches.anyObject locationInView:self])) [self becomeFirstResponder];
}
- (NSDictionary *)formSegmentIdentity
{
  if (![self active] || _surface <= 0 || self.tag <= 0 || !_ownerId.length || !_segmentId.length || !_bindingRevision.length) return nil;
  return @{ @"ownerId":_ownerId, @"segmentId":_segmentId, @"bindingRevision":_bindingRevision,
    @"target":@(self.tag), @"nativeInstance":[NSString stringWithFormat:@"uikit-date-segment:%p", self],
    @"surfaceId":@(_surface), @"windowId":CUIInputWindowIdentity(self.window), @"epoch":@(_epoch) };
}
- (BOOL)requestFormSegmentFocus:(NSDictionary *)identity
{
  if (![[self formSegmentIdentity] isEqual:identity] || ![self canBecomeFirstResponder]) return NO;
  [self requestSegmentFocus:identity[@"ownerId"] segmentId:identity[@"segmentId"] bindingRevision:identity[@"bindingRevision"]
      windowId:identity[@"windowId"] epoch:[identity[@"epoch"] doubleValue]];
  return self.isFirstResponder && [[self formSegmentIdentity] isEqual:identity];
}
- (BOOL)matchesOwner:(NSString *)owner segment:(NSString *)segment revision:(NSString *)revision window:(NSString *)window epoch:(double)epoch
{
  return [_ownerId isEqual:owner] && [_segmentId isEqual:segment] && [_bindingRevision isEqual:revision] &&
    [window isEqual:CUIInputWindowIdentity(self.window)] && epoch == _epoch && [self active];
}
- (void)requestSegmentFocus:(NSString *)ownerId segmentId:(NSString *)segmentId bindingRevision:(NSString *)bindingRevision windowId:(NSString *)windowId epoch:(double)epoch
{
  if ([self matchesOwner:ownerId segment:segmentId revision:bindingRevision window:windowId epoch:epoch]) [self becomeFirstResponder];
}
- (void)requestSegmentBlur:(NSString *)ownerId segmentId:(NSString *)segmentId bindingRevision:(NSString *)bindingRevision windowId:(NSString *)windowId epoch:(double)epoch
{
  if ([self matchesOwner:ownerId segment:segmentId revision:bindingRevision window:windowId epoch:epoch]) [self resignFirstResponder];
}
- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args { RCTCUIDateSegmentHandleCommand(self, commandName, args); }
- (void)emit:(NSString *)kind text:(NSString *)text replacement:(NSRange)range
{
  [self emit:kind text:text replacement:range nativeData:@{}];
}
- (void)emit:(NSString *)kind text:(NSString *)text replacement:(NSRange)range nativeData:(NSDictionary *)nativeData
{
  if (!_eventEmitter || !_ownerId.length || !_segmentId.length) return;
  CUIDateSegmentEventEmitter::OnNativeSegmentInput data{};
  data.kind = kind.UTF8String; data.ownerId = _ownerId.UTF8String; data.segmentId = _segmentId.UTF8String; data.bindingRevision = _bindingRevision.UTF8String;
  data.nativeInstance = [NSString stringWithFormat:@"uikit-date-segment:%p", self].UTF8String;
  data.target = (int)self.tag; data.surfaceId = _surface; data.windowId = CUIInputWindowIdentity(self.window).UTF8String;
  data.epoch = _epoch; data.sequence = ++_sequence; data.timestamp = NSProcessInfo.processInfo.systemUptime * 1000;
  NSData *raw = [NSJSONSerialization dataWithJSONObject:nativeData options:NSJSONWritingSortedKeys error:nil];
  data.nativeData = raw ? [[NSString alloc] initWithData:raw encoding:NSUTF8StringEncoding].UTF8String : "{}";
  data.text = text.UTF8String; data.document = _document.UTF8String;
  data.replacementStart = (int)range.location; data.replacementEnd = (int)NSMaxRange(range);
  data.selectionStart = (int)_selection.location; data.selectionEnd = (int)NSMaxRange(_selection);
  data.composingStart = _marked.location == NSNotFound ? -1 : (int)_marked.location;
  data.composingEnd = _marked.location == NSNotFound ? -1 : (int)NSMaxRange(_marked);
  data.focused = self.isFirstResponder; data.active = [self active];
  std::static_pointer_cast<const CUIDateSegmentEventEmitter>(_eventEmitter)->onNativeSegmentInput(data);
}
- (CUIDatePosition *)position:(NSInteger)index
{
  CUIDatePosition *position = [CUIDatePosition new]; position.owner = self; position.generation = _epoch; position.index = index; return position;
}
- (BOOL)validPosition:(UITextPosition *)position
{
  return [position isKindOfClass:CUIDatePosition.class] && ((CUIDatePosition *)position).owner == self &&
    ((CUIDatePosition *)position).generation == _epoch && ((CUIDatePosition *)position).index >= 0 && ((CUIDatePosition *)position).index <= _document.length;
}
- (CUIDateRange *)range:(NSRange)range
{
  CUIDateRange *value = [CUIDateRange new]; value.first = [self position:range.location]; value.last = [self position:NSMaxRange(range)]; return value;
}
- (BOOL)validRange:(UITextRange *)range
{
  return [self validPosition:range.start] && [self validPosition:range.end] && ((CUIDatePosition *)range.start).index <= ((CUIDatePosition *)range.end).index;
}
- (NSRange)nativeRange:(UITextRange *)range
{
  return NSMakeRange(((CUIDatePosition *)range.start).index, ((CUIDatePosition *)range.end).index - ((CUIDatePosition *)range.start).index);
}
- (BOOL)hasText { return _document.length > 0; }
- (void)insertText:(NSString *)text
{
  if (![self canEdit]) return;
  NSRange replacement = _marked.location == NSNotFound ? _selection : _marked;
  [self replaceNativeRange:replacement text:text kind:@"insert" marked:NO selected:NSMakeRange(text.length, 0) nativeData:@{@"method":@"insertText", @"text":text}];
}
- (void)deleteBackward
{
  if (![self canEdit]) return;
  NSRange range = _selection;
  if (!range.length && range.location) range = [_document rangeOfComposedCharacterSequenceAtIndex:range.location - 1];
  [self replaceNativeRange:range text:@"" kind:@"delete" marked:NO selected:NSMakeRange(0, 0) nativeData:@{@"method":@"deleteBackward"}];
}
- (NSString *)textInRange:(UITextRange *)range { return [self validRange:range] ? [_document substringWithRange:[self nativeRange:range]] : nil; }
- (void)replaceRange:(UITextRange *)range withText:(NSString *)text
{
  if ([self canEdit] && [self validRange:range]) [self replaceNativeRange:[self nativeRange:range] text:text kind:@"insert" marked:NO selected:NSMakeRange(text.length, 0) nativeData:@{@"method":@"replaceRange", @"text":text, @"range":NSStringFromRange([self nativeRange:range])}];
}
- (void)replaceNativeRange:(NSRange)range text:(NSString *)text kind:(NSString *)kind marked:(BOOL)marked selected:(NSRange)selected nativeData:(NSDictionary *)nativeData
{
  if (range.location > _document.length || range.length > _document.length - range.location) return;
  [_inputDelegate textWillChange:self]; [_inputDelegate selectionWillChange:self];
  [_document replaceCharactersInRange:range withString:text];
  _marked = marked ? NSMakeRange(range.location, text.length) : NSMakeRange(NSNotFound, 0);
  NSUInteger start = MIN(selected.location, text.length), count = MIN(selected.length, text.length - start);
  _selection = NSMakeRange(range.location + start, count);
  [_inputDelegate textDidChange:self]; [_inputDelegate selectionDidChange:self];
  [self emit:kind text:text replacement:range nativeData:nativeData];
}
- (UITextRange *)selectedTextRange { return [self range:_selection]; }
- (void)setSelectedTextRange:(UITextRange *)range
{
  if (![self validRange:range]) return;
  [_inputDelegate selectionWillChange:self]; _selection = [self nativeRange:range]; [_inputDelegate selectionDidChange:self];
  [self emit:@"selection" text:@"" replacement:_selection];
}
- (UITextRange *)markedTextRange { return _marked.location == NSNotFound ? nil : [self range:_marked]; }
- (void)setMarkedText:(NSString *)text selectedRange:(NSRange)selectedRange
{
  if (![self canEdit]) return;
  [self replaceNativeRange:_marked.location == NSNotFound ? _selection : _marked text:text ?: @"" kind:@"marked" marked:YES selected:selectedRange nativeData:@{@"method":@"setMarkedText", @"text":text ?: @"", @"selectedRange":NSStringFromRange(selectedRange)}];
}
- (void)unmarkText
{
  if (![self canEdit] || _marked.location == NSNotFound) return;
  NSRange range = _marked; NSString *text = [_document substringWithRange:range]; _marked = NSMakeRange(NSNotFound, 0);
  [self emit:@"unmark" text:text replacement:range nativeData:@{@"method":@"unmarkText"}];
}
- (UITextPosition *)beginningOfDocument { return [self position:0]; }
- (UITextPosition *)endOfDocument { return [self position:_document.length]; }
- (UITextRange *)textRangeFromPosition:(UITextPosition *)fromPosition toPosition:(UITextPosition *)toPosition
{
  if (![self validPosition:fromPosition] || ![self validPosition:toPosition]) return nil;
  NSInteger start = ((CUIDatePosition *)fromPosition).index, end = ((CUIDatePosition *)toPosition).index;
  return [self range:NSMakeRange(MIN(start, end), ABS(end - start))];
}
- (UITextPosition *)positionFromPosition:(UITextPosition *)position offset:(NSInteger)offset
{
  if (![self validPosition:position]) return nil;
  NSInteger index = ((CUIDatePosition *)position).index + offset;
  return index >= 0 && index <= _document.length ? [self position:index] : nil;
}
- (UITextPosition *)positionFromPosition:(UITextPosition *)position inDirection:(UITextLayoutDirection)direction offset:(NSInteger)offset
{
  return [self positionFromPosition:position offset:(direction == UITextLayoutDirectionLeft || direction == UITextLayoutDirectionUp ? -offset : offset)];
}
- (NSComparisonResult)comparePosition:(UITextPosition *)position toPosition:(UITextPosition *)other
{
  if (![self validPosition:position] || ![self validPosition:other]) return NSOrderedSame;
  NSInteger a = ((CUIDatePosition *)position).index, b = ((CUIDatePosition *)other).index;
  return a < b ? NSOrderedAscending : a > b ? NSOrderedDescending : NSOrderedSame;
}
- (NSInteger)offsetFromPosition:(UITextPosition *)from toPosition:(UITextPosition *)toPosition
{
  return [self validPosition:from] && [self validPosition:toPosition] ? ((CUIDatePosition *)toPosition).index - ((CUIDatePosition *)from).index : 0;
}
- (id<UITextInputTokenizer>)tokenizer { return _tokenizer; }
- (UITextPosition *)positionWithinRange:(UITextRange *)range farthestInDirection:(UITextLayoutDirection)direction
{
  return [self validRange:range] ? (direction == UITextLayoutDirectionLeft || direction == UITextLayoutDirectionUp ? range.start : range.end) : nil;
}
- (UITextRange *)characterRangeByExtendingPosition:(UITextPosition *)position inDirection:(UITextLayoutDirection)direction
{
  UITextPosition *other = [self positionFromPosition:position inDirection:direction offset:1];
  return other ? [self textRangeFromPosition:position toPosition:other] : nil;
}
- (NSWritingDirection)baseWritingDirectionForPosition:(UITextPosition *)position inDirection:(UITextStorageDirection)direction { return _writingDirection; }
- (void)setBaseWritingDirection:(NSWritingDirection)writingDirection forRange:(UITextRange *)range { if ([self validRange:range]) _writingDirection = writingDirection; }
- (CGRect)firstRectForRange:(UITextRange *)range { return [self validRange:range] ? self.bounds : CGRectZero; }
- (CGRect)caretRectForPosition:(UITextPosition *)position { return [self validPosition:position] ? CGRectMake(CGRectGetMaxX(self.bounds) - 1, 0, 1, self.bounds.size.height) : CGRectZero; }
- (NSArray<UITextSelectionRect *> *)selectionRectsForRange:(UITextRange *)range { return @[]; }
- (UITextPosition *)closestPositionToPoint:(CGPoint)point { return self.endOfDocument; }
- (UITextPosition *)closestPositionToPoint:(CGPoint)point withinRange:(UITextRange *)range { return [self validRange:range] ? range.end : nil; }
- (UITextRange *)characterRangeAtPoint:(CGPoint)point { return [self range:NSMakeRange(_document.length, 0)]; }
- (void)mountingTransactionDidMount:(const MountingTransaction &)transaction withSurfaceTelemetry:(const SurfaceTelemetry &)surfaceTelemetry
{
  SurfaceId surface = transaction.getSurfaceId();
  if (_surface >= 0 && _surface != surface) { _epoch++; [self clearTransientDocument]; }
  _surface = surface;
  BOOL active = [self active];
  if (_wasActive != active) { _wasActive = active; _epoch++; [self clearTransientDocument]; if (!active) [self resignFirstResponder]; }
  [self emit:@"status" text:@"" replacement:NSMakeRange(0, 0)];
}
- (void)prepareForRecycle
{
  [self resignFirstResponder]; _epoch++; [self clearTransientDocument];
  _ownerId = @""; _segmentId = @""; _bindingRevision = @""; _displayText = @""; _locale = @""; _keyboardMode = @"numeric"; _wasActive = NO; _disabled = YES; _editable = NO;
  [super prepareForRecycle];
}
@end
Class<RCTComponentViewProtocol> CUIDateSegmentCls(void) { return CUIDateSegment.class; }
