// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
export function isNullish(v: unknown): v is null | undefined {
  return v == null
}
