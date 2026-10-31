// Received from pinned Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.
import type { MotionValue } from "../kernel"

import type {
  TNativeMotionAnimationOwner,
  TNativeMotionAnimationProps,
  TNativeMotionDefinition,
  TNativeMotionResolvedValues,
  TNativeMotionTarget,
  TNativeMotionTargetResolver,
  TNativeMotionVelocities,
} from "./types"

function getValueState(
  visualElement?: TNativeMotionAnimationOwner,
): [TNativeMotionResolvedValues, TNativeMotionVelocities] {
  const state: [TNativeMotionResolvedValues, TNativeMotionVelocities] = [{}, {}]

  visualElement?.values.forEach((value: MotionValue<unknown>, key: string) => {
    state[0][key] = value.get()
    state[1][key] = value.getVelocity()
  })

  return state
}

export function resolveVariantFromProps(
  props: TNativeMotionAnimationProps,
  definition: TNativeMotionTarget | TNativeMotionTargetResolver,
  custom?: unknown,
  visualElement?: TNativeMotionAnimationOwner,
): TNativeMotionTarget
export function resolveVariantFromProps(
  props: TNativeMotionAnimationProps,
  definition?: TNativeMotionDefinition,
  custom?: unknown,
  visualElement?: TNativeMotionAnimationOwner,
): undefined | TNativeMotionTarget
export function resolveVariantFromProps(
  props: TNativeMotionAnimationProps,
  definition?: TNativeMotionDefinition,
  custom?: unknown,
  visualElement?: TNativeMotionAnimationOwner,
) {
  /**
   * If the variant definition is a function, resolve.
   */
  if (typeof definition === "function") {
    const [current, velocity] = getValueState(visualElement)
    definition = definition(custom !== undefined ? custom : props.custom, current, velocity)
  }

  /**
   * If the variant definition is a variant label, or
   * the function returned a variant label, resolve.
   */
  if (typeof definition === "string") {
    definition = props.variants && props.variants[definition]
  }

  /**
   * At this point we've resolved both functions and variant labels,
   * but the resolved variant label might itself have been a function.
   * If so, resolve. This can only have returned a valid target object.
   */
  if (typeof definition === "function") {
    const [current, velocity] = getValueState(visualElement)
    definition = definition(custom !== undefined ? custom : props.custom, current, velocity)
  }

  return definition
}
