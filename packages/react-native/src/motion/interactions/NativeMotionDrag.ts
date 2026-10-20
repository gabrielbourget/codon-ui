import type { View } from "react-native"

import type { TNativeKeyScope } from "../../input/keyScope"
import { observeNativeMotionGeometry, readNativeMotionGeometry } from "../../input/motionGeometry"
import type { TNativeMotionGeometryRecord, TNativeMotionGeometrySnapshot } from "../../input/motionGeometry"
import { observeNativeGestureWindow } from "../../input/nativeGestureObservation"
import { cancelFrame, frame } from "../kernel"
import type { MotionValue, AnimationPlaybackControlsWithThen } from "../kernel"
import { readNativeMotionTargetGeometry } from "../measurement/targetGeometry"
import type { NativeMotionOwner } from "../owner/NativeMotionOwner"
import type { TNativeMotionResolutionToken } from "../value"

import {
  applyNativeDragConstraints,
  nativeDragAxes,
  nativeDragBoundingBox,
  nativeDragDirection,
  nativeDragElastic,
  nativeDragOrigin,
  nativeRelativeDragConstraints,
  nativeViewportDragConstraints,
  shouldNativeDrag,
} from "./dragConstraints"
import type { TNativeDragBox, TNativeDragConstraints, TNativeDragDirection } from "./dragConstraints"
import { acquireNativeDragLock } from "./dragLock"
import type { NativeDragControls, TNativeDragStartOptions } from "./NativeDragControls"
import { NativePanSession, isNativeMotionPrimaryPointer, nativePanEventSource } from "./NativePanSession"
import type { TNativeMotionPanEvent, TNativeMotionPanInfo } from "./types"

type TMeasurement = {
  windowId: string
  layout: TNativeDragBox
  model: TNativeDragBox
  bounds?: TNativeDragBox
  current: () => boolean
}
const box = (rect: readonly number[]): TNativeDragBox => ({
  x: { min: rect[0], max: rect[0] + rect[2] },
  y: { min: rect[1], max: rect[1] + rect[3] },
})
const transformedBox = (rect: TNativeDragBox, owner: NativeMotionOwner): TNativeDragBox => {
  const transform = owner.getTransformPagePoint()
  if (!transform) return rect
  const min = transform({ x: rect.x.min, y: rect.y.min }),
    max = transform({ x: rect.x.max, y: rect.y.max })
  if (![min.x, min.y, max.x, max.y].every(Number.isFinite)) throw new Error("Native drag: invalid transformed geometry")
  return { x: { min: min.x, max: max.x }, y: { min: min.y, max: max.y } }
}
const geometryShape = (snapshot: TNativeMotionGeometrySnapshot) =>
  JSON.stringify([
    snapshot.rootIdentity,
    snapshot.root.box,
    snapshot.layout,
    snapshot.ancestors.slice(1).map((ancestor) => [ancestor.identity, ancestor.layout, ancestor.scroll]),
  ])

