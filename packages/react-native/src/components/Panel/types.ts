import type { ReactNode, RefObject } from "react"
import type { ColorValue, StyleProp, TextInput, TextStyle, View, ViewStyle } from "react-native"

import type { TCornerGeometry } from "../../tokens/geometry"
import type { TNativeDisplayDimension } from "../displayDimensions"

export const PANEL_POSITION__LEFT = "left"
export const PANEL_POSITION__RIGHT = "right"
export const AVAILABLE_PANEL_POSITIONS = [PANEL_POSITION__LEFT, PANEL_POSITION__RIGHT] as const
export type TNativePanelPosition = (typeof AVAILABLE_PANEL_POSITIONS)[number]
type TName =
  | { accessibilityLabel: string; "aria-label"?: string }
  | { accessibilityLabel?: string; "aria-label": string }
export type TNativePanelProps = TName & {
  testID?: string
  "data-testid"?: string
  children?: ReactNode
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  isDismissable?: boolean
  isKeyboardDismissDisabled?: boolean
  initialFocusRef?: RefObject<View | TextInput | null>
  restoreFocusRef?: RefObject<View | TextInput | null>
  height?: TNativeDisplayDimension
  width?: TNativeDisplayDimension
  horizontalGap?: number
  position?: TNativePanelPosition
  panelGeometry?: TCornerGeometry
  backgroundColor?: ColorValue
  raised?: boolean
  overlayBlur?: boolean
  customStyles?: StyleProp<TextStyle>
  style?: StyleProp<TextStyle>
  customOverlayStyles?: StyleProp<ViewStyle>
}
