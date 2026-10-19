// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
import { fillOffset } from "./fill"

export function defaultOffset(arr: unknown[]): number[] {
  const offset = [0]
  fillOffset(offset, arr.length - 1)
  return offset
}
