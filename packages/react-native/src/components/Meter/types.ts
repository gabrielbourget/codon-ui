import type { StyleProp, View, ViewStyle } from "react-native"

import type { TNativeRangeProps } from "../RangeIndicator/types"

export type TNativeMeterRef = View
export type TNativeMeterRenderState = Readonly<{
  percentage: number
  valueText: string
}>
export type TNativeMeterStyleState = TNativeMeterRenderState & { defaultStyle: ViewStyle }
export type TNativeMeterProps = TNativeRangeProps & {
  isIndeterminate?: never
  style?: StyleProp<ViewStyle> | ((state: TNativeMeterStyleState) => StyleProp<ViewStyle>)
}
