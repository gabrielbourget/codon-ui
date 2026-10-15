import type { ReactNode } from "react"
import type { ColorValue, StyleProp, View, ViewStyle } from "react-native"

import type { TCornerGeometry } from "../../tokens/geometry"
import type { TThemingOrderCode } from "../../tokens/theme-order"
import type { TNativeSelectionHostProps, TNativeSelectionState } from "../selection"

export type TNativeCheckboxRef = View
export type TNativeCheckboxRenderState = TNativeSelectionState & Readonly<{ isIndeterminate: boolean }>
export type TNativeCheckboxStyleState = TNativeCheckboxRenderState & { defaultStyle: ViewStyle }
export type TNativeCheckboxChildrenState = TNativeCheckboxRenderState & { defaultChildren: undefined }
export type TNativeCheckboxProps = TNativeSelectionHostProps & {
  children?: ReactNode | ((state: TNativeCheckboxChildrenState) => ReactNode)
  value?: string
  isSelected?: boolean
  defaultSelected?: boolean
  onChange?: (selected: boolean) => void
  isDisabled?: boolean
  isReadOnly?: boolean
  isIndeterminate?: boolean
  showIcon?: boolean
  width?: number
  height?: number
  geometry?: TCornerGeometry
  color?: ColorValue
  order?: TThemingOrderCode
  raised?: boolean
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  customStyles?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle> | ((state: TNativeCheckboxStyleState) => StyleProp<ViewStyle>)
}
