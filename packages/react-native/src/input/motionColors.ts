import { processColor, type ColorValue, type View } from "react-native"

import type { NativeMotionColors } from "./specs/CUIFocusViewNativeComponent"

export type TNativeMotionColorEnvironment = Readonly<{
  windowId: string
  scopeOwnerId: string
  epoch: number
  environmentRevision: number
}>
export type TNativeMotionColor = Readonly<{ red: number; green: number; blue: number; alpha: number }>
export type TNativeMotionColorBatch = Readonly<{
  environment: TNativeMotionColorEnvironment
  colors: readonly TNativeMotionColor[]
}>
type TScope = { ownerId: string; windowId?: string; epoch?: number }
export type TNativeMotionColorCancellation = {
  isCurrent: () => boolean
  onCancel: (listener: () => void) => () => void
}
type TPending = {
  encoded: readonly unknown[]
  environment?: TNativeMotionColorEnvironment
  scope: string
  resolve: (batch: TNativeMotionColorBatch) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
  unsubscribe?: () => void
}
let samplerSequence = 0
const samplers = new WeakMap<View, NativeMotionColorSampler>()
const failure = (message: string) => new Error(`Native motion color: ${message}`)
const signature = (environment: TNativeMotionColorEnvironment) => JSON.stringify(environment)
const validInteger = (value: number) => Number.isSafeInteger(value) && value >= 0

