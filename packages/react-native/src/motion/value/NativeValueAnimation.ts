import { JSAnimation, time } from "../kernel"
import type {
  AnimationPlaybackControlsWithThen,
  AnimationPlayState,
  TimelineWithFallback,
  ValueAnimationOptions,
} from "../kernel"
import { getFinalKeyframe } from "../kernel/engine/animation/keyframes/get-final"
import { nativeMotionRuntime } from "../kernel/nativeRuntime"

import { canAnimateNativeKeyframes, resolveNativeMotionKeyframes } from "./keyframes"
import type { TNativeMotionResolutionTicket } from "./resolution-batch"
import type { TNativeMotionResolutionToken, TNativeMotionValueOptions, TNativeResolvedKeyframes } from "./types"

export class NativeMotionResolutionPendingError extends Error {
  constructor() {
    super("Native motion: playback metadata requires resolved native keyframes; await ready")
  }
}

// Native asynchronous counterpart of pinned Motion's value wrapper. The same
// source-owned JS driver remains responsible for actual curve/playback semantics.
export class NativeValueAnimation implements AnimationPlaybackControlsWithThen {
  private inner?: JSAnimation<unknown>
  private readonly createdAt = time.now()
  private generation = 0
  private stopped = false
  private stopping = false
  private failed = false
  private readonly cancellation = new Set<() => void>()
  private readonly queued: Array<(animation: JSAnimation<unknown>) => void> = []
  private pendingTime = 0
  private pendingSpeed = 1
  private timeline?: TimelineWithFallback
  private stopTimeline?: () => void
  private finish!: () => void
  private reject!: (error: unknown) => void
  private resolveReady!: () => void
  private rejectReady!: (error: unknown) => void
  private resolutionTicket?: TNativeMotionResolutionTicket
  private readonly pendingFinished: Promise<void>
  readonly ready: Promise<void>
  constructor(private readonly options: TNativeMotionValueOptions) {
    this.pendingFinished = new Promise<void>((resolve, reject) => {
      this.finish = resolve
      this.reject = reject
    })
    this.ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve
      this.rejectReady = reject
    })
    void this.ready.catch(() => {})
    void this.pendingFinished.catch(() => {})
    this.resolve()
  }
  private current = (generation = this.generation) =>
    !this.stopped && !this.failed && generation === this.generation && this.options.context.isCurrent()
  private token = (generation: number): TNativeMotionResolutionToken => ({
    isCurrent: () => this.current(generation),
    onCancel: (listener) => {
      if (!this.current(generation)) {
        listener()
        return () => {}
      }
      this.cancellation.add(listener)
      return () => {
        this.cancellation.delete(listener)
      }
    },
  })
  private resolve = () => {
    const generation = ++this.generation
    try {
      const token = this.token(generation)
      const ticket = this.options.context.beginResolution?.(this.options.name, token)
      this.resolutionTicket = ticket
      const options = ticket
        ? { ...this.options, context: { ...this.options.context, resolutionTicket: ticket } }
        : this.options
      const resolved = resolveNativeMotionKeyframes(options, token)
      const accept = (result: TNativeResolvedKeyframes) => {
        ticket?.settled()
        if (ticket) return ticket.ready.then(() => this.accept(result, generation))
        this.accept(result, generation)
      }
      if (resolved instanceof Promise)
        void resolved.then(accept).catch((error) => {
          if (this.current(generation)) this.fail(error)
        })
      else {
        const pending = accept(resolved)
        if (pending)
          void pending.catch((error: unknown) => {
            if (this.current(generation)) this.fail(error)
          })
      }
    } catch (error) {
      if (this.current(generation)) this.fail(error)
    }
  }
  private accept = (resolved: TNativeResolvedKeyframes, generation: number) => {
    if (!this.current(generation)) return
    const { context: _context, ...provided } = this.options
    void _context
    const options: ValueAnimationOptions<unknown> = {
      ...provided,
      keyframes: [...resolved.keyframes],
      finalKeyframe: resolved.finalKeyframe,
    }
    const resolvedAt = time.now()
    options.startTime = options.startTime ?? (resolvedAt - this.createdAt > 40 ? resolvedAt : this.createdAt)
    if (!canAnimateNativeKeyframes(options.keyframes, options.name ?? "", options.type, options.velocity)) {
      if (!options.delay) options.onUpdate?.(this.finalValue(resolved))
      options.keyframes[0] = options.keyframes[options.keyframes.length - 1]
      options.duration = 0
      options.type = "keyframes"
      options.repeat = 0
    }
    if (!this.current(generation)) return
    const currentPlayback = () => !this.failed && generation === this.generation && this.options.context.isCurrent()
    const update = options.onUpdate,
      complete = options.onComplete,
      stop = options.onStop,
      cancel = options.onCancel,
      play = options.onPlay,
      repeat = options.onRepeat
    options.onPlay = () => {
      if (currentPlayback()) play?.()
    }
    options.onRepeat = () => {
      if (currentPlayback()) repeat?.()
    }
    options.onUpdate = (latest) => {
      if (!currentPlayback()) {
        if (!this.stopped) this.stop()
        return
      }
      update?.(latest)
    }
    options.onComplete = () => {
      if (currentPlayback()) complete?.()
    }
    options.onStop = () => {
      if (this.options.context.isCurrent()) stop?.()
    }
    options.onCancel = () => {
      if (currentPlayback()) cancel?.()
    }
    const animation = new JSAnimation(options)
    this.inner = animation
    if (!this.current(generation)) {
      animation.stop()
      return
    }
    void animation.finished.then(() => {
      if (this.current(generation)) this.finish()
    })
    if (this.timeline) this.stopTimeline = animation.attachTimeline(this.timeline)
    for (const command of this.queued.splice(0)) {
      if (!this.current(generation)) break
      command(animation)
    }
    this.resolveReady()
  }
  private finalValue = (resolved: TNativeResolvedKeyframes) =>
    getFinalKeyframe(resolved.keyframes, this.options, resolved.finalKeyframe)
  private fail = (error: unknown) => {
    this.failed = true
    this.resolutionTicket?.settled(error)
    this.inner?.stop()
    this.cancellation.forEach((listener) => listener())
    this.cancellation.clear()
    this.rejectReady(error)
    this.reject(error)
    nativeMotionRuntime.queueMicrotask(() => {
      if (this.options.motionValue.animation === this) this.options.motionValue.stop()
    })
  }
  private playback = () => {
    if (!this.inner) throw new NativeMotionResolutionPendingError()
    return this.inner
  }
  get finished() {
    return this.inner?.finished ?? this.pendingFinished
  }
  then(onResolve: () => void, onReject?: () => void) {
    return this.finished.then(onResolve, onReject)
  }
  get duration() {
    return this.playback().duration
  }
  get iterationDuration() {
    return this.playback().iterationDuration
  }
  get time() {
    return this.inner?.time ?? this.pendingTime
  }
  set time(value: number) {
    this.pendingTime = value
    if (this.inner) this.inner.time = value
    else
      this.queued.push((animation) => {
        animation.time = value
      })
  }
  get speed() {
    return this.inner?.speed ?? this.pendingSpeed
  }
  set speed(value: number) {
    this.pendingSpeed = value
    if (this.inner) this.inner.speed = value
    else
      this.queued.push((animation) => {
        animation.speed = value
      })
  }
  get state(): AnimationPlayState {
    return this.inner?.state ?? "idle"
  }
  get startTime() {
    return this.inner?.startTime ?? null
  }
  set startTime(value: number | null) {
    if (this.inner) this.inner.startTime = value
    else
      this.queued.push((animation) => {
        animation.startTime = value
      })
  }
  play() {
    if (this.inner) {
      this.inner.play()
      return
    }
    if (this.failed || !this.options.context.isCurrent()) return
    this.queued.push((animation) => animation.play())
    if (this.stopped) {
      this.stopped = false
      this.resolve()
    }
  }
  pause() {
    if (this.inner) this.inner.pause()
    else this.queued.push((animation) => animation.pause())
  }
  complete() {
    if (this.inner) this.inner.complete()
    else this.queued.push((animation) => animation.complete())
  }
  stop = () => {
    if (this.stopping) return
    if (this.stopped) {
      this.stopTimeline?.()
      return
    }
    this.stopping = true
    try {
      this.inner?.stop()
    } finally {
      this.stopping = false
    }
    this.stopped = true
    if (!this.inner) this.generation++
    this.cancellation.forEach((listener) => listener())
    this.cancellation.clear()
    this.stopTimeline?.()
  }
  cancel() {
    if (this.inner) {
      this.inner.cancel()
      return
    }
    this.stopped = true
    this.generation++
    this.cancellation.forEach((listener) => listener())
    this.cancellation.clear()
  }
  attachTimeline(timeline: TimelineWithFallback) {
    this.timeline = timeline
    if (this.inner) this.stopTimeline = this.inner.attachTimeline(timeline)
    return () => this.stop()
  }
  getGeneratorVelocity() {
    return this.playback().getGeneratorVelocity()
  }
}
