import type { ReactNode, RefObject } from "react"
import type { ColorValue, ScrollView, StyleProp, TextInput, TextStyle, View, ViewProps, ViewStyle } from "react-native"
import type { PathProps } from "react-native-svg"

import type { TNativeFloatingOutsideInteraction } from "../../overlays/floating/interaction"
import type { TNativeFloatingMeasurable } from "../../overlays/floating/measurement"
import type { TNativeFloatingPlacement } from "../../overlays/floating/placement"
import type { TThemingOrderCode } from "../../tokens/theme-order"
import type { TNativeDisplayDimension } from "../displayDimensions"

export type TNativeClickPopoverRef = View
export type TNativeClickPopoverRootStyle = TextStyle
export type TNativeClickPopoverArrowStyle = ViewStyle &
  Pick<
    PathProps,
    | "fill"
    | "fillOpacity"
    | "fillRule"
    | "stroke"
    | "strokeWidth"
    | "strokeOpacity"
    | "strokeLinecap"
    | "strokeLinejoin"
    | "strokeMiterlimit"
    | "strokeDasharray"
    | "strokeDashoffset"
  > & { color?: ColorValue }
export type { TNativeFloatingOutsideInteraction } from "../../overlays/floating/interaction"
export type TNativeClickPopoverProps = Omit<
  ViewProps,
  "children" | "style" | "role" | "accessibilityRole" | "accessible" | "onAccessibilityEscape"
> & {
  children?: ReactNode
  isOpen?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  triggerRef?: RefObject<TNativeFloatingMeasurable | null>
  boundaryRef?: RefObject<TNativeFloatingMeasurable | null>
  scrollRef?: RefObject<ScrollView | null>
  initialFocusRef?: RefObject<View | TextInput | null>
  restoreFocusRef?: RefObject<View | TextInput | null>
  placement?: TNativeFloatingPlacement
  direction?: "ltr" | "rtl"
  offset?: number
  crossOffset?: number
  containerPadding?: number
  shouldFlip?: boolean
  maxHeight?: number
  arrowBoundaryOffset?: number
  shouldUpdatePosition?: boolean
  isNonModal?: boolean
  isKeyboardDismissDisabled?: boolean
  shouldCloseOnInteractOutside?: (interaction: TNativeFloatingOutsideInteraction) => boolean
  isEntering?: boolean
  isExiting?: boolean
  trigger?: string
  childIsDialog?: boolean
  showOverlayArrow?: boolean
  raised?: boolean
  geometry?: "rounded" | "orthogonal"
  color?: ColorValue
  order?: TThemingOrderCode
  width?: TNativeDisplayDimension
  height?: TNativeDisplayDimension
  customStyles?: StyleProp<TNativeClickPopoverRootStyle>
  style?: StyleProp<TNativeClickPopoverRootStyle>
  customOverlayArrowStyles?: StyleProp<TNativeClickPopoverArrowStyle>
  customDialogStyles?: StyleProp<TextStyle>
  "data-testid"?: string
  "aria-label"?: string
}
