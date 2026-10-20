// Native adapters of pinned Framer Motion hooks; see UPSTREAM.json and LICENSE.framer-motion.md.
import { useInsertionEffect, useLayoutEffect, useRef } from "react"

import { motionValue } from "../kernel"
import type { MotionValue } from "../kernel"
import type { MotionValueEventCallbacks } from "../kernel/engine/value"

import { nativeAnimationControls } from "./animation-controls"

const useNativeConstant = <T>(factory: () => T): T => {
  const current = useRef<{ value: T } | undefined>(undefined)
  if (!current.current) current.current = { value: factory() }
  return current.current.value
}

export const nativeMotionValue = motionValue

// This is the source hook's normal native lifetime. Static-preview context
// integration remains part of the unpublished NativeMotionConfig layer.
export const useNativeMotionValue = <T>(initial: T) => useNativeConstant(() => nativeMotionValue(initial))

export const useNativeMotionValueEvent = <T, Event extends keyof MotionValueEventCallbacks<T>>(
  value: MotionValue<T>,
  event: Event,
  callback: MotionValueEventCallbacks<T>[Event],
) => {
  useInsertionEffect(() => value.on(event, callback), [value, event, callback])
}

export const useNativeAnimationControls = () => {
  const controls = useNativeConstant(nativeAnimationControls)
  useLayoutEffect(controls.mount, [controls])
  return controls
}
