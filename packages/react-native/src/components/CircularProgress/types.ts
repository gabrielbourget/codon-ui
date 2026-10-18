import type { ReactNode } from "react"
import type { ColorValue, StyleProp, View, ViewProps, ViewStyle } from "react-native"
import type { CircleProps, PathProps, SvgProps, TextProps } from "react-native-svg"

import type { TThemingOrderCode } from "../../tokens/theme-order"
import type { TNativeDisplayDimension } from "../displayDimensions"

export const AVAILABLE_NATIVE_STROKE_LINECAPS = ["butt", "round", "square"] as const
export type TNativeStrokeLinecap = (typeof AVAILABLE_NATIVE_STROKE_LINECAPS)[number]
export type TNativeCircularProgressRef = View
export type TNativeCircularProgressRootStyle = ViewStyle & { color?: ColorValue }
type TPaintFields =
  | "color"
  | "fill"
  | "fillOpacity"
  | "fillRule"
  | "stroke"
  | "strokeWidth"
  | "strokeOpacity"
  | "strokeLinecap"
  | "strokeLinejoin"
  | "strokeMiterlimit"
  | "strokeDasharray"
  | "strokeDashoffset"
  | "vectorEffect"
export type TNativeCircularProgressSVGStyle = Omit<ViewStyle, "width" | "height"> &
  Pick<SvgProps, TPaintFields> & { width?: TNativeDisplayDimension; height?: TNativeDisplayDimension }
export type TNativeCircularProgressPathStyle = ViewStyle & Pick<PathProps, TPaintFields>
export type TNativeCircularProgressBackgroundStyle = ViewStyle & Pick<CircleProps, TPaintFields | "cx" | "cy" | "r">
export type TNativeCircularProgressTextStyle = ViewStyle &
  Pick<
    TextProps,
    | TPaintFields
    | "fontFamily"
    | "fontSize"
    | "fontWeight"
    | "fontStyle"
    | "fontVariant"
    | "fontStretch"
    | "letterSpacing"
    | "wordSpacing"
    | "textAnchor"
    | "alignmentBaseline"
    | "baselineShift"
    | "x"
    | "y"
    | "dx"
    | "dy"
    | "rotate"
    | "textLength"
    | "lengthAdjust"
  >
export type TNativeCircularProgressRenderState = Readonly<{
  percentage: number | undefined
  valueText: ReactNode
  isIndeterminate: boolean
}>
export type TNativeCircularProgressStyleState = TNativeCircularProgressRenderState & {
  defaultStyle: TNativeCircularProgressRootStyle
}
export type TNativeCircularProgressProps = Omit<
  ViewProps,
  | "children"
  | "style"
  | "accessible"
  | "role"
  | "accessibilityRole"
  | "accessibilityValue"
  | "aria-valuemin"
  | "aria-valuemax"
  | "aria-valuenow"
  | "aria-valuetext"
> & {
  value: number
  minValue?: number
  maxValue?: number
  valueLabel?: ReactNode
  isIndeterminate?: boolean
  locale?: string
  formatOptions?: Intl.NumberFormatOptions
  height?: TNativeDisplayDimension
  width?: TNativeDisplayDimension
  backgroundColor?: ColorValue
  pathColor?: ColorValue
  trackColor?: ColorValue
  order?: TThemingOrderCode
  circleRatio?: number
  backgroundPadding?: number
  strokeWidth?: number
  strokeLineCap?: TNativeStrokeLinecap
  counterClockwise?: boolean
  text?: string
  customStyles?: StyleProp<TNativeCircularProgressRootStyle>
  style?:
    | StyleProp<TNativeCircularProgressRootStyle>
    | ((state: TNativeCircularProgressStyleState) => StyleProp<TNativeCircularProgressRootStyle>)
  customSVGStyles?: StyleProp<TNativeCircularProgressSVGStyle>
  customTrackStyles?: StyleProp<TNativeCircularProgressPathStyle>
  customPathStyles?: StyleProp<TNativeCircularProgressPathStyle>
  customTextStyles?: StyleProp<TNativeCircularProgressTextStyle>
  customBackgroundStyles?: StyleProp<TNativeCircularProgressBackgroundStyle>
  children?: never
  "data-testid"?: string
  "aria-describedby"?: never
  "aria-details"?: never
  "aria-valuemin"?: never
  "aria-valuemax"?: never
  "aria-valuenow"?: never
  "aria-valuetext"?: never
}
