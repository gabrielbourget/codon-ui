import { findNodeHandle, TurboModuleRegistry } from "react-native"
import type { View } from "react-native"

import { subscribeNativeMotionColorEnvironment } from "../../input/motionColors"
import { observeNativeMotionGeometry, readNativeMotionGeometry } from "../../input/motionGeometry"
import type { TNativeMotionGeometryRecord } from "../../input/motionGeometry"
import type { Spec } from "../../input/specs/NativeCUIMotionSnapshot"
import { nativeMotionRuntime } from "../kernel/nativeRuntime"
import type { TNativeMotionResolutionCapture, TNativeMotionResolutionTicket } from "../value/resolution-batch"
import type { TNativeMotionResolutionToken, TNativeResolvedKeyframes } from "../value/types"
import { resolveNativeMotionVisualStyle } from "../visual/styles"
import type { TNativeMotionVisualValues } from "../visual/types"

export type TNativeMotionIsolatedLayoutStage = Readonly<{
  index: number
  nativeView: Readonly<Record<string, unknown>>
}>
export type TNativeMotionEvaluatedLayout = Readonly<{
  kind: "evaluated-layout"
  requestId: string
  ownerId: string
  bindingId: string
  target: number
  windowId: string
  scopeOwnerId: string
  epoch: number
  attachmentRevision: number
  nativeViewRevision: string
  surfaceId: number
  fabricRevision: string
  results: readonly Readonly<{ index: number; metrics: Readonly<Record<string, unknown>> }>[]
}>
type TBackend = Spec & { evaluateLayout?: (request: string) => Promise<string> }
const failure = (message: string) => new Error(`Native motion isolated geometry: ${message}`)
const identity = (record: TNativeMotionGeometryRecord) => ({
  ownerId: record.ownerId,
  bindingId: record.bindingId,
  target: record.target,
  windowId: record.windowId,
  scopeOwnerId: record.scopeOwnerId,
  epoch: record.epoch,
  attachmentRevision: record.attachmentRevision,
  nativeViewRevision: record.commitRevision,
})
const connected = (view: View) => (view as View & { readonly isConnected?: boolean }).isConnected === true
const validField = (field: string) =>
  field.length <= 128 &&
  /^[A-Za-z][A-Za-z0-9]*$/.test(field) &&
  !["constructor", "prototype", "__proto__"].includes(field)
const numericString = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i
const angleString = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(deg|rad)$/i
const ANGLES = new Set([
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ",
  "rotation",
  "skew",
  "skewX",
  "skewY",
  "pathRotation",
])
const copyNativeValue = (value: unknown, depth = 0): unknown => {
  if (depth > 32) throw failure("native value nesting exceeded its limit")
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw failure("finite native values required")
    return value
  }
  if (typeof value === "string" || typeof value === "boolean") return value
  if (Array.isArray(value)) return Object.freeze(value.map((item) => copyNativeValue(item, depth + 1)))
  if (value && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    const entries = Object.entries(value)
    if (entries.some(([field]) => !validField(field))) throw failure("invalid native value field")
    return Object.freeze(
      Object.fromEntries(
        entries
          .filter(([, item]) => item !== undefined)
          .map(([field, item]) => [field, copyNativeValue(item, depth + 1)]),
      ),
    )
  }
  throw failure("native value unavailable")
}

