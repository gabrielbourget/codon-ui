import type { ReactNode, RefObject } from "react"
import type { ColorValue, DimensionValue, StyleProp, TextStyle, View, ViewStyle } from "react-native"

import type { TThemingOrderCode } from "../../tokens/theme-order"

type TName =
  | { accessibilityLabel: string; "aria-label"?: string }
  | { accessibilityLabel?: string; "aria-label": string }
export type TNativeModalRef = View
export type TNativeModalRootStyle = ViewStyle & Pick<TextStyle, "color">
export type TNativeModalProps = TName & {
  isOpen?: boolean
  defaultOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  isDismissable?: boolean
  isKeyboardDismissDisabled?: boolean
  children?: ReactNode
  titleText?: ReactNode
  closeButtonText?: ReactNode
  closeLabel?: string
  color?: ColorValue
  order?: TThemingOrderCode
  geometry?: "rounded" | "orthogonal"
  raised?: boolean
  overlayBlur?: false
  width?: DimensionValue
  height?: DimensionValue
  isScrollable?: boolean
  customStyles?: StyleProp<TNativeModalRootStyle>
  style?: StyleProp<TNativeModalRootStyle>
  customOverlayStyles?: StyleProp<ViewStyle>
  customDialogStyles?: StyleProp<ViewStyle>
  initialFocusRef?: RefObject<View | null>
  restoreFocusRef?: RefObject<View | null>
  testID?: string
  "data-testid"?: string
}
