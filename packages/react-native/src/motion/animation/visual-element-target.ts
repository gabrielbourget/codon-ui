import { frame } from "../kernel"
import type { AnimationPlaybackControlsWithThen } from "../kernel"

import { getValueTransition } from "./get-value-transition"
import { resolveTransition } from "./resolve-transition"
import { setTarget } from "./setters"
import { positionalKeys } from "./transform-keys"
import type {
  TNativeMotionAnimationOptions,
  TNativeMotionAnimationOwner,
  TNativeMotionTarget,
  TNativeMotionTransition,
} from "./types"

// Native adapter for pinned Motion's target orchestration. The owner supplies
// real value/keyframe resolution; browser handoff and CSS will-change have no native import.
export const animateTarget = (
  owner: TNativeMotionAnimationOwner,
  targetAndTransition: TNativeMotionTarget,
  { delay = 0, transitionOverride, type }: TNativeMotionAnimationOptions = {},
): AnimationPlaybackControlsWithThen[] => {
  const isCurrent = owner.captureAnimationLease()
  if (!isCurrent()) return []
  const { transition: authoredTransition, transitionEnd, ...target } = targetAndTransition
  let transition = authoredTransition
  const parent = owner.getDefaultTransition()
  transition = transition ? resolveTransition(transition, parent) : parent
  const reduceMotion = transition?.reduceMotion
  const skipAnimations = transition?.skipAnimations
  if (transitionOverride) transition = transitionOverride
  const animations: AnimationPlaybackControlsWithThen[] = []
  const state = type && owner.animationState?.getState()[type]
  if (transition?.path) transition.path.animateVisualElement(owner, target, transition, delay, animations)
  for (const key in target) {
    const value = owner.getValue(key, owner.latestValues[key] ?? null)
    const valueTarget = target[key]
    if (valueTarget === undefined) continue
    if (state) {
      const blocked =
        Object.prototype.hasOwnProperty.call(state.protectedKeys, key) && state.needsAnimating[key] !== true
      state.needsAnimating[key] = false
      if (blocked) continue
    }
    const valueTransition: TNativeMotionTransition = { delay, ...getValueTransition(transition || {}, key) }
    if (skipAnimations) valueTransition.skipAnimations = true
    const current = value.get()
    if (
      current !== undefined &&
      !value.isAnimating() &&
      !Array.isArray(valueTarget) &&
      valueTarget === current &&
      !valueTransition.velocity
    ) {
      frame.update(() => {
        if (isCurrent()) value.set(valueTarget)
      })
      continue
    }
    const shouldReduceMotion = reduceMotion ?? owner.shouldReduceMotion
    value.start((complete) =>
      owner.animateValue(
        key,
        value,
        valueTarget,
        shouldReduceMotion && positionalKeys.has(key) ? { type: false } : valueTransition,
        complete,
        isCurrent,
      ),
    )
    if (value.animation) animations.push(value.animation)
  }
  if (transitionEnd) {
    const end = transitionEnd
    const apply = () =>
      frame.update(() => {
        if (isCurrent()) setTarget(owner, end)
      })
    if (animations.length) void Promise.all(animations).then(apply)
    else apply()
  }
  return animations
}
