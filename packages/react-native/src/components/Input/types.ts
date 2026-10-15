import type { StyleProp, TextInput, TextInputProps, TextStyle } from "react-native"

import type { TCornerGeometry } from "../../tokens/geometry"

export const INPUT_SIZE__SM = "small"
export const INPUT_SIZE__MD = "medium"
export const INPUT_SIZE__LG = "large"
export const AVAILABLE_INPUT_SIZES = [INPUT_SIZE__SM, INPUT_SIZE__MD, INPUT_SIZE__LG] as const
export type TNativeInputSize = (typeof AVAILABLE_INPUT_SIZES)[number]
export type TNativeInputRef = TextInput
export type TNativeInputRenderState = Readonly<{
  isFocused: boolean
  isDisabled: boolean
  isReadOnly: boolean
  isInvalid: boolean
}>
export type TNativeInputStyleState = TNativeInputRenderState & { defaultStyle: TextStyle }
export type TNativeInputProps = Omit<
  TextInputProps,
  "style" | "editable" | "readOnly" | "multiline" | "children" | "aria-disabled" | "aria-label" | "accessibilityState"
> & {
  isDisabled?: boolean
  isReadOnly?: boolean
  textSize?: TNativeInputSize
  geometry?: TCornerGeometry
  width?: TextStyle["width"]
  height?: TextStyle["height"]
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  errorState?: boolean
  warningState?: boolean
  successState?: boolean
  customStyles?: StyleProp<TextStyle>
  style?: StyleProp<TextStyle> | ((state: TNativeInputStyleState) => StyleProp<TextStyle>)
  accessibilityState?: Omit<NonNullable<TextInputProps["accessibilityState"]>, "disabled">
  "data-testid"?: string
  "aria-label"?: string
  "aria-disabled"?: never
}
