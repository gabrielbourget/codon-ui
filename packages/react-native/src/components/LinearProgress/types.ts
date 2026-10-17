import type { StyleProp, View, ViewStyle } from "react-native"

import type { TNativeRangeProps } from "../RangeIndicator/types"

export type TNativeLinearProgressRef = View
export type TNativeLinearProgressRenderState = Readonly<{
  percentage: number | undefined
  valueText: string | undefined
  isIndeterminate: boolean
}>
export type TNativeLinearProgressStyleState = TNativeLinearProgressRenderState & { defaultStyle: ViewStyle }
export type TNativeLinearProgressProps = TNativeRangeProps & {
  isIndeterminate?: boolean
  style?: StyleProp<ViewStyle> | ((state: TNativeLinearProgressStyleState) => StyleProp<ViewStyle>)
}
