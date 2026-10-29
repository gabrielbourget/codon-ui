import type { ReactElement, ReactNode, RefAttributes } from "react"
import type { ColorValue, PressableProps, StyleProp, View, ViewStyle } from "react-native"

import type { TCornerGeometry } from "../../tokens/geometry"
import type { TThemingOrderCode } from "../../tokens/theme-order"
import type { TNativeSelectionHostProps, TNativeSelectionState } from "../selection"

export type TNativeSwitchRef = View
export type TNativeSwitchRenderState = TNativeSelectionState
export type TNativeSwitchStyleState = TNativeSwitchRenderState & { defaultStyle: ViewStyle }
export type TNativeSwitchProps = TNativeSelectionHostProps & {
  render?: (props: PressableProps & RefAttributes<View>, state: TNativeSwitchRenderState) => ReactElement
  isSelected?: boolean
  defaultSelected?: boolean
  onChange?: (selected: boolean) => void
  isDisabled?: boolean
  isReadOnly?: boolean
  width?: number
  height?: number
  trackColor?: ColorValue
  indicatorColor?: ColorValue
  invertColorsOnToggle?: boolean
  showBorder?: boolean
  geometry?: TCornerGeometry
  order?: TThemingOrderCode
  raised?: boolean
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  iconOn?: ReactNode
  iconOff?: ReactNode
  showOnOffIcons?: boolean
  leftContent?: ReactNode
  rightContent?: ReactNode
  customStyles?: StyleProp<ViewStyle>
  customTrackStyles?: StyleProp<ViewStyle>
  customIndicatorStyles?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle> | ((state: TNativeSwitchStyleState) => StyleProp<ViewStyle>)
}
