import type { ReactElement, ReactNode } from "react"
import type { StyleProp, TextInput, TextInputProps, TextStyle, ViewProps, ViewStyle } from "react-native"

import type { TCornerGeometry } from "../../tokens/geometry"
import type { TNativeButtonRootStyle } from "../Button/types"

export const NUMBER_INPUT_SIZE__SM = "small"
export const NUMBER_INPUT_SIZE__MD = "medium"
export const NUMBER_INPUT_SIZE__LG = "large"
export const AVAILABLE_NUMBER_INPUT_SIZES = [
  NUMBER_INPUT_SIZE__SM,
  NUMBER_INPUT_SIZE__MD,
  NUMBER_INPUT_SIZE__LG,
] as const
export type TNativeNumberInputSize = (typeof AVAILABLE_NUMBER_INPUT_SIZES)[number]
export type TNativeNumberInputRef = TextInput
export type TNativeNumberInputFormatOptions = {
  style?: "decimal"
  useGrouping?: boolean
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}
export type TNativeNumberInputInputProps = Pick<
  TextInputProps,
  | "keyboardType"
  | "returnKeyType"
  | "autoFocus"
  | "selection"
  | "selectTextOnFocus"
  | "allowFontScaling"
  | "maxFontSizeMultiplier"
  | "placeholderTextColor"
  | "selectionColor"
  | "selectionHandleColor"
  | "cursorColor"
  | "underlineColorAndroid"
  | "accessibilityHint"
  | "onChange"
  | "onFocus"
  | "onBlur"
  | "onEndEditing"
  | "onSubmitEditing"
  | "onSelectionChange"
>
export type TNativeNumberInputRenderState = Readonly<{
  value: number | null
  inputValue: string
  isFocused: boolean
  isDisabled: boolean
  isReadOnly: boolean
  isInvalid: boolean
  canIncrement: boolean
  canDecrement: boolean
}>
export type TNativeNumberInputStyleState = TNativeNumberInputRenderState & { defaultStyle: ViewStyle }
type TNativeNumberInputLabel =
  | { accessibilityLabel: string; "aria-label"?: string }
  | { accessibilityLabel?: string; "aria-label": string }

export type TNativeNumberInputProps = Pick<
  ViewProps,
  "testID" | "nativeID" | "id" | "onLayout" | "pointerEvents" | "collapsable"
> &
  TNativeNumberInputLabel & {
    render?: (props: ViewProps, state: TNativeNumberInputRenderState) => ReactElement
    value?: number | null
    defaultValue?: number | null
    onChange?: (value: number | null) => void
    onChangeText?: (text: string) => void
    minValue?: number
    maxValue?: number
    step?: number
    locale?: string
    formatOptions?: TNativeNumberInputFormatOptions
    inputProps?: TNativeNumberInputInputProps
    incrementLabel: string
    decrementLabel: string
    isDisabled?: boolean
    isReadOnly?: boolean
    placeholder?: string
    textSize?: TNativeNumberInputSize
    geometry?: TCornerGeometry
    width?: ViewStyle["width"]
    height?: ViewStyle["height"]
    enableFocusStyle?: boolean
    offsetFocusRing?: boolean
    errorState?: boolean
    warningState?: boolean
    successState?: boolean
    IncrementIcon?: ReactNode
    DecrementIcon?: ReactNode
    customStyles?: StyleProp<ViewStyle>
    style?: StyleProp<ViewStyle> | ((state: TNativeNumberInputStyleState) => StyleProp<ViewStyle>)
    customGroupStyles?: StyleProp<ViewStyle>
    customInputStyles?: StyleProp<TextStyle>
    customButtonStyles?: StyleProp<TNativeButtonRootStyle>
    "data-testid"?: string
  }
