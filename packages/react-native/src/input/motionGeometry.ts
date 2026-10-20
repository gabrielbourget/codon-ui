import type { View } from "react-native"

import type { NativeMotionGeometry } from "./specs/CUIFocusViewNativeComponent"

export type TNativeMotionGeometryBox = Readonly<{
  box: readonly number[]
  quad: readonly number[]
  toWindowMatrix?: readonly number[]
}>
export type TNativeMotionGeometryAncestor = Readonly<{
  tag: number
  identity: string
  bounds: readonly number[]
  layout: readonly number[]
  scroll: readonly number[]
  matrix: readonly number[]
  model: TNativeMotionGeometryBox
  clip: Readonly<Record<string, unknown>> & { complete: boolean }
}>
export type TNativeMotionGeometrySnapshot = Readonly<{
  platform: "android" | "ios"
  coordinateSpace: "window"
  units: "dp" | "points"
  density: number
  matrixFormat: "android-row-major-3x3" | "core-animation-4x4"
  rootTag: number
  rootIdentity: string
  root: TNativeMotionGeometryBox
  layout: readonly number[]
  untransformed: TNativeMotionGeometryBox
  model: TNativeMotionGeometryBox
  presentation: TNativeMotionGeometryBox | null
  presentationSource: string
  ancestors: readonly TNativeMotionGeometryAncestor[]
  layers?: readonly Readonly<Record<string, unknown>>[]
  mountObservationAvailable: boolean
}>
export type TNativeMotionGeometryRecord = Readonly<
  Omit<NativeMotionGeometry, "snapshot"> & { snapshot: TNativeMotionGeometrySnapshot | null }
>
export type TNativeMotionGeometryMountPair = Readonly<{
  before: TNativeMotionGeometryRecord
  after: TNativeMotionGeometryRecord
}>
export type TNativeMotionGeometryCancellation = {
  isCurrent: () => boolean
  onCancel: (callback: () => void) => () => void
}
type TPending = {
  revision?: string
  resolve: (report: TNativeMotionGeometryRecord) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
  unsubscribe?: () => void
}
type TScope = { ownerId: string; windowId?: string; epoch?: number }
const observers = new WeakMap<View, NativeMotionGeometryObserver>(),
  history = new WeakMap<View, number>()
let sequence = 0
const failure = (message: string) => new Error(`Native motion geometry: ${message}`)
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
const tuple = (value: unknown, length: number) =>
  Array.isArray(value) &&
  value.length === length &&
  value.every((item) => typeof item === "number" && Number.isFinite(item))
const rect = (value: unknown) => tuple(value, 4) && (value as number[])[2] >= 0 && (value as number[])[3] >= 0
const box = (value: unknown, matrixLength: number) =>
  object(value) &&
  rect(value.box) &&
  tuple(value.quad, 8) &&
  (value.toWindowMatrix === undefined || tuple(value.toWindowMatrix, matrixLength))
const finite = (value: unknown): boolean =>
  typeof value === "number"
    ? Number.isFinite(value)
    : Array.isArray(value)
      ? value.every(finite)
      : object(value)
        ? Object.values(value).every(finite)
        : true
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
export const decodeNativeMotionGeometry = (encoded: string): TNativeMotionGeometrySnapshot => {
  const value: unknown = JSON.parse(encoded)
  if (
    !object(value) ||
    !finite(value) ||
    !["android", "ios"].includes(String(value.platform)) ||
    value.coordinateSpace !== "window" ||
    typeof value.density !== "number" ||
    value.density <= 0 ||
    typeof value.rootTag !== "number" ||
    !Number.isInteger(value.rootTag) ||
    typeof value.rootIdentity !== "string" ||
    !value.rootIdentity
  )
    throw failure("invalid native geometry envelope")
  const matrixLength = value.platform === "android" ? 9 : 16
  if (
    value.units !== (value.platform === "android" ? "dp" : "points") ||
    value.matrixFormat !== (value.platform === "android" ? "android-row-major-3x3" : "core-animation-4x4") ||
    !rect(value.layout) ||
    ![value.root, value.untransformed, value.model].every((item) => box(item, matrixLength)) ||
    (value.presentation !== null && !box(value.presentation, matrixLength)) ||
    typeof value.presentationSource !== "string" ||
    typeof value.mountObservationAvailable !== "boolean"
  )
    throw failure("partial native geometry snapshot")
  if (
    !Array.isArray(value.ancestors) ||
    !value.ancestors.length ||
    !value.ancestors.every(
      (item) =>
        object(item) &&
        typeof item.tag === "number" &&
        Number.isInteger(item.tag) &&
        typeof item.identity === "string" &&
        !!item.identity &&
        rect(item.bounds) &&
        rect(item.layout) &&
        tuple(item.scroll, 2) &&
        tuple(item.matrix, matrixLength) &&
        box(item.model, matrixLength) &&
        object(item.clip) &&
        typeof item.clip.complete === "boolean",
    )
  )
    throw failure("partial native ancestor geometry")
  if (
    value.platform === "ios" &&
    (!Array.isArray(value.layers) ||
      !value.layers.length ||
      !value.layers.every(
        (layer) =>
          object(layer) &&
          typeof layer.identity === "string" &&
          rect(layer.bounds) &&
          tuple(layer.position, 2) &&
          tuple(layer.anchor, 3) &&
          tuple(layer.matrix, 16) &&
          tuple(layer.sublayerMatrix, 16) &&
          object(layer.clip) &&
          typeof layer.clip.complete === "boolean",
      ))
  )
    throw failure("partial native layer geometry")
  return freeze(value as unknown as TNativeMotionGeometrySnapshot)
}
const integer = (value: number) => Number.isSafeInteger(value) && value >= 0
const sameAttachment = (first: TNativeMotionGeometryRecord, second: TNativeMotionGeometryRecord) =>
  first.bindingId === second.bindingId &&
  first.windowId === second.windowId &&
  first.scopeOwnerId === second.scopeOwnerId &&
  first.epoch === second.epoch &&
  first.attachmentRevision === second.attachmentRevision &&
  first.snapshot?.rootIdentity === second.snapshot?.rootIdentity

