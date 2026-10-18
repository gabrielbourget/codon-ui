import type { ColorValue, PressableProps, StyleProp, ImageStyle, TextStyle, View, ViewStyle } from "react-native"

import type { TCornerGeometry } from "../../tokens/geometry"
import type { TNativeDisplayDimension } from "../displayDimensions"
import type { TNativeTextProps } from "../Text/types"

export type TNativeAvatarRef = View
export type TNativeAvatarLabels = {
  placeholderFirstName: string
  placeholderLastName: string
}
export type TNativeAvatarRootStyle = ViewStyle & { color?: ColorValue }
export type TNativeAvatarRenderState = Readonly<{
  isInteractive: boolean
  isDisabled: boolean
  isPressed: boolean
  isHovered: boolean
  isFocused: boolean
  foregroundColor: ColorValue
}>
export type TNativeAvatarStyleState = TNativeAvatarRenderState & { defaultStyle: TNativeAvatarRootStyle }
export type TNativeAvatarTextProps = Omit<
  TNativeTextProps,
  "children" | "onPress" | "onLongPress" | "accessible" | "role" | "accessibilityRole" | "selectable"
>
export type TNativeAvatarProps = Omit<
  PressableProps,
  | "children"
  | "style"
  | "role"
  | "accessibilityRole"
  | "accessibilityState"
  | "aria-disabled"
  | "focusable"
  | "aria-label"
> & {
  size?: TNativeDisplayDimension | `${number}`
  color?: ColorValue
  foreground?: ColorValue
  background?: ColorValue
  imageURL?: string
  name1?: string
  name2?: string
  geometry?: TCornerGeometry
  raised?: boolean
  clickable?: boolean
  fallbackDelay?: number
  labels?: Partial<TNativeAvatarLabels>
  customStyles?: StyleProp<TNativeAvatarRootStyle>
  style?: StyleProp<TNativeAvatarRootStyle> | ((state: TNativeAvatarStyleState) => StyleProp<TNativeAvatarRootStyle>)
  customImageStyles?: StyleProp<ImageStyle>
  customFallbackStyles?: StyleProp<TNativeAvatarRootStyle>
  customTextStyles?: StyleProp<TextStyle>
  customTextProps?: TNativeAvatarTextProps
  accessibilityState?: Omit<NonNullable<PressableProps["accessibilityState"]>, "disabled">
  "aria-label"?: string
  "data-testid"?: string
}
