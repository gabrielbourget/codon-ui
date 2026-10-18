import type { ReactNode, Ref, RefObject } from "react"
import type {
  ScrollView,
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

import type { TNativePartialTypeaheadSearchLabels } from "./labels"
import type { TNativeTypeaheadSearchStatus } from "./status"

export const NATIVE_TYPEAHEAD_INPUT_PROP_KEYS = [
  "keyboardType",
  "returnKeyType",
  "autoCapitalize",
  "autoCorrect",
  "spellCheck",
  "selection",
  "selectTextOnFocus",
  "allowFontScaling",
  "maxFontSizeMultiplier",
  "placeholderTextColor",
  "selectionColor",
  "selectionHandleColor",
  "cursorColor",
  "underlineColorAndroid",
  "accessibilityHint",
  "onChange",
  "onFocus",
  "onBlur",
  "onEndEditing",
  "onSubmitEditing",
  "onSelectionChange",
  "onKeyPress",
] as const
export type TNativeTypeaheadSearchInputProps = Pick<TextInputProps, (typeof NATIVE_TYPEAHEAD_INPUT_PROP_KEYS)[number]>
export type TNativeTypeaheadSearchKey = string | number
export type TNativeTypeaheadSearchRef = View
export type TNativeTypeaheadSearchRenderItemArgs = Readonly<{
  query: string
  textValue: string
  itemKey: TNativeTypeaheadSearchKey
}>
export type TNativeTypeaheadSearchProps<T extends object = object> = Pick<
  ViewProps,
  "testID" | "nativeID" | "id" | "onLayout" | "pointerEvents" | "collapsable" | "accessibilityHint"
> & {
  children?: never
  items?: Iterable<T>
  inputValue: string
  onInputChange: (value: string) => void
  status?: TNativeTypeaheadSearchStatus
  isDisabled?: boolean
  placeholder?: string
  accessibilityLabel?: string
  "aria-label"?: string
  "data-testid"?: string
  inputRef?: Ref<TextInput>
  inputProps?: TNativeTypeaheadSearchInputProps
  searchButtonAriaLabel?: string
  minimumInputLength?: number
  idleMessage?: string
  minimumInputLengthMessage?: string
  loadingMessage?: string
  emptyListMessage?: string
  errorMessage?: string
  labels?: TNativePartialTypeaheadSearchLabels
  shouldAutoFocusInput?: boolean
  shouldFocusWrap?: boolean
  geometry?: TCornerGeometry
  SearchIcon?: ReactNode
  LoadingIndicator?: ReactNode
  getItemKey?: (item: T) => TNativeTypeaheadSearchKey
  getItemTextValue?: (item: T) => string
  renderItem?: (item: T, args: TNativeTypeaheadSearchRenderItemArgs) => ReactNode
  onSelectionChange?: (key: TNativeTypeaheadSearchKey | null) => void
  onSubmitQuery?: (query: string) => void
  customStyles?: StyleProp<TextStyle>
  style?: StyleProp<TextStyle>
  customInputRowStyles?: StyleProp<ViewStyle>
  customInputStyles?: StyleProp<TextStyle>
  customSearchButtonStyles?: StyleProp<TNativeButtonRootStyle>
  customResultsContainerStyles?: StyleProp<ViewStyle>
  customResultsListStyles?: StyleProp<ViewStyle>
}
export type TTypeaheadEntry<T> = Readonly<{ item: T; key: TNativeTypeaheadSearchKey; encodedKey: string; text: string }>
export type TTypeaheadViewport = {
  width: number
  height: number
  offset: number
  contentHeight: number
  generation: number
}
export type TTypeaheadResultsProps<T extends object> = {
  entries: readonly TTypeaheadEntry<T>[]
  query: string
  label: string
  shouldFocusWrap: boolean
  renderItem?: TNativeTypeaheadSearchProps<T>["renderItem"]
  onSelectionChange?: TNativeTypeaheadSearchProps<T>["onSelectionChange"]
  style: ViewStyle
  scroll: RefObject<ScrollView | null>
  content: RefObject<View | null>
  viewport: RefObject<TTypeaheadViewport>
}
