// Native mapping of Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.
import type { ComponentProps } from "react"
import type { StyleProp, TextStyle, ViewStyle } from "react-native"

import type { NativeFocusHost } from "../../input/NativeFocusView"

export const NATIVE_MOTION_TRANSFORM_ORDER = [
  "transformPerspective",
  "x",
  "y",
  "z",
  "translateX",
  "translateY",
  "translateZ",
  "scale",
  "scaleX",
  "scaleY",
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ",
  "skew",
  "skewX",
  "skewY",
] as const
export type TNativeMotionTransformKey = (typeof NATIVE_MOTION_TRANSFORM_ORDER)[number]
export type TNativeMotionTranslation = number | `${number}%`
export type TNativeMotionAngle = number | `${number}deg` | `${number}rad`
export type TNativeMotionTransformValues = Partial<{
  transformPerspective: number
  x: TNativeMotionTranslation
  y: TNativeMotionTranslation
  z: number
  translateX: TNativeMotionTranslation
  translateY: TNativeMotionTranslation
  translateZ: number
  scale: number
  scaleX: number
  scaleY: number
  rotate: TNativeMotionAngle
  rotateX: TNativeMotionAngle
  rotateY: TNativeMotionAngle
  rotateZ: TNativeMotionAngle
  skew: TNativeMotionAngle
  skewX: TNativeMotionAngle
  skewY: TNativeMotionAngle
  pathRotation: TNativeMotionAngle
}>
export type TNativeMotionOriginValues = Partial<{
  originX: number | `${number}%`
  originY: number | `${number}%`
  originZ: number
}>
export type TNativeMotionVisualValues = TextStyle & TNativeMotionTransformValues & TNativeMotionOriginValues
export type TNativeMotionTransform = Exclude<ViewStyle["transform"], string | undefined>
export type TNativeMotionTransformTemplate = (
  values: Readonly<TNativeMotionTransformValues>,
  generated: TNativeMotionTransform,
) => TNativeMotionTransform

export type TNativeMotionValueBinding<T> = {
  get: () => T
  on: (event: "change", callback: (latest: T) => void) => () => void
}
export type TNativeMotionVisualBindings = {
  readonly [Key in keyof TNativeMotionVisualValues]?: TNativeMotionValueBinding<TNativeMotionVisualValues[Key]>
}
export type TNativeMotionVisualHostProps = Omit<ComponentProps<typeof NativeFocusHost>, "style"> & {
  computedStyles?: StyleProp<TextStyle>
  customStyles?: StyleProp<TextStyle>
  style?: StyleProp<TextStyle>
  bindings?: TNativeMotionVisualBindings
  transformTemplate?: TNativeMotionTransformTemplate
  onUpdate?: (latest: Readonly<TNativeMotionVisualValues>) => void
}
