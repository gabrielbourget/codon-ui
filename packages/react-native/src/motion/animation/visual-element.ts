// Received from pinned Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.
import { resolveVariant } from "./resolve-dynamic-variants"
import type { TNativeMotionAnimationOptions, TNativeMotionAnimationOwner, TNativeMotionDefinition } from "./types"
import { animateTarget } from "./visual-element-target"
import { animateVariant } from "./visual-element-variant"

export function animateVisualElement(
  visualElement: TNativeMotionAnimationOwner,
  definition: TNativeMotionDefinition,
  options: TNativeMotionAnimationOptions = {},
) {
  const ready = visualElement.awaitAnimationReady?.()
  if (ready instanceof Promise)
    return ready.then((current) => (current() ? animateReady(visualElement, definition, options) : undefined))
  if (ready && !ready()) return Promise.resolve()
  return animateReady(visualElement, definition, options)
}

const animateReady = (
  visualElement: TNativeMotionAnimationOwner,
  definition: TNativeMotionDefinition,
  options: TNativeMotionAnimationOptions,
) => {
  const isCurrent = visualElement.captureAnimationLease()
  if (!isCurrent()) return Promise.resolve()
  visualElement.notify("AnimationStart", definition)
  let animation: Promise<unknown>

  if (Array.isArray(definition)) {
    const animations = definition.map((variant) => animateVariant(visualElement, variant, options))
    animation = Promise.all(animations)
  } else if (typeof definition === "string") {
    animation = animateVariant(visualElement, definition, options)
  } else {
    const resolvedDefinition =
      typeof definition === "function" ? resolveVariant(visualElement, definition, options.custom) : definition

    animation = Promise.all(animateTarget(visualElement, resolvedDefinition, options))
  }

  return animation.then(() => {
    if (isCurrent()) visualElement.notify("AnimationComplete", definition)
  })
}
