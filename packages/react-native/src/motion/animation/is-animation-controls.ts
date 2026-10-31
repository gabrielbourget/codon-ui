// Received from pinned Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.
import type { TNativeMotionAnimationControls } from "./types"

export function isAnimationControls(v?: unknown): v is TNativeMotionAnimationControls {
  return v !== null && typeof v === "object" && typeof (v as TNativeMotionAnimationControls).start === "function"
}
