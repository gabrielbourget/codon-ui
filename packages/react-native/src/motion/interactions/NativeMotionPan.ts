import { cancelFrame, frame } from "../kernel"
import type { NativeMotionOwner } from "../owner/NativeMotionOwner"

import { NativePanSession, isNativeMotionPrimaryPointer, nativePanEventSource } from "./NativePanSession"
import type { TNativePanHandlers } from "./NativePanSession"
import type { TNativeMotionPanEvent, TNativeMotionPanInfo } from "./types"

export class NativeMotionPan {
  private session?: NativePanSession
  private source?: ReturnType<typeof nativePanEventSource>
  private readonly jobs = new Set<() => void>()
  constructor(
    private readonly owner: NativeMotionOwner,
    private readonly error: (error: unknown) => void,
  ) {}
  private configured = () => {
    return this.owner.hasFeature("pan")
  }
  private queue = (
    phase: "update" | "postRender",
    callback: ((event: TNativeMotionPanEvent, info: TNativeMotionPanInfo) => void) | undefined,
    current: () => boolean,
  ) =>
    callback
      ? (event: TNativeMotionPanEvent, info: TNativeMotionPanInfo) => {
          event.persist?.()
          const job = () => {
            this.jobs.delete(job)
            if (current()) callback(event, info)
          }
          this.jobs.add(job)
          frame[phase](job, false, phase === "update")
        }
      : undefined
  private handlers = (current: () => boolean): TNativePanHandlers => {
    const props = this.owner.getProps()
    return {
      onSessionStart: this.queue("update", props.onPanSessionStart, current),
      onStart: this.queue("update", props.onPanStart, current),
      onMove: this.queue("update", props.onPan, current),
      onEnd: this.queue("postRender", props.onPanEnd, current),
    }
  }
  start = (event: TNativeMotionPanEvent) => {
    if (
      !this.configured() ||
      !this.owner.captureAnimationLease()() ||
      !isNativeMotionPrimaryPointer(event) ||
      event.isDefaultPrevented?.()
    )
      return
    const source = nativePanEventSource(event)
    if (this.session?.isCurrent() && this.source !== source) return
    try {
      this.session?.end()
      const current = this.owner.captureAnimationLease()
      this.session = new NativePanSession(event, this.handlers(current), {
        transformPagePoint: this.owner.getTransformPagePoint(),
        isCurrent: current,
        onError: this.error,
      })
      this.source = source
    } catch (error) {
      this.error(error)
    }
  }
  move = (event: TNativeMotionPanEvent) => {
    try {
      this.session?.move(event)
    } catch (error) {
      this.session?.end()
      this.error(error)
    }
  }
  finish = (event: TNativeMotionPanEvent, cancelled = false) => {
    try {
      if (this.session?.finish(event, cancelled)) this.session = undefined
    } catch (error) {
      this.session?.end()
      this.session = undefined
      this.error(error)
    }
  }
  refresh = () => {
    if (!this.configured() || !this.session?.isCurrent()) {
      this.session?.end()
      this.session = undefined
      return
    }
    this.session.updateHandlers(this.handlers(this.owner.captureAnimationLease()))
  }
  retire = () => {
    this.session?.end()
    this.session = undefined
    for (const job of this.jobs) cancelFrame(job)
    this.jobs.clear()
  }
}