export class NativeMotionGeometryObserver {
  private readonly identity = ++sequence
  private requestSequence = 0
  private disposed = false
  private highestRevision = 0
  private attachmentRevision = 0
  private scopeSignature: string
  private current?: TNativeMotionGeometryRecord
  private pair?: TNativeMotionGeometryMountPair
  private readonly pending = new Map<string, TPending>()
  private readonly before = new Map<string, TNativeMotionGeometryRecord>()
  private readonly listeners = new Set<(record: TNativeMotionGeometryRecord | undefined) => void>()
  private readonly mountListeners = new Set<(pair: TNativeMotionGeometryMountPair) => void>()
  constructor(
    private readonly options: {
      ownerId: string
      bindingId: string
      target: () => number | null
      scope: () => TScope
      dispatch: (requestId: string) => void
      priorRevision?: () => number
      rememberRevision?: (revision: number) => void
    },
  ) {
    this.scopeSignature = JSON.stringify(options.scope())
    this.highestRevision = options.priorRevision?.() ?? 0
  }
  private release = (id: string) => {
    const pending = this.pending.get(id)
    if (!pending) return
    this.pending.delete(id)
    clearTimeout(pending.timer)
    pending.unsubscribe?.()
    return pending
  }
  private clearSnapshot = () => {
    this.current = undefined
    this.pair = undefined
    this.before.clear()
    this.listeners.forEach((listener) => listener(undefined))
  }
  private invalidate = (reason: string) => {
    this.clearSnapshot()
    for (const [id, pending] of this.pending) {
      this.release(id)
      pending.reject(failure(reason))
    }
  }
  refreshScope = () => {
    const signature = JSON.stringify(this.options.scope())
    if (signature !== this.scopeSignature) {
      this.scopeSignature = signature
      this.invalidate("native owner/window scope changed")
    }
  }
  latest = () => this.current
  latestMountPair = () => this.pair
  subscribe = (listener: (record: TNativeMotionGeometryRecord | undefined) => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  subscribeMountPairs = (listener: (pair: TNativeMotionGeometryMountPair) => void) => {
    this.mountListeners.add(listener)
    return () => {
      this.mountListeners.delete(listener)
    }
  }
  read = (
    cancellation?: TNativeMotionGeometryCancellation,
    revision?: string,
  ): Promise<TNativeMotionGeometryRecord> => {
    if (this.disposed) return Promise.reject(failure("observer retired"))
    if (cancellation && !cancellation.isCurrent()) return Promise.reject(failure("query cancelled"))
    this.refreshScope()
    const id = `${this.options.bindingId}:geometry:${this.identity}:${++this.requestSequence}`
    const result = new Promise<TNativeMotionGeometryRecord>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.release(id)?.reject(failure("query exceeded its 5000ms limit"))
      }, 5000)
      this.pending.set(id, { revision, resolve, reject, timer })
    })
    const unsubscribe = cancellation?.onCancel(() => {
      this.release(id)?.reject(failure("query cancelled"))
    })
    const pending = this.pending.get(id)
    if (pending) pending.unsubscribe = unsubscribe
    else unsubscribe?.()
    if (this.pending.has(id))
      try {
        this.options.dispatch(id)
      } catch (error) {
        this.release(id)?.reject(error instanceof Error ? error : failure("native command rejected"))
      }
    return result
  }
  receive = (data: NativeMotionGeometry) => {
    if (
      this.disposed ||
      data.ownerId !== this.options.ownerId ||
      data.bindingId !== this.options.bindingId ||
      data.target !== this.options.target()
    )
      return
    this.refreshScope()
    const job = data.requestId ? this.pending.get(data.requestId) : undefined
    if (data.requestId && !job) return
    if (
      ![data.epoch, data.attachmentRevision, data.geometryRevision].every(integer) ||
      !Number.isFinite(data.observedAt)
    )
      return
    if (!["sample", "mount-before", "mount-after", "frame", "detached"].includes(data.kind)) return
    if (data.geometryRevision <= this.highestRevision || data.attachmentRevision < this.attachmentRevision) {
      if (job) this.release(data.requestId)?.reject(failure("stale native geometry"))
      return
    }
    const scope = this.options.scope()
    if (
      data.scopeOwnerId !== scope.ownerId ||
      (scope.windowId !== undefined && scope.windowId !== data.windowId) ||
      (scope.epoch !== undefined && scope.epoch !== data.epoch)
    ) {
      if (job) this.release(data.requestId)?.reject(failure("geometry belongs to a different window/scope"))
      return
    }
    this.highestRevision = data.geometryRevision
    this.attachmentRevision = data.attachmentRevision
    this.options.rememberRevision?.(data.geometryRevision)
    if (!data.attached || data.kind === "detached") {
      this.invalidate("native geometry view detached")
      return
    }
    if (data.error) {
      this.clearSnapshot()
      if (job) this.release(data.requestId)?.reject(failure(data.error))
      return
    }
    let snapshot: TNativeMotionGeometrySnapshot
    try {
      snapshot = decodeNativeMotionGeometry(data.snapshot)
    } catch (error) {
      this.clearSnapshot()
      if (job) this.release(data.requestId)?.reject(error instanceof Error ? error : failure("invalid native snapshot"))
      return
    }
    if (snapshot.ancestors[0].tag !== data.target) {
      this.clearSnapshot()
      if (job) this.release(data.requestId)?.reject(failure("snapshot target mismatch"))
      return
    }
    const report = freeze({ ...data, snapshot })
    if (this.current && !sameAttachment(this.current, report)) {
      this.before.clear()
      this.pair = undefined
    }
    this.current = report
    if (data.kind === "mount-before" && data.transactionId) this.before.set(data.transactionId, report)
    if (data.kind === "mount-after" && data.transactionId) {
      const before = this.before.get(data.transactionId)
      this.before.delete(data.transactionId)
      if (before && sameAttachment(before, report) && before.geometryRevision < report.geometryRevision) {
        const pair = Object.freeze({ before, after: report })
        this.pair = pair
        this.mountListeners.forEach((listener) => listener(pair))
      }
    }
    if (this.current !== report) return
    this.listeners.forEach((listener) => {
      if (this.current === report) listener(report)
    })
    if (job) {
      const pending = this.release(data.requestId)
      if (pending) {
        if (pending.revision !== undefined && pending.revision !== data.commitRevision)
          pending.reject(failure("native commit revision mismatch"))
        else pending.resolve(report)
      }
    }
  }
  dispose = () => {
    if (this.disposed) return
    this.disposed = true
    this.invalidate("observer retired")
    this.listeners.clear()
    this.mountListeners.clear()
  }
}
export const registerNativeMotionGeometryObserver = (target: View, observer: NativeMotionGeometryObserver) => {
  observers.get(target)?.dispose()
  observers.set(target, observer)
  return () => {
    observer.dispose()
    if (observers.get(target) === observer) observers.delete(target)
  }
}
export const nativeMotionGeometryHistory = (target: View) => ({
  priorRevision: () => history.get(target) ?? 0,
  rememberRevision: (revision: number) => history.set(target, Math.max(history.get(target) ?? 0, revision)),
})
export const readNativeMotionGeometry = (
  target: View | null,
  cancellation?: TNativeMotionGeometryCancellation,
  revision?: string,
) => {
  const observer = target && observers.get(target)
  return observer
    ? observer.read(cancellation, revision)
    : Promise.reject(failure("no observer registered for the actual native view"))
}
export const observeNativeMotionGeometry = (
  target: View | null,
  listener: (record: TNativeMotionGeometryRecord | undefined) => void,
) => {
  const observer = target && observers.get(target)
  return observer ? observer.subscribe(listener) : () => {}
}
export const observeNativeMotionMountPairs = (
  target: View | null,
  listener: (pair: TNativeMotionGeometryMountPair) => void,
) => {
  const observer = target && observers.get(target)
  return observer ? observer.subscribeMountPairs(listener) : () => {}
}

export const requireNativeMotionGeometryCapabilities = (
  record: TNativeMotionGeometryRecord,
  required: { presentation?: boolean; clipping?: boolean; mount?: boolean },
) => {
  const snapshot = record.snapshot
  if (!record.attached || !snapshot) throw failure("actual geometry unavailable")
  if (required.presentation && !snapshot.presentation) throw failure("native presentation geometry unavailable")
  if (required.mount && !snapshot.mountObservationAvailable) throw failure("native mount observation unavailable")
  if (
    required.clipping &&
    (!snapshot.ancestors.every((ancestor) => ancestor.clip.complete) ||
      snapshot.layers?.some((layer) => (layer.clip as { complete: boolean }).complete !== true))
  )
    throw failure("native clipping geometry incomplete")
  return snapshot
}
