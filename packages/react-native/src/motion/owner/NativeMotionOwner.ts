import type { TextStyle, View } from "react-native"

import { observeNativeMotionGeometry } from "../../input/motionGeometry"
import { createAnimationState, isControllingVariants, isVariantNode, resolveVariantFromProps } from "../animation"
import { isAnimationControls } from "../animation/is-animation-controls"
import { isVariantLabel } from "../animation/is-variant-label"
import { positionalKeys, transformProps } from "../animation/transform-keys"
import type {
  TNativeMotionAnimationOwner,
  TNativeMotionAnimationProps,
  TNativeMotionDefinition,
} from "../animation/types"
import type { TNativeMotionConfig } from "../config"
import type { TNativeMotionDragProps } from "../interactions/dragTypes"
import type { TNativeMotionInteractionProps } from "../interactions/types"
import { motionValue } from "../kernel"
import type { AnimationPlaybackControlsWithThen, MotionValue } from "../kernel"
import type { TNativeMotionLayoutProps } from "../projection/layoutTypes"
import type { NativeProjectionState } from "../projection/NativeProjectionState"
import type { IProjectionNode } from "../projection/node/types"
import { animateNativeMotionValue } from "../value/animateValue"
import { NativeMotionProbeIsolation } from "../value/isolated-probe"
import { nativeTargetKeyframes } from "../value/keyframes"
import { createNativeMotionValueContext } from "../value/nativeContext"
import { NativeValueAnimation } from "../value/NativeValueAnimation"
import { NativeMotionResolutionBatch } from "../value/resolution-batch"
import type { TNativeMotionValueContext } from "../value/types"
import type { TNativeMotionViewportProps } from "../viewport/types"
import { resolveNativeMotionVisualStyle } from "../visual/styles"
import { NATIVE_MOTION_TRANSFORM_ORDER } from "../visual/types"
import type {
  TNativeMotionTransformTemplate,
  TNativeMotionVisualBindings,
  TNativeMotionVisualValues,
} from "../visual/types"

const NATIVE_NODE_DISCONNECTED = 1
const NATIVE_NODE_PRECEDING = 2
const NATIVE_NODE_FOLLOWING = 4

export type TNativeMotionOwnerProps = TNativeMotionAnimationProps &
  TNativeMotionInteractionProps & {
    onAnimationStart?: (definition: TNativeMotionDefinition) => void
    onAnimationComplete?: (definition: TNativeMotionDefinition) => void
  } & TNativeMotionDragProps &
  TNativeMotionLayoutProps &
  TNativeMotionViewportProps
export type TNativeMotionInitialContext = Pick<TNativeMotionAnimationProps, "initial" | "animate">
export const nativeInitialVariantContext = (
  props: TNativeMotionAnimationProps,
  parent: TNativeMotionInitialContext = {},
): TNativeMotionInitialContext => {
  if (isControllingVariants(props))
    return {
      initial: props.initial === false || isVariantLabel(props.initial) ? props.initial : undefined,
      animate: isVariantLabel(props.animate) ? props.animate : undefined,
    }
  return props.inherit !== false ? parent : {}
}
export type TNativeMotionOwnerOptions = {
  props: TNativeMotionOwnerProps
  base: Readonly<Record<string, unknown>>
  values?: Readonly<Record<string, MotionValue<unknown>>>
  config: TNativeMotionConfig
  reduced: boolean
  canAct: () => boolean
  waitForInitialWindow?: () => boolean
  readValue?: TNativeMotionValueContext["readValue"]
  resolveGeometry?: TNativeMotionValueContext["resolveGeometry"]
  evaluateGeometry?: TNativeMotionValueContext["resolveGeometry"]
  transformTemplate?: TNativeMotionTransformTemplate
  onMeasurementError?: (error: unknown) => void
  presence?: { custom?: unknown; initial?: boolean; isPresent?: boolean }
  initialContext?: TNativeMotionInitialContext
}

