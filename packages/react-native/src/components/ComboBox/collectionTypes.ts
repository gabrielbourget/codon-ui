import type { ReactElement, ReactNode, RefAttributes } from "react"
import type { TextInputProps, View, ViewProps, StyleProp, TextStyle } from "react-native"

import type { TNativeFieldSemanticLabels } from "../../form/semantics"
import type { TNativeFocusViewProps } from "../../input/types"
import type { TNativeFloatingPlacement } from "../../overlays/floating/placement"

import type { ComboBoxStateOptions } from "./state/types"
import type { TNativeComboBoxProps, TNativeComboBoxRootStyle, TNativeComboBoxKeyboardCallbacks } from "./types"

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
export type TNativeCollectionComboBoxProps<T extends object> = TNativeComboBoxKeyboardCallbacks &
  Omit<
    TNativeComboBoxProps<T>,
    "style" | "accessibilityLabel" | "aria-label" | "onOpenChange" | "customOptionsListStyles" | "inputProps"
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
    autoFocus?: TextInputProps["autoFocus"]
    inputProps?: TNativeComboBoxProps<T>["inputProps"] & TNativeComboBoxKeyboardCallbacks
    inputMode?: TextInputProps["inputMode"]
    accessibilityLabel?: string
    customOptionsListStyles?: StyleProp<TextStyle>
    "aria-label"?: string
    accessibilityLabelledBy?: ViewProps["accessibilityLabelledBy"]
    "aria-labelledby"?: string
    "aria-describedby"?: string
    "aria-details"?: string
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
    // Owned composites may control their popup independently of trigger state.
    popoverIsOpen?: boolean
    // Source root items and child-list items have different state admission rules.
    controlledItems?: Iterable<T>
    renderContent?: (field: { metadata: ReactNode; placement: "input" | "root" }) => ReactNode
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
