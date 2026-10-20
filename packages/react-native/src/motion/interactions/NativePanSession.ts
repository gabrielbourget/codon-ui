// Native session adapter of pinned Motion 12.40.0; see UPSTREAM.json and ../animation/LICENSE.framer-motion.md.
import type { TNativeMotionTransformPoint } from "../config"
import { cancelFrame, frame, frameData } from "../kernel"

import type { TNativeMotionPanEvent, TNativeMotionPanInfo, TNativeMotionPointInfo } from "./types"

type TPoint = TNativeMotionPanInfo["point"]
type TTimestampedPoint = TPoint & { timestamp: number }
export type TNativePanHandlers = {
  onSessionStart?: (event: TNativeMotionPanEvent, info: TNativeMotionPanInfo) => void
  onStart?: (event: TNativeMotionPanEvent, info: TNativeMotionPanInfo) => void
  onMove?: (event: TNativeMotionPanEvent, info: TNativeMotionPanInfo) => void
  onEnd?: (event: TNativeMotionPanEvent, info: TNativeMotionPanInfo) => void
  onSessionEnd?: (event: TNativeMotionPanEvent, info: TNativeMotionPanInfo) => void
  resumeAnimation?: () => void
}
export type TNativePanOptions = {
  transformPagePoint?: TNativeMotionTransformPoint
  dragSnapToOrigin?: boolean
  distanceThreshold?: number
  isCurrent: () => boolean
  onError: (error: unknown) => void
}

export const isNativeMotionPrimaryPointer = (event: TNativeMotionPanEvent) => {
  const pointer = event.nativeEvent
  if (!("pointerId" in pointer))
    return pointer.touches.length === 1 && pointer.touches[0].identifier === pointer.identifier
  return pointer.pointerType === "mouse"
    ? typeof pointer.button !== "number" || pointer.button <= 0
    : pointer.isPrimary !== false
}
export const nativePanEventSource = (event: TNativeMotionPanEvent) =>
  "pointerId" in event.nativeEvent ? "pointer" : "touch"
const pointerKey = (event: TNativeMotionPanEvent) => {
  const pointer = event.nativeEvent
  const id = "pointerId" in pointer ? pointer.pointerId : pointer.identifier
  if (typeof id !== "string" && !Number.isSafeInteger(id))
    throw new Error("Native pan: actual pointer identity required")
  return JSON.stringify([nativePanEventSource(event), typeof id, id])
}
const pointInfo = (event: TNativeMotionPanEvent): TNativeMotionPointInfo => {
  const { pageX: x, pageY: y } = event.nativeEvent
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Native pan: finite native page coordinates required")
  return { point: { x, y } }
}
const transformPoint = (
  info: TNativeMotionPointInfo,
  transform?: TNativeMotionTransformPoint,
): TNativeMotionPointInfo => {
  const point = transform ? transform(info.point) : info.point
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
    throw new Error("Native pan: finite transformed coordinates required")
  return { point: { x: point.x, y: point.y } }
}
const subtractPoint = (a: TPoint, b: TPoint): TPoint => ({ x: a.x - b.x, y: a.y - b.y })
const velocity = (history: readonly TTimestampedPoint[], timeDelta: number): TPoint => {
  if (history.length < 2) return { x: 0, y: 0 }
  let index = history.length - 1,
    timestampedPoint: TTimestampedPoint | undefined
  const last = history[history.length - 1]
  while (index >= 0) {
    timestampedPoint = history[index]
    if (last.timestamp - timestampedPoint.timestamp > timeDelta * 1000) break
    index--
  }
  if (!timestampedPoint) return { x: 0, y: 0 }
  if (
    timestampedPoint === history[0] &&
    history.length > 2 &&
    last.timestamp - timestampedPoint.timestamp > timeDelta * 2000
  )
    timestampedPoint = history[1]
  const seconds = (last.timestamp - timestampedPoint.timestamp) / 1000
  if (seconds === 0) return { x: 0, y: 0 }
  const current = { x: (last.x - timestampedPoint.x) / seconds, y: (last.y - timestampedPoint.y) / seconds }
  if (current.x === Infinity) current.x = 0
  if (current.y === Infinity) current.y = 0
  return current
}
const panInfo = ({ point }: TNativeMotionPointInfo, history: readonly TTimestampedPoint[]): TNativeMotionPanInfo => ({
  point,
  delta: subtractPoint(point, history[history.length - 1]),
  offset: subtractPoint(point, history[0]),
  velocity: velocity(history, 0.1),
})

