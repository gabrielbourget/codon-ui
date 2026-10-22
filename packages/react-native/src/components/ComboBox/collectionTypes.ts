import type { ReactElement, ReactNode, RefAttributes } from "react"
import type { TextInputProps, View, StyleProp, TextStyle } from "react-native"

import type { TNativeFieldSemanticLabels } from "../../form/semantics"
import type { TNativeFocusViewProps } from "../../input/types"
import type { TNativeFloatingPlacement } from "../../overlays/floating/placement"

import type { ComboBoxStateOptions } from "./state/types"
import type { TNativeComboBoxProps, TNativeComboBoxRootStyle } from "./types"

export type TNativeComboBoxSubmitEvent = Parameters<NonNullable<TextInputProps["onSubmitEditing"]>>[0]

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
  "style" | "accessibilityLabel" | "aria-label" | "onOpenChange" | "customOptionsListStyles"
> &
  Pick<
    ComboBoxStateOptions<T>,
    | "onOpenChange"
    | "allowsCustomValue"
    | "allowsEmptyCollection"
    | "menuTrigger"
    | "isRequired"
    | "isInvalid"
    | "validate"
    | "validationBehavior"
    | "shouldCloseOnBlur"
  > & {
    accessibilityLabel?: string
    customOptionsListStyles?: StyleProp<TextStyle>
    "aria-label"?: string
    children?: ReactNode | ((item: T) => ReactNode)
    placement?: TNativeFloatingPlacement
    shouldFocusWrap?: boolean
    slot?: string | null
    locale?: string
    defaultFilter?: (text: string, query: string) => boolean
    dependencies?: readonly unknown[]
    name?: string
    form?: string
    formValue?: "key" | "text"
    triggerLabel?: string
    groupLabel?: string
    nativeLabelledBy?: readonly string[]
    nativeDescribedBy?: readonly string[]
    nativeErrorMessageBy?: readonly string[]
    nativeDetailsBy?: readonly string[]
    nativeAccessibilityLabels?: Partial<TNativeFieldSemanticLabels>
    render?: (
      props: TNativeFocusViewProps & RefAttributes<View>,
      state: TNativeCollectionComboBoxRenderState,
    ) => ReactElement
    onFocus?: TextInputProps["onFocus"]
    onBlur?: TextInputProps["onBlur"]
    onFocusChange?: (focused: boolean) => void
    style?:
      | TNativeComboBoxProps<T>["customStyles"]
      | ((state: TNativeCollectionComboBoxStyleState) => TNativeComboBoxProps<T>["customStyles"])
  }

export type TNativeCollectionComboBoxParentProps<T extends object> = Omit<
  TNativeCollectionComboBoxProps<T>,
  "items"
> & { items?: Iterable<T> }
