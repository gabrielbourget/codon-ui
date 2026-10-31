// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
import { millisecondsToSeconds } from "../../../../utils/index"
import type { GeneratorFactory, Transition } from "../../types"

import { calcGeneratorDuration, maxGeneratorDuration } from "./calc-duration"

/**
 * Create a progress => progress easing function from a generator.
 */
export function createGeneratorEasing(options: Transition, scale = 100, createGenerator: GeneratorFactory) {
  const generator = createGenerator({ ...options, keyframes: [0, scale] })
  const duration = Math.min(calcGeneratorDuration(generator), maxGeneratorDuration)

  return {
    type: "keyframes",
    ease: (progress: number) => {
      return generator.next(duration * progress).value / scale
    },
    duration: millisecondsToSeconds(duration),
  }
}
