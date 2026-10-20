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

import type { TNativeSlotProps } from "../../collection/context"
import type { TNativeFocusViewProps, TNativeInteractionEvent, TNativePressEvent } from "../../input/types"
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
  | "onPress"
  | "onPressIn"
  | "onPressOut"
  | "onFocus"
  | "onBlur"
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
> &
  Pick<TNativeFocusViewProps, "onFocus" | "onBlur" | "onKeyDown" | "onKeyUp"> & {
    slot?: TNativeSlotProps["slot"]
    onPress?: (event: TNativePressEvent) => void
    onPressIn?: (event: TNativeInteractionEvent) => void
    onPressOut?: (event: TNativeInteractionEvent) => void
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
    onPressStart?: (event: TNativePressEvent) => void
    onPressEnd?: (event: TNativePressEvent) => void
    onPressUp?: (event: TNativePressEvent) => void
    onPressChange?: (pressed: boolean) => void
    onFocusChange?: (focused: boolean) => void
    onHoverStart?: NonNullable<PressableProps["onHoverIn"]>
    onHoverEnd?: NonNullable<PressableProps["onHoverOut"]>
    onHoverChange?: (hovered: boolean) => void
  }
