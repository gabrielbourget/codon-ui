import type { ReactNode, Ref } from "react"
import type {
  ColorValue,
  StyleProp,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from "react-native"

import type { TCornerGeometry } from "../../tokens/geometry"
import type { TNativeButtonRootStyle } from "../Button/types"
import type { TNativeSelectionState } from "../selection"

export const COMBOBOX_SIZE__SM = "small"
export const COMBOBOX_SIZE__MD = "medium"
export const COMBOBOX_SIZE__LG = "large"
export const AVAILABLE_COMBOBOX_SIZES = [COMBOBOX_SIZE__SM, COMBOBOX_SIZE__MD, COMBOBOX_SIZE__LG] as const
export type TNativeComboBoxSize = (typeof AVAILABLE_COMBOBOX_SIZES)[number]
export type TNativeComboBoxKey = string | number
export type TNativeComboBoxRef = View
export type TNativeComboBoxRootStyle = ViewStyle & { color?: ColorValue }
export type TNativeComboBoxRenderState = Readonly<{
  isOpen: boolean
  isDisabled: boolean
  isReadOnly: boolean
  isInvalid: boolean
}>
export type TNativeComboBoxStyleState = TNativeComboBoxRenderState & { defaultStyle: TNativeComboBoxRootStyle }
export type TNativeComboBoxItemRenderState = TNativeSelectionState
export type TNativeComboBoxInputProps = Pick<
  TextInputProps,
  | "keyboardType"
  | "returnKeyType"
  | "autoCapitalize"
  | "autoCorrect"
  | "spellCheck"
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
type TNativeComboBoxLabel =
  | { accessibilityLabel: string; "aria-label"?: string }
  | { accessibilityLabel?: string; "aria-label": string }

export type TNativeComboBoxProps<T> = Pick<
  ViewProps,
  "testID" | "nativeID" | "id" | "onLayout" | "pointerEvents" | "collapsable" | "accessibilityHint"
> &
  TNativeComboBoxLabel & {
    items: readonly T[]
    getKey: (item: T) => TNativeComboBoxKey
    getTextValue: (item: T) => string
    renderItem?: (item: T, state: TNativeComboBoxItemRenderState) => ReactNode
    value?: TNativeComboBoxKey | null
    defaultValue?: TNativeComboBoxKey | null
    onChange?: (key: TNativeComboBoxKey | null) => void
    inputValue?: string
    defaultInputValue?: string
    onInputChange?: (text: string) => void
    isOpen?: boolean
    defaultOpen?: boolean
    onOpenChange?: (open: boolean) => void
    disabledKeys?: readonly TNativeComboBoxKey[]
    isDisabled?: boolean
    isReadOnly?: boolean
    inputLabel: string
    closeLabel: string
    inputRef?: Ref<TextInput>
    inputProps?: TNativeComboBoxInputProps
    placeholder?: string
    emptyListMessage?: string
    width?: ViewStyle["width"]
    height?: ViewStyle["height"]
    color?: ColorValue
    textSize?: TNativeComboBoxSize
    geometry?: TCornerGeometry
    enableFocusStyle?: boolean
    offsetFocusRing?: boolean
    errorState?: boolean
    warningState?: boolean
    successState?: boolean
    ComponentIcon?: ReactNode
    customStyles?: StyleProp<TNativeComboBoxRootStyle>
    style?:
      | StyleProp<TNativeComboBoxRootStyle>
      | ((state: TNativeComboBoxStyleState) => StyleProp<TNativeComboBoxRootStyle>)
    customInputStyles?: StyleProp<TextStyle>
    customButtonStyles?: StyleProp<TNativeButtonRootStyle>
    customInputButtonGroupStyles?: StyleProp<ViewStyle>
    customOptionsListStyles?: StyleProp<ViewStyle>
    "data-testid"?: string
  }