// Native adaptation of pinned VisualElementDragControls. Native reads never strip mounted transforms.
export class NativeMotionDrag {
  isDragging = false
  private direction: TNativeDragDirection | null = null
  private origin = { x: 0, y: 0 }
  private constraints: TNativeDragConstraints | false = false
  private elastic = nativeDragElastic()
  private releaseLock?: () => void
  private session?: NativePanSession
  private source?: ReturnType<typeof nativePanEventSource>
  private latest?: { event: TNativeMotionPanEvent; info: TNativeMotionPanInfo }
  private measurement?: TMeasurement
  private measuring?: Promise<TMeasurement | undefined>
  private measurementRevision = 0
  private gesture = 0
  private animationRevision = 0
  private target?: View
  private constraintTarget?: View | null
  private shape?: string
  private constraintSize?: string
  private stopGeometry?: () => void
  private controls?: NativeDragControls
  private stopControls?: () => void
  private stopCancellation?: () => void
  private stopWindow?: () => void
  private readonly animations = new Map<MotionValue<unknown>, AnimationPlaybackControlsWithThen>()
  private lease: () => boolean = () => false
  private readonly jobs = new Set<() => void>()
  constructor(
    private readonly owner: NativeMotionOwner,
    private readonly error: (error: unknown) => void,
    private readonly scope: () => TNativeKeyScope | null = () => null,
    private readonly onDragStarted: () => void = () => {},
  ) {}
  private axisValue = (axis: TNativeDragDirection): MotionValue<unknown> => {
    const props = this.owner.getProps(),
      external = axis === "x" ? props._dragX : props._dragY
    return (
      (external as MotionValue<unknown> | undefined) ?? this.owner.getValue(axis, this.owner.latestValues[axis] ?? 0)
    )
  }
  private queue = (phase: "update" | "postRender", callback: (() => void) | undefined) => {
    if (!callback) return
    const current = this.owner.captureAnimationLease()
    const job = () => {
      this.jobs.delete(job)
      if (current()) callback()
    }
    this.jobs.add(job)
    frame[phase](job, false, phase === "update")
  }
  private active = (enabled: boolean) => {
    const current = this.owner.captureAnimationLease()
    void this.owner.animationState.setActive("whileDrag", enabled).catch((error: unknown) => {
      if (current()) this.error(error)
    })
  }
  private constraintRef = () => {
    const constraint = this.owner.getProps().dragConstraints
    return constraint && "current" in constraint ? constraint : undefined
  }
  private readMeasurement = (force = false): Promise<TMeasurement | undefined> => {
    if (!force && this.measurement?.current()) return Promise.resolve(this.measurement)
    if (this.measuring && !force) return this.measuring
    this.stopCancellation?.()
    const revision = ++this.measurementRevision,
      target = this.owner.current,
      constraintRef = this.constraintRef(),
      constraint = constraintRef?.current,
      lease = this.owner.captureAnimationLease(),
      cancellations = new Set<() => void>()
    const token: TNativeMotionResolutionToken = {
      isCurrent: () =>
        revision === this.measurementRevision &&
        lease() &&
        this.owner.current === target &&
        this.constraintRef()?.current === constraint,
      onCancel: (callback) => {
        cancellations.add(callback)
        return () => {
          cancellations.delete(callback)
        }
      },
    }
    this.stopCancellation = () => {
      ++this.measurementRevision
      ;[...cancellations].forEach((cancel) => cancel())
      cancellations.clear()
    }
    const read = async (): Promise<TMeasurement | undefined> => {
      if (!target || !token.isCurrent()) return
      if (constraintRef && !constraint) throw new Error("Native drag: dragConstraints requires a mounted native ref")
      const geometry = constraint ? await readNativeMotionTargetGeometry(target, constraint, token) : undefined
      const record = geometry ? undefined : await readNativeMotionGeometry(target, token)
      if (!token.isCurrent()) return
      const snapshot = geometry?.ownerSnapshot ?? record?.snapshot
      if (!snapshot || record?.attached === false) throw new Error("Native drag: actual native layout unavailable")
      const value: TMeasurement = {
        windowId: geometry?.windowId ?? record!.windowId,
        layout: transformedBox(box(snapshot.untransformed.box), this.owner),
        model: transformedBox(box(snapshot.model.box), this.owner),
        bounds: geometry ? transformedBox(box(geometry.targetSnapshot.model.box), this.owner) : undefined,
        current: token.isCurrent,
      }
      this.measurement = value
      return value
    }
    const result = read().finally(() => {
      if (this.measuring === result) this.measuring = undefined
    })
    this.measuring = result
    return result
  }
  private resolveConstraints = (measurement: TMeasurement) => {
    const props = this.owner.getProps(),
      ref = this.constraintRef()
    this.elastic = nativeDragElastic(props.dragElastic)
    if (ref) {
      if (!measurement.bounds) throw new Error("Native drag: actual constraint geometry unavailable")
      const measured = nativeViewportDragConstraints(measurement.layout, measurement.bounds)
      const custom = props.onMeasureDragConstraints?.(nativeDragBoundingBox(measured))
      this.constraints = custom ? nativeRelativeDragConstraints(custom) : measured
    } else
      this.constraints =
        props.dragConstraints && !("current" in props.dragConstraints)
          ? nativeRelativeDragConstraints(props.dragConstraints)
          : false
  }
  private startDragging = (event: TNativeMotionPanEvent, info: TNativeMotionPanInfo, measurement: TMeasurement) => {
    const props = this.owner.getProps()
    if (props.drag && !props.dragPropagation) {
      this.releaseLock?.()
      this.releaseLock = acquireNativeDragLock(measurement.windowId, props.drag) ?? undefined
      if (!this.releaseLock) return
    }
    this.isDragging = true
    this.onDragStarted()
    this.direction = null
    this.resolveConstraints(measurement)
    for (const axis of nativeDragAxes) {
      const current = this.axisValue(axis).get() || 0
      const value =
        typeof current === "string" && /^-?(?:\d+\.?\d*|\.\d+)%$/.test(current)
          ? ((measurement.layout[axis].max - measurement.layout[axis].min) * parseFloat(current)) / 100
          : current
      if (typeof value !== "number" || !Number.isFinite(value))
        throw new Error("Native drag: numeric or percentage axis value required")
      this.origin[axis] = value
    }
    this.queue("update", props.onDragStart ? () => props.onDragStart!(event, info) : undefined)
    this.active(true)
  }
  private applyMove = (event: TNativeMotionPanEvent, info: TNativeMotionPanInfo) => {
    const props = this.owner.getProps()
    if (!this.isDragging || (!props.dragPropagation && !this.releaseLock)) return
    if (props.dragDirectionLock && this.direction === null) {
      this.direction = nativeDragDirection(info.offset)
      if (this.direction) props.onDirectionLock?.(this.direction)
      return
    }
    for (const axis of nativeDragAxes) {
      if (!shouldNativeDrag(axis, props.drag, this.direction)) continue
      let next = this.origin[axis] + info.offset[axis]
      if (this.constraints) next = applyNativeDragConstraints(next, this.constraints[axis], this.elastic[axis])
      this.axisValue(axis).set(next)
    }
    // Existing visual subscriptions publish before the source onDrag callback phase.
    this.queue("update", props.onDrag ? () => props.onDrag!(event, info) : undefined)
  }
  start = (event: TNativeMotionPanEvent, options: TNativeDragStartOptions = {}) => {
    const props = this.owner.getProps()
    if (
      !props.drag ||
      this.owner.presenceContext?.isPresent === false ||
      !this.owner.captureAnimationLease()() ||
      !isNativeMotionPrimaryPointer(event) ||
      event.isDefaultPrevented?.()
    )
      return
    const source = nativePanEventSource(event)
    if (this.session?.isCurrent() && this.source !== source) return
    this.cancel()
    const gesture = ++this.gesture,
      current = this.owner.captureAnimationLease()
    this.lease = current
    this.source = source
    this.stopWindow = observeNativeGestureWindow({ scope: this.scope, current, move: this.move, end: this.finish })
    event.persist?.()
    let measured: TMeasurement | undefined,
      started: { event: TNativeMotionPanEvent; info: TNativeMotionPanInfo } | undefined,
      moved: { event: TNativeMotionPanEvent; info: TNativeMotionPanInfo } | undefined,
      attempted = false
    const admit = () => {
      if (!measured?.current() || gesture !== this.gesture || !current()) return
      if (started && !attempted) {
        attempted = true
        this.startDragging(started.event, started.info, measured)
      }
      if (this.isDragging && moved) {
        const latest = moved
        moved = undefined
        this.applyMove(latest.event, latest.info)
      }
    }
    try {
      this.session = new NativePanSession(
        event,
        {
          onSessionStart: () => {
            this.stopAnimation(true)
            void this.readMeasurement(Boolean(options.snapToCursor || this.constraintRef()))
              .then((measurement) => {
                if (!measurement || gesture !== this.gesture || !current()) return
                measured = measurement
                if (options.snapToCursor) {
                  const point = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }
                  for (const axis of nativeDragAxes)
                    if (shouldNativeDrag(axis, this.owner.getProps().drag, this.direction)) {
                      const value = this.axisValue(axis),
                        previous = value.get() || 0
                      if (typeof previous !== "number")
                        throw new Error("Native drag: snapToCursor requires numeric axis values")
                      value.set(
                        point[axis] - (measurement.model[axis].min + measurement.model[axis].max) / 2 + previous,
                      )
                    }
                }
                this.queue("update", admit)
              })
              .catch((failure: unknown) => {
                if (gesture === this.gesture && current()) {
                  this.cancel()
                  this.error(failure)
                }
              })
          },
          onStart: (event, info) => {
            started = { event, info }
            admit()
          },
          onMove: (event, info) => {
            this.latest = moved = { event, info }
            admit()
          },
          onSessionEnd: (event, info) => {
            this.latest = { event, info }
            this.stop(event, info)
          },
          resumeAnimation: () => {
            if ((this.owner.getProps().dragSnapToOrigin || this.constraints) && current())
              this.startAnimation({ x: 0, y: 0 })
          },
        },
        {
          transformPagePoint: this.owner.getTransformPagePoint(),
          dragSnapToOrigin: Boolean(props.dragSnapToOrigin),
          distanceThreshold: options.distanceThreshold,
          isCurrent: current,
          onError: (failure) => {
            this.cancel()
            this.error(failure)
          },
        },
      )
    } catch (failure) {
      this.cancel()
      this.error(failure)
    }
  }
  move = (event: TNativeMotionPanEvent) => {
    try {
      this.session?.move(event)
    } catch (failure) {
      this.cancel()
      this.error(failure)
    }
  }
  finish = (event: TNativeMotionPanEvent, cancelled = false) => {
    try {
      if (this.session?.finish(event, cancelled)) this.session = undefined
    } catch (failure) {
      this.cancel()
      this.error(failure)
    }
  }
  cancel = () => {
    ++this.gesture
    this.session?.end()
    this.session = undefined
    this.stopWindow?.()
    this.stopWindow = undefined
    this.isDragging = false
    this.releaseLock?.()
    this.releaseLock = undefined
    this.active(false)
  }
  stop = (event = this.latest?.event, info = this.latest?.info) => {
    const wasDragging = this.isDragging
    this.cancel()
    this.latest = undefined
    if (!wasDragging || !event || !info) return
    this.startAnimation(info.velocity)
    const callback = this.owner.getProps().onDragEnd
    this.queue("postRender", callback ? () => callback(event, info) : undefined)
  }
  private startAnimation = (velocity: { x: number; y: number }) => {
    const props = this.owner.getProps(),
      current = this.owner.captureAnimationLease(),
      revision = ++this.animationRevision
    const animations = nativeDragAxes.map((axis) => {
      if (!shouldNativeDrag(axis, props.drag, this.direction)) return
      const bounds =
        props.dragSnapToOrigin === true || props.dragSnapToOrigin === axis
          ? { min: 0, max: 0 }
          : this.constraints
            ? this.constraints[axis]
            : {}
      const elastic = props.dragElastic ?? 0.35
      const transition = {
        type: "inertia" as const,
        velocity: props.dragMomentum !== false ? velocity[axis] : 0,
        bounceStiffness: elastic ? 200 : 1000000,
        bounceDamping: elastic ? 40 : 10000000,
        timeConstant: 750,
        restDelta: 1,
        restSpeed: 10,
        ...props.dragTransition,
        ...bounds,
      }
      const value = this.axisValue(axis)
      return value.start((complete) => {
        const animation = this.owner.animateValue(
          axis,
          value,
          0,
          transition,
          complete,
          () => current() && revision === this.animationRevision,
        )
        if (animation) this.animations.set(value, animation)
        return animation
      })
    })
    void Promise.all(animations)
      .then(() => {
        if (current() && revision === this.animationRevision) props.onDragTransitionEnd?.()
      })
      .catch((failure: unknown) => {
        if (current() && revision === this.animationRevision) this.error(failure)
      })
  }
  private stopAnimation = (all = false) => {
    ++this.animationRevision
    for (const [value, animation] of this.animations) if (value.animation === animation) value.stop()
    this.animations.clear()
    if (all) nativeDragAxes.forEach((axis) => this.axisValue(axis).stop())
  }
  private resize = () => {
    if (!this.constraintRef() || !this.constraints) return
    this.stopAnimation(true)
    const progress = { x: 0, y: 0 }
    for (const axis of nativeDragAxes) {
      const latest = this.axisValue(axis).get(),
        bounds = this.constraints[axis]
      if (typeof latest !== "number" || bounds.min === undefined || bounds.max === undefined) return
      progress[axis] = nativeDragOrigin({ min: latest, max: latest }, bounds as { min: number; max: number })
    }
    void this.readMeasurement(true)
      .then((measurement) => {
        if (!measurement?.current()) return
        this.resolveConstraints(measurement)
        if (!this.constraints) return
        for (const axis of nativeDragAxes) {
          if (!shouldNativeDrag(axis, this.owner.getProps().drag, null)) continue
          const { min, max } = this.constraints[axis]
          if (min === undefined || max === undefined) continue
          this.axisValue(axis).set(min + (max - min) * progress[axis])
        }
      })
      .catch((failure: unknown) => {
        if (this.owner.captureAnimationLease()()) this.error(failure)
      })
  }
  private handleGeometry = (record: TNativeMotionGeometryRecord | undefined) => {
    if (!record?.snapshot || !record.attached) {
      if (this.shape) this.retire()
      return
    }
    if (!this.owner.captureAnimationLease()()) {
      this.cancel()
      this.stopAnimation()
      return
    }
    const shape = geometryShape(record.snapshot),
      prior = this.measurement,
      changed = this.shape !== undefined && shape !== this.shape
    this.shape = shape
    if (this.isDragging && changed && prior) {
      const next = transformedBox(box(record.snapshot.untransformed.box), this.owner)
      for (const axis of nativeDragAxes) {
        const delta = prior.layout[axis].min - next[axis].min,
          value = this.axisValue(axis),
          latest = value.get()
        if (typeof latest === "number") {
          this.origin[axis] += delta
          value.set(latest + delta)
        }
      }
      prior.layout = next
    }
    const constraint = this.constraintRef()?.current
    if (constraint) {
      const rect = constraint.getBoundingClientRect(),
        size = JSON.stringify([rect.width, rect.height])
      const resized = this.constraintSize !== undefined && size !== this.constraintSize
      this.constraintSize = size
      if ((changed || resized) && !this.isDragging) this.resize()
      else if ((changed || resized) && this.isDragging)
        void this.readMeasurement(true)
          .then((data) => {
            if (data?.current()) this.resolveConstraints(data)
          })
          .catch(this.error)
    } else if (changed) this.measurement = undefined
  }
  private observeGeometry = (record: TNativeMotionGeometryRecord | undefined) => {
    try {
      this.handleGeometry(record)
    } catch (failure) {
      this.cancel()
      this.stopAnimation()
      if (this.owner.captureAnimationLease()()) this.error(failure)
    }
  }
  refresh = () => {
    const props = this.owner.getProps(),
      current = this.owner.captureAnimationLease()
    if (this.target !== this.owner.current) {
      this.retire()
      this.target = this.owner.current ?? undefined
      if (this.target) this.stopGeometry = observeNativeMotionGeometry(this.target, this.observeGeometry)
    }
    if (this.controls !== props.dragControls) {
      this.stopControls?.()
      this.controls = props.dragControls
      this.stopControls = this.controls?.subscribe(this)
    }
    if (!props.drag || !current() || (this.session && !this.lease())) {
      this.cancel()
      this.stopAnimation()
      return
    }
    const constraint = this.constraintRef()?.current
    if (this.constraintTarget !== constraint) {
      this.constraintTarget = constraint
      this.measurement = undefined
      this.constraintSize = undefined
    }
    if (!this.measurement?.current() && !this.measuring)
      void this.readMeasurement().catch((failure: unknown) => {
        if (current()) this.error(failure)
      })
  }
  retire = () => {
    this.cancel()
    this.stopAnimation()
    this.stopCancellation?.()
    this.stopCancellation = undefined
    this.stopGeometry?.()
    this.stopGeometry = undefined
    this.stopControls?.()
    this.stopControls = undefined
    this.controls = undefined
    this.measurement = undefined
    this.measuring = undefined
    this.shape = undefined
    this.constraintSize = undefined
    this.target = undefined
    for (const job of this.jobs) cancelFrame(job)
    this.jobs.clear()
  }
}
