import type { TNativeFocusEvent, TNativeKeyboardEvent } from "../../input/types"
import { cancelFrame, frame } from "../kernel"
import type { NativeMotionOwner } from "../owner/NativeMotionOwner"

import { nativeMotionIsDragging, nativeDragGestureRevision } from "./dragLock"
import type { TNativeMotionHoverEvent, TNativeMotionPointInfo, TNativeMotionTapEvent } from "./types"

type TCycle = {
  event: TNativeMotionTapEvent
  info: TNativeMotionPointInfo
  current: () => boolean
  cancelCurrent: () => boolean
  source: "pointer" | "keyboard"
  code?: number
  dragRevision: number
}
type THover = { event: TNativeMotionHoverEvent; info: TNativeMotionPointInfo; cancelCurrent: () => boolean }
const eventPoint = (event: { nativeEvent: unknown }): TNativeMotionPointInfo | undefined => {
  const data = event.nativeEvent as { pageX?: unknown; pageY?: unknown }
  return typeof data.pageX === "number" &&
    Number.isFinite(data.pageX) &&
    typeof data.pageY === "number" &&
    Number.isFinite(data.pageY)
    ? { point: { x: data.pageX, y: data.pageY } }
    : undefined
}

// Native events remain original objects; only native point metadata is constructed.
export class NativeMotionInteractions {
  private cycle?: TCycle
  private hover?: THover
  private hoverPressed = false
  private deferredHoverEnd = false
  private focused = false
  private readonly jobs = new Set<() => void>()
  constructor(
    private readonly owner: NativeMotionOwner,
    private readonly cancelLease: () => () => boolean,
    private readonly error: (error: unknown) => void,
  ) {}
  tapEnabled = () => {
    const props = this.owner.getProps()
    return Boolean(props.whileTap || props.onTap || props.onTapStart || props.onTapCancel)
  }
  hoverEnabled = () => {
    const props = this.owner.getProps()
    return Boolean(props.whileHover || props.onHoverStart || props.onHoverEnd)
  }
  private eligible = () => this.owner.captureAnimationLease()()
  private admitted = () =>
    this.eligible() && !nativeMotionIsDragging() && !this.owner.animationState.getState().whileDrag.isActive
  private priority = (type: "whileTap" | "whileHover" | "whileFocus", active: boolean) => {
    if (active && !this.owner.getProps()[type]) return
    const current = this.owner.captureAnimationLease()
    void this.owner.animationState.setActive(type, active).catch((error: unknown) => {
      if (current()) this.error(error)
    })
  }
  private point = (event: TNativeMotionTapEvent): TNativeMotionPointInfo => {
    const point = eventPoint(event)
    if (point) return point
    const target = this.owner.current
    if (!target || typeof target.getBoundingClientRect !== "function")
      throw new Error("Native motion: actual activation rectangle unavailable")
    const bounds = target.getBoundingClientRect()
    if (
      ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
      bounds.width < 0 ||
      bounds.height < 0
    )
      throw new Error("Native motion: invalid native activation rectangle")
    return { point: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 } }
  }
  private queue = <Event>(
    event: Event,
    info: TNativeMotionPointInfo,
    callback: ((event: Event, info: TNativeMotionPointInfo) => void) | undefined,
    current: () => boolean,
  ) => {
    if (!callback) return
    const point = { ...info.point }
    const job = () => {
      this.jobs.delete(job)
      if (current()) callback(event, { point })
    }
    this.jobs.add(job)
    frame.postRender(job)
  }
  start = (
    event: TNativeMotionTapEvent,
    source: TCycle["source"],
    code?: number,
    registrationCurrent: () => boolean = () => true,
  ) => {
    if (!this.tapEnabled() || !this.admitted() || this.cycle || event.isDefaultPrevented?.()) return false
    try {
      const info = this.point(event)
      event.persist?.()
      const ownerCurrent = this.owner.captureAnimationLease()
      const current = () => ownerCurrent() && registrationCurrent()
      this.cycle = {
        event,
        info,
        current,
        cancelCurrent: this.cancelLease(),
        source,
        code,
        dragRevision: nativeDragGestureRevision(),
      }
      this.priority("whileTap", true)
      this.queue(event, info, this.owner.getProps().onTapStart, current)
      return true
    } catch (error) {
      this.error(error)
      return false
    }
  }
  move = (event: TNativeMotionTapEvent) => {
    if (this.cycle?.source !== "pointer") return
    const point = eventPoint(event)
    if (point) this.cycle.info = point
  }
  end = (event: TNativeMotionTapEvent, success: boolean, source?: TCycle["source"]) => {
    const cycle = this.cycle
    if (!cycle || (source && cycle.source !== source)) return
    this.cycle = undefined
    this.priority("whileTap", false)
    const accepted =
      success &&
      this.admitted() &&
      cycle.current() &&
      cycle.dragRevision === nativeDragGestureRevision() &&
      !event.isDefaultPrevented?.()
    event.persist?.()
    let info = cycle.info
    try {
      info = this.point(event)
    } catch (error) {
      if (accepted) {
        this.error(error)
        return
      }
    }
    this.queue(
      event,
      info,
      accepted ? this.owner.getProps().onTap : this.owner.getProps().onTapCancel,
      accepted ? cycle.current : cycle.cancelCurrent,
    )
  }
  cancel = () => {
    if (this.cycle) this.end(this.cycle.event, false)
  }
  keyDown = (event: TNativeKeyboardEvent) => {
    const data = event.nativeEvent
    if (!data.nativeDefaultHandled || data.cancelled || data.repeat || (data.key !== "Enter" && data.key !== " "))
      return
    this.start(event, "keyboard", data.nativeCode)
  }
  keyUp = (event: TNativeKeyboardEvent) => {
    if (this.cycle?.source !== "keyboard" || this.cycle.code !== event.nativeEvent.nativeCode) return
    this.end(event, !event.nativeEvent.cancelled, "keyboard")
  }
  activation = (event: TNativeMotionTapEvent) => {
    if (!this.tapEnabled() || !this.admitted() || this.cycle?.source === "keyboard" || event.isDefaultPrevented?.())
      return
    if (this.cycle) {
      this.end(event, true)
      return
    }
    try {
      const info = this.point(event),
        current = this.owner.captureAnimationLease()
      event.persist?.()
      this.queue(event, info, this.owner.getProps().onTapStart, current)
      this.queue(event, info, this.owner.getProps().onTap, current)
    } catch (error) {
      this.error(error)
    }
  }
  hoverStart = (event: TNativeMotionHoverEvent) => {
    if (!this.hoverEnabled() || !this.admitted() || event.nativeEvent.pointerType === "touch") return
    const info = eventPoint(event)
    if (!info) {
      this.error(new Error("Native motion: native hover point unavailable"))
      return
    }
    event.persist?.()
    this.deferredHoverEnd = false
    this.hover = { event, info, cancelCurrent: this.cancelLease() }
    this.priority("whileHover", true)
    this.queue(event, info, this.owner.getProps().onHoverStart, this.owner.captureAnimationLease())
  }
  hoverEnd = (event?: TNativeMotionHoverEvent) => {
    if (!this.hover || event?.nativeEvent.pointerType === "touch") return
    if (event && this.hoverPressed) {
      this.deferredHoverEnd = true
      return
    }
    if (!event) this.hoverPressed = false
    this.finishHover(event)
  }
  private finishHover = (event?: TNativeMotionHoverEvent) => {
    const hover = this.hover
    if (!hover) return
    this.hover = undefined
    this.deferredHoverEnd = false
    this.priority("whileHover", false)
    const original = event ?? hover.event
    original.persist?.()
    this.queue(
      original,
      event ? (eventPoint(event) ?? hover.info) : hover.info,
      this.owner.getProps().onHoverEnd,
      hover.cancelCurrent,
    )
  }
  hoverPointerDown = () => {
    this.hoverPressed = true
  }
  hoverPointerUp = (event: TNativeMotionHoverEvent) => {
    this.hoverPressed = false
    if (this.deferredHoverEnd) this.finishHover(event)
  }
  focus = (event: TNativeFocusEvent) => {
    if (!this.eligible() || event.nativeEvent.isFocusVisible !== true || !this.owner.getProps().whileFocus) return
    this.focused = true
    this.priority("whileFocus", true)
  }
  blur = () => {
    if (this.focused) {
      this.focused = false
      this.priority("whileFocus", false)
    }
    if (this.cycle?.source === "keyboard") this.cancel()
  }
  refresh = () => {
    if (!this.eligible()) {
      this.cancel()
      this.hoverEnd()
      this.blur()
      return
    }
    if (!this.tapEnabled() || !this.admitted() || (this.cycle && !this.cycle.current())) this.cancel()
    if (!this.hoverEnabled() || !this.admitted() || (this.hover && !this.hover.cancelCurrent())) this.hoverEnd()
    if (!this.owner.getProps().whileFocus) this.blur()
  }
  retire = () => {
    for (const job of this.jobs) cancelFrame(job)
    this.jobs.clear()
    this.cycle = undefined
    this.hover = undefined
    this.focused = false
    this.hoverPressed = false
    this.deferredHoverEnd = false
  }
}
