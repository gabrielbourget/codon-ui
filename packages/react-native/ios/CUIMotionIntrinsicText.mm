#import "CUIMotionIntrinsicText.h"
#import <UIKit/UIKit.h>
#include <react/utils/ManagedObjectWrapper.h>
#include <stdexcept>

using namespace facebook::react;

AttributedStringBox CUIIsolateMotionEditorText(const AttributedStringBox &source) {
  if (source.getMode() == AttributedStringBox::Mode::Value) return source;
  NSCAssert(NSThread.isMainThread, @"Card intrinsic text snapshot requires the original UI thread");
  NSAttributedString *original = (NSAttributedString *)unwrapManagedObject(source.getOpaquePointer());
  Class immutable = [[[NSAttributedString alloc] initWithString:@""] class];
  Class mutableString = [[[NSMutableAttributedString alloc] initWithString:@""] class];
  if (!original || (original.class != immutable && original.class != mutableString))
    throw std::runtime_error("Native motion: opaque text container requires CUIIntrinsicSource");
  NSMutableAttributedString *owned = [[NSMutableAttributedString alloc] initWithString:[original.string copy]];
  NSSet *numbers = [NSSet setWithArray:@[NSKernAttributeName, NSLigatureAttributeName,
    NSBaselineOffsetAttributeName, NSObliquenessAttributeName, NSExpansionAttributeName,
    NSStrokeWidthAttributeName, NSUnderlineStyleAttributeName, NSStrikethroughStyleAttributeName,
    NSVerticalGlyphFormAttributeName, @"IsHighlighted"]];
  NSSet *colors = [NSSet setWithArray:@[NSForegroundColorAttributeName, NSBackgroundColorAttributeName,
    NSUnderlineColorAttributeName, NSStrikethroughColorAttributeName, NSStrokeColorAttributeName]];
  [original enumerateAttributesInRange:NSMakeRange(0, original.length) options:0
      usingBlock:^(NSDictionary<NSAttributedStringKey, id> *attributes, NSRange range, BOOL *) {
    NSMutableDictionary *copied = [NSMutableDictionary new];
    for (NSAttributedStringKey key in attributes) {
      id value = attributes[key], replacement = nil;
      if ([key isEqual:NSFontAttributeName] && [value isKindOfClass:UIFont.class]) replacement = value;
      else if ([numbers containsObject:key] && [value isKindOfClass:NSNumber.class]) replacement = value;
      else if ([colors containsObject:key] && [value isKindOfClass:UIColor.class]) replacement = value;
      else if ([key isEqual:NSParagraphStyleAttributeName] &&
          ([value class] == NSParagraphStyle.class || [value class] == NSMutableParagraphStyle.class))
        replacement = [value copy];
      else if ([key isEqual:NSShadowAttributeName] && [value class] == NSShadow.class) replacement = [value copy];
      else if ([key isEqual:NSAttachmentAttributeName] && [value class] == NSTextAttachment.class) {
        NSTextAttachment *attachment = [NSTextAttachment new];
        attachment.bounds = [(NSTextAttachment *)value bounds];
        attachment.image = [(NSTextAttachment *)value image];
        // File/type-driven or custom attachment layout must supply an isolated native provider.
        if ([(NSTextAttachment *)value fileWrapper] || [(NSTextAttachment *)value contents])
          throw std::runtime_error("Native motion: opaque attachment requires CUIIntrinsicSource");
        replacement = attachment;
      } else if ([key isEqual:NSWritingDirectionAttributeName] && [value isKindOfClass:NSArray.class]) {
        for (id direction in value) if (![direction isKindOfClass:NSNumber.class])
          throw std::runtime_error("Native motion: custom writing direction requires CUIIntrinsicSource");
        replacement = [value copy];
      } else if ([key isEqual:NSLinkAttributeName] &&
          ([value isKindOfClass:NSString.class] || [value isKindOfClass:NSURL.class])) replacement = [value copy];
      else if ([key isEqual:@"AccessibilityRole"] && [value isKindOfClass:NSString.class]) replacement = [value copy];
      // RN's event-emitter metadata has no measurement callback; preserve original identity.
      else if ([key isEqual:@"EventEmitter"]) replacement = value;
      if (!replacement) throw std::runtime_error("Native motion: opaque text attribute requires CUIIntrinsicSource");
      copied[key] = replacement;
    }
    [owned setAttributes:copied range:range];
  }];
  return AttributedStringBox(wrapManagedObject([owned copy]));
}
