import type { ColorValue, StyleProp, View, ViewProps, ViewStyle } from "react-native"

import type { TNativeDisplayDimension } from "../displayDimensions"

export const INDICATOR_SHAPE__CIRCLE = "circle"
export const INDICATOR_SHAPE__ROUNDED = "rounded"
export const INDICATOR_SHAPE__SQUARE = "square"
export const AVAILABLE_INDICATOR_SHAPES = [
  INDICATOR_SHAPE__CIRCLE,
  INDICATOR_SHAPE__ROUNDED,
  INDICATOR_SHAPE__SQUARE,
] as const
export type TNativeIndicatorShape = (typeof AVAILABLE_INDICATOR_SHAPES)[number]
export type TNativeIndicatorRef = View
export type TNativeIndicatorRenderState = Readonly<{ isActive: boolean }>
export type TNativeIndicatorStyleState = TNativeIndicatorRenderState & { defaultStyle: ViewStyle }
export type TNativeIndicatorProps = Omit<ViewProps, "children" | "style"> & {
  isActive?: boolean
  size?: TNativeDisplayDimension
  color?: ColorValue
  inactiveColor?: ColorValue
  borderColor?: ColorValue
  borderWidth?: number
  shape?: TNativeIndicatorShape
  customStyles?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle> | ((state: TNativeIndicatorStyleState) => StyleProp<ViewStyle>)
  "data-testid"?: string
}
