import { forwardRef, useCallback, useId, useInsertionEffect, useRef, type ElementRef } from "react"
import type { GestureResponderEvent, NativeSyntheticEvent } from "react-native"

import { registerNativeFocusTarget } from "./focus"
import { nativeViewProps, NativeViewContextBoundary } from "./nativeViewProps"
import FocusHost, { Commands, type NativeActivationData, type NativeKeyData } from "./specs/CUIFocusViewNativeComponent"
import type { TNativeKeyboardEvent, TNativeFocusViewProps, TNativeFocusViewRef } from "./types"

export type TNativeActivationPacket = NativeSyntheticEvent<Omit<NativeActivationData, "kind"> & { kind: "activation" }>
const isActivationEvent = (event: NativeSyntheticEvent<NativeActivationData>): event is TNativeActivationPacket =>
  event.nativeEvent.kind === "activation" &&
  (event.nativeEvent.source === "android-click" || event.nativeEvent.source === "ios-accessibility-activate")

const isKeyboardEvent = (event: NativeSyntheticEvent<NativeKeyData>): event is TNativeKeyboardEvent =>
  event.nativeEvent.kind === "keyboard"

export const NativeFocusHost = forwardRef<
  TNativeFocusViewRef,
  TNativeFocusViewProps & {
    nativePressable?: boolean
    onNativeActivation?: (event: TNativeActivationPacket) => void
    capturedKeys?: readonly string[]
    onClick?: (event: GestureResponderEvent) => void
  }
>((props, forwardedRef) => {
  const { onKeyDown, onKeyUp, onFocus, onBlur, focusable, tabIndex, capturedKeys, onNativeActivation, ...rest } = props
  const ownerId = useId()
  const attached = useRef(false)
  const activationId = useRef(0)
  const release = useRef<(() => void) | undefined>(undefined)
  const releaseForwardedRef = useRef<(() => void) | undefined>(undefined)
  const keyboardFocusable = tabIndex === -1 ? false : (focusable ?? true)
  const focusEligibility = useRef(keyboardFocusable)
  useInsertionEffect(() => {
    focusEligibility.current = keyboardFocusable
  }, [keyboardFocusable])
  const setRef = useCallback(
    (target: ElementRef<typeof FocusHost> | null) => {
      attached.current = target !== null
      release.current?.()
      releaseForwardedRef.current?.()
      releaseForwardedRef.current = undefined
      release.current = target
        ? registerNativeFocusTarget(target, {
            canFocus: () => focusEligibility.current,
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
    [forwardedRef, ownerId],
  )
  return (
    <NativeViewContextBoundary>
      <FocusHost
        {...nativeViewProps(rest)}
        ref={setRef}
        ownerId={ownerId}
        focusable={keyboardFocusable}
        keyboardFocusable={keyboardFocusable}
        capturedKeys={capturedKeys}
        onNativeActivation={(event) => {
          const data = event.nativeEvent
          if (!attached.current || data.ownerId !== ownerId || !isActivationEvent(event)) return
          if (!Number.isSafeInteger(data.activationId) || data.activationId <= activationId.current) return
          activationId.current = data.activationId
          onNativeActivation?.(event)
        }}
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
    </NativeViewContextBoundary>
  )
})
NativeFocusHost.displayName = "NativeFocusHost"
export const NativeFocusView = forwardRef<TNativeFocusViewRef, TNativeFocusViewProps>((props, ref) => (
  <NativeFocusHost {...props} ref={ref} />
))
NativeFocusView.displayName = "NativeFocusView"
