// Received from pinned Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.
import { isAnimationControls } from "./is-animation-controls"
import { isVariantLabel } from "./is-variant-label"
import type { TNativeMotionAnimationProps } from "./types"
import { variantProps } from "./variant-props"

export function isControllingVariants(props: TNativeMotionAnimationProps) {
  return (
    isAnimationControls(props.animate) || variantProps.some((name) => isVariantLabel(props[name as keyof typeof props]))
  )
}

export function isVariantNode(props: TNativeMotionAnimationProps) {
  return Boolean(isControllingVariants(props) || props.variants)
}
