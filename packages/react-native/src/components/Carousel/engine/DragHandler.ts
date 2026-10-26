import type { AnimationsType } from "./Animations"
import type { AxisType } from "./Axis"
import type { CounterType } from "./Counter"
import type { DragTrackerType, PointerEventType } from "./DragTracker"
import type { EmblaCarouselType } from "./EmblaCarousel"
import type { EventHandlerType } from "./EventHandler"
import { EventStore } from "./EventStore"
import { Limit } from "./Limit"
import {
  nativeCarouselEditableTarget,
  nativeCarouselPointer,
  nativeCarouselPointerTarget,
  type TNativeCarouselDocument,
  type TNativeCarouselNode,
} from "./nativeEnvironment"
import type { PercentOfViewType } from "./PercentOfView"
import type { ScrollBodyType } from "./ScrollBody"
import type { ScrollTargetType } from "./ScrollTarget"
import type { ScrollToType } from "./ScrollTo"
import { deltaAbs, factorAbs, mathAbs, mathSign, type WindowType } from "./utils"
import type { Vector1DType } from "./Vector1d"

export type DragHandlerOptionType = boolean | ((api: EmblaCarouselType, event: PointerEventType) => boolean | void)
export type DragHandlerType = {
  init: (api: EmblaCarouselType) => void
  destroy: () => void
  pointerDown: () => boolean
  retire: () => void
  shouldClaim: (x: number, y: number, touches: number) => boolean
}
export const DragHandler = (
  axis: AxisType,
  root: TNativeCarouselNode,
  document: TNativeCarouselDocument,
  _window: WindowType,
  target: Vector1DType,
  tracker: DragTrackerType,
  location: Vector1DType,
  animation: AnimationsType,
  scrollTo: ScrollToType,
  body: ScrollBodyType,
  scrollTarget: ScrollTargetType,
  index: CounterType,
  events: EventHandlerType,
  percent: PercentOfViewType,
  dragFree: boolean,
  threshold: number,
  skipSnaps: boolean,
  baseFriction: number,
  watchDrag: DragHandlerOptionType,
): DragHandlerType => {
  const initial = EventStore(document.environment),
    moving = EventStore(document.environment)
  const nextThreshold = Limit(50, 225).constrain(percent.measure(20))
  let down = false,
    mouse = false,
    preventScroll = false,
    preventClick = false,
    isMoving = false
  let startScroll = 0,
    startCross = 0,
    pointerId: number | undefined
  const retire = () => {
    down = false
    preventScroll = false
    pointerId = undefined
    moving.clear()
  }
  const up = (event: PointerEventType) => {
    if (!down) return
    const current = scrollTarget.byDistance(0, false)
    const rawForce = tracker.pointerUp(event) * (dragFree ? (mouse ? 500 : 600) : mouse ? 300 : 400)
    const proposed = axis.direction(rawForce)
    const baseForce = scrollTarget.byDistance(proposed, !dragFree).distance
    const next = index.add(mathSign(proposed) * -1)
    const force =
      dragFree || mathAbs(proposed) < nextThreshold
        ? baseForce
        : skipSnaps && current.index !== index.get()
          ? baseForce * 0.5
          : scrollTarget.byIndex(next.get(), 0).distance
    const factor = factorAbs(rawForce, force)
    retire()
    body.useDuration((dragFree ? 43 : 25) - 10 * factor).useFriction(baseFriction + factor / 50)
    scrollTo.distance(force, !dragFree)
    events.emit("pointerUp")
  }
  const move = (event: PointerEventType) => {
    if (!down) return
    const data = nativeCarouselPointer(event)
    if (data.pointerId !== pointerId) return
    if (!document.environment.active()) return retire()
    const distance = deltaAbs(tracker.readPoint(event), startScroll)
    const cross = deltaAbs(tracker.readPoint(event, axis.cross), startCross)
    if (!preventScroll && !mouse) {
      preventScroll = distance > cross
      if (!preventScroll) return up(event)
    }
    const difference = tracker.pointerMove(event)
    if (distance > threshold) preventClick = true
    body.useFriction(0.3).useDuration(0.75)
    animation.start()
    target.add(axis.direction(difference))
  }
  const begin = (api: EmblaCarouselType, event: PointerEventType) => {
    const data = nativeCarouselPointer(event)
    if (down) {
      if (data.pointerId !== pointerId && data.pointerType !== "mouse") up(event)
      return
    }
    if (!document.environment.active() || !data.isPrimary || (data.pointerType === "mouse" && data.button !== 0)) return
    if (typeof watchDrag === "function" && !watchDrag(api, event)) return
    if (nativeCarouselEditableTarget(nativeCarouselPointerTarget(event, root))) return
    mouse = data.pointerType === "mouse"
    preventClick = dragFree && mouse && !data.buttons && isMoving
    isMoving = deltaAbs(target.get(), location.get()) >= 2
    down = true
    pointerId = data.pointerId
    tracker.pointerDown(event)
    body.useFriction(0).useDuration(0)
    target.set(location)
    startScroll = tracker.readPoint(event)
    startCross = tracker.readPoint(event, axis.cross)
    moving
      .add(document, "pointerMove", move)
      .add(document, "pointerUp", (value) => {
        if (nativeCarouselPointer(value).pointerId === pointerId) up(value)
      })
      .add(document, "pointerCancel", (value) => {
        if (nativeCarouselPointer(value).pointerId === pointerId) up(value)
      })
    events.emit("pointerDown")
  }
  return {
    init: (api) => {
      if (!watchDrag) return
      initial
        .add(root, "pointerDown", (event) => begin(api, event))
        .add(document, "pointerDown", (event) => {
          if (
            down &&
            nativeCarouselPointer(event).pointerId !== pointerId &&
            nativeCarouselPointer(event).pointerType !== "mouse"
          )
            up(event)
        })
        .add(document, "visibility", () => {
          if (document.hidden()) retire()
        })
    },
    destroy: () => {
      retire()
      initial.clear()
    },
    retire,
    pointerDown: () => down,
    shouldClaim: (x, y, touches) => {
      if (!down || touches !== 1 || !document.environment.active()) return false
      const scroll = axis.scroll === "x" ? x : y
      const cross = axis.cross === "x" ? x : y
      const distance = deltaAbs(scroll, startScroll)
      return preventClick || (distance > threshold && (mouse || distance > deltaAbs(cross, startCross)))
    },
  }
}
