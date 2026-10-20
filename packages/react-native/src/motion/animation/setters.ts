// Received from pinned Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.
import { motionValue } from "../kernel"
import { nativeTargetKeyframes } from "../value/targetKeyframes"

import { resolveVariant } from "./resolve-dynamic-variants"
import type { TNativeMotionAnimationOwner, TNativeMotionDefinition } from "./types"

/**
 * Set TNativeMotionAnimationOwner's MotionValue, creating a new MotionValue for it if
 * it doesn't exist.
 */
function setMotionValue(visualElement: TNativeMotionAnimationOwner, key: string, value: unknown) {
  if (visualElement.hasValue(key)) {
    visualElement.getValue(key)!.set(value)
  } else {
    visualElement.addValue(key, motionValue(value))
  }
}

function resolveFinalValueInKeyframes(key: string, value: unknown): unknown {
  if (!Array.isArray(value)) return value
  // Native array values retain their identity; actual keyframes keep the pinned final-value fallback.
  const frames = nativeTargetKeyframes(key, value)
  return frames[frames.length - 1] || 0
}

export function setTarget(visualElement: TNativeMotionAnimationOwner, definition: TNativeMotionDefinition) {
  const resolved = resolveVariant(visualElement, definition)
  const { transitionEnd = {}, transition: _transition = {}, ...initialTarget } = resolved || {}
  void _transition
  const target = { ...initialTarget, ...transitionEnd }

  for (const key in target) {
    const value = resolveFinalValueInKeyframes(key, target[key as keyof typeof target])
    setMotionValue(visualElement, key, value as unknown)
  }
}
