import type { ReactNode, Ref } from "react"
import type { ColorValue, StyleProp, TextInput, TextStyle, View, ViewProps } from "react-native"

import type { TNativeFloatingPlacement } from "../../overlays/floating/placement"
import type { TCornerGeometry } from "../../tokens/geometry"
import type { TNativeCollectionComboBoxProps } from "../ComboBox/collectionTypes"
import type { TNativeInputProps, TNativeInputSize } from "../Input/types"

import type { TNativeCompactTypeaheadLabels } from "./labels"

export type TNativeCompactTypeaheadKey = string | number
export type TNativeCompactTypeaheadRef = View
export type TNativeCompactTypeaheadRenderState = Readonly<{
  isOpen: boolean
  isDisabled: boolean
  isReadOnly: boolean
  isInvalid: boolean
  isRequired: boolean
}>
export type TNativeCompactTypeaheadStyleState = TNativeCompactTypeaheadRenderState & { defaultStyle: TextStyle }
export type TNativeCompactTypeaheadRenderItemArgs = Readonly<{
  query: string
  textValue: string
  itemKey: TNativeCompactTypeaheadKey
}>
type TNativeCompactTypeaheadOwnProps<T extends object> = Omit<ViewProps, "children" | "style"> & {
  children?: never
  "data-testid"?: string
  "aria-label"?: string
  items?: Iterable<T>
  defaultItems?: Iterable<T>
  selectionMode?: "single"
  inputValue?: string
  defaultInputValue?: string
  onInputChange?: (value: string) => void
  value?: TNativeCompactTypeaheadKey | null
  defaultValue?: TNativeCompactTypeaheadKey | null
  onChange?: (value: TNativeCompactTypeaheadKey | null) => void
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  isLoading?: boolean
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  isInvalid?: boolean
  disabledKeys?: Iterable<TNativeCompactTypeaheadKey>
  menuTrigger?: "input" | "focus" | "manual"
  allowsCustomValue?: boolean
  autoFocus?: boolean
  placeholder?: string
  minimumInputLength?: number
  minimumInputLengthMessage?: string
  loadingMessage?: string
  emptyListMessage?: string
  labels?: Partial<Omit<TNativeCompactTypeaheadLabels, "status">> & {
    status?: Partial<TNativeCompactTypeaheadLabels["status"]>
  }
  getItemKey?: (item: T) => TNativeCompactTypeaheadKey
  getItemTextValue?: (item: T) => string
  renderItem?: (item: T, args: TNativeCompactTypeaheadRenderItemArgs) => ReactNode
  inputRef?: Ref<TextInput>
  inputProps?: Omit<TNativeInputProps, "value" | "defaultValue" | "onChangeText" | "style" | "customStyles">
  height?: TextStyle["height"]
  width?: TextStyle["width"]
  color?: ColorValue
  geometry?: TCornerGeometry
  textSize?: TNativeInputSize
  placement?: TNativeFloatingPlacement
  rtl?: boolean
  shouldFocusWrap?: boolean
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  errorState?: boolean
  warningState?: boolean
  successState?: boolean
  SearchIcon?: ReactNode
  LoadingIndicator?: ReactNode
  customStyles?: StyleProp<TextStyle>
  customInputStyles?: StyleProp<TextStyle>
  customButtonStyles?: StyleProp<TextStyle>
  customInputButtonGroupStyles?: StyleProp<TextStyle>
  customOptionsListStyles?: StyleProp<TextStyle>
  style?: StyleProp<TextStyle> | ((state: TNativeCompactTypeaheadStyleState) => StyleProp<TextStyle>)
}
export type TNativeCompactTypeaheadSearchProps<T extends object = object> = TNativeCompactTypeaheadOwnProps<T> &
  Omit<
    TNativeCollectionComboBoxProps<T>,
    | keyof TNativeCompactTypeaheadOwnProps<T>
    | "inputLabel"
    | "closeLabel"
    | "getKey"
    | "getTextValue"
    | "ComponentIcon"
    | "popoverIsOpen"
    | "controlledItems"
    | "renderContent"
  >
export type TNativeCompactTypeaheadEntry<T> = Readonly<{
  item: T
  key: TNativeCompactTypeaheadKey
  encodedKey: string
  text: string
}>
