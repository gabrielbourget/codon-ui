import type { View } from "react-native"

import {
  observeNativeMotionGeometry,
  readNativeMotionGeometry,
  requireNativeMotionGeometryCapabilities,
} from "../../input/motionGeometry"
import type { TNativeMotionGeometryRecord } from "../../input/motionGeometry"
import { nativeMotionRuntime } from "../kernel/nativeRuntime"
import type { TNativeMotionResolutionToken } from "../value/types"

import type {
  TNativeMotionAtomicLayoutProvider,
  TNativeMotionAtomicLayoutSession,
  TNativeMotionMeasurementRequest,
  TNativeMotionMeasurementResult,
  TNativeMotionMeasurementSnapshot,
} from "./types"

type TJob = TNativeMotionMeasurementRequest & {
  settled: boolean
  resolve: (result: TNativeMotionMeasurementResult) => void
  reject: (error: unknown) => void
  unsubscribe?: () => void
}
type TWaiter = { accept: (record: TNativeMotionGeometryRecord) => void; reject: (error: Error) => void }
class MeasurementRestart extends Error {}
const EMPTY: TNativeMotionMeasurementSnapshot = Object.freeze({ values: null })
let measurementOwners = 0
const failure = (message: string) => new Error(`Native motion measurement: ${message}`)
const context = (record: TNativeMotionGeometryRecord) =>
  JSON.stringify([
    record.ownerId,
    record.bindingId,
    record.target,
    record.windowId,
    record.scopeOwnerId,
    record.epoch,
    record.attachmentRevision,
    record.snapshot?.rootIdentity,
  ])
const finite = (value: unknown): boolean =>
  typeof value === "number"
    ? Number.isFinite(value)
    : Array.isArray(value)
      ? value.every(finite)
      : value !== null && typeof value === "object"
        ? Object.values(value).every(finite)
        : value !== undefined && value !== null

