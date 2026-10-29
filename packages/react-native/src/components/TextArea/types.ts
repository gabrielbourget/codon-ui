import type { ReactElement, RefAttributes } from "react"
import type { StyleProp, TextInput, TextInputProps, TextStyle } from "react-native"

import type { TCornerGeometry } from "../../tokens/geometry"

export const TEXTAREA_SIZE__SM = "small"
export const TEXTAREA_SIZE__MD = "medium"
export const TEXTAREA_SIZE__LG = "large"
export const AVAILABLE_TEXTAREA_SIZES = [TEXTAREA_SIZE__SM, TEXTAREA_SIZE__MD, TEXTAREA_SIZE__LG] as const
export type TNativeTextAreaSize = (typeof AVAILABLE_TEXTAREA_SIZES)[number]
export type TNativeTextAreaRef = TextInput
export type TNativeTextAreaRenderState = Readonly<{
  isFocused: boolean
  isDisabled: boolean
  isReadOnly: boolean
  isInvalid: boolean
}>
export type TNativeTextAreaStyleState = TNativeTextAreaRenderState & { defaultStyle: TextStyle }
type TNativeTextAreaLabel =
  | { accessibilityLabel: string; "aria-label"?: string }
  | { accessibilityLabel?: string; "aria-label": string }

export type TNativeTextAreaProps = Omit<
  TextInputProps,
  | "style"
  | "editable"
  | "readOnly"
  | "multiline"
  | "children"
  | "aria-disabled"
  | "aria-label"
  | "accessibilityLabel"
  | "accessibilityState"
  | "blurOnSubmit"
  | "clearButtonMode"
  | "secureTextEntry"
> &
  TNativeTextAreaLabel & {
    render?: (props: TextInputProps & RefAttributes<TextInput>, state: TNativeTextAreaRenderState) => ReactElement
    isDisabled?: boolean
    isReadOnly?: boolean
    textSize?: TNativeTextAreaSize
    geometry?: TCornerGeometry
    width?: TextStyle["width"]
    height?: TextStyle["height"]
    enableFocusStyle?: boolean
    offsetFocusRing?: boolean
    errorState?: boolean
    warningState?: boolean
    successState?: boolean
    customStyles?: StyleProp<TextStyle>
    style?: StyleProp<TextStyle> | ((state: TNativeTextAreaStyleState) => StyleProp<TextStyle>)
    accessibilityState?: Omit<NonNullable<TextInputProps["accessibilityState"]>, "disabled">
    "data-testid"?: string
    "aria-disabled"?: never
  }
