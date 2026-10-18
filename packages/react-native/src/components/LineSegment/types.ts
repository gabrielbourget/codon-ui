import type { ColorValue, StyleProp, View, ViewProps, ViewStyle } from "react-native"

import type { TNativeDisplayDimension } from "../displayDimensions"

export const LINE_SEGMENT_DIRECTION__HORIZONTAL = "horizontal"
export const LINE_SEGMENT_DIRECTION__VERTICAL = "vertical"
export const AVAILABLE_LINE_SEGMENT_DIRECTIONS = [
  LINE_SEGMENT_DIRECTION__HORIZONTAL,
  LINE_SEGMENT_DIRECTION__VERTICAL,
] as const
export type TNativeLineSegmentDirection = (typeof AVAILABLE_LINE_SEGMENT_DIRECTIONS)[number]
export type TNativeLineSegmentRef = View
export type TNativeLineSegmentRenderState = Readonly<{ direction: TNativeLineSegmentDirection }>
export type TNativeLineSegmentStyleState = TNativeLineSegmentRenderState & { defaultStyle: ViewStyle }
export type TNativeLineSegmentProps = Omit<ViewProps, "children" | "style"> & {
  height?: TNativeDisplayDimension
  width?: TNativeDisplayDimension
  size?: TNativeDisplayDimension
  direction?: TNativeLineSegmentDirection
  color?: ColorValue
  customStyles?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle> | ((state: TNativeLineSegmentStyleState) => StyleProp<ViewStyle>)
  "data-testid"?: string
}
