import { getDefaultTransition, getValueTransition, isTransitionDefined } from "../animation"
import type { TNativeMotionTransition } from "../animation"
import { MotionGlobalConfig, frame } from "../kernel"
import { getFinalKeyframe } from "../kernel/engine/animation/keyframes/get-final"
import type { MotionValue, StartAnimation } from "../kernel/engine/value"

import { nativeTargetKeyframes } from "./keyframes"
import { NativeValueAnimation } from "./NativeValueAnimation"
import type { TNativeMotionValueContext, TNativeMotionValueOptions } from "./types"

export const animateNativeMotionValue =
  (
    name: string,
    value: MotionValue<unknown>,
    target: unknown,
    transition: TNativeMotionTransition = {},
    context: TNativeMotionValueContext,
  ): StartAnimation =>
  (complete) => {
    const selected = getValueTransition(transition, name) || {}
    const delay = selected.delay || transition.delay || 0
    const elapsed = (transition.elapsed ?? 0) - delay * 1000
    const options: TNativeMotionValueOptions = {
      keyframes: nativeTargetKeyframes(name, target),
      ease: "easeOut",
      velocity: value.getVelocity(),
      ...selected,
      delay: -elapsed,
      name,
      motionValue: value,
      context,
      onUpdate: (latest) => {
        if (context.isCurrent()) {
          value.set(latest)
          selected.onUpdate?.(latest)
        }
      },
      onComplete: () => {
        if (context.isCurrent()) {
          complete()
          selected.onComplete?.()
        }
      },
    }
    if (!isTransitionDefined(selected)) Object.assign(options, getDefaultTransition(name, options))
    if (options.duration) options.duration *= 1000
    if (options.repeatDelay) options.repeatDelay *= 1000
    if (options.from !== undefined) options.keyframes[0] = options.from
    let skip = false
    if (options.type === false || (options.duration === 0 && !options.repeatDelay)) {
      options.duration = 0
      options.type = "keyframes"
      if (!options.delay) skip = true
    }
    if (
      MotionGlobalConfig.instantAnimations ||
      MotionGlobalConfig.skipAnimations ||
      context.shouldSkipAnimations ||
      selected.skipAnimations
    ) {
      skip = true
      options.duration = 0
      options.type = "keyframes"
      options.delay = 0
    }
    options.allowFlatten = !selected.type && !selected.ease
    // Instant final values retain their original native representation. No native
    // interpolation endpoint is sampled or guessed on this source fast path.
    if (skip && value.get() !== undefined) {
      const final = getFinalKeyframe(options.keyframes, selected)
      if (final !== undefined) {
        frame.update(() => {
          if (context.isCurrent()) {
            options.onUpdate?.(final)
            options.onComplete?.()
          }
        })
        return
      }
    }
    return new NativeValueAnimation(options)
  }
