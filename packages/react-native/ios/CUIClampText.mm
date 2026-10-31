#include "../cpp/table/ClampText.h"
#import <Foundation/Foundation.h>
#import "CUIMotionIntrinsicText.h"
#include <react/utils/ManagedObjectWrapper.h>
#include <stdexcept>

namespace codon::table {
using namespace facebook::react;
std::shared_ptr<const void> captureClampEditorText(std::shared_ptr<void> original) {
  @try {
    return std::make_shared<const AttributedStringBox>(CUIIsolateMotionEditorText(AttributedStringBox(std::move(original))));
  } @catch (NSException *failure) {
    throw std::runtime_error(failure.reason.UTF8String ?: "Table clamp native editor snapshot failed");
  }
}
void observeClampEditorText(int, uint64_t) {}
void unobserveClampEditorText(int, uint64_t) noexcept {}
codon::motion::TNativeIsolatedIntrinsicServices clampPlatformIntrinsicServices(
    const ShadowNode &, std::function<std::shared_ptr<const CuiTextSnapshot>(const ShadowNode &)> snapshot) {
  codon::motion::TNativeIsolatedIntrinsicServices services;
  services.editorText = [snapshot](const ShadowNode &node, const AttributedStringBox &content) {
    if (content.getMode() == AttributedStringBox::Mode::Value) return content;
    const auto selected = snapshot(node);
    const auto owned = std::static_pointer_cast<const AttributedStringBox>(selected->ownedPayload);
    if (!owned) throw std::runtime_error("Table clamp requires its retained immutable native editor text");
    return *owned;
  };
  return services;
}
} // namespace codon::table