// Native angle/origin normalization does not need Yoga. Preserve all other
// native types, topology and transform order; never guess a replacement metric.
export const normalizeNativeMotionKeyframeUnits = (name: string, frames: readonly unknown[]): unknown[] => {
  const visit = (value: unknown, field: string, transform: boolean, depth: number): unknown => {
    if (depth > 32) throw failure("native value nesting exceeded its limit")
    if (ANGLES.has(field)) {
      const match = typeof value === "string" ? angleString.exec(value) : null
      const degrees = match ? Number(match[1]) * (match[2].toLowerCase() === "rad" ? 180 / Math.PI : 1) : value
      if (typeof degrees !== "number" || !Number.isFinite(degrees)) throw failure(`${field} requires a native angle`)
      return transform ? `${degrees}deg` : degrees
    }
    if ((field === "originX" || field === "originY") && typeof value === "string" && value.endsWith("%")) {
      const percent = value.slice(0, -1)
      if (!numericString.test(percent) || !Number.isFinite(Number(percent))) throw failure("invalid native origin")
      return Number(percent) / 100
    }
    if (Array.isArray(value)) {
      const next = value.map((item) => visit(item, "", transform || field === "transform", depth + 1))
      return next.every((item, index) => item === value[index]) ? value : next
    }
    if (value && typeof value === "object") {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(value)))
        throw failure("native value object required")
      const entries = Object.entries(value)
      if (entries.some(([key]) => !validField(key))) throw failure("invalid native value field")
      const next = entries
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, visit(item, key, transform, depth + 1)] as const)
      return next.length === entries.length &&
        next.every(([key, item]) => item === (value as Record<string, unknown>)[key])
        ? value
        : Object.fromEntries(next)
    }
    if (typeof value === "number" && !Number.isFinite(value)) throw failure("finite native values required")
    if (value === null || value === undefined || typeof value === "function" || typeof value === "symbol")
      throw failure("complete native values required")
    return value
  }
  return frames.map((value) => visit(value, name, name === "transform", 0))
}
const comparable = (frames: readonly unknown[]): boolean => {
  const first = frames[0]
  if (frames.every((value) => typeof value === "number")) return true
  if (frames.every((value) => typeof value === "boolean")) return true
  if (frames.every((value) => typeof value === "string")) {
    if (frames.some((value) => value === "auto")) return false
    const percent = frames.map((value) => (value as string).endsWith("%"))
    return percent.every((value) => value === percent[0])
  }
  if (!first || typeof first !== "object") return false
  const keys = Object.keys(first).sort()
  if (
    !frames.every(
      (value) =>
        value &&
        typeof value === "object" &&
        Array.isArray(value) === Array.isArray(first) &&
        Object.keys(value).sort().join("\0") === keys.join("\0"),
    )
  )
    return false
  return keys.every((key) => comparable(frames.map((value) => (value as Record<string, unknown>)[key])))
}
let sequence = 0

