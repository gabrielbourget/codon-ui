// Received from pinned Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.

export const isKeyframesTarget = (v: unknown): v is unknown[] => {
  return Array.isArray(v)
}
