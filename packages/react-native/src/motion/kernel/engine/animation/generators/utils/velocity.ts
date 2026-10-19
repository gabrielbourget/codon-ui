// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
import { velocityPerSecond } from "../../../../utils/index"

const velocitySampleDuration = 5 // ms

export function getGeneratorVelocity(resolveValue: (v: number) => number, t: number, current: number) {
  const prevT = Math.max(t - velocitySampleDuration, 0)
  return velocityPerSecond(current - resolveValue(prevT), t - prevT)
}
