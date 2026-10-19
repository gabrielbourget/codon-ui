// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
export function mixImmediate<T>(a: T, b: T) {
  return (p: number) => (p > 0 ? b : a)
}
