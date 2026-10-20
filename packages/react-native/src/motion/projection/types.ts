export type { Process } from "../kernel/engine/frameloop/types"
import type { TextStyle, ViewStyle } from "react-native"

import type {
  AnimationPlaybackControlsWithThen,
  MotionValue,
  ValueAnimationOptions,
  ValueAnimationTransition,
} from "../kernel"

import type { IProjectionNode } from "./node/types"

export { clamp, noop, SubscriptionManager, progress, circOut, addUniqueItem, removeItem } from "../kernel/utils"
export type { ValueAnimationOptions }
export type Axis = { min: number; max: number }
export type Point = { x: number; y: number }
export type AxisDelta = { translate: number; scale: number; origin: number; originPoint: number }
export type Delta = { x: AxisDelta; y: AxisDelta }
export type Box = { x: Axis; y: Axis }
export type BoundingBox = { top: number; left: number; bottom: number; right: number }
export type ResolvedValues = Record<string, string | number>
export type AnyResolvedKeyframe = string | number
export type EasingFunction = (progress: number) => number
export type TransformPoint = (point: Point) => Point
export type TransformProperties = ResolvedValues
export type NativeProjectionStyle = ViewStyle & TextStyle
export type MotionStyle = NativeProjectionStyle
export type JSAnimation<T = number> = AnimationPlaybackControlsWithThen & { readonly valueType?: T }
export type PathInterpolator = (progress: number) => Point & { rotate?: number }
export type MotionPath = { interpolateProjection: (delta: Delta) => PathInterpolator | undefined }
export type Transition = ValueAnimationTransition<number> & {
  [key: string]: unknown
  default?: Transition
  layout?: Transition
  reduceMotion?: boolean
  path?: MotionPath
}
export type ValueTransition = Omit<ValueAnimationOptions<number>, "keyframes"> & { reduceMotion?: boolean }
export type VisualElement = {
  readonly props: { style?: MotionStyle }
  current: NativeProjectionInstance | null
  latestValues: ResolvedValues
  projection?: IProjectionNode
  shouldReduceMotion?: boolean
  getProps: () => {
    onBeforeLayoutMeasure?: (layout: Box) => void
    onLayoutAnimationStart?: () => void
    onLayoutAnimationComplete?: () => void
    layoutDependency?: unknown
    style?: MotionStyle
  }
  getDefaultTransition: () => Transition | undefined
  getTransformPagePoint: () => TransformPoint | undefined
  getValue: (name: string, fallback?: unknown) => MotionValue<unknown> | undefined
  mount: (instance: NativeProjectionInstance) => void
  notify: (event: string, ...args: unknown[]) => void
  render: () => void
  scheduleRender: (notifyAll?: boolean) => void
  setStaticValue: (name: string, value: unknown) => void
}
// Private adapters retain actual native refs/records. They are never exposed as the component ref.
export interface NativeProjectionInstance {
  readonly isConnected: boolean
  readonly isCurrent: () => boolean
  windowWidth: () => number
  shouldSkipAnimations?: () => boolean
  measureNative: (removeTransform: boolean) => { measuredBox: Box; layoutBox: Box }
  measureScroll: () => Point
  isScrollRoot: () => boolean
  applyNativeProjection: (node: IProjectionNode, output: NativeProjectionStyle, authored?: MotionStyle) => void
}
