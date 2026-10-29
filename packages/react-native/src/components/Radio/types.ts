import type { ReactElement, ReactNode, RefAttributes } from "react"
import type { ColorValue, PressableProps, StyleProp, View, ViewStyle } from "react-native"

import type { TCornerGeometry } from "../../tokens/geometry"
import type { TThemingOrderCode } from "../../tokens/theme-order"
import type { TNativeSelectionHostProps, TNativeSelectionState } from "../selection"

export type TNativeRadioRef = View
export type TNativeRadioRenderState = TNativeSelectionState
export type TNativeRadioStyleState = TNativeRadioRenderState & { defaultStyle: ViewStyle }
export type TNativeRadioChildrenState = TNativeRadioRenderState & { defaultChildren: undefined }
type TNativeRadioLabel =
  | { accessibilityLabel: string; "aria-label"?: string }
  | { accessibilityLabel?: string; "aria-label": string }

export type TNativeRadioProps = Omit<TNativeSelectionHostProps, "accessibilityLabel" | "aria-label"> &
  TNativeRadioLabel & {
    render?: (props: PressableProps & RefAttributes<View>, state: TNativeRadioRenderState) => ReactElement
    children?: ReactNode | ((state: TNativeRadioChildrenState) => ReactNode)
    value: string
    isDisabled?: boolean
    width?: ViewStyle["width"]
    height?: ViewStyle["height"]
    geometry?: TCornerGeometry
    color?: ColorValue
    order?: TThemingOrderCode
    enableFocusStyle?: boolean
    offsetFocusRing?: boolean
    customStyles?: StyleProp<ViewStyle>
    style?: StyleProp<ViewStyle> | ((state: TNativeRadioStyleState) => StyleProp<ViewStyle>)
    customShapeStyles?: StyleProp<ViewStyle>
  }
