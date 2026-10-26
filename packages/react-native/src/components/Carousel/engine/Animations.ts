import type { EngineType } from "./Engine"
import type { TNativeCarouselDocument } from "./nativeEnvironment"
import type { WindowType } from "./utils"

export type AnimationsUpdateType = (engine: EngineType) => void
export type AnimationsRenderType = (engine: EngineType, alpha: number) => void
export type AnimationsType = {
  init: () => void
  destroy: () => void
  start: () => void
  stop: () => void
  update: () => void
  render: (alpha: number) => void
}
// The pinned fixed-step integrator uses the existing native frame clock and window lease.
export const Animations = (
  document: TNativeCarouselDocument,
  window: WindowType,
  update: () => void,
  render: (alpha: number) => void,
): AnimationsType => {
  const step = 1000 / 60
  let previous: number | null = null,
    accumulated = 0,
    frame = 0,
    generation = 0
  let resume = false
  const removers: (() => void)[] = []
  const stop = () => {
    generation++
    window.cancelAnimationFrame(frame)
    frame = 0
    previous = null
    accumulated = 0
  }
  const start = () => {
    if (frame) return
    if (document.hidden()) {
      resume = true
      return
    }
    const current = generation
    const session = window.state()
    const animate = (timestamp: number) => {
      if (!frame || current !== generation) return
      const now = window.state()
      if (document.hidden() || now.windowId !== session.windowId || now.epoch !== session.epoch) {
        resume = true
        stop()
        if (!document.hidden()) start()
        return
      }
      if (!previous) {
        previous = timestamp
        update()
        update()
      }
      accumulated += timestamp - previous
      previous = timestamp
      while (accumulated >= step) {
        update()
        accumulated -= step
      }
      render(accumulated / step)
      if (frame && current === generation) frame = window.requestAnimationFrame(animate)
    }
    frame = window.requestAnimationFrame(animate)
  }
  return {
    init: () => {
      removers.push(
        document.events.subscribe("visibility", () => {
          if (document.hidden()) {
            resume = !!frame
            stop()
          } else if (resume) {
            resume = false
            start()
          }
        }),
      )
    },
    destroy: () => {
      stop()
      resume = false
      removers.splice(0).forEach((remove) => remove())
    },
    start,
    stop,
    update,
    render,
  }
}
