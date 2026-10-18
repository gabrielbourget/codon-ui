import { forwardRef, useImperativeHandle, useRef, type ComponentProps } from "react"
import { Animated, type View } from "react-native"

import { nativeKeyTokens } from "../../input/keyScope"
import { NativeFocusView } from "../../input/NativeFocusView"
import { useNativeKeyPolicy } from "../../input/NativeKeyboardScope"

import { useNativePanelInitialFocus } from "./focus"
import type { TNativePanelProps } from "./types"

const AnimatedFocusView = Animated.createAnimatedComponent(NativeFocusView)
const escapeTokens = nativeKeyTokens("Escape")
export const NativePanelSurface = forwardRef<
  View,
  ComponentProps<typeof AnimatedFocusView> & {
    open: boolean
    ready: boolean
    isActive: () => boolean
    systemClose: () => void
    keyboardDisabled: boolean
    initialFocusRef?: TNativePanelProps["initialFocusRef"]
  }
>(({ open, ready, isActive, systemClose, keyboardDisabled, initialFocusRef, ...props }, ref) => {
  const root = useRef<View>(null)
  useImperativeHandle(ref, () => root.current!)
  useNativePanelInitialFocus(open, ready, isActive, root, initialFocusRef)
  useNativeKeyPolicy({
    tokens: escapeTokens,
    targetTag: 0,
    excludeEditable: false,
    excludeComposing: true,
    isEnabled: open && !keyboardDisabled,
    lifetimeKey: JSON.stringify([open, keyboardDisabled]),
    canAct: isActive,
    onKey: (event) => {
      if (event.nativeEvent.phase === "down" && !event.nativeEvent.repeat && !event.nativeEvent.cancelled) systemClose()
    },
  })
  return <AnimatedFocusView {...props} ref={root} />
})
NativePanelSurface.displayName = "NativePanelSurface"
