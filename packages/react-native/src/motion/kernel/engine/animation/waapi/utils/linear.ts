// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
import type { EasingFunction } from "../../../../utils/index"

export const generateLinearEasing = (
  easing: EasingFunction,
  duration: number, // as milliseconds
  resolution: number = 10, // as milliseconds
): string => {
  let points = ""
  const numPoints = Math.max(Math.round(duration / resolution), 2)

  for (let i = 0; i < numPoints; i++) {
    points += Math.round(easing(i / (numPoints - 1)) * 10000) / 10000 + ", "
  }

  return `linear(${points.substring(0, points.length - 2)})`
}
