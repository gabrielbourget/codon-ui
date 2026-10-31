import { createAnimationState, isControllingVariants } from "../animation"
import type {
  TNativeMotionAnimationOwner,
  TNativeMotionAnimationProps,
  TNativeMotionDefinition,
  TNativeMotionTransition,
} from "../animation"
import { JSAnimation, motionValue } from "../kernel"
import type { MotionValue } from "../kernel"
import type { TNativeMotionVisualBindings } from "../visual/types"

// Non-shipping scalar model. Native color, unit/geometry resolution and native
// tree order are deliberately not simulated or claimed by this fixture.
export class AnimationOwnerFixture implements TNativeMotionAnimationOwner {
  props: TNativeMotionAnimationProps
  parent?: AnimationOwnerFixture
  values = new Map<string, MotionValue<unknown>>()
  latestValues: Record<string, unknown> = {}
  variantChildren = new Set<AnimationOwnerFixture>()
  enteringChildren = new Set<AnimationOwnerFixture>()
  presenceContext: { custom?: unknown } = {}
  animationState: ReturnType<typeof createAnimationState>
  isControllingVariants: boolean
  manuallyAnimateOnMount = false
  blockInitialAnimation = false
  shouldReduceMotion = false
  shouldSkipAnimations = false
  active = true
  generation = 0
  order = 0
  events: Array<{ event: string; definition: TNativeMotionDefinition }> = []
  base: Record<string, unknown> = { x: 0, y: 0, opacity: 1, scale: 1 }
  constructor(props: TNativeMotionAnimationProps = {}) {
    this.props = props
    this.isControllingVariants = isControllingVariants(props)
    for (const [key, value] of Object.entries(this.base)) this.addValue(key, motionValue<unknown>(value))
    this.animationState = createAnimationState(this)
  }
  getProps = () => this.props
  getVariant = (name: string) => this.props.variants?.[name]
  getDefaultTransition = () => this.props.transition
  getBaseTarget = (key: string) => this.base[key]
  hasValue = (key: string) => this.values.has(key)
  addValue = (key: string, value: MotionValue<unknown>) => {
    this.values.set(key, value)
    this.latestValues[key] = value.get()
    value.on("change", (latest) => {
      this.latestValues[key] = latest
    })
  }
  getValue(key: string): MotionValue<unknown> | undefined
  getValue(key: string, fallback: unknown): MotionValue<unknown>
  getValue(key: string, ...fallback: unknown[]) {
    if (!this.values.has(key) && fallback.length) this.addValue(key, motionValue<unknown>(fallback[0]))
    return this.values.get(key)
  }
  notify = (event: "AnimationStart" | "AnimationComplete", definition: TNativeMotionDefinition) => {
    this.events.push({ event, definition })
  }
  sortNodePosition = (other: TNativeMotionAnimationOwner) => this.order - (other as AnimationOwnerFixture).order
  captureAnimationLease = () => {
    const generation = this.generation
    return () => this.active && this.generation === generation
  }
  attach = () => {
    this.active = true
    this.generation++
  }
  retire = () => {
    this.active = false
    this.generation++
    this.values.forEach((value) => value.stop())
  }
  bindings = () => Object.fromEntries(this.values) as TNativeMotionVisualBindings
  animateValue: TNativeMotionAnimationOwner["animateValue"] = (
    _key,
    value,
    target,
    transition,
    complete,
    isCurrent,
  ) => {
    const initial = value.get()
    const frames: unknown[] = Array.isArray(target) ? target : [initial, target]
    const resolved = frames.map((frame, index) =>
      frame === null ? (index === 0 ? initial : frames[index - 1]) : frame,
    )
    if (!resolved.every((frame) => typeof frame === "number" || typeof frame === "string"))
      throw new TypeError("Source fixture requires already resolved scalar native keyframes")
    const options = {
      ...transition,
      keyframes: resolved as Array<number | string>,
      duration: (transition.duration ?? 0.3) * 1000,
      repeatDelay: (transition.repeatDelay ?? 0) * 1000,
      delay: (transition.delay ?? 0) * 1000,
      ease: transition.ease ?? "easeOut",
      motionValue: value as unknown as MotionValue<number | string>,
      onUpdate: (latest: number | string) => {
        if (isCurrent()) {
          value.set(latest)
          transition.onUpdate?.(latest)
        }
      },
      onComplete: () => {
        if (isCurrent()) {
          complete()
          transition.onComplete?.()
        }
      },
    }
    return new JSAnimation(options)
  }
}
export const scalarTransition: TNativeMotionTransition = { duration: 0.1, ease: "linear" }
