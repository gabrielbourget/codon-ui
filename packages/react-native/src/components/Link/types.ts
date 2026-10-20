import type { ReactNode } from "react"
import type { ColorValue, PressableProps, StyleProp, TextStyle, View } from "react-native"

import type { TNativeFocusViewProps, TNativeInteractionEvent, TNativePressEvent } from "../../input/types"
import type { TThemingOrderCode } from "../../tokens/theme-order"

export type TNativeLinkRef = View
export type TNativeLinkRootStyle = TextStyle
export type TNativeLinkRenderState = Readonly<{
  isPressed: boolean
  isHovered: boolean
  isFocused: boolean
  isDisabled: boolean
  isVisited: boolean
  foregroundColor: ColorValue
}>
export type TNativeLinkStyleState = TNativeLinkRenderState & { defaultStyle: TNativeLinkRootStyle }
export type TNativeLinkProps = Omit<
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
> &
  Pick<TNativeFocusViewProps, "onFocus" | "onBlur" | "onKeyDown" | "onKeyUp"> & {
    onPress?: (event: TNativePressEvent) => void
    onPressIn?: (event: TNativeInteractionEvent) => void
    onPressOut?: (event: TNativeInteractionEvent) => void
    href: string
    children?: ReactNode
    color?: ColorValue
    visitedColor?: ColorValue
    order?: TThemingOrderCode
    isVisited?: boolean
    isDisabled?: boolean
    textDecoration?: TextStyle["textDecorationLine"]
    enableFocusStyle?: boolean
    offsetFocusRing?: boolean
    customStyles?: StyleProp<TNativeLinkRootStyle>
    style?: StyleProp<TNativeLinkRootStyle> | ((state: TNativeLinkStyleState) => StyleProp<TNativeLinkRootStyle>)
    accessibilityState?: Omit<NonNullable<PressableProps["accessibilityState"]>, "disabled">
    ariaLabel?: string
    ariaLabelledBy?: string
    ariaDescribedBy?: string
    ariaDetails?: string
    "aria-describedby"?: string
    "aria-details"?: string
    labels?: { descriptionLabel?: string; detailsLabel?: string }
    "data-testid"?: string
    "aria-disabled"?: never
    onNavigationError?: (error: unknown, href: string) => void
  }
