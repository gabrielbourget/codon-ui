import { readNativeFocusWithin, type TNativeFocusWithinEvent } from "../../input/focusWithin"
import type { TNativeFocusEvent } from "../../input/types"

// The SDK emits both views of the same original observation. No event object,
// timestamp, target or focus flag is created or rewritten in JavaScript.
export const isNativeDateFieldFocusEvent = (
  event: TNativeFocusWithinEvent,
): event is TNativeFocusWithinEvent & TNativeFocusEvent => {
  const frame = readNativeFocusWithin(event.nativeEvent)
  const data = event.nativeEvent
  return (
    frame !== null &&
    data.isFocused === frame.within &&
    typeof data.isFocusVisible === "boolean" &&
    (!data.isFocusVisible || frame.within) &&
    data.timestamp === frame.observedAt &&
    ["unknown", "keyboard", "pointer", "programmatic"].includes(data.origin)
  )
}
