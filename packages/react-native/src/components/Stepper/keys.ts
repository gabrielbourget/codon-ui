import { useContext, useInsertionEffect, useRef } from "react"
import type { TextInput } from "react-native"

import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { useNativeOriginalEditorKeyPolicy } from "../../input/originalEditorKeyPolicy"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import type { useNumberInputState } from "../NumberInput/state"

import type { TNativeStepperProps } from "./types"

const NUMERIC_KEYS = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"] as const
const NUMERIC_KEY_TOKENS = NUMERIC_KEYS.map((key) => `0000:${key}`)

type TStepperKeyOptions = {
  props: TNativeStepperProps
  numeric: ReturnType<typeof useNumberInputState>
  original: TextInput | null
  currentOriginal: () => TextInput | null
  lifetimeKey: string
}

export const useNativeStepperKeys = (options: TStepperKeyOptions) => {
  const scope = useNativeKeyScope()
  const floatingScope = useContext(NativeFloatingScopeContext)
  const windowActive = useContext(NativeFloatingWindowContext)
  const current = useRef({ ...options, floatingScope, windowActive })
  const live = useRef(false)
  useInsertionEffect(() => {
    current.current = { ...options, floatingScope, windowActive }
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const canObserve = () => {
    const owner = current.current
    return (
      live.current &&
      !owner.props.isDisabled &&
      owner.original !== null &&
      owner.currentOriginal() === owner.original &&
      scope?.isNativeReady() === true &&
      scope.isWindowActive() === true &&
      owner.floatingScope?.canAct() !== false &&
      owner.windowActive?.() !== false
    )
  }
  return useNativeOriginalEditorKeyPolicy(options.original, {
    enabled: !options.props.isDisabled,
    actionEnabled: !options.props.isReadOnly,
    lifetimeKey: options.lifetimeKey,
    tokens: NUMERIC_KEY_TOKENS,
    current: () => current.current.currentOriginal(),
    canAct: canObserve,
    onAction: (frame) => {
      if (!canObserve() || current.current.props.isReadOnly) return
      const numeric = current.current.numeric
      if (frame.key === "ArrowUp" || frame.key === "PageUp") numeric.step(1)
      if (frame.key === "ArrowDown" || frame.key === "PageDown") numeric.step(-1)
      if (frame.key === "Home") numeric.endpoint(-1)
      if (frame.key === "End") numeric.endpoint(1)
    },
    receive: (event) => {
      if (!canObserve()) return
      const owner = current.current
      const callback = event.nativeEvent.phase === "down" ? "onKeyDown" : "onKeyUp"
      owner.props[callback]?.(event)
      if (
        canObserve() &&
        current.current.lifetimeKey === owner.lifetimeKey &&
        current.current.original === owner.original
      )
        current.current.props.inputProps?.[callback]?.(event)
    },
  })
}
