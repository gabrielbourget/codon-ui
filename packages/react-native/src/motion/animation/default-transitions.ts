// Received from pinned Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.
import { transformProps } from "./transform-keys"
import type { TNativeMotionValueAnimationOptions } from "./types"

const underDampedSpring: Partial<TNativeMotionValueAnimationOptions> = {
  type: "spring",
  stiffness: 500,
  damping: 25,
  restSpeed: 10,
}

const criticallyDampedSpring = (target: unknown): Partial<TNativeMotionValueAnimationOptions> => ({
  type: "spring",
  stiffness: 550,
  damping: target === 0 ? 2 * Math.sqrt(550) : 30,
  restSpeed: 10,
})

const keyframesTransition: Partial<TNativeMotionValueAnimationOptions> = {
  type: "keyframes",
  duration: 0.8,
}

/**
 * Default easing curve is a slightly shallower version of
 * the default browser easing curve.
 */
const ease: Partial<TNativeMotionValueAnimationOptions> = {
  type: "keyframes",
  ease: [0.25, 0.1, 0.35, 1],
  duration: 0.3,
}

export const getDefaultTransition = (
  valueKey: string,
  { keyframes }: TNativeMotionValueAnimationOptions,
): Partial<TNativeMotionValueAnimationOptions> => {
  if (keyframes.length > 2) {
    return keyframesTransition
  } else if (transformProps.has(valueKey)) {
    return valueKey.startsWith("scale") ? criticallyDampedSpring(keyframes[1]) : underDampedSpring
  }

  return ease
}
