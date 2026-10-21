import type { ReactNode } from "react"
import type { TextInputProps } from "react-native"

import type { TNativeFloatingPlacement } from "../../overlays/floating/placement"

import type { ComboBoxStateOptions } from "./state/types"
import type { TNativeComboBoxProps, TNativeComboBoxRootStyle } from "./types"

type TNativeComboBoxLabel =
  | { accessibilityLabel: string; "aria-label"?: string }
  | { accessibilityLabel?: string; "aria-label": string }

export type TNativeCollectionComboBoxRenderState = Readonly<{
  isOpen: boolean
  isDisabled: boolean
  isInvalid: boolean
  isRequired: boolean
  isReadOnly: boolean
}>
export type TNativeCollectionComboBoxStyleState = TNativeCollectionComboBoxRenderState & {
  defaultStyle: TNativeComboBoxRootStyle
}
export type TNativeCollectionComboBoxProps<T extends object> = Omit<
  TNativeComboBoxProps<T>,
  "style" | "accessibilityLabel" | "aria-label"
> &
  TNativeComboBoxLabel &
  Pick<
    ComboBoxStateOptions<T>,
    | "allowsCustomValue"
    | "allowsEmptyCollection"
    | "menuTrigger"
    | "isRequired"
    | "isInvalid"
    | "validate"
    | "validationBehavior"
    | "shouldCloseOnBlur"
  > & {
    children?: ReactNode | ((item: T) => ReactNode)
    placement?: TNativeFloatingPlacement
    shouldFocusWrap?: boolean
    slot?: string | null
    locale?: string
    defaultFilter?: (text: string, query: string) => boolean
    dependencies?: readonly unknown[]
    name?: string
    onFocus?: TextInputProps["onFocus"]
    onBlur?: TextInputProps["onBlur"]
    onFocusChange?: (focused: boolean) => void
    style?:
      | TNativeComboBoxProps<T>["customStyles"]
      | ((state: TNativeCollectionComboBoxStyleState) => TNativeComboBoxProps<T>["customStyles"])
  }

export type TNativeCollectionComboBoxParentProps<T extends object> = Omit<
  TNativeCollectionComboBoxProps<T>,
  "items" | "accessibilityLabel" | "aria-label"
> &
  TNativeComboBoxLabel & { items?: Iterable<T> }
