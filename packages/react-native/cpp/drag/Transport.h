#pragma once
#include <string_view>

namespace codon::drag {
enum class NativeDragCarrier { Cancel, Copy, Move };

// UIKit has no link proposal. The approved local link preserves the business
// operation while using UIKit's actual copy carrier and native copy feedback.
inline NativeDragCarrier nativeDragCarrier(std::string_view requested, bool authenticated,
    bool copyAllowed, bool moveAllowed, bool linkAllowed, bool platformMoveAllowed) {
  if (requested == "copy" && (!authenticated || copyAllowed)) return NativeDragCarrier::Copy;
  if (requested == "link" && authenticated && linkAllowed) return NativeDragCarrier::Copy;
  if (requested == "move" && authenticated && moveAllowed && platformMoveAllowed) return NativeDragCarrier::Move;
  return NativeDragCarrier::Cancel;
}

inline std::string_view completedDragOperation(bool nativeSucceeded, bool localAttempted,
    bool localAccepted, std::string_view selected, bool selectedAllowed, bool exportedCopy) {
  if (!nativeSucceeded) return "cancel";
  if (localAttempted) {
    const bool known = selected == "copy" || selected == "move" || selected == "link";
    return localAccepted && selectedAllowed && known ? selected : "cancel";
  }
  return exportedCopy ? "copy" : "cancel";
}
} // namespace codon::drag