// Private renderer owner. Missing native reads/order/geometry reject; construction is not admission.
export class NativeMotionOwner implements TNativeMotionAnimationOwner {
  props: TNativeMotionOwnerProps
  values = new Map<string, MotionValue<unknown>>()
  latestValues: Record<string, unknown> = {}
  variantChildren?: Set<NativeMotionOwner>
  enteringChildren?: Set<NativeMotionOwner>
  presenceContext?: { custom?: unknown; isPresent?: boolean }
  readonly animationState = createAnimationState(this)
  readonly isControllingVariants: boolean
  readonly isVariantNode: boolean
  readonly manuallyAnimateOnMount: boolean
  blockInitialAnimation = false
  shouldReduceMotion = false
  shouldSkipAnimations = false
  current: View | null = null
  projection?: IProjectionNode
  nativeProjection?: NativeProjectionState
  private readonly projectionValues = new Set<() => void>()
  private readonly projectionNodes = new Set<(node: IProjectionNode | undefined) => void>()
  private options: TNativeMotionOwnerOptions
  private configuredValues: TNativeMotionOwnerOptions["values"]
  private configuredReduced: boolean
  private configuredSkip: boolean
  private readonly reducedPolicies = new Map<string, boolean | undefined>()
  private generation = 0
  private attachment = 0
  private mountedBefore = false
  private eligible: boolean
  private everReady = false
  private readonly waiting = new Set<{
    resolve: (current: () => boolean) => void
    timer: ReturnType<typeof setTimeout>
  }>()
  private readonly initialValues: Record<string, unknown> = {}
  private readonly baseTarget: Record<string, unknown> = {}
  private readonly subscriptions = new Map<string, () => void>()
  private readonly animations = new Map<MotionValue<unknown>, AnimationPlaybackControlsWithThen>()
  private readonly pendingBindings = new Map<string, { value: MotionValue<unknown>; failed: boolean }>()
  private readonly listeners = new Set<() => void>()
  private readonly resolutionBatch = new NativeMotionResolutionBatch()
  private readonly probes = new NativeMotionProbeIsolation({
    canAct: () => this.isCurrent(),
    onError: (error) => this.options.onMeasurementError?.(error),
  })
  private snapshot: TNativeMotionVisualBindings = Object.freeze({})
  private stopGeometry?: () => void
  private stopControls?: () => void
  private removeVariant?: () => void
  private subscribedControls?: TNativeMotionAnimationProps["animate"]

  constructor(
    options: TNativeMotionOwnerOptions,
    readonly parent?: NativeMotionOwner,
  ) {
    this.options = options
    this.configuredValues = options.values
    this.configuredReduced = options.reduced
    this.configuredSkip = Boolean(options.config.skipAnimations)
    this.eligible = options.canAct()
    this.props = { transition: options.config.transition, ...options.props }
    this.isControllingVariants = isControllingVariants(this.props)
    this.isVariantNode = isVariantNode(this.props)
    if (this.isVariantNode) this.variantChildren = new Set()
    this.manuallyAnimateOnMount = Boolean(parent?.current)
    this.shouldReduceMotion = options.reduced
    this.shouldSkipAnimations = Boolean(options.config.skipAnimations)
    this.presenceContext = options.presence
    this.blockInitialAnimation = options.presence?.initial === false
    for (const [key, value] of Object.entries(options.values ?? {})) this.addValue(key, value)
    const inherited =
      this.isVariantNode && !this.isControllingVariants && this.props.inherit !== false
        ? (options.initialContext ?? parent?.getInitialVariantContext())
        : undefined
    const initial = this.props.initial ?? inherited?.initial
    const animate = this.props.animate ?? inherited?.animate
    const blocked = initial === false || this.blockInitialAnimation
    const definition = blocked ? animate : initial
    if (definition && typeof definition !== "boolean" && !isAnimationControls(definition)) {
      const definitions = Array.isArray(definition) ? definition : [definition]
      for (const item of definitions) {
        const resolved = resolveVariantFromProps(this.props, item)
        if (!resolved) continue
        const { transition: _transition, transitionEnd, ...target } = resolved
        void _transition
        for (const [key, targetValue] of Object.entries(target)) {
          const frames = nativeTargetKeyframes(key, targetValue)
          const value =
            Array.isArray(targetValue) && frames[1] !== targetValue
              ? targetValue[blocked ? targetValue.length - 1 : 0]
              : targetValue
          if (value !== null && value !== undefined) {
            if (!this.values.has(key)) this.addValue(key, motionValue(value))
            else this.values.get(key)!.set(value)
          }
        }
        for (const [key, value] of Object.entries(transitionEnd ?? {})) {
          if (!this.values.has(key)) this.addValue(key, motionValue(value))
          else this.values.get(key)!.set(value)
        }
      }
    }
    this.values.forEach((value, key) => {
      this.latestValues[key] = value.get()
    })
    Object.assign(this.baseTarget, options.base, this.latestValues)
    if (this.props.initial) Object.assign(this.initialValues, this.latestValues)
  }

