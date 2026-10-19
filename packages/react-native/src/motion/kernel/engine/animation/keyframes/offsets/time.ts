// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
export function convertOffsetToTimes(offset: number[], duration: number) {
  return offset.map((o) => o * duration)
}
