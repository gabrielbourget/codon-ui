// Received from motion-utils 12.39.0. See UPSTREAM.json and LICENSE.motion-utils.md.
import type { BezierDefinition, Easing } from "../types"

/*#__NO_SIDE_EFFECTS__*/
export const isBezierDefinition = (easing: Easing | Easing[]): easing is BezierDefinition =>
  Array.isArray(easing) && typeof easing[0] === "number"
