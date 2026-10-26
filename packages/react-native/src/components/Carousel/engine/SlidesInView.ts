import type { EventHandlerType } from "./EventHandler"
import type { TNativeCarouselDocument, TNativeCarouselNode } from "./nativeEnvironment"
import type { NodeRectType } from "./NodeRects"

export type SlidesInViewOptionsType = number | number[]
export type SlidesInViewType = { init: () => void; destroy: () => void; get: (inView?: boolean) => number[] }
const rect = (node: TNativeCarouselNode): NodeRectType | null => {
  if (!("getBoundingClientRect" in node) || typeof node.getBoundingClientRect !== "function") return null
  const value: unknown = node.getBoundingClientRect()
  if (!value || typeof value !== "object") return null
  const read = (key: string): unknown => Reflect.get(value, key)
  if (
    !["top", "right", "bottom", "left", "width", "height"].every(
      (key) => typeof read(key) === "number" && Number.isFinite(read(key)),
    )
  )
    return null
  return value as NodeRectType
}
export const SlidesInView = (
  _container: TNativeCarouselNode,
  slides: TNativeCarouselNode[],
  events: EventHandlerType,
  threshold: SlidesInViewOptionsType,
  document: TNativeCarouselDocument,
): SlidesInViewType => {
  const entries = new Map<number, { inView: boolean; ratio: number }>()
  const thresholds = [...new Set([0, ...(Array.isArray(threshold) ? threshold : [threshold])])].sort((a, b) => a - b)
  let frame = 0,
    generation = 0,
    followup = 0
  let initialized = false,
    pendingNotice = false
  const removers: (() => void)[] = []
  const sample = () => {
    const viewport = rect(document.environment.nodes().root.node)
    if (!viewport || document.hidden()) return false
    const rendered = Reflect.get(document.root, "offsetParent") !== null
    let changed = false
    slides.forEach((slide, index) => {
      const value = rect(slide)
      if (!value) return
      const spanX = Math.min(value.right, viewport.right) - Math.max(value.left, viewport.left)
      const spanY = Math.min(value.bottom, viewport.bottom) - Math.max(value.top, viewport.top)
      const width = Math.max(0, spanX),
        height = Math.max(0, spanY)
      const inView = rendered && Reflect.get(slide, "offsetParent") !== null && spanX >= 0 && spanY >= 0
      const area = value.width * value.height
      const ratio = area > 0 ? (width * height) / area : Number(inView)
      const previous = entries.get(index)
      if (!previous || previous.inView !== inView || thresholds.some((edge) => previous.ratio < edge !== ratio < edge))
        changed = true
      entries.set(index, { inView, ratio })
    })
    initialized = true
    return changed
  }
  const schedule = () => {
    if (frame || document.hidden()) return
    const current = generation
    frame = requestAnimationFrame(() => {
      frame = 0
      if (current !== generation || document.hidden()) return
      const changed = sample()
      if (changed || pendingNotice) {
        pendingNotice = false
        events.emit("slidesInView")
      }
      if (events.hasListeners("slidesInView") || followup-- > 0) schedule()
    })
  }
  return {
    init: () => {
      if (thresholds.some((value) => !Number.isFinite(value) || value < 0 || value > 1))
        throw new RangeError("Carousel: in-view thresholds must be finite numbers between zero and one")
      schedule()
      removers.push(
        events.subscribeListeners(() => {
          if (events.hasListeners("slidesInView")) schedule()
        }),
      )
      removers.push(
        document.events.subscribe("geometry", () => {
          followup = 1
          schedule()
        }),
      )
      removers.push(
        document.events.subscribe("visibility", () => {
          if (document.hidden()) {
            cancelAnimationFrame(frame)
            frame = 0
          } else {
            followup = 1
            schedule()
          }
        }),
      )
    },
    destroy: () => {
      generation++
      cancelAnimationFrame(frame)
      frame = 0
      removers.splice(0).forEach((remove) => remove())
    },
    get: (inView = true) => {
      if (initialized && !document.hidden() && sample() && events.hasListeners("slidesInView")) {
        pendingNotice = true
        schedule()
      }
      return [...entries].filter(([, entry]) => entry.inView === inView).map(([index]) => index)
    },
  }
}
