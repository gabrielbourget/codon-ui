// Native adapters of pinned Framer Motion hooks; see UPSTREAM.json and LICENSE.framer-motion.md.
import { useEffect, useInsertionEffect, useLayoutEffect, useRef, useState } from "react"

import { useNativeMotionConfig } from "../config/NativeMotionConfig"
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

export const useNativeMotionValue = <T>(initial: T) => {
  const value = useNativeConstant(() => nativeMotionValue(initial))
  const { isStatic } = useNativeMotionConfig()
  const [, setLatest] = useState<T>(() => initial)
  useEffect(() => {
    if (isStatic) return value.on("change", (latest) => setLatest(() => latest))
  }, [value, isStatic])
  return value
}

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
