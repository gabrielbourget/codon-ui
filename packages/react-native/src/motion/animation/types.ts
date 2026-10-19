import type { AnimationPlaybackControlsWithThen, MotionValue, ValueAnimationTransition } from "../kernel"

import type { AnimationState } from "./animation-state"

export type TNativeMotionAnimationType =
  | "animate"
  | "whileInView"
  | "whileFocus"
  | "whileHover"
  | "whileTap"
  | "whileDrag"
  | "exit"
export type TNativeMotionResolvedValues = Record<string, unknown>
export type TNativeMotionVariantLabels = string | string[]
export type TNativeMotionDynamicOption<T> = (index: number, total: number) => T
export type TNativeMotionTarget = Record<string, unknown> & {
  transition?: TNativeMotionTransition
  transitionEnd?: Record<string, unknown>
}
export type TNativeMotionTargetResolver = (
  custom: unknown,
  current: TNativeMotionResolvedValues,
  velocity: TNativeMotionResolvedValues,
) => TNativeMotionTarget | string
export type TNativeMotionDefinition = TNativeMotionTarget | TNativeMotionTargetResolver | TNativeMotionVariantLabels
export type TNativeMotionAnimationProp = TNativeMotionDefinition | TNativeMotionAnimationControls | boolean
export type TNativeMotionAnimationProps = Partial<
  Record<"initial" | TNativeMotionAnimationType, TNativeMotionAnimationProp>
> & {
  custom?: unknown
  inherit?: boolean
  variants?: Readonly<Record<string, TNativeMotionTarget | TNativeMotionTargetResolver>>
  transition?: TNativeMotionTransition
}
export type TNativeMotionTransition = ValueAnimationTransition<unknown> & {
  [property: string]: unknown
  default?: TNativeMotionTransition
  reduceMotion?: boolean
  path?: {
    animateVisualElement: (
      owner: TNativeMotionAnimationOwner,
      target: TNativeMotionTarget,
      transition: TNativeMotionTransition | undefined,
      delay: number,
      animations: AnimationPlaybackControlsWithThen[],
    ) => void
  }
}
export type TNativeMotionValueAnimationOptions = TNativeMotionTransition & { keyframes: unknown[] }
export type TNativeMotionAnimationOptions = {
  delay?: number
  transitionOverride?: TNativeMotionTransition
  type?: TNativeMotionAnimationType
  custom?: unknown
}
export type TNativeMotionAnimationControls = {
  subscribe: (owner: TNativeMotionAnimationOwner) => () => void
  start: (definition: TNativeMotionDefinition, transitionOverride?: TNativeMotionTransition) => Promise<unknown[]>
  set: (definition: TNativeMotionDefinition) => void
  stop: () => void
  mount: () => () => void
}

// This private protocol deliberately requires the real native owner/value backend.
// It is not a public claim that native keyframes, geometry or color probes exist.
export interface TNativeMotionAnimationOwner {
  props: TNativeMotionAnimationProps
  parent?: TNativeMotionAnimationOwner
  values: Map<string, MotionValue<unknown>>
  latestValues: TNativeMotionResolvedValues
  variantChildren?: Set<TNativeMotionAnimationOwner>
  enteringChildren?: Set<TNativeMotionAnimationOwner>
  presenceContext?: { custom?: unknown }
  animationState?: AnimationState
  isControllingVariants: boolean
  manuallyAnimateOnMount: boolean
  blockInitialAnimation: boolean
  shouldReduceMotion?: boolean | null
  shouldSkipAnimations?: boolean
  getProps: () => TNativeMotionAnimationProps
  getVariant: (name: string) => TNativeMotionTarget | TNativeMotionTargetResolver | undefined
  getDefaultTransition: () => TNativeMotionTransition | undefined
  getBaseTarget: (key: string) => unknown
  hasValue: (key: string) => boolean
  addValue: (key: string, value: MotionValue<unknown>) => void
  getValue: {
    (key: string): MotionValue<unknown> | undefined
    (key: string, fallback: unknown): MotionValue<unknown>
  }
  notify: (event: "AnimationStart" | "AnimationComplete", definition: TNativeMotionDefinition) => void
  sortNodePosition: (other: TNativeMotionAnimationOwner) => number
  captureAnimationLease: () => () => boolean
  animateValue: (
    key: string,
    value: MotionValue<unknown>,
    target: unknown,
    transition: TNativeMotionTransition,
    complete: () => void,
    isCurrent: () => boolean,
  ) => AnimationPlaybackControlsWithThen | undefined
}
