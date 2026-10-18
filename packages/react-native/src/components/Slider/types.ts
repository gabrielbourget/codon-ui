import type { ColorValue, StyleProp, TextStyle, View, ViewProps, ViewStyle } from "react-native"

import type { TCornerGeometry } from "../../tokens/geometry"
import type { TThemingOrderCode } from "../../tokens/theme-order"
import type { TNativeDisplayDimension } from "../displayDimensions"

export const NATIVE_SLIDER_ORIENTATIONS = ["horizontal", "vertical"] as const
export const NATIVE_SLIDER_DIRECTIONS = ["ltr", "rtl"] as const
export type TNativeSliderOrientation = (typeof NATIVE_SLIDER_ORIENTATIONS)[number]
export type TNativeSliderDirection = (typeof NATIVE_SLIDER_DIRECTIONS)[number]
export type TNativeSliderRef = View
export type TNativeSliderValue = number | readonly number[]
export type TNativeSliderState = Readonly<{
  values: readonly number[]
  defaultValues: readonly number[]
  focusedThumb: number | undefined
  step: number
  pageSize: number
  orientation: TNativeSliderOrientation
  isDisabled: boolean
  getThumbValue: (index: number) => number
  setThumbValue: (index: number, value: number) => void
  setThumbPercent: (index: number, percent: number) => void
  isThumbDragging: (index: number) => boolean
  setThumbDragging: (index: number, dragging: boolean) => void
  setFocusedThumb: (index: number | undefined) => void
  getThumbPercent: (index: number) => number
  getValuePercent: (value: number) => number
  getThumbValueLabel: (index: number) => string
  getFormattedValue: (value: number) => string
  getThumbMinValue: (index: number) => number
  getThumbMaxValue: (index: number) => number
  getPercentValue: (percent: number) => number
  isThumbEditable: (index: number) => boolean
  setThumbEditable: (index: number, editable: boolean) => void
  incrementThumb: (index: number, stepSize?: number) => void
  decrementThumb: (index: number, stepSize?: number) => void
}>
export type TNativeSliderRenderState = Readonly<{
  orientation: TNativeSliderOrientation
  isDisabled: boolean
  state: TNativeSliderState
}>
export type TNativeSliderStyleState = TNativeSliderRenderState & { defaultStyle: ViewStyle }

type TSliderValueProps<T extends TNativeSliderValue> = {
  value?: T
  defaultValue?: T
  onChange?: (value: T extends number ? number : number[]) => void
  onChangeEnd?: (value: T extends number ? number : number[]) => void
}
type TNamedSlider =
  | { accessibilityLabel: string; "aria-label"?: string; label?: string }
  | { accessibilityLabel?: string; "aria-label": string; label?: string }
  | { accessibilityLabel?: string; "aria-label"?: string; label: string }
export type TNativeSliderProps<T extends TNativeSliderValue = TNativeSliderValue> = Omit<
  ViewProps,
  | "children"
  | "style"
  | "role"
  | "accessibilityRole"
  | "accessible"
  | "accessibilityLabel"
  | "aria-label"
  | "accessibilityValue"
  | "accessibilityState"
  | "accessibilityActions"
  | "onAccessibilityAction"
  | "aria-valuemin"
  | "aria-valuemax"
  | "aria-valuenow"
  | "aria-valuetext"
  | "aria-disabled"
> &
  TNamedSlider &
  TSliderValueProps<T> & {
    minValue?: number
    maxValue?: number
    step?: number
    isDisabled?: boolean
    orientation?: TNativeSliderOrientation
    direction?: TNativeSliderDirection
    locale?: string
    formatOptions?: Intl.NumberFormatOptions
    labelID?: string
    thumbAriaLabels?: readonly string[]
    thumbColor?: ColorValue
    trackColor?: ColorValue
    geometry?: TCornerGeometry
    order?: TThemingOrderCode
    raised?: boolean
    enableFocusStyle?: boolean
    offsetFocusRing?: boolean
    height?: TNativeDisplayDimension
    width?: TNativeDisplayDimension
    maxWidth?: TNativeDisplayDimension
    customStyles?: StyleProp<ViewStyle>
    customLabelStyles?: StyleProp<TextStyle>
    customOutputStyles?: StyleProp<TextStyle>
    customTrackStyles?: StyleProp<ViewStyle>
    customThumbStyles?: StyleProp<ViewStyle>
    customOutputFormatter?: (values: number[]) => string
    style?: StyleProp<ViewStyle> | ((state: TNativeSliderStyleState) => StyleProp<ViewStyle>)
    "data-testid"?: string
  }
