import type { AxisType } from "./Axis"
import type { EmblaCarouselType } from "./EmblaCarousel"
import type { EventHandlerType } from "./EventHandler"
import type { TNativeCarouselNode, TNativeCarouselResizeEntry } from "./nativeEnvironment"
import type { NodeRectsType } from "./NodeRects"
import type { WindowType } from "./utils"

export type ResizeHandlerOptionType =
  | boolean
  | ((api: EmblaCarouselType, entries: readonly TNativeCarouselResizeEntry[]) => boolean | void)
export type ResizeHandlerType = { init: (api: EmblaCarouselType) => void; destroy: () => void }
export const ResizeHandler = (
  container: TNativeCarouselNode,
  events: EventHandlerType,
  window: WindowType,
  slides: TNativeCarouselNode[],
  axis: AxisType,
  watch: ResizeHandlerOptionType,
  rects: NodeRectsType,
): ResizeHandlerType => {
  const nodes = [container, ...slides]
  const removers: (() => void)[] = []
  const sizes = new Map<TNativeCarouselNode, number>()
  let frame = 0,
    generation = 0
  return {
    init: (api) => {
      if (!watch) return
      const current = generation
      for (const node of nodes) sizes.set(node, axis.measureSize(rects.measure(node)))
      frame = window.requestAnimationFrame(() => {
        frame = 0
        if (current !== generation) return
        for (const node of nodes)
          removers.push(
            window.environment.binding(node).events.subscribe("layout", (originalEvent) => {
              if (current !== generation) return
              if (typeof watch === "function" && !watch(api, [{ target: node, originalEvent }])) return
              if (Math.abs(axis.measureSize(rects.measure(node)) - (sizes.get(node) ?? 0)) >= 0.5) {
                api.reInit()
                events.emit("resize")
              }
            }),
          )
      })
    },
    destroy: () => {
      generation++
      window.cancelAnimationFrame(frame)
      frame = 0
      removers.splice(0).forEach((remove) => remove())
    },
  }
}