// Native event subscription belongs to the existing host. No browser/global listener or editor mutation is installed.
export class NativePanSession {
  private handlers: TNativePanHandlers
  private readonly history: TTimestampedPoint[] = []
  private startEvent: TNativeMotionPanEvent | null = null
  private lastMoveEvent: TNativeMotionPanEvent | null = null
  private lastMoveInfo: TNativeMotionPointInfo | null = null
  private lastRawMoveInfo: TNativeMotionPointInfo | null = null
  private active = false
  private readonly pointerIdentity: string
  constructor(
    event: TNativeMotionPanEvent,
    handlers: TNativePanHandlers,
    private readonly options: TNativePanOptions,
  ) {
    this.handlers = handlers
    this.pointerIdentity = pointerKey(event)
    if (!options.isCurrent() || !isNativeMotionPrimaryPointer(event)) return
    const initial = transformPoint(pointInfo(event), options.transformPagePoint)
    this.history.push({ ...initial.point, timestamp: frameData.timestamp })
    this.active = true
    event.persist?.()
    handlers.onSessionStart?.(event, panInfo(initial, this.history))
  }
  private admitted = (event: TNativeMotionPanEvent) =>
    this.active && this.options.isCurrent() && pointerKey(event) === this.pointerIdentity
  private updatePoint = () => {
    if (!this.active || !this.options.isCurrent()) {
      this.end()
      return
    }
    if (!this.lastMoveEvent || !this.lastMoveInfo) return
    try {
      if (this.lastRawMoveInfo)
        this.lastMoveInfo = transformPoint(this.lastRawMoveInfo, this.options.transformPagePoint)
      const info = panInfo(this.lastMoveInfo, this.history)
      const started = this.startEvent !== null
      const crossed = Math.sqrt(info.offset.x ** 2 + info.offset.y ** 2) >= (this.options.distanceThreshold ?? 3)
      if (!started && !crossed) return
      this.history.push({ ...info.point, timestamp: frameData.timestamp })
      if (!started) {
        this.handlers.onStart?.(this.lastMoveEvent, info)
        this.startEvent = this.lastMoveEvent
      }
      this.handlers.onMove?.(this.lastMoveEvent, info)
    } catch (error) {
      this.end()
      if (this.options.isCurrent()) this.options.onError(error)
    }
  }
  move = (event: TNativeMotionPanEvent) => {
    if (!this.admitted(event)) return
    event.persist?.()
    this.lastMoveEvent = event
    this.lastRawMoveInfo = pointInfo(event)
    this.lastMoveInfo = transformPoint(this.lastRawMoveInfo, this.options.transformPagePoint)
    frame.update(this.updatePoint, true)
  }
  finish = (event: TNativeMotionPanEvent, cancelled = false) => {
    if (!this.admitted(event)) return false
    this.end()
    event.persist?.()
    if (this.options.dragSnapToOrigin || !this.startEvent) this.handlers.resumeAnimation?.()
    if (!this.lastMoveEvent || !this.lastMoveInfo) return true
    const info = panInfo(
      cancelled ? this.lastMoveInfo : transformPoint(pointInfo(event), this.options.transformPagePoint),
      this.history,
    )
    if (this.startEvent) this.handlers.onEnd?.(event, info)
    this.handlers.onSessionEnd?.(event, info)
    return true
  }
  updateHandlers = (handlers: TNativePanHandlers) => {
    this.handlers = handlers
  }
  isCurrent = () => this.active && this.options.isCurrent()
  end = () => {
    this.active = false
    cancelFrame(this.updatePoint)
  }
}
