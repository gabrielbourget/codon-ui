import type { ReactNode } from "react"
import type { ColorValue, PressableProps, StyleProp, TextStyle, View, ViewProps, ViewStyle } from "react-native"

import type { TCornerGeometry } from "../../tokens/geometry"
import type { TNativeDisplayDimension } from "../displayDimensions"

export const AVAILABLE_NATIVE_TAG_EASINGS = ["linear", "ease", "ease-in", "ease-out", "ease-in-out"] as const
export type TNativeTagEasing = (typeof AVAILABLE_NATIVE_TAG_EASINGS)[number]
export type TNativeTagDuration = number | `${number}ms` | `${number}s`
export type TNativeTagTransition =
  | TNativeTagDuration
  | Readonly<{
      duration?: TNativeTagDuration
      delay?: TNativeTagDuration
      easing?: TNativeTagEasing
    }>
export type TNativeTagBorder =
  | "none"
  | Readonly<{
      borderWidth?: number
      borderColor?: ColorValue
      borderStyle?: ViewStyle["borderStyle"]
    }>
export type TNativeTagOutline =
  | "none"
  | Readonly<{
      outlineWidth?: number
      outlineColor?: ColorValue
      outlineStyle?: ViewStyle["outlineStyle"]
    }>
export type TNativeTagRef = View
export type TNativeTagRootStyle = TextStyle
export type TNativeTagRenderState = Readonly<{
  pressable: boolean
  isPressed: boolean
  isPressing: boolean
  isHovered: boolean
  isFocused: boolean
  isDisabled: boolean
  foregroundColor: ColorValue
}>
export type TNativeTagStyleState = TNativeTagRenderState & { defaultStyle: TNativeTagRootStyle }
type TNativeTagCommonProps = Omit<
  ViewProps,
  | "children"
  | "style"
  | "onPress"
  | "disabled"
  | "id"
  | "role"
  | "accessibilityRole"
  | "accessibilityState"
  | "aria-label"
  | "aria-disabled"
  | "aria-checked"
  | "aria-pressed"
  | "aria-selected"
> & {
  children?: ReactNode
  id?: string | number
  width?: TNativeDisplayDimension
  height?: TNativeDisplayDimension
  geometry?: TCornerGeometry
  raised?: boolean
  raisedOnHover?: boolean
  hoverCursor?: ViewStyle["cursor"]
  backgroundColorTransition?: TNativeTagTransition
  focusOutline?: TNativeTagOutline
  outlineOffset?: number
  customStyles?: StyleProp<TNativeTagRootStyle>
  style?: StyleProp<TNativeTagRootStyle> | ((state: TNativeTagStyleState) => StyleProp<TNativeTagRootStyle>)
  "data-testid"?: string
  "aria-label"?: string
  onHoverIn?: PressableProps["onHoverIn"]
  onHoverOut?: PressableProps["onHoverOut"]
}
export type TNativeStaticTagProps = TNativeTagCommonProps & {
  pressable?: false
  color?: ColorValue
  border?: TNativeTagBorder
  role?: ViewProps["role"]
  accessibilityRole?: ViewProps["accessibilityRole"]
  accessibilityState?: ViewProps["accessibilityState"]
  "aria-checked"?: ViewProps["aria-checked"]
  "aria-selected"?: ViewProps["aria-selected"]
  "aria-disabled"?: ViewProps["aria-disabled"]
  isPressed?: never
  isDisabled?: never
  onPress?: never
  onPressIn?: never
  onPressOut?: never
  onLongPress?: never
  "aria-pressed"?: never
  activeColor?: never
  inactiveColor?: never
  activeBorder?: never
  inactiveBorder?: never
}
export type TNativePressableTagProps = TNativeTagCommonProps &
  Omit<
    PressableProps,
    keyof TNativeTagCommonProps | "onPress" | "disabled" | "role" | "accessibilityRole" | "accessibilityState"
  > & {
    pressable: true
    isPressed: boolean
    isDisabled?: boolean
    onPress: (id?: string | number) => void
    activeColor?: ColorValue
    inactiveColor?: ColorValue
    activeBorder?: TNativeTagBorder
    inactiveBorder?: TNativeTagBorder
    "aria-pressed"?: boolean | "true" | "false" | "mixed"
    "aria-checked"?: never
    "aria-selected"?: never
    "aria-disabled"?: never
    accessibilityState?: Omit<NonNullable<ViewProps["accessibilityState"]>, "disabled" | "checked">
    color?: never
    border?: never
    role?: never
    accessibilityRole?: never
  }
export type TNativeTagProps = TNativeStaticTagProps | TNativePressableTagProps
