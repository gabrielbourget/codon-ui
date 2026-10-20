// Received from motion-utils 12.39.0. See UPSTREAM.json and LICENSE.motion-utils.md.
import type { Easing } from "../types"

/*#__NO_SIDE_EFFECTS__*/
export const isEasingArray = (ease: unknown): ease is Easing[] => {
  return Array.isArray(ease) && typeof ease[0] !== "number"
}