export class NativeMotionColorSampler {
  private readonly identity = ++samplerSequence
  private sequence = 0
  private disposed = false
  private context?: TNativeMotionColorEnvironment
  private scopeSignature: string
  private environmentRequest?: string
  private observedRevision = -1
  private readonly pending = new Map<string, TPending>()
  private readonly listeners = new Set<() => void>()
  constructor(
    private readonly options: {
      ownerId: string
      target: () => number | null
      scope: () => TScope
      dispatch: (id: string, request: string) => void
    },
  ) {
    this.scopeSignature = JSON.stringify(options.scope())
  }
  private nextId = () => `${this.options.ownerId}:motion-color:${this.identity}:${++this.sequence}`
  private release = (id: string) => {
    const request = this.pending.get(id)
    if (!request) return
    this.pending.delete(id)
    clearTimeout(request.timer)
    request.unsubscribe?.()
    if (!this.pending.size) this.environmentRequest = undefined
    return request
  }
  private invalidate = (reason: string, notify = true) => {
    this.context = undefined
    this.environmentRequest = undefined
    for (const [id, request] of this.pending) {
      this.release(id)
      request.reject(failure(reason))
    }
    if (notify) this.listeners.forEach((listener) => listener())
  }
  refreshScope = () => {
    const current = JSON.stringify(this.options.scope())
    if (current === this.scopeSignature) return
    this.scopeSignature = current
    this.invalidate("native owner/window scope changed")
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  environment = () => this.context
  private dispatchPending = () => {
    if (this.disposed) return
    if (!this.context) {
      if (!this.environmentRequest && this.pending.size) {
        this.environmentRequest = this.nextId()
        try {
          this.options.dispatch(this.environmentRequest, JSON.stringify({ kind: "environment" }))
        } catch (error) {
          this.environmentRequest = undefined
          for (const [id, request] of this.pending) {
            this.release(id)
            request.reject(error instanceof Error ? error : failure("native command rejected"))
          }
        }
      }
      return
    }
    for (const [id, request] of this.pending) {
      if (request.environment) continue
      request.environment = this.context
      try {
        this.options.dispatch(id, JSON.stringify({ ...this.context, colors: request.encoded }))
      } catch (error) {
        this.release(id)
        request.reject(error instanceof Error ? error : failure("native command rejected"))
      }
    }
  }
  sample = (
    colors: readonly ColorValue[],
    cancellation?: TNativeMotionColorCancellation,
  ): Promise<TNativeMotionColorBatch> => {
    if (this.disposed) return Promise.reject(failure("native color sampler retired"))
    if (cancellation && !cancellation.isCurrent()) return Promise.reject(failure("native color query cancelled"))
    this.refreshScope()
    const encoded: unknown[] = []
    for (const color of colors) {
      const value = processColor(color)
      if (value === null || value === undefined) return Promise.reject(failure("unsupported native color input"))
      encoded.push(value)
    }
    let snapshot: readonly unknown[]
    try {
      snapshot = JSON.parse(JSON.stringify(encoded)) as unknown[]
    } catch {
      return Promise.reject(failure("native color input is not serializable"))
    }
    const id = this.nextId()
    const result = new Promise<TNativeMotionColorBatch>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.release(id)
        reject(failure("native color query exceeded its 5000ms limit"))
      }, 5000)
      this.pending.set(id, { encoded: snapshot, scope: this.scopeSignature, resolve, reject, timer })
    })
    const unsubscribe = cancellation?.onCancel(() => {
      this.release(id)?.reject(failure("native color query cancelled"))
    })
    const request = this.pending.get(id)
    if (request) request.unsubscribe = unsubscribe
    else unsubscribe?.()
    try {
      this.dispatchPending()
    } catch (error) {
      const request = this.pending.get(id)
      if (request) {
        this.release(id)
        request.reject(error instanceof Error ? error : failure("native command rejected"))
      }
    }
    return result
  }
  receive = (data: NativeMotionColors) => {
    if (this.disposed || data.ownerId !== this.options.ownerId || data.target !== this.options.target()) return
    this.refreshScope()
    if (!validInteger(data.epoch) || !validInteger(data.environmentRevision) || !Number.isFinite(data.observedAt))
      return
    if (data.kind !== "environment" && data.kind !== "sample") return
    if (data.kind === "sample" && !this.pending.has(data.requestId)) return
    if (data.kind === "environment" && data.requestId && data.requestId !== this.environmentRequest) return
    if (data.environmentRevision < this.observedRevision) {
      if (data.kind === "sample") {
        const stale = this.pending.get(data.requestId)
        if (stale) {
          this.release(data.requestId)
          stale.reject(failure("stale native color sample"))
        }
      }
      return
    }
    if (!data.attached) {
      this.invalidate("native color view detached")
      return
    }
    const scope = this.options.scope()
    if (
      data.scopeOwnerId !== scope.ownerId ||
      (scope.windowId !== undefined && data.windowId !== scope.windowId) ||
      (scope.epoch !== undefined && data.epoch !== scope.epoch)
    ) {
      if (data.kind === "sample") {
        const foreign = this.pending.get(data.requestId)
        if (foreign) {
          this.release(data.requestId)
          foreign.reject(failure("native color report belongs to a different window/scope"))
        }
      }
      return
    }
    if (data.kind === "environment") {
      this.observedRevision = data.environmentRevision
      if (!data.attached || !data.windowId) {
        this.invalidate("native color view detached")
        return
      }
      const environment = Object.freeze({
        windowId: data.windowId,
        scopeOwnerId: data.scopeOwnerId,
        epoch: data.epoch,
        environmentRevision: data.environmentRevision,
      })
      const changed = this.context && signature(this.context) !== signature(environment)
      if (changed) this.invalidate("native color environment changed", false)
      this.context = environment
      this.environmentRequest = undefined
      if (changed) this.listeners.forEach((listener) => listener())
      this.dispatchPending()
      return
    }
    if (data.kind !== "sample") return
    const request = this.pending.get(data.requestId)
    if (!request || request.scope !== this.scopeSignature || !request.environment) return
    this.release(data.requestId)
    const expected = request.environment
    if (
      !data.attached ||
      !this.context ||
      signature(expected) !== signature(this.context) ||
      data.windowId !== expected.windowId ||
      data.scopeOwnerId !== expected.scopeOwnerId ||
      data.epoch !== expected.epoch ||
      data.environmentRevision !== expected.environmentRevision
    ) {
      request.reject(failure("stale native color sample"))
      return
    }
    if (data.error) {
      request.reject(failure(data.error))
      return
    }
    try {
      const parsed: unknown = JSON.parse(data.colors)
      if (!Array.isArray(parsed) || parsed.length !== request.encoded.length)
        throw failure("partial native color sample")
      const colors = parsed.map((value: unknown) => {
        if (
          !Array.isArray(value) ||
          value.length !== 4 ||
          !value.every(
            (channel) => typeof channel === "number" && Number.isFinite(channel) && channel >= 0 && channel <= 1,
          )
        )
          throw failure("invalid native color components")
        const [red, green, blue, alpha] = value as number[]
        return Object.freeze({ red, green, blue, alpha })
      })
      request.resolve(Object.freeze({ environment: expected, colors: Object.freeze(colors) }))
    } catch (error) {
      request.reject(error instanceof Error ? error : failure("invalid native color report"))
    }
  }
  dispose = () => {
    if (this.disposed) return
    this.disposed = true
    this.invalidate("native color sampler retired")
    this.listeners.clear()
  }
}

export const registerNativeMotionColorSampler = (target: View, sampler: NativeMotionColorSampler) => {
  samplers.get(target)?.dispose()
  samplers.set(target, sampler)
  return () => {
    sampler.dispose()
    if (samplers.get(target) === sampler) samplers.delete(target)
  }
}
export const sampleNativeMotionColors = (
  target: View | null,
  colors: readonly ColorValue[],
  cancellation?: TNativeMotionColorCancellation,
) => {
  const sampler = target && samplers.get(target)
  return sampler
    ? sampler.sample(colors, cancellation)
    : Promise.reject(failure("no sampler registered for the actual native view"))
}
export const subscribeNativeMotionColorEnvironment = (target: View | null, listener: () => void) => {
  const sampler = target && samplers.get(target)
  return sampler ? sampler.subscribe(listener) : () => {}
}
