import type { ColorValue, StyleProp, ViewProps, ViewStyle } from "react-native"

import type { TCornerGeometry } from "../../tokens/geometry"
import type { TThemingOrderCode } from "../../tokens/theme-order"

export const NATIVE_RANGE_ORIENTATIONS = ["horizontal", "vertical"] as const
export const NATIVE_RANGE_DIRECTIONS = ["left", "right", "up", "down"] as const
export type TNativeRangeOrientation = (typeof NATIVE_RANGE_ORIENTATIONS)[number]
export type TNativeRangeDirection = (typeof NATIVE_RANGE_DIRECTIONS)[number]

type TNativeRangeLabel =
  | { accessibilityLabel: string; "aria-label"?: string }
  | { accessibilityLabel?: string; "aria-label": string }

export type TNativeRangeProps = Omit<
  ViewProps,
  | "children"
  | "style"
  | "accessible"
  | "role"
  | "accessibilityRole"
  | "accessibilityLabel"
  | "aria-label"
  | "accessibilityLabelledBy"
  | "aria-labelledby"
  | "accessibilityValue"
  | "aria-valuemin"
  | "aria-valuemax"
  | "aria-valuenow"
  | "aria-valuetext"
> &
  TNativeRangeLabel & {
    value: number
    minValue?: number
    maxValue?: number
    valueLabel?: string
    locale?: string
    formatOptions?: Intl.NumberFormatOptions
    height?: ViewStyle["height"]
    width?: ViewStyle["width"]
    orientation?: TNativeRangeOrientation
    direction?: TNativeRangeDirection
    barColor?: ColorValue
    trackColor?: ColorValue
    barGeometry?: TCornerGeometry
    trackGeometry?: TCornerGeometry
    order?: TThemingOrderCode
    raised?: boolean
    customStyles?: StyleProp<ViewStyle>
    customTrackStyles?: StyleProp<ViewStyle>
    customBarStyles?: StyleProp<ViewStyle>
    "data-testid"?: string
    "aria-valuemin"?: never
    "aria-valuemax"?: never
    "aria-valuenow"?: never
    "aria-valuetext"?: never
    "aria-labelledby"?: never
  }
