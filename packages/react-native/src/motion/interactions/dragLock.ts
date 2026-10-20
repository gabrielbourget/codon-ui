import type { TNativeDragDirection } from "./dragConstraints"

const locks = new Map<string, { x: boolean; y: boolean }>()
let revision = 0
export const nativeDragGestureRevision = () => revision
export const nativeMotionIsDragging = () => [...locks.values()].some((lock) => lock.x || lock.y)
export const acquireNativeDragLock = (windowId: string, axis: boolean | TNativeDragDirection) => {
  const lock = locks.get(windowId) ?? { x: false, y: false }
  if (axis === "x" || axis === "y") {
    if (lock[axis]) return null
    lock[axis] = true
  } else {
    if (lock.x || lock.y) return null
    lock.x = lock.y = true
  }
  locks.set(windowId, lock)
  revision++
  let released = false
  return () => {
    if (released) return
    released = true
    if (axis === "x" || axis === "y") lock[axis] = false
    else lock.x = lock.y = false
    if (!lock.x && !lock.y) locks.delete(windowId)
  }
}