export class NativeMotionMeasurementState {
  private readonly owner = ++measurementOwners
  private sequence = 0
  private generation = 0
  private epoch = 0
  private target: View | null = null
  private snapshot: TNativeMotionMeasurementSnapshot = EMPTY
  private readonly listeners = new Set<() => void>()
  private readonly retired = new Set<() => void>()
  private readonly waiters = new Map<string, TWaiter>()
  private readonly queue: TJob[] = []
  private active: TJob[] = []
  private scheduled = false
  private running = false
  private restart = false
  private currentGeometry?: TNativeMotionGeometryRecord
  private releaseGeometry?: () => void
  constructor(private readonly atomic?: TNativeMotionAtomicLayoutProvider) {}
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private notify = () => {
    let failed = false,
      firstError: unknown
    for (const listener of [...this.listeners]) {
      try {
        listener()
      } catch (error) {
        if (!failed) firstError = error
        failed = true
      }
    }
    if (failed) throw firstError
  }
  private publish = (values: Readonly<Record<string, unknown>> | null) => {
    const revision = `native-measurement:${this.owner}:${++this.sequence}`
    this.snapshot = Object.freeze({ values: values ? Object.freeze({ ...values }) : null, revision })
    this.notify()
    return revision
  }
  private receive = (record: TNativeMotionGeometryRecord | undefined) => {
    if (!record || (this.currentGeometry && context(record) !== context(this.currentGeometry))) {
      this.epoch++
      this.retired.forEach((listener) => listener())
      for (const waiter of [...this.waiters.values()]) waiter.reject(failure("native geometry ownership changed"))
    }
    this.currentGeometry = record
    if (record?.kind === "mount-after") this.waiters.get(record.commitRevision)?.accept(record)
  }
  attach = (target: View) => {
    this.detach()
    this.target = target
    this.generation++
    this.releaseGeometry = observeNativeMotionGeometry(target, this.receive)
    const generation = this.generation
    return () => {
      if (generation === this.generation) this.detach()
    }
  }
  detach = () => {
    this.generation++
    this.epoch++
    this.target = null
    this.releaseGeometry?.()
    this.releaseGeometry = undefined
    this.currentGeometry = undefined
    this.retired.forEach((listener) => listener())
    for (const waiter of [...this.waiters.values()]) waiter.reject(failure("actual native owner retired"))
    for (const job of [...this.active, ...this.queue]) this.reject(job, failure("actual native owner retired"))
    this.queue.length = 0
    this.snapshot = EMPTY
  }
  private reject = (job: TJob, error: unknown) => {
    if (job.settled) return
    job.settled = true
    job.unsubscribe?.()
    job.reject(error)
  }
  private current = (job: TJob) => !job.settled && job.token.isCurrent()
  measure = (request: TNativeMotionMeasurementRequest): Promise<TNativeMotionMeasurementResult> => {
    if (!this.atomic) return Promise.reject(failure("actual native atomic layout provider unavailable"))
    if (!this.target || !request.token.isCurrent()) return Promise.reject(failure("actual native owner unavailable"))
    if (!request.keyframes.length || !request.keyframes.every(finite))
      return Promise.reject(failure("finite complete native keyframes required"))
    let job!: TJob
    const result = new Promise<TNativeMotionMeasurementResult>((resolve, reject) => {
      job = { ...request, keyframes: [...request.keyframes], settled: false, resolve, reject }
      this.queue.push(job)
    })
    const unsubscribe = request.token.onCancel(() => {
      this.reject(job, failure("keyframe request cancelled"))
      if (this.active.includes(job)) {
        this.restart = true
        for (const waiter of [...this.waiters.values()]) waiter.reject(new MeasurementRestart())
      }
    })
    if (job.settled) unsubscribe()
    else job.unsubscribe = unsubscribe
    this.schedule()
    return result
  }
  private schedule = () => {
    if (this.scheduled || this.running) return
    this.scheduled = true
    nativeMotionRuntime.queueMicrotask(() => {
      this.scheduled = false
      void this.drain()
    })
  }
  private token = (target: View, generation: number, epoch?: number): TNativeMotionResolutionToken => {
    const isCurrent = () =>
      this.target === target && this.generation === generation && (epoch === undefined || this.epoch === epoch)
    return {
      isCurrent,
      onCancel: (listener) => {
        if (!isCurrent()) {
          listener()
          return () => {}
        }
        const retire = () => {
          if (!isCurrent()) listener()
        }
        this.retired.add(retire)
        return () => {
          this.retired.delete(retire)
        }
      },
    }
  }
  private publishAndWaitForMount = (
    values: Readonly<Record<string, unknown>> | null,
    token: TNativeMotionResolutionToken,
  ): Promise<TNativeMotionGeometryRecord> => {
    if (!token.isCurrent()) return Promise.reject(failure("actual native owner changed"))
    const revision = `native-measurement:${this.owner}:${this.sequence + 1}`
    const pending = new Promise<TNativeMotionGeometryRecord>((resolve, reject) => {
      let unsubscribe: () => void = () => {}
      const clear = () => {
        clearTimeout(timer)
        this.waiters.delete(revision)
        unsubscribe()
      }
      const fail = (error: Error) => {
        clear()
        reject(error)
      }
      const timer = setTimeout(() => fail(failure("native commit exceeded its 5000ms limit")), 5000)
      this.waiters.set(revision, {
        accept: (record) => {
          if (!token.isCurrent()) {
            fail(failure("native commit owner changed"))
            return
          }
          try {
            requireNativeMotionGeometryCapabilities(record, { mount: true })
            clear()
            resolve(record)
          } catch (error) {
            fail(error instanceof Error ? error : failure("invalid native commit"))
          }
        },
        reject: fail,
      })
      unsubscribe = token.onCancel(() => fail(failure("actual native owner retired")))
    })
    try {
      this.publish(values)
    } catch (error) {
      this.waiters.get(revision)?.reject(error instanceof Error ? error : failure("render publication failed"))
      return pending.then(() => {
        throw error
      })
    }
    return pending
  }
  private drain = async () => {
    if (this.running) return
    this.running = true
    try {
      while (this.target && this.queue.some((job) => this.current(job))) {
        const selected = new Set<string>(),
          remaining: TJob[] = []
        this.active = this.queue.splice(0).filter((job) => {
          if (!this.current(job)) return false
          if (selected.has(job.name)) {
            remaining.push(job)
            return false
          }
          selected.add(job.name)
          return true
        })
        this.queue.unshift(...remaining)
        await this.batch()
        this.active = []
      }
    } finally {
      this.running = false
      this.active = []
      for (let index = this.queue.length - 1; index >= 0; index--) {
        const job = this.queue[index]
        if (!this.current(job)) {
          this.reject(job, failure("native keyframe request retired"))
          this.queue.splice(index, 1)
        }
      }
      if (this.target && this.queue.some((job) => this.current(job))) this.schedule()
    }
  }
  private batch = async () => {
    const target = this.target!,
      generation = this.generation,
      epoch = this.epoch
    const token = this.token(target, generation, epoch),
      cleanup = this.token(target, generation)
    const jobs = this.active,
      results = new Map<TJob, unknown[]>()
    let identity: string | undefined
    let session: TNativeMotionAtomicLayoutSession | undefined,
      baseline: TNativeMotionGeometryRecord | undefined,
      restored: TNativeMotionGeometryRecord | undefined,
      error: unknown
    let staged = false
    this.restart = false
    try {
      session = await this.atomic!.begin(target, token)
      if (session.target !== target || !token.isCurrent()) throw failure("atomic layout lease belongs to another owner")
      baseline = await readNativeMotionGeometry(target, token)
      requireNativeMotionGeometryCapabilities(baseline, { mount: true })
      identity = context(baseline)
      for (let index = 0; index < Math.max(...jobs.map((job) => job.keyframes.length)); index++) {
        if (this.restart) break
        if (!token.isCurrent()) throw failure("native measurement owner changed")
        const live = jobs.filter((job) => this.current(job))
        if (!live.length) break
        const values = Object.fromEntries(
          live.map((job) => [job.name, job.keyframes[Math.min(index, job.keyframes.length - 1)]]),
        )
        staged = true
        const report = await this.publishAndWaitForMount(values, token)
        if (context(report) !== identity) throw failure("native probe coordinate space changed")
        if (this.restart) break
        for (const job of live) {
          if (this.restart) break
          if (!this.current(job)) continue
          if (index >= job.keyframes.length) continue
          const measured = job.metric(report)
          if (!finite(measured)) throw failure("native property measurement unavailable")
          const resolved = results.get(job) ?? []
          resolved.push(measured)
          results.set(job, resolved)
          job.onProbe?.(job.keyframes[index], index === 0 ? "initial" : "target")
        }
      }
    } catch (failure) {
      if (!(failure instanceof MeasurementRestart)) error = failure
    }
    if (session) {
      try {
        if (session.target !== target) throw failure("atomic layout lease belongs to another owner")
        if (staged && cleanup.isCurrent()) restored = await this.publishAndWaitForMount(null, cleanup)
        else if (!staged && token.isCurrent()) restored = baseline
        if (!restored) throw failure("native restoration owner unavailable")
        if (identity && context(restored) !== identity) throw failure("restored native coordinate space changed")
        await session.release(restored)
      } catch (failure) {
        error = error ?? failure
        try {
          await session.abort()
        } catch (abortFailure) {
          error = abortFailure
        }
      }
    }
    if (cleanup.isCurrent()) {
      this.snapshot = EMPTY
      try {
        this.notify()
      } catch (notificationError) {
        error = error ?? notificationError
      }
    }
    for (const job of jobs) {
      if (!this.current(job)) {
        this.reject(job, failure("native keyframe request retired"))
        continue
      }
      if (error) {
        this.reject(job, error)
        continue
      }
      if (this.restart) {
        this.queue.unshift(job)
        continue
      }
      const frames = results.get(job)
      if (!restored || !frames || frames.length !== job.keyframes.length) {
        this.reject(job, failure("incomplete native keyframe transaction"))
        continue
      }
      try {
        job.onProbe?.(frames[0], "restored")
      } catch (callbackError) {
        this.reject(job, callbackError)
        continue
      }
      if (!this.current(job)) continue
      job.settled = true
      job.unsubscribe?.()
      job.resolve({ keyframes: frames, finalKeyframe: job.keyframes[job.keyframes.length - 1] })
    }
  }
}
