// Received from pinned Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.
import { resolveVariantFromProps } from "./resolve-variants"
import type {
  TNativeMotionAnimationOwner,
  TNativeMotionDefinition,
  TNativeMotionTarget,
  TNativeMotionTargetResolver,
} from "./types"

/**
 * Resolves a variant if it's a variant resolver.
 * Uses `any` type for visualElement to avoid circular dependencies.
 */
export function resolveVariant(
  visualElement: TNativeMotionAnimationOwner,
  definition?: TNativeMotionTarget | TNativeMotionTargetResolver,
  custom?: unknown,
): TNativeMotionTarget
export function resolveVariant(
  visualElement: TNativeMotionAnimationOwner,
  definition?: TNativeMotionDefinition,
  custom?: unknown,
): TNativeMotionTarget | undefined
export function resolveVariant(
  visualElement: TNativeMotionAnimationOwner,
  definition?: TNativeMotionDefinition,
  custom?: unknown,
) {
  const props = visualElement.getProps()
  return resolveVariantFromProps(props, definition, custom !== undefined ? custom : props.custom, visualElement)
}
