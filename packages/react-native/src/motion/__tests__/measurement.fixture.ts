import type { TNativeMotionResolutionToken } from "../value"

export const measurementToken = () => {
  let active = true
  const listeners = new Set<() => void>()
  const token: TNativeMotionResolutionToken = {
    isCurrent: () => active,
    onCancel: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
  return {
    ...token,
    cancel: () => {
      active = false
      ;[...listeners].forEach((listener) => listener())
    },
    size: () => listeners.size,
  }
}
