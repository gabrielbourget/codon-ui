import type { ReactNode } from "react"
import type {
  AccessibilityState,
  ColorValue,
  PressableProps,
  StyleProp,
  TextStyle,
  View,
  ViewStyle,
} from "react-native"

import type { TCornerGeometry } from "../../tokens/geometry"
import type { TThemingOrderCode } from "../../tokens/theme-order"

export const AVAILABLE_NATIVE_BUTTON_COLOR_MODES = ["fill", "outline"] as const
export type TNativeButtonColorMode = (typeof AVAILABLE_NATIVE_BUTTON_COLOR_MODES)[number]
export type TNativeButtonRootStyle = TextStyle
export type TNativeButtonRef = View
export type TNativeButtonRenderState = Readonly<{
  isPressed: boolean
  isHovered: boolean
  isFocused: boolean
  isDisabled: boolean
  isPending: boolean
  foregroundColor: ColorValue
}>
export type TNativeButtonStyleState = TNativeButtonRenderState & { defaultStyle: TNativeButtonRootStyle }
export type TNativeButtonChildrenState = TNativeButtonRenderState & { defaultChildren: undefined }

export type TNativeButtonProps = Omit<
  PressableProps,
  | "children"
  | "style"
  | "disabled"
  | "role"
  | "accessibilityRole"
  | "accessible"
  | "accessibilityState"
  | "aria-disabled"
  | "aria-busy"
  | "aria-label"
> & {
  children?: ReactNode | ((state: TNativeButtonChildrenState) => ReactNode)
  style?: StyleProp<TNativeButtonRootStyle> | ((state: TNativeButtonStyleState) => StyleProp<TNativeButtonRootStyle>)
  customStyles?: StyleProp<TNativeButtonRootStyle>
  color?: ColorValue
  hoverColor?: ColorValue
  colorMode?: TNativeButtonColorMode
  geometry?: TCornerGeometry
  order?: TThemingOrderCode
  width?: ViewStyle["width"]
  height?: ViewStyle["height"]
  transparent?: boolean
  raised?: boolean
  raisedOnHover?: boolean
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  isDisabled?: boolean
  isPending?: boolean
  accessibilityState?: Omit<AccessibilityState, "disabled" | "busy">
  "data-testid"?: string
  "aria-label"?: string
  onPressStart?: NonNullable<PressableProps["onPressIn"]>
  onPressEnd?: NonNullable<PressableProps["onPressOut"]>
  onPressChange?: (pressed: boolean) => void
  onFocusChange?: (focused: boolean) => void
  onHoverStart?: NonNullable<PressableProps["onHoverIn"]>
  onHoverEnd?: NonNullable<PressableProps["onHoverOut"]>
  onHoverChange?: (hovered: boolean) => void
}
