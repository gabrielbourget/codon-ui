import { useLayoutEffect, useState, type RefObject } from "react"
import { findNodeHandle, type ScrollView } from "react-native"

export const useNativeFloatingScrollAnchor = (
  enabled: boolean,
  scrollRef: RefObject<ScrollView | null> | undefined,
) => {
  const [tag, setTag] = useState(0)
  useLayoutEffect(() => {
    if (!enabled || !scrollRef) {
      setTag(0)
      return
    }
    let live = true
    let frame: ReturnType<typeof requestAnimationFrame> | null = null
    const update = () => {
      if (!live) return
      const target = scrollRef.current
      const next = target ? findNodeHandle(target) : null
      setTag(next !== null && Number.isSafeInteger(next) && next > 0 ? next : 0)
      frame = requestAnimationFrame(update)
    }
    update()
    return () => {
      live = false
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [enabled, scrollRef])
  return enabled ? tag : 0
}
