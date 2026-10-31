// Received from motion-utils 12.39.0. See UPSTREAM.json and LICENSE.motion-utils.md.
// Accepts an easing function and returns a new one that outputs reversed values.

import type { EasingModifier } from "../types"

// Turns easeIn into easeOut.
/*#__NO_SIDE_EFFECTS__*/
export const reverseEasing: EasingModifier = (easing) => (p) => 1 - easing(1 - p)
