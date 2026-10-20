import { cancelFrame, createRenderBatcher, frame, time } from "../kernel"
import type { MotionValue } from "../kernel"
import { nativeMotionRuntime } from "../kernel/nativeRuntime"
import { animateNativeMotionValue } from "../value/animateValue"

import type { ValueAnimationOptions } from "./types"

const microtaskBatch = createRenderBatcher(nativeMotionRuntime.queueMicrotask, false)
export const microtask = microtaskBatch.schedule
export const cancelNativeProjectionMicrotask = microtaskBatch.cancel
export const delay = (callback: (overshoot: number) => void, duration: number) => {
  const started = time.now()
  const check = ({ timestamp }: { timestamp: number }) => {
    const elapsed = timestamp - started
    if (elapsed >= duration) {
      cancelFrame(check)
      callback(elapsed - duration)
    }
  }
  frame.setup(check, true)
  return () => cancelFrame(check)
}
export const animateSingleValue = (
  value: MotionValue<number>,
  keyframes: number[],
  options: Omit<ValueAnimationOptions<number>, "keyframes">,
  isCurrent: () => boolean,
  skipAnimations = false,
) => {
  const { onUpdate, ...transition } = options
  void value.start(
    animateNativeMotionValue(
      "",
      value as MotionValue<unknown>,
      keyframes,
      {
        ...transition,
        onUpdate: (latest) => {
          if (typeof latest !== "number") throw new Error("Native projection: numeric sample required")
          onUpdate?.(latest)
        },
      },
      {
        isCurrent,
        shouldSkipAnimations: skipAnimations,
        readValue: () => {
          throw new Error("Native projection: a definite numeric MotionValue is required")
        },
      },
    ),
  )
  return value.animation!
}
