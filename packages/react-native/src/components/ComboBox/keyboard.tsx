import type { TNativeObservedKeyboardEvent } from "../../input/keyboardObservation"
import { nativeKeyTokens } from "../../input/keyScope"
import { useNativeKeyPolicy, useNativeKeyboardObservation } from "../../input/NativeKeyboardScope"
import type { TNativeKeyboardEvent } from "../../input/types"

export const NativeComboBoxKeyBinding = ({
  target,
  open,
  enabled,
  lifetime,
  onKey,
  observe,
}: {
  target: number
  open: boolean
  enabled: boolean
  lifetime: string
  onKey: (event: TNativeKeyboardEvent) => void
  observe: (event: TNativeObservedKeyboardEvent) => void
}) => {
  useNativeKeyPolicy({
    tokens: [
      ...["ArrowDown", "ArrowUp"],
      ...(open ? ["Home", "End", "PageUp", "PageDown", "Enter", "Escape"] : []),
    ].flatMap(nativeKeyTokens),
    targetTag: target,
    excludeEditable: false,
    excludeComposing: true,
    isEnabled: enabled && target > 0,
    lifetimeKey: lifetime,
    canAct: () => enabled,
    onKey,
  })
  useNativeKeyboardObservation({
    targetTag: target,
    isEnabled: enabled && target > 0,
    lifetimeKey: lifetime,
    canAct: () => enabled,
    onKeyDown: observe,
  })
  return null
}
