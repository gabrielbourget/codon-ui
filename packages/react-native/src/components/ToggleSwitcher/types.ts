import type { ReactNode } from "react"
import type {
  ColorValue,
  NativeSyntheticEvent,
  PointerEvent,
  StyleProp,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from "react-native"

import type { TCornerGeometry } from "../../tokens/geometry"
import type { TThemingOrderCode } from "../../tokens/theme-order"
import type { TNativeDisplayDimension } from "../displayDimensions"

import type { TNativeSwitcherOwnedRootProps, TNativeSwitcherUnsupportedRootProps } from "./rootBoundary"
import type { TNativeSwitcherRootKeyCallbacks } from "./rootKeys"

export const AVAILABLE_TOGGLE_SWITCHER_FONT_WEIGHTS = [
  "lighter",
  "light",
  "regular",
  "normal",
  "medium",
  "semibold",
  "bold",
  "extrabold",
  "bolder",
] as const
export type TNativeToggleSwitcherFontWeight = (typeof AVAILABLE_TOGGLE_SWITCHER_FONT_WEIGHTS)[number]
export type TNativeToggleSwitcherItem = Readonly<{
  id: string
  label: ReactNode
  disabled?: boolean
  accessibilityLabel?: string
}>
export type TNativeToggleSwitcherRootStyle = ViewStyle & { color?: ColorValue }
export type TNativeToggleSwitcherOptionStyle = TextStyle
export type TNativeToggleSwitcherRef = View
export type TNativeToggleSwitcherRenderState = Readonly<{
  selectedKey: string
  isDisabled: boolean
  isReadOnly: boolean
}>
export type TNativeToggleSwitcherStyleState = TNativeToggleSwitcherRenderState & {
  defaultStyle: TNativeToggleSwitcherRootStyle
}
type TNativeSwitcherClickEvent = PointerEvent | NativeSyntheticEvent<Record<never, never>>
type TNativeSwitcherStockCallbacks = {
  onFocusCapture?: ViewProps["onFocus"]
  onBlurCapture?: ViewProps["onBlur"]
  // Stock View accepts these callbacks, omitted from RN's public ViewProps.
  onClick?: (event: TNativeSwitcherClickEvent) => void
  onClickCapture?: (event: TNativeSwitcherClickEvent) => void
  onPointerOver?: ViewProps["onPointerEnter"]
  onPointerOverCapture?: ViewProps["onPointerEnter"]
  onPointerOut?: ViewProps["onPointerLeave"]
  onPointerOutCapture?: ViewProps["onPointerLeave"]
  onTouchStartCapture?: ViewProps["onTouchStart"]
  onTouchMoveCapture?: ViewProps["onTouchMove"]
  onTouchCancelCapture?: ViewProps["onTouchCancel"]
  // Capture lifecycle requires the configured stock pointer stream/registration.
  onGotPointerCapture?: ViewProps["onPointerDown"]
  onGotPointerCaptureCapture?: ViewProps["onPointerDown"]
  onLostPointerCapture?: ViewProps["onPointerDown"]
  onLostPointerCaptureCapture?: ViewProps["onPointerDown"]
}
export type TNativeToggleSwitcherProps = Omit<
  ViewProps,
  | "children"
  | "style"
  | "accessible"
  | "role"
  | "accessibilityRole"
  | "accessibilityState"
  | "aria-disabled"
  | "aria-checked"
  | "aria-selected"
> &
  TNativeSwitcherStockCallbacks &
  TNativeSwitcherRootKeyCallbacks &
  TNativeSwitcherUnsupportedRootProps &
  TNativeSwitcherOwnedRootProps & {
    "aria-describedby"?: string
    "aria-details"?: string
    items: readonly TNativeToggleSwitcherItem[]
    selectedKey?: string
    defaultSelectedKey?: string
    onSelectionChange?: (key: string) => void
    isDisabled?: boolean
    isReadOnly?: boolean
    height?: TNativeDisplayDimension
    /** A bounded width shares space equally; an auto/unbounded root uses natural option widths. */
    width?: TNativeDisplayDimension
    color?: ColorValue
    geometry?: TCornerGeometry
    order?: TThemingOrderCode
    raised?: boolean
    enableFocusStyle?: boolean
    offsetFocusRing?: boolean
    uppercase?: boolean
    fontSize?: number
    optionFontWeight?: TNativeToggleSwitcherFontWeight
    selectedOptionFontWeight?: TNativeToggleSwitcherFontWeight
    customStyles?: StyleProp<TNativeToggleSwitcherRootStyle>
    customOptionStyles?: StyleProp<TNativeToggleSwitcherOptionStyle>
    customSelectedOptionStyles?: StyleProp<TNativeToggleSwitcherOptionStyle>
    style?:
      | StyleProp<TNativeToggleSwitcherRootStyle>
      | ((state: TNativeToggleSwitcherStyleState) => StyleProp<TNativeToggleSwitcherRootStyle>)
    "data-testid"?: string
  }
