import { useLayoutEffect, useState, type RefObject } from "react"
import { findNodeHandle, type ScrollView, type VirtualizedList } from "react-native"

export type TNativeFloatingScrollHost =
  | Pick<ScrollView, "getNativeScrollRef" | "getScrollableNode">
  | Pick<VirtualizedList<unknown>, "getScrollRef" | "getScrollResponder">

export const useNativeFloatingScrollAnchor = (
  enabled: boolean,
  scrollRef: RefObject<TNativeFloatingScrollHost | null> | undefined,
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
      const native =
        target && "getNativeScrollRef" in target && typeof target.getNativeScrollRef === "function"
          ? target.getNativeScrollRef()
          : target && "getScrollRef" in target && typeof target.getScrollRef === "function"
            ? target.getScrollRef()
            : null
      // RN's own getScrollableNode uses this host getter; its published handle
      // type still names legacy components rather than ReactNativeElement.
      const next = native ? findNodeHandle(native as Parameters<typeof findNodeHandle>[0]) : null
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
