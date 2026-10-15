import type { ReactNode } from "react"
import type { StyleProp, TextStyle, View, ViewProps, ViewStyle } from "react-native"

import type { TCornerGeometry } from "../../tokens/geometry"
import type { TNativeSelectionState } from "../selection"

import type { TNativeSelectKey } from "./collection"

export const SELECT_SIZE__SM = "small"
export const SELECT_SIZE__MD = "medium"
export const SELECT_SIZE__LG = "large"
export const AVAILABLE_SELECT_SIZES = [SELECT_SIZE__SM, SELECT_SIZE__MD, SELECT_SIZE__LG] as const
export type TNativeSelectSize = (typeof AVAILABLE_SELECT_SIZES)[number]
export type { TNativeSelectKey } from "./collection"
export type TNativeSelectRef = View
export type TNativeSelectRenderState = Readonly<{
  isOpen: boolean
  isDisabled: boolean
  isReadOnly: boolean
  isInvalid: boolean
}>
export type TNativeSelectStyleState = TNativeSelectRenderState & { defaultStyle: ViewStyle }
export type TNativeSelectItemRenderState = TNativeSelectionState
export type TNativeSelectValueRenderState<T> = Readonly<{
  selectedItem: T | null
  selectedText: string
  isPlaceholder: boolean
}>
type TNativeSelectLabel =
  | { accessibilityLabel: string; "aria-label"?: string }
  | { accessibilityLabel?: string; "aria-label": string }

export type TNativeSelectProps<T> = Omit<
  ViewProps,
  | "children"
  | "style"
  | "accessible"
  | "role"
  | "accessibilityRole"
  | "accessibilityState"
  | "accessibilityValue"
  | "accessibilityLabel"
  | "aria-label"
  | "aria-expanded"
  | "aria-disabled"
  | "aria-selected"
  | "aria-checked"
> &
  TNativeSelectLabel & {
    items: readonly T[]
    getKey: (item: T) => TNativeSelectKey
    getTextValue: (item: T) => string
    renderItem?: (item: T, state: TNativeSelectItemRenderState) => ReactNode
    value?: TNativeSelectKey | null
    defaultValue?: TNativeSelectKey | null
    onChange?: (key: TNativeSelectKey | null) => void
    disabledKeys?: readonly TNativeSelectKey[]
    isOpen?: boolean
    defaultOpen?: boolean
    onOpenChange?: (open: boolean) => void
    isDisabled?: boolean
    isReadOnly?: boolean
    closeLabel: string
    placeholder?: string
    emptyListMessage?: string
    width?: ViewStyle["width"]
    height?: ViewStyle["height"]
    textSize?: TNativeSelectSize
    geometry?: TCornerGeometry
    enableFocusStyle?: boolean
    offsetFocusRing?: boolean
    errorState?: boolean
    warningState?: boolean
    successState?: boolean
    ComponentIcon?: ReactNode
    renderSelectedValue?: (state: TNativeSelectValueRenderState<T>) => ReactNode
    customStyles?: StyleProp<ViewStyle>
    style?: StyleProp<ViewStyle> | ((state: TNativeSelectStyleState) => StyleProp<ViewStyle>)
    customSelectedItemStyles?: StyleProp<ViewStyle>
    customSelectedItemTextStyles?: StyleProp<TextStyle>
    customOptionsListStyles?: StyleProp<ViewStyle>
    "data-testid"?: string
  }
