import { forwardRef, useCallback, useId, useRef, type ElementRef } from "react"
import type { NativeSyntheticEvent } from "react-native"

import { registerNativeFocusTarget } from "./focus"
import FocusHost, { Commands, type NativeKeyData } from "./specs/CUIFocusViewNativeComponent"
import type { TNativeKeyboardEvent, TNativeFocusViewProps, TNativeFocusViewRef } from "./types"

const isKeyboardEvent = (event: NativeSyntheticEvent<NativeKeyData>): event is TNativeKeyboardEvent =>
  event.nativeEvent.kind === "keyboard"

export const NativeFocusView = forwardRef<TNativeFocusViewRef, TNativeFocusViewProps>((props, forwardedRef) => {
  const { onKeyDown, onKeyUp, onFocus, onBlur, focusable, tabIndex, ...rest } = props
  const ownerId = useId()
  const attached = useRef(false)
  const release = useRef<(() => void) | undefined>(undefined)
  const releaseForwardedRef = useRef<(() => void) | undefined>(undefined)
  const keyboardFocusable = tabIndex === -1 ? false : (focusable ?? true)
  const setRef = useCallback(
    (target: ElementRef<typeof FocusHost> | null) => {
      attached.current = target !== null
      release.current?.()
      releaseForwardedRef.current?.()
      releaseForwardedRef.current = undefined
      release.current = target
        ? registerNativeFocusTarget(target, {
            canFocus: () => keyboardFocusable,
            focus: () => Commands.requestKeyboardFocus(target, ownerId),
            blur: () => Commands.requestKeyboardBlur(target, ownerId),
          })
        : undefined
      if (typeof forwardedRef === "function") {
        if (target) {
          const cleanup = forwardedRef(target)
          releaseForwardedRef.current = typeof cleanup === "function" ? cleanup : () => forwardedRef(null)
        }
      } else if (forwardedRef) forwardedRef.current = target
    },
    [forwardedRef, keyboardFocusable, ownerId],
  )
  return (
    <FocusHost
      {...rest}
      ref={setRef}
      ownerId={ownerId}
      focusable={keyboardFocusable}
      tabIndex={tabIndex}
      keyboardFocusable={keyboardFocusable}
      onNativeKey={(event) => {
        if (!attached.current || event.nativeEvent.ownerId !== ownerId || !isKeyboardEvent(event)) return
        if (event.nativeEvent.phase === "down") {
          if (keyboardFocusable) onKeyDown?.(event)
        } else onKeyUp?.(event)
      }}
      onNativeFocusChange={(event) => {
        if (!attached.current || event.nativeEvent.ownerId !== ownerId) return
        if (event.nativeEvent.isFocused) onFocus?.(event)
        else onBlur?.(event)
      }}
    />
  )
})
NativeFocusView.displayName = "NativeFocusView"
