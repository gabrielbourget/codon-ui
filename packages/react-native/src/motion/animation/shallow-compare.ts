// Received from pinned Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.
export function shallowCompare(next: unknown[], prev: unknown) {
  if (!Array.isArray(prev)) return false

  const prevLength = prev.length

  if (prevLength !== next.length) return false

  for (let i = 0; i < prevLength; i++) {
    if (prev[i] !== next[i]) return false
  }

  return true
}
