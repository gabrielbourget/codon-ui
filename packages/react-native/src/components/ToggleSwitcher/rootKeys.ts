import { useContext, useInsertionEffect, useLayoutEffect, useRef, useState, type RefObject } from "react"
import type { View } from "react-native"

import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { useNativeOrdinaryEditorKeys, type TNativeOrdinaryEditorKeyEvent } from "../../input/ordinaryEditorKeys"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"

export type TNativeSwitcherRootKeyEvent = TNativeOrdinaryEditorKeyEvent<View, View>
export type TNativeSwitcherRootKeyCallbacks = {
  onKeyDown?: (event: TNativeSwitcherRootKeyEvent) => void
  onKeyDownCapture?: (event: TNativeSwitcherRootKeyEvent) => void
  onKeyUp?: (event: TNativeSwitcherRootKeyEvent) => void
  onKeyUpCapture?: (event: TNativeSwitcherRootKeyEvent) => void
}
export const useNativeSwitcherRootKeys = (
  original: RefObject<View | null>,
  ownsOriginal: (target: object) => boolean,
  callbacks: TNativeSwitcherRootKeyCallbacks,
) => {
  const [target, setTarget] = useState<View | null>(null)
  const input = useNativeKeyScope()
  const floatingScope = useContext(NativeFloatingScopeContext)
  const floatingWindow = useContext(NativeFloatingWindowContext)
  const current = useRef({ callbacks, ownsOriginal })
  useInsertionEffect(() => {
    current.current = { callbacks, ownsOriginal }
  })
  useLayoutEffect(() => {
    if (target !== original.current) setTarget(original.current)
  })
  const canAct = () =>
    original.current !== null &&
    input?.isWindowActive() !== false &&
    floatingScope?.canAct() !== false &&
    floatingWindow?.() !== false
  const capture = useNativeOrdinaryEditorKeys(
    target,
    !!(callbacks.onKeyDownCapture || callbacks.onKeyUpCapture),
    "switcher-root-capture",
    {
      current: () => original.current,
      canAct,
      subtree: true,
      receive: (event) => {
        if (!current.current.ownsOriginal(event.target)) return
        const receive =
          event.nativeEvent.phase === "down"
            ? current.current.callbacks.onKeyDownCapture
            : current.current.callbacks.onKeyUpCapture
        receive?.(event)
      },
    },
  )
  const bubble = useNativeOrdinaryEditorKeys(
    target,
    !!(callbacks.onKeyDown || callbacks.onKeyUp),
    "switcher-root-bubble",
    {
      current: () => original.current,
      canAct,
      subtree: true,
      receive: (event) => {
        if (!current.current.ownsOriginal(event.target)) return
        const receive =
          event.nativeEvent.phase === "down" ? current.current.callbacks.onKeyDown : current.current.callbacks.onKeyUp
        receive?.(event)
      },
    },
  )
  return { onNativeOrdinaryEditorKeyCapture: capture, onNativeOrdinaryEditorKey: bubble }
}
