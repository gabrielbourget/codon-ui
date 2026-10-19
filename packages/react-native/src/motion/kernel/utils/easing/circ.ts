// Received from motion-utils 12.39.0. See UPSTREAM.json and LICENSE.motion-utils.md.
import { mirrorEasing } from "./modifiers/mirror"
import { reverseEasing } from "./modifiers/reverse"
import type { EasingFunction } from "./types"

export const circIn: EasingFunction = (p) => 1 - Math.sin(Math.acos(p))
export const circOut = reverseEasing(circIn)
export const circInOut = mirrorEasing(circIn)
