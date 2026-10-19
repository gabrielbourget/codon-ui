// Received from pinned Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.
import type { TNativeMotionAnimationType } from "./types"

export const variantPriorityOrder: TNativeMotionAnimationType[] = [
  "animate",
  "whileInView",
  "whileFocus",
  "whileHover",
  "whileTap",
  "whileDrag",
  "exit",
]

export const variantProps = ["initial", ...variantPriorityOrder]
