// Received from pinned Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.
import { resolveTransition } from "./resolve-transition"
import type { TNativeMotionTransition } from "./types"

export function getValueTransition(transition: TNativeMotionTransition, key: string) {
  const valueTransition = transition?.[key as keyof typeof transition] ?? transition?.["default"] ?? transition

  if (valueTransition !== transition) {
    return resolveTransition(valueTransition as TNativeMotionTransition, transition)
  }

  return valueTransition as TNativeMotionTransition
}