// The response describes independent evaluated layout, never a mounted/native
// presentation sample. This function has no style publication or editor access.
export const resolveNativeMotionIsolatedLayout = (
  target: View,
  stages: readonly TNativeMotionIsolatedLayoutStage[],
  properties: readonly string[],
  token: TNativeMotionResolutionToken,
): Promise<TNativeMotionEvaluatedLayout> =>
  new Promise((resolve, reject) => {
    let settled = false,
      expected: ReturnType<typeof identity> | undefined,
      latest: TNativeMotionGeometryRecord | undefined
    let stopGeometry = () => {},
      stopCancellation = () => {},
      stopColors = () => {}
    const cancellations = new Set<() => void>()
    const local: TNativeMotionResolutionToken = {
      isCurrent: () => !settled && token.isCurrent(),
      onCancel: (listener) => {
        if (!local.isCurrent()) {
          listener()
          return () => {}
        }
        cancellations.add(listener)
        return () => {
          cancellations.delete(listener)
        }
      },
    }
    const finish = (error?: unknown, value?: TNativeMotionEvaluatedLayout) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      stopGeometry()
      stopCancellation()
      stopColors()
      for (const cancel of [...cancellations]) cancel()
      cancellations.clear()
      if (error) reject(error)
      else if (value) resolve(value)
      else reject(failure("evaluated layout unavailable"))
    }
    const timer = setTimeout(() => finish(failure("query exceeded its 5000ms limit")), 5000)
    const stop = token.onCancel(() => finish(failure("owner cancelled")))
    if (settled) stop()
    else stopCancellation = stop
    let nativeTarget: number | null = null
    const sameRef = () => connected(target) && findNodeHandle(target) === nativeTarget
    let copiedStages: readonly TNativeMotionIsolatedLayoutStage[], requestedProperties: readonly string[]
    try {
      nativeTarget = findNodeHandle(target)
      if (!local.isCurrent() || !sameRef() || !nativeTarget || nativeTarget <= 0 || !Number.isSafeInteger(nativeTarget))
        throw failure("actual connected native owner required")
      if (
        !properties.length ||
        new Set(properties).size !== properties.length ||
        properties.some((field) => !validField(field))
      )
        throw failure("unique native metric properties required")
      if (!stages.length || stages.some((stage, index) => stage.index !== index))
        throw failure("ordered native layout stages required")
      requestedProperties = Object.freeze([...properties])
      copiedStages = stages.map((stage) => ({
        index: stage.index,
        nativeView: copyNativeValue(stage.nativeView) as Record<string, unknown>,
      }))
    } catch (error) {
      finish(error)
      return
    }
    const unobserve = observeNativeMotionGeometry(target, (record) => {
      latest = record
      if (!record || !sameRef() || (expected && JSON.stringify(identity(record)) !== JSON.stringify(expected)))
        finish(failure("actual native lease changed"))
    })
    if (settled) unobserve()
    else stopGeometry = unobserve
    if (settled) return
    const unwatchColors = subscribeNativeMotionColorEnvironment(target, () =>
      finish(failure("native color environment changed")),
    )
    if (settled) unwatchColors()
    else stopColors = unwatchColors
    if (settled) return
    void readNativeMotionGeometry(target, local).then(
      async (baseline) => {
        if (settled) return
        expected = identity(baseline)
        try {
          if (
            !local.isCurrent() ||
            !sameRef() ||
            expected.target !== nativeTarget ||
            !expected.ownerId ||
            !expected.bindingId ||
            (latest && JSON.stringify(identity(latest)) !== JSON.stringify(expected))
          )
            throw failure("actual native owner retired")
          const backend = TurboModuleRegistry.get<TBackend>("CUIMotionSnapshot")
          if (!backend || typeof backend.evaluateLayout !== "function") throw failure("native evaluator unavailable")
          const requestId = `native-evaluated-layout:${++sequence}`
          const encoded = await backend.evaluateLayout(
            JSON.stringify({ ...expected, requestId, properties: requestedProperties, stages: copiedStages }),
          )
          if (settled) return
          if (!local.isCurrent() || !sameRef()) throw failure("actual native owner retired")
          if (typeof encoded !== "string") throw failure("invalid native response")
          const raw: unknown = JSON.parse(encoded)
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw failure("invalid native response")
          const result = raw as Record<string, unknown>
          if (
            result.kind !== "evaluated-layout" ||
            result.requestId !== requestId ||
            Object.entries(expected).some(([field, value]) => result[field] !== value) ||
            !Number.isSafeInteger(result.surfaceId) ||
            (result.surfaceId as number) <= 0 ||
            typeof result.fabricRevision !== "string" ||
            !/^(0|[1-9]\d*)$/.test(result.fabricRevision)
          )
            throw failure("native evaluated-layout identity mismatch")
          if (!Array.isArray(result.results) || result.results.length !== copiedStages.length)
            throw failure("incomplete evaluated layout")
          const results = result.results.map((entry: unknown, index: number) => {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw failure("invalid evaluated stage")
            const stage = entry as Record<string, unknown>
            if (
              stage.index !== index ||
              !stage.metrics ||
              typeof stage.metrics !== "object" ||
              Array.isArray(stage.metrics)
            )
              throw failure("unordered evaluated stage")
            const metrics = copyNativeValue(stage.metrics) as Readonly<Record<string, unknown>>
            if (requestedProperties.some((field) => !Object.hasOwn(metrics, field)))
              throw failure("native metric unavailable")
            return Object.freeze({ index, metrics })
          })
          finish(
            undefined,
            Object.freeze({
              ...expected,
              kind: "evaluated-layout",
              requestId,
              surfaceId: result.surfaceId as number,
              fabricRevision: result.fabricRevision,
              results: Object.freeze(results),
            }),
          )
        } catch (error) {
          finish(error)
        }
      },
      (error: unknown) => finish(error),
    )
  })

