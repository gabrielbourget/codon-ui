// Received from motion-utils 12.39.0. See UPSTREAM.json and LICENSE.motion-utils.md.
export const clamp = (min: number, max: number, v: number) => {
  if (v > max) return max
  if (v < min) return min
  return v
}
