// Received from pinned Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.
import { isVariantLabel } from "./is-variant-label"
import type { TNativeMotionAnimationOwner, TNativeMotionAnimationProp, TNativeMotionAnimationType } from "./types"
import { variantProps } from "./variant-props"

const numVariantProps = variantProps.length

type VariantStateContext = Partial<Record<"initial" | TNativeMotionAnimationType, TNativeMotionAnimationProp>>

/**
 * Get variant context from a visual element's parent chain.
 * Uses `any` type for visualElement to avoid circular dependencies.
 */
export function getVariantContext(visualElement?: TNativeMotionAnimationOwner): undefined | VariantStateContext {
  if (!visualElement) return undefined

  if (!visualElement.isControllingVariants) {
    const context = visualElement.parent ? getVariantContext(visualElement.parent) || {} : {}
    if (visualElement.props.initial !== undefined) {
      context.initial = visualElement.props.initial
    }
    return context
  }

  const context: VariantStateContext = {}
  for (let i = 0; i < numVariantProps; i++) {
    const name = variantProps[i] as keyof typeof context
    const prop = visualElement.props[name]

    if (isVariantLabel(prop) || prop === false) {
      context[name] = prop
    }
  }

  return context
}
