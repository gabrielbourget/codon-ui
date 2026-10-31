// Native mapping of Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.
import { cancelFrame, frame } from "../kernel"

import type { TNativeMotionValueBinding, TNativeMotionVisualBindings, TNativeMotionVisualValues } from "./types"

type TSubscription = {
  value: TNativeMotionValueBinding<unknown>
  retire: () => void
}
const EMPTY_BINDINGS: TNativeMotionVisualBindings = Object.freeze({})

export class NativeMotionVisualState {
  private readonly listeners = new Set<() => void>()
  private readonly subscriptions = new Map<string, TSubscription>()
  private readonly latest: Record<string, unknown> = {}
  private snapshot: Readonly<TNativeMotionVisualValues>
  private bindings: TNativeMotionVisualBindings
  private onUpdate?: (latest: Readonly<TNativeMotionVisualValues>) => void
  private generation = 0
  private attached = false
  private notifyFrame?: () => void
  private renderFrame?: () => void
  private notifyLease?: () => boolean
  private renderLease?: () => boolean

  constructor(
    bindings: TNativeMotionVisualBindings = EMPTY_BINDINGS,
    onUpdate?: (latest: Readonly<TNativeMotionVisualValues>) => void,
    private readonly captureLease?: () => () => boolean,
  ) {
    this.onUpdate = onUpdate
    this.bindings = bindings
    for (const [key, value] of Object.entries(bindings)) if (value) this.latest[key] = value.get()
    this.snapshot = Object.freeze({ ...this.latest })
  }

  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private publish = () => {
    this.snapshot = Object.freeze({ ...this.latest })
    this.listeners.forEach((listener) => listener())
  }

  attach = () => {
    this.detach()
    this.attached = true
    this.generation++
    this.bindValues()
    this.publish()
    const generation = this.generation
    return () => {
      if (this.generation === generation) this.detach()
    }
  }

  configure = (
    bindings: TNativeMotionVisualBindings = EMPTY_BINDINGS,
    onUpdate?: (latest: Readonly<TNativeMotionVisualValues>) => void,
  ) => {
    const replaced = this.bindings !== bindings
    this.onUpdate = onUpdate
    this.bindings = bindings
    if (this.attached && (this.bindValues() || replaced)) this.publish()
  }

  private bindValues = () => {
    let changed = false
    for (const key of Object.keys(this.latest)) {
      if (this.bindings[key as keyof TNativeMotionVisualBindings]) continue
      delete this.latest[key]
      changed = true
    }
    for (const [key, subscription] of this.subscriptions) {
      if (this.bindings[key as keyof TNativeMotionVisualBindings] === subscription.value) continue
      subscription.retire()
      this.subscriptions.delete(key)
      delete this.latest[key]
      changed = true
    }
    for (const [key, binding] of Object.entries(this.bindings)) {
      if (!binding || this.subscriptions.get(key)?.value === binding) continue
      const generation = this.generation
      const subscription: TSubscription = { value: binding, retire: () => {} }
      subscription.retire = binding.on("change", (latest) => {
        if (!this.attached || this.generation !== generation || this.subscriptions.get(key) !== subscription) return
        this.latest[key] = latest
        this.schedule()
      })
      this.subscriptions.set(key, subscription)
      this.latest[key] = binding.get()
      changed = true
    }
    return changed
  }

  private schedule = () => {
    const generation = this.generation
    const current = this.captureLease?.() ?? (() => true)
    if (!current()) return
    if (this.notifyFrame && this.notifyLease?.() === false) {
      cancelFrame(this.notifyFrame)
      this.notifyFrame = undefined
    }
    if (this.renderFrame && this.renderLease?.() === false) {
      cancelFrame(this.renderFrame)
      this.renderFrame = undefined
    }
    if (this.onUpdate && !this.notifyFrame) {
      const notify = () => {
        if (this.notifyFrame !== notify) return
        this.notifyFrame = undefined
        if (!this.attached || generation !== this.generation || !current()) return
        const callback:
          | ((latest: Readonly<TNativeMotionVisualValues>, unused?: undefined, other?: undefined) => void)
          | undefined = this.onUpdate
        callback?.(this.latest, undefined, undefined)
      }
      this.notifyFrame = notify
      this.notifyLease = current
      frame.preRender(notify)
    }
    if (!this.renderFrame) {
      const render = () => {
        if (this.renderFrame !== render) return
        this.renderFrame = undefined
        if (!this.attached || generation !== this.generation || !current()) return
        this.publish()
      }
      this.renderFrame = render
      this.renderLease = current
      frame.render(render, false, true)
    }
  }

  detach = () => {
    this.attached = false
    this.generation++
    if (this.notifyFrame) cancelFrame(this.notifyFrame)
    if (this.renderFrame) cancelFrame(this.renderFrame)
    this.notifyFrame = this.renderFrame = undefined
    this.subscriptions.forEach(({ retire }) => retire())
    this.subscriptions.clear()
  }
}
