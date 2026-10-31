import type { Animated, ColorValue } from "react-native"

import type { AnimationPlaybackControlsWithThen, MotionValue, ValueAnimationTransition } from "../kernel"
import type { Delta, PathInterpolator } from "../projection/types"
import type { TNativeMotionVisualValues } from "../visual/types"

import type { AnimationState } from "./animation-state"

export type TNativeMotionAnimationType =
  | "animate"
  | "whileInView"
  | "whileFocus"
  | "whileHover"
  | "whileTap"
  | "whileDrag"
  | "exit"
type TNativeMotionValue<Value> = Value extends Animated.AnimatedNode
  ? never
  : Value extends ColorValue
    ? Value
    : Value extends readonly unknown[]
      ? { readonly [Key in keyof Value]: TNativeMotionValue<Value[Key]> }
      : Value extends object
        ? { [Key in keyof Value]: TNativeMotionValue<Value[Key]> }
        : Value
export type TNativeMotionStyleValues = {
  [Key in keyof TNativeMotionVisualValues]?: TNativeMotionValue<Exclude<TNativeMotionVisualValues[Key], undefined>>
}
export type TNativeMotionResolvedValues = TNativeMotionStyleValues & Record<string, unknown>
export type TNativeMotionVelocities = Partial<Record<keyof TNativeMotionStyleValues, number>> &
  Record<string, number | undefined>
export type TNativeMotionVariantLabels = string | string[]
export type TNativeMotionDynamicOption<T> = (index: number, total: number) => T
export type TNativeMotionTargetValues = {
  [Key in keyof TNativeMotionStyleValues]?:
    | Exclude<TNativeMotionStyleValues[Key], undefined>
    | ReadonlyArray<Exclude<TNativeMotionStyleValues[Key], undefined> | null>
}
export type TNativeMotionTarget = TNativeMotionTargetValues & {
  transition?: TNativeMotionTransition
  transitionEnd?: TNativeMotionStyleValues
}
export type TNativeMotionTargetResolver = (
  custom: unknown,
  current: TNativeMotionResolvedValues,
  velocity: TNativeMotionVelocities,
) => TNativeMotionTarget | string
export type TNativeMotionDefinition = TNativeMotionTarget | TNativeMotionTargetResolver | TNativeMotionVariantLabels
export type TNativeMotionAnimationProp = TNativeMotionDefinition | TNativeMotionAnimationControls | boolean
type TNativeMotionVariantTarget = TNativeMotionTarget | TNativeMotionVariantLabels
export type TNativeMotionAnimationProps = {
  initial?: TNativeMotionVariantTarget | boolean
  animate?: TNativeMotionVariantTarget | TNativeMotionAnimationControls | boolean
  exit?: TNativeMotionVariantTarget
  whileInView?: TNativeMotionVariantTarget
  whileFocus?: TNativeMotionVariantTarget
  whileHover?: TNativeMotionVariantTarget
  whileTap?: TNativeMotionVariantTarget
  whileDrag?: TNativeMotionVariantTarget
  custom?: unknown
  inherit?: boolean
  variants?: Readonly<Record<string, TNativeMotionTarget | TNativeMotionTargetResolver>>
  transition?: TNativeMotionTransition
}
export type TNativeMotionValueTransition<Value = unknown> = ValueAnimationTransition<Value> & {
  reduceMotion?: boolean
  path?: {
    interpolateProjection: (delta: Delta) => PathInterpolator | undefined
    animateVisualElement: (
      owner: TNativeMotionAnimationOwner,
      target: TNativeMotionTarget,
      transition: TNativeMotionTransition | undefined,
      delay: number,
      animations: AnimationPlaybackControlsWithThen[],
    ) => void
  }
}
type TNativeMotionPropertyTransitions = {
  [Key in keyof TNativeMotionStyleValues]?: TNativeMotionValueTransition<
    Exclude<TNativeMotionStyleValues[Key], undefined>
  >
}
export interface TNativeMotionTransition extends TNativeMotionValueTransition, TNativeMotionPropertyTransitions {
  default?: TNativeMotionValueTransition
  layout?: TNativeMotionValueTransition
}
export type TNativeMotionValueAnimationOptions = TNativeMotionTransition & {
  keyframes: unknown[]
  allowFlatten?: boolean
}
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
  awaitAnimationReady?: () => (() => boolean) | Promise<() => boolean>
  setReducedMotionPolicy?: (key: string, override: boolean | undefined) => void
  animateValue: (
    key: string,
    value: MotionValue<unknown>,
    target: unknown,
    transition: TNativeMotionTransition,
    complete: () => void,
    isCurrent: () => boolean,
  ) => AnimationPlaybackControlsWithThen | undefined
}