  getProps = () => this.props
  getInitialVariantContext = (): TNativeMotionInitialContext =>
    nativeInitialVariantContext(this.props, this.options.initialContext ?? this.parent?.getInitialVariantContext())
  getVariant = (name: string) => this.props.variants?.[name]
  getDefaultTransition = () => this.props.transition
  getTransformPagePoint = () => this.options.config.transformPagePoint
  isStatic = () => Boolean(this.options.config.isStatic)
  getAuthoredStyle = () => this.options.base
  subscribeProjectionValues = (listener: () => void) => {
    this.projectionValues.add(listener)
    return () => {
      this.projectionValues.delete(listener)
    }
  }
  setProjection = (node: IProjectionNode | undefined) => {
    this.projection = node
    this.projectionNodes.forEach((listener) => listener(node))
  }
  subscribeProjectionNode = (listener: (node: IProjectionNode | undefined) => void) => {
    this.projectionNodes.add(listener)
    listener(this.projection)
    return () => {
      this.projectionNodes.delete(listener)
    }
  }
  setReducedMotionPolicy = (key: string, override: boolean | undefined) => {
    this.reducedPolicies.set(key, override)
  }
  hasValue = (key: string) => this.values.has(key)
  getBindings = () => this.snapshot
  subscribeBindings = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private publishBindings = () => {
    this.snapshot = Object.freeze(
      Object.fromEntries(
        [...this.values]
          .filter(([key, value]) => value.get() !== undefined && !this.pendingBindings.has(key))
          .map(([key, value]) => [key, this.probes.binding(value)]),
      ),
    ) as TNativeMotionVisualBindings
    if (this.current) this.listeners.forEach((listener) => listener())
  }
  private bind = (key: string, value: MotionValue<unknown>) => {
    this.subscriptions.get(key)?.()
    const receive = (latest: unknown) => {
      if (this.values.get(key) !== value || this.probes.isProbing(value)) return
      this.latestValues[key] = latest
      this.projectionValues.forEach((listener) => listener())
      if (this.pendingBindings.get(key)?.failed) this.pendingBindings.delete(key)
      if (
        !this.snapshot[key as keyof TNativeMotionVisualBindings] &&
        !this.pendingBindings.has(key) &&
        latest !== undefined
      )
        this.publishBindings()
    }
    const stopChange = value.on("change", receive)
    const stopRestored = this.probes.observeRestored(value, () => receive(value.get()))
    this.subscriptions.set(key, () => {
      stopChange()
      stopRestored()
    })
  }
  isolatedProbe = (
    name: string,
    value: unknown,
    phase: "target" | "restored",
    token: Parameters<TNativeMotionValueContext["readValue"]>[2],
  ) => {
    const current = this.values.get(name)
    if (!current) throw new Error("Native motion: isolated probe value unavailable")
    this.probes.probe(name, current, value, phase, token)
  }
  beginIsolatedTransforms = (token: Parameters<TNativeMotionValueContext["readValue"]>[2]) => {
    const removed: Array<{ name: string; value: MotionValue<unknown>; original: unknown }> = []
    let restored = false
    const restore = () => {
      if (restored) return
      restored = true
      let failure: unknown,
        failed = false
      for (const { name, value, original } of removed) {
        try {
          this.probes.setProbe(name, value, original, "restored", token)
        } catch (error) {
          if (!failed) failure = error
          failed = true
        }
      }
      if (failed) throw failure
    }
    try {
      for (const name of NATIVE_MOTION_TRANSFORM_ORDER) {
        if (name === "x" || name === "y" || name === "z") continue
        const value = this.values.get(name)
        if (!value) continue
        removed.push({ name, value, original: value.get() })
        this.probes.setProbe(name, value, name.startsWith("scale") ? 1 : 0, "target", token)
      }
    } catch (error) {
      try {
        restore()
      } catch (restorationError) {
        this.options.onMeasurementError?.(restorationError)
      }
      throw error
    }
    return restore
  }
  buildIsolatedStage = (patch: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> => {
    const values = { ...this.latestValues }
    for (const name of NATIVE_MOTION_TRANSFORM_ORDER) {
      const value = this.values.get(name)
      if (value && this.probes.isProbing(value)) values[name] = value.get()
    }
    Object.assign(values, patch)
    const resolved = resolveNativeMotionVisualStyle(
      this.options.base as TextStyle,
      undefined,
      undefined,
      values as TNativeMotionVisualValues,
      this.options.transformTemplate,
    ).view
    const result = { ...patch }
    for (const name of Object.keys(result))
      if (transformProps.has(name) || ["originX", "originY", "originZ"].includes(name)) delete result[name]
    if (
      resolved.transform !== undefined &&
      (Object.keys(values).some((name) => transformProps.has(name)) || "transform" in patch)
    )
      result.transform = resolved.transform
    if (resolved.transformOrigin !== undefined) result.transformOrigin = resolved.transformOrigin
    return result
  }
  addValue = (key: string, value: MotionValue<unknown>) => {
    if (this.values.get(key) === value) return
    this.removeValue(key)
    this.values.set(key, value)
    this.latestValues[key] = value.get()
    if (this.current) this.bind(key, value)
    this.publishBindings()
  }
  removeValue = (key: string) => {
    const previous = this.values.get(key)
    if (previous) this.animations.delete(previous)
    this.pendingBindings.delete(key)
    this.reducedPolicies.delete(key)
    this.subscriptions.get(key)?.()
    this.subscriptions.delete(key)
    this.values.delete(key)
    delete this.latestValues[key]
    this.publishBindings()
  }
  getValue(key: string): MotionValue<unknown> | undefined
  getValue(key: string, fallback: unknown): MotionValue<unknown>
  getValue(key: string, fallback?: unknown) {
    if (!this.values.has(key) && fallback !== undefined)
      this.addValue(key, motionValue<unknown>(fallback === null ? undefined : fallback))
    return this.values.get(key)
  }
  getBaseTarget = (key: string) => {
    const initial = this.props.initial
    const variant =
      typeof initial === "string" || typeof initial === "object"
        ? resolveVariantFromProps(this.props, initial, this.presenceContext?.custom)
        : undefined
    const fromInitial = variant?.[key]
    if (initial && fromInitial !== undefined) return fromInitial
    const authored = this.options.base[key]
    if (authored !== undefined) return authored
    return this.initialValues[key] !== undefined && fromInitial === undefined ? undefined : this.baseTarget[key]
  }
  private isCurrent = () => this.current !== null && this.options.canAct()
  captureVisualLease = () => {
    const target = this.current,
      generation = this.generation
    return () => this.isCurrent() && this.current === target && this.generation === generation
  }
  captureAttachmentLease = () => {
    const target = this.current,
      attachment = this.attachment
    return () => target !== null && this.current === target && this.attachment === attachment
  }
  captureAnimationLease = () => {
    const current = this.captureVisualLease()
    return () => current() && !this.options.config.isStatic
  }
  awaitAnimationReady = (): (() => boolean) | Promise<() => boolean> => {
    if (!this.current || this.everReady || this.isCurrent() || !this.options.waitForInitialWindow?.())
      return this.captureAnimationLease()
    const attachment = this.attachment
    return new Promise<() => boolean>((resolve, reject) => {
      const entry: { resolve: (current: () => boolean) => void; timer: ReturnType<typeof setTimeout> } = {
        resolve: (current: () => boolean) => resolve(() => this.attachment === attachment && current()),
        timer: setTimeout(() => {
          this.waiting.delete(entry)
          reject(new Error("Native motion: native window readiness exceeded its 5000ms limit"))
        }, 5000),
      }
      this.waiting.add(entry)
    })
  }
  private releaseWaiting = (current: () => boolean) => {
    for (const entry of this.waiting) {
      clearTimeout(entry.timer)
      entry.resolve(current)
    }
    this.waiting.clear()
  }
  invalidate = () => {
    this.resolutionBatch.cancel()
    this.probes.cancel()
    this.generation++
    const animations = [...this.animations]
    this.animations.clear()
    for (const [key, pending] of [...this.pendingBindings]) {
      if (this.pendingBindings.get(key) !== pending) continue
      if (this.values.get(key) === pending.value && !this.options.values?.[key]) this.removeValue(key)
      else pending.failed = true
    }
    for (const [value, animation] of animations) if (value.animation === animation) value.stop()
  }
  notify: TNativeMotionAnimationOwner["notify"] = (event, definition) => {
    if (!this.isCurrent()) return
    const callback: ((definition: TNativeMotionDefinition, unused?: undefined, other?: undefined) => void) | undefined =
      event === "AnimationStart" ? this.props.onAnimationStart : this.props.onAnimationComplete
    callback?.(definition, undefined, undefined)
  }
  private closestVariantNode = (): NativeMotionOwner | undefined =>
    this.isVariantNode ? this : this.parent?.closestVariantNode()
  private registerVariant = () => {
    if (!this.isVariantNode || this.isControllingVariants) return
    const ancestor = this.parent?.closestVariantNode()
    ancestor?.variantChildren?.add(this)
    this.removeVariant = () => ancestor?.variantChildren?.delete(this)
  }
  private subscribeControls = () => {
    if (this.subscribedControls === this.props.animate) return
    this.stopControls?.()
    this.stopControls = undefined
    this.subscribedControls = this.props.animate
    if (!this.options.config.isStatic && isAnimationControls(this.props.animate))
      this.stopControls = this.props.animate.subscribe(this)
  }
  commitProps = (options: TNativeMotionOwnerOptions) => {
    this.options = options
    this.props = { transition: options.config.transition, ...options.props }
    this.shouldReduceMotion = options.reduced
    this.shouldSkipAnimations = Boolean(options.config.skipAnimations)
    this.presenceContext = options.presence
  }
  configure = (options: TNativeMotionOwnerOptions) => {
    const previousValues = this.configuredValues
    const finishReduced = !this.configuredReduced && options.reduced
    const finishAll = !this.configuredSkip && Boolean(options.config.skipAnimations)
    this.configuredReduced = options.reduced
    this.configuredSkip = Boolean(options.config.skipAnimations)
    const eligible = options.canAct()
    const changedEligibility = eligible !== this.eligible
    if (changedEligibility) this.invalidate()
    this.eligible = eligible
    this.commitProps(options)
    this.configuredValues = options.values
    for (const key of Object.keys(previousValues ?? {})) if (!options.values?.[key]) this.removeValue(key)
    for (const [key, value] of Object.entries(options.values ?? {})) this.addValue(key, value)
    if (this.isCurrent() && (finishAll || finishReduced)) {
      for (const [key, value] of this.values) {
        if (!finishAll && (!positionalKeys.has(key) || this.reducedPolicies.get(key) === false)) continue
        const animation = this.animations.get(value)
        if (animation && value.animation === animation) animation.complete()
      }
    }
    if (this.current) this.subscribeControls()
    if (this.current && eligible && changedEligibility) this.publishBindings()
    if (this.isCurrent()) {
      this.everReady = true
      this.releaseWaiting(this.captureAnimationLease())
    }
  }
  attach = (target: View) => {
    if (this.current) this.detach()
    if (this.mountedBefore)
      for (const [key, value] of Object.entries(this.initialValues)) {
        this.values.get(key)?.jump(value)
      }
    this.current = target
    this.generation++
    const attachment = ++this.attachment
    this.values.forEach((value, key) => {
      this.latestValues[key] = value.get()
      this.bind(key, value)
    })
    this.registerVariant()
    if (this.parent) (this.parent.enteringChildren ??= new Set()).add(this)
    this.stopGeometry = observeNativeMotionGeometry(target, (record) => {
      if (!record || !record.attached) this.invalidate()
    })
    this.subscribeControls()
    this.mountedBefore = true
    this.everReady = this.isCurrent()
    return () => {
      if (this.current === target && this.attachment === attachment) this.detach()
    }
  }
  detach = () => {
    this.attachment++
    this.releaseWaiting(() => false)
    this.current = null
    this.invalidate()
    this.stopGeometry?.()
    this.stopGeometry = undefined
    this.stopControls?.()
    this.stopControls = undefined
    this.subscribedControls = undefined
    this.removeVariant?.()
    this.removeVariant = undefined
    this.parent?.enteringChildren?.delete(this)
    this.subscriptions.forEach((retire) => retire())
    this.subscriptions.clear()
    this.current = null
    this.animationState.reset()
  }
  sortNodePosition = (other: TNativeMotionAnimationOwner) => {
    if (!(other instanceof NativeMotionOwner) || !this.current || !other.current) return 0
    const left = this.current as View & { compareDocumentPosition?: (right: unknown) => number }
    if (typeof left.compareDocumentPosition !== "function")
      throw new Error("Native motion: native host document ordering unavailable")
    const position = left.compareDocumentPosition(other.current)
    if (!Number.isInteger(position) || position & NATIVE_NODE_DISCONNECTED)
      throw new Error("Native motion: native hosts are disconnected")
    if (position === 0) return 0
    if (position & NATIVE_NODE_PRECEDING) return 1
    if (position & NATIVE_NODE_FOLLOWING) return -1
    throw new Error("Native motion: invalid native host document order")
  }
  animateValue: TNativeMotionAnimationOwner["animateValue"] = (key, value, target, transition, complete, isCurrent) => {
    const pending = value.get() === undefined || this.pendingBindings.has(key) ? { value, failed: false } : undefined
    if (pending) {
      this.pendingBindings.set(key, pending)
      this.publishBindings()
    }
    const nativeContext = createNativeMotionValueContext({
      target: () => this.current,
      isCurrent: () => this.isCurrent() && isCurrent(),
      shouldSkipAnimations: this.shouldSkipAnimations,
      beginResolution: this.resolutionBatch.begin,
      readValue: (name, endpoint, token) => {
        const authored = this.options.base[name]
        if (authored !== undefined) {
          this.baseTarget[name] = authored
          return authored
        }
        if (!this.options.readValue) throw new Error("Native motion: actual native initial-value reader unavailable")
        const result = this.options.readValue(name, endpoint, token)
        const remember = (initial: unknown) => {
          if (token.isCurrent() && initial !== undefined && initial !== null) this.baseTarget[name] = initial
          return initial
        }
        return result !== null &&
          (typeof result === "object" || typeof result === "function") &&
          "then" in result &&
          typeof result.then === "function"
          ? Promise.resolve(result).then(remember)
          : remember(result)
      },
      resolveGeometry: (name, frames, token, ticket) => {
        if (this.options.resolveGeometry) return this.options.resolveGeometry(name, frames, token)
        if (!this.options.evaluateGeometry)
          throw new Error("Native motion: actual isolated geometry resolver unavailable")
        return this.options.evaluateGeometry(name, frames, token, ticket)
      },
    })
    const animation = animateNativeMotionValue(key, value, target, transition, nativeContext)(complete)
    if (animation) this.animations.set(value, animation)
    if (pending && animation instanceof NativeValueAnimation)
      void animation.ready.then(
        () => {
          if (this.pendingBindings.get(key) !== pending || this.values.get(key) !== value || !isCurrent()) return
          this.pendingBindings.delete(key)
          this.publishBindings()
        },
        () => {
          if (this.pendingBindings.get(key) !== pending || this.values.get(key) !== value) return
          if (!this.options.values?.[key]) this.removeValue(key)
          else pending.failed = true
        },
      )
    return animation
  }
}