type TJob = {
  target: View
  name: string
  frames: readonly unknown[]
  finalKeyframe: unknown
  token: TNativeMotionResolutionToken
  ticket?: TNativeMotionResolutionTicket
  onProbe?: (value: unknown, phase: "target" | "restored") => void
  resolve: (value: TNativeResolvedKeyframes) => void
  reject: (error: unknown) => void
  settled: boolean
  timer: ReturnType<typeof setTimeout>
  stop: () => void
  retirement: Set<() => void>
}

export type TNativeMotionIsolatedStageBuilder = (
  patch: Readonly<Record<string, unknown>>,
) => Readonly<Record<string, unknown>>
export type TNativeMotionIsolatedTransformPreparation = (token: TNativeMotionResolutionToken) => () => void

export class NativeMotionIsolatedGeometryState {
  constructor(
    private readonly stageBuilder: TNativeMotionIsolatedStageBuilder = (patch) =>
      resolveNativeMotionVisualStyle(undefined, undefined, undefined, patch as TNativeMotionVisualValues)
        .view as Readonly<Record<string, unknown>>,
    private readonly prepareTransforms?: TNativeMotionIsolatedTransformPreparation,
  ) {}
  private readonly queue: TJob[] = []
  private readonly active = new Set<TJob>()
  private running = false
  private scheduled = false
  private current = (job: TJob) => !job.settled && job.token.isCurrent()
  private retire = (job: TJob, error: unknown) => {
    if (job.settled) return
    job.settled = true
    clearTimeout(job.timer)
    job.stop()
    for (const listener of [...job.retirement]) listener()
    job.retirement.clear()
    job.reject(error)
  }
  resolve = (
    target: View,
    name: string,
    frames: readonly unknown[],
    token: TNativeMotionResolutionToken,
    ticket?: TNativeMotionResolutionTicket,
    onProbe?: TJob["onProbe"],
  ): Promise<TNativeResolvedKeyframes> => {
    const normalized = normalizeNativeMotionKeyframeUnits(name, frames)
    if (!token.isCurrent() || !validField(name) || !normalized.length)
      return Promise.reject(failure("current complete keyframes required"))
    if (comparable(normalized))
      return Promise.resolve({ keyframes: normalized, finalKeyframe: frames[frames.length - 1] })
    let job!: TJob
    const result = new Promise<TNativeResolvedKeyframes>((resolve, reject) => {
      job = {
        target,
        name,
        frames: copyNativeValue(normalized) as readonly unknown[],
        finalKeyframe: frames[frames.length - 1],
        token,
        ticket,
        onProbe,
        resolve,
        reject,
        settled: false,
        timer: setTimeout(() => this.retire(job, failure("resolution exceeded its 5000ms limit")), 5000),
        stop: () => {},
        retirement: new Set(),
      }
      this.queue.push(job)
    })
    const stop = token.onCancel(() => this.retire(job, failure("keyframe request cancelled")))
    if (job.settled) stop()
    else job.stop = stop
    if (!this.running && !this.scheduled) {
      this.scheduled = true
      nativeMotionRuntime.queueMicrotask(() => {
        this.scheduled = false
        void this.drain()
      })
    }
    return result
  }
  private waitForNormalization = async (job: TJob) => {
    if (!job.ticket) return
    let retire!: () => void
    const cancelled = new Promise<never>((_resolve, reject) => {
      retire = () => reject(failure("normalization request retired"))
      job.retirement.add(retire)
    })
    try {
      await Promise.race([job.ticket.whenNormalized, cancelled])
    } finally {
      job.retirement.delete(retire)
    }
  }
  private drain = async () => {
    if (this.running) return
    this.running = true
    try {
      while (this.queue.some((job) => this.current(job))) {
        const first = this.queue.find((job) => this.current(job))!
        try {
          await this.waitForNormalization(first)
        } catch (error) {
          this.retire(first, error)
          continue
        }
        if (!this.current(first)) continue
        let capture: TNativeMotionResolutionCapture | undefined
        try {
          capture = first.ticket?.capture()
        } catch (error) {
          this.retire(first, error)
          continue
        }
        const names = new Set<string>()
        const jobs = this.queue.filter((job) => {
          if (!this.current(job) || job.target !== first.target || names.has(job.name)) return false
          if (job.ticket) {
            try {
              if (!capture || job.ticket.capture().cohort !== capture.cohort) return false
            } catch {
              return false
            }
          }
          if (!job.ticket && capture) return false
          names.add(job.name)
          return true
        })
        for (const job of jobs) {
          this.queue.splice(this.queue.indexOf(job), 1)
          this.active.add(job)
        }
        const queryToken: TNativeMotionResolutionToken = {
          isCurrent: () => jobs.every(this.current) && (!capture || capture.isCurrent()),
          onCancel: (listener) => {
            const stops = jobs.map((job) => {
              job.retirement.add(listener)
              return () => {
                job.retirement.delete(listener)
              }
            })
            if (capture) stops.push(capture.onChange(listener))
            if (!queryToken.isCurrent()) listener()
            return () => {
              stops.forEach((stop) => stop())
            }
          },
        }
        let restoreTransforms: (() => void) | undefined
        try {
          restoreTransforms = this.prepareTransforms?.(queryToken)
          // Pinned Motion only jumps resolvers needing measurement to endpoints.
          // A numeric sibling width stays at its current native value while an
          // auto height is evaluated, even though both shared normalization.
          const stages = Array.from({ length: Math.max(...jobs.map((job) => job.frames.length)) }, (_, index) => {
            // The first read uses the actual captured native layout. An authored
            // first keyframe can differ from that mounted origin; pinned Motion
            // replaces it with the measured origin before jumping endpoints.
            const latest =
              index === 0
                ? {}
                : Object.fromEntries(jobs.map((job) => [job.name, job.frames[Math.min(index, job.frames.length - 1)]]))
            return { index, nativeView: this.stageBuilder(latest) }
          })
          const evaluated = await resolveNativeMotionIsolatedLayout(first.target, stages, [...names], queryToken)
          if (!queryToken.isCurrent()) throw failure("coupled query retired")
          const results = new Map<TJob, unknown[]>()
          for (const job of jobs) {
            const values = evaluated.results.slice(0, job.frames.length).map((stage) => stage.metrics[job.name])
            if (!comparable(values)) throw failure(`native ${job.name} normalization remains unresolved`)
            results.set(job, values)
          }
          for (const job of jobs) if (this.current(job)) job.onProbe?.(job.frames[job.frames.length - 1], "target")
          const restore = restoreTransforms
          restoreTransforms = undefined
          restore?.()
          for (const job of jobs) if (this.current(job)) job.onProbe?.(results.get(job)![0], "restored")
          for (const job of jobs) {
            if (!this.current(job)) {
              this.retire(job, failure("keyframe request retired"))
              continue
            }
            job.settled = true
            clearTimeout(job.timer)
            job.stop()
            job.resolve({ keyframes: results.get(job)!, finalKeyframe: job.finalKeyframe })
          }
        } catch (error) {
          const changed = (capture && !capture.isCurrent()) || jobs.some((job) => !this.current(job))
          for (const job of jobs) {
            if (changed && this.current(job)) this.queue.push(job)
            else this.retire(job, error)
          }
        } finally {
          try {
            restoreTransforms?.()
          } catch (error) {
            for (const job of jobs) this.retire(job, error)
          }
          for (const job of jobs) this.active.delete(job)
        }
      }
    } finally {
      this.running = false
      this.queue.splice(0, this.queue.length, ...this.queue.filter(this.current))
    }
  }
  cancel = () => {
    for (const job of [...this.queue, ...this.active]) this.retire(job, failure("owner cancelled"))
    this.queue.length = 0
  }
}
