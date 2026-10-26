import type { ReactNode } from "react"
import type { ColorValue, StyleProp, TextStyle, View, ViewProps } from "react-native"

import type { TNativeCircularProgressRootStyle } from "../CircularProgress/types"
import type { TNativeDisplayDimension } from "../displayDimensions"

export type TNativeCounterRef = View
export type TNativeCounterProps = Omit<ViewProps, "style" | "children"> & {
  value: string | number
  maxValue?: string | number
  showMaxValue?: boolean
  showProgressIndicator?: boolean
  warningPercentageThreshold?: number
  errorOrDangerPercentageThreshold?: number
  children?: ReactNode
  height?: TNativeDisplayDimension
  width?: TNativeDisplayDimension
  color?: ColorValue
  customStyles?: StyleProp<TNativeCircularProgressRootStyle>
  style?: StyleProp<TNativeCircularProgressRootStyle>
  customTextStyles?: StyleProp<TextStyle>
  customProgressIndicatorStyles?: StyleProp<TNativeCircularProgressRootStyle>
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  ariaDetails?: string
  "aria-describedby"?: string
  "aria-details"?: string
  "data-testid"?: string
}
