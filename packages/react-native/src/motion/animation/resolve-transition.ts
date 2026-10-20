// Received from pinned Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.
import type { TNativeMotionTransition } from "./types"
/**
 * If `transition` has `inherit: true`, shallow-merge it with
 * `parentTransition` (child keys win) and strip the `inherit` key.
 * Otherwise return `transition` unchanged.
 */
export function resolveTransition(
  transition: TNativeMotionTransition | undefined,
  parentTransition?: TNativeMotionTransition,
) {
  if (transition?.inherit && parentTransition) {
    const { inherit: _, ...rest } = transition
    return { ...parentTransition, ...rest }
  }

  return transition
}
