// Received from pinned Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.
import type { TNativeMotionTransition } from "./types"

const orchestrationKeys = new Set([
  "when",
  "delay",
  "delayChildren",
  "staggerChildren",
  "staggerDirection",
  "repeat",
  "repeatType",
  "repeatDelay",
  "from",
  "elapsed",
])

/**
 * Decide whether a transition is defined on a given TNativeMotionTransition.
 * This filters out orchestration options and returns true
 * if any options are left.
 */
export function isTransitionDefined(transition: TNativeMotionTransition & { elapsed?: number; from?: unknown }) {
  for (const key in transition) {
    if (!orchestrationKeys.has(key)) return true
  }
  return false
}
