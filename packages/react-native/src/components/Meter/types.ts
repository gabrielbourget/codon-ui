import type { ReactElement, RefAttributes } from "react"
import type { StyleProp, View, ViewProps, ViewStyle } from "react-native"

import type { TNativeRangeProps } from "../RangeIndicator/types"

export type TNativeMeterRef = View
export type TNativeMeterRenderState = Readonly<{
  percentage: number
  valueText: string
}>
export type TNativeMeterStyleState = TNativeMeterRenderState & { defaultStyle: ViewStyle }
export type TNativeMeterProps = TNativeRangeProps & {
  isIndeterminate?: never
  render?: (props: ViewProps & RefAttributes<View>, state: TNativeMeterRenderState) => ReactElement
  style?: StyleProp<ViewStyle> | ((state: TNativeMeterStyleState) => StyleProp<ViewStyle>)
}
