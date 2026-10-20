// Received from pinned Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.
import { motionValue } from "../kernel"

import { isKeyframesTarget } from "./is-keyframes-target"
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

function resolveFinalValueInKeyframes(v: unknown): unknown {
  // TODO maybe throw if v.length - 1 is placeholder token?
  return isKeyframesTarget(v) ? v[v.length - 1] || 0 : v
}

export function setTarget(visualElement: TNativeMotionAnimationOwner, definition: TNativeMotionDefinition) {
  const resolved = resolveVariant(visualElement, definition)
  const { transitionEnd = {}, transition: _transition = {}, ...initialTarget } = resolved || {}
  void _transition
  const target = { ...initialTarget, ...transitionEnd }

  for (const key in target) {
    const value = resolveFinalValueInKeyframes(target[key as keyof typeof target])
    setMotionValue(visualElement, key, value as unknown)
  }
}
