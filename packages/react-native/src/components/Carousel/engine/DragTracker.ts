import type { AxisOptionType, AxisType } from "./Axis"
import { nativeCarouselPointer, nativeCarouselPointerTime, type TNativeCarouselPointerEvent } from "./nativeEnvironment"
import { mathAbs, type WindowType } from "./utils"

export type PointerEventType = TNativeCarouselPointerEvent
export type DragTrackerType = {
  pointerDown: (event: PointerEventType) => number
  pointerMove: (event: PointerEventType) => number
  pointerUp: (event: PointerEventType) => number
  readPoint: (event: PointerEventType, axis?: AxisOptionType) => number
}
export const DragTracker = (axis: AxisType, _window: WindowType): DragTrackerType => {
  let start: PointerEventType | undefined, last: PointerEventType | undefined
  const readPoint = (event: PointerEventType, direction = axis.scroll) => {
    const data = nativeCarouselPointer(event)
    return direction === "x" ? data.pageX : data.pageY
  }
  return {
    readPoint,
    pointerDown: (event) => {
      event.persist?.()
      start = last = event
      return readPoint(event)
    },
    pointerMove: (event) => {
      event.persist?.()
      const distance = last ? readPoint(event) - readPoint(last) : 0
      if (!start || nativeCarouselPointerTime(event) - nativeCarouselPointerTime(start) > 170) start = event
      last = event
      return distance
    },
    pointerUp: (event) => {
      if (!start || !last) return 0
      const distance = readPoint(last) - readPoint(start)
      const time = nativeCarouselPointerTime(event) - nativeCarouselPointerTime(start)
      const expired = nativeCarouselPointerTime(event) - nativeCarouselPointerTime(last) > 170
      const force = distance / time
      return time && !expired && mathAbs(force) > 0.1 ? force : 0
    },
  }
}
