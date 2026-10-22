import { createContext, type RefObject } from "react"
import type { TextInput, View } from "react-native"

import type { TNativeContextValue } from "../../collection/context"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import type { TNativePressEvent } from "../../input/types"
import type { TNativeFocusViewProps } from "../../input/types"
import type { TNativeButtonProps } from "../Button/types"
import type { TNativeClickPopoverProps } from "../ClickPopover/types"
import type { TNativeInputProps } from "../Input/types"
import type { TNativeTextRender } from "../Text/Text"
import type { TNativeTextProps, TNativeTextRef } from "../Text/types"

import type { TNativeCollectionComboBoxParentProps } from "./collectionTypes"
import type { ComboBoxState, ValidationResult } from "./state/types"

export const NativeComboBoxStateContext = createContext<ComboBoxState<object> | null>(null)
export const NativeComboBoxContext =
  createContext<
    TNativeContextValue<
      Partial<
        Omit<TNativeCollectionComboBoxParentProps<object>, "getKey" | "getTextValue" | "children" | "renderItem">
      >,
      View
    >
  >(null)
export const NativeComboBoxItemValueContext = createContext<{
  key: string | number
  value: unknown
  text: string
} | null>(null)
export const NativeComboBoxGroupContext = createContext<
  TNativeContextValue<
    Partial<TNativeFocusViewProps> & {
      isDisabled?: boolean
      isInvalid?: boolean
    },
    View
  >
>(null)
export const NativeComboBoxPopoverContext = createContext<
  TNativeContextValue<
    Partial<Omit<TNativeClickPopoverProps, "children">> & {
      clearContexts?: typeof NATIVE_COMBO_BOX_POPOVER_CONTEXTS
    },
    View
  >
>(null)
export type TNativeComboBoxLabelContext = Partial<TNativeTextProps> & {
  render?: TNativeTextRender
  labelTarget?: RefObject<TextInput | null>
  isDisabled?: boolean
}
export const NativeComboBoxLabelContext =
  createContext<TNativeContextValue<TNativeComboBoxLabelContext, TNativeTextRef>>(null)
export const NativeComboBoxTextContext =
  createContext<TNativeContextValue<Partial<TNativeTextProps> & { render?: TNativeTextRender }, TNativeTextRef>>(null)
export const NativeComboBoxFieldErrorContext = createContext<ValidationResult | null>(null)
export const NativeComboBoxInputContext =
  createContext<TNativeContextValue<Partial<TNativeInputProps>, TextInput>>(null)
export const NativeComboBoxButtonContext =
  createContext<TNativeContextValue<Partial<TNativeButtonProps> & { isPressed?: boolean }, View>>(null)
export const NativeComboBoxValueContext =
  createContext<TNativeContextValue<Partial<import("./fieldParts").TNativeComboBoxValueProps>, View>>(null)
export const NATIVE_COMBO_BOX_POPOVER_CONTEXTS = [
  NativeComboBoxLabelContext,
  NativeComboBoxButtonContext,
  NativeComboBoxInputContext,
  NativeComboBoxGroupContext,
  NativeComboBoxTextContext,
] as const
export const NativeComboBoxOverlayTriggerStateContext = createContext<Pick<
  ComboBoxState<object>,
  "isOpen" | "open" | "close" | "toggle" | "setOpen"
> | null>(null)
export const NativeComboBoxFieldIdsContext = createContext<Readonly<{
  input: string
  label: string
  description: string
  errorMessage: string
  value: string
}> | null>(null)
export const NativeComboBoxListContext = createContext<
  TNativeContextValue<
    Partial<TNativeFocusViewProps> & {
      autoFocus?: boolean | "first" | "last"
      shouldUseVirtualFocus?: boolean
      shouldSelectOnPressUp?: boolean
      shouldFocusOnHover?: boolean
      linkBehavior?: "selection"
      itemBehavior?: "action"
      shouldFocusWrap?: boolean
    },
    View
  >
>(null)
export const NativeComboBoxOptionsContext = createContext<{
  input: RefObject<TextInput | null>
  isDisabled: boolean
  isReadOnly: boolean
  isVirtualized: boolean
  register: (node: TNativeCollectionNode<unknown>, target: View | null) => void
  press: (node: TNativeCollectionNode<unknown>, target: View | null, event: TNativePressEvent) => void
} | null>(null)
