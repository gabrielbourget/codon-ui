// Received from pinned Motion 12.40.0; see UPSTREAM.json and LICENSE.framer-motion.md.
import { invariant } from "../kernel/utils"

import { setTarget } from "./setters"
import type {
  TNativeMotionAnimationControls,
  TNativeMotionAnimationOwner,
  TNativeMotionDefinition,
  TNativeMotionTransition,
} from "./types"
import { animateVisualElement } from "./visual-element"

function stopAnimation(visualElement: TNativeMotionAnimationOwner) {
  visualElement.values.forEach((value) => value.stop())
}

function setVariants(visualElement: TNativeMotionAnimationOwner, variantLabels: string[]) {
  const reversedLabels = [...variantLabels].reverse()

  reversedLabels.forEach((key) => {
    const variant = visualElement.getVariant(key)
    if (variant) setTarget(visualElement, variant)

    if (visualElement.variantChildren) {
      visualElement.variantChildren.forEach((child) => {
        setVariants(child, variantLabels)
      })
    }
  })
}

export function setValues(visualElement: TNativeMotionAnimationOwner, definition: TNativeMotionDefinition) {
  if (Array.isArray(definition)) {
    return setVariants(visualElement, definition)
  } else if (typeof definition === "string") {
    return setVariants(visualElement, [definition])
  } else {
    setTarget(visualElement, definition)
  }
}

/**
 * @public
 */
export function nativeAnimationControls(): TNativeMotionAnimationControls {
  /**
   * Track whether the host component has mounted.
   */
  let hasMounted = false

  /**
   * A collection of linked component animation controls.
   */
  const subscribers = new Set<TNativeMotionAnimationOwner>()

  const controls: TNativeMotionAnimationControls = {
    subscribe(visualElement: TNativeMotionAnimationOwner) {
      subscribers.add(visualElement)
      return () => void subscribers.delete(visualElement)
    },

    start(definition: TNativeMotionDefinition, transitionOverride?: TNativeMotionTransition) {
      invariant(
        hasMounted,
        "controls.start() should only be called after a component has mounted. Consider calling within a useEffect hook.",
      )

      const animations: Array<Promise<unknown>> = []
      subscribers.forEach((visualElement) => {
        animations.push(
          animateVisualElement(visualElement, definition, {
            transitionOverride,
          }),
        )
      })

      return Promise.all(animations)
    },

    set(definition: TNativeMotionDefinition) {
      invariant(
        hasMounted,
        "controls.set() should only be called after a component has mounted. Consider calling within a useEffect hook.",
      )

      return subscribers.forEach((visualElement) => {
        setValues(visualElement, definition)
      })
    },

    stop() {
      subscribers.forEach((visualElement) => {
        stopAnimation(visualElement)
      })
    },

    mount() {
      hasMounted = true

      return () => {
        hasMounted = false
        controls.stop()
      }
    },
  }

  return controls
}
