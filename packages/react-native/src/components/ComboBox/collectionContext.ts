import { createContext, type RefObject } from "react"
import type { TextInput, View } from "react-native"

import type { TNativeCollectionActionOutcome } from "../../collection/actions"
import type { TNativeContextValue } from "../../collection/context"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import type { TNativeWindowPointerEvent } from "../../input/nativeWindowPointers"
import type { TNativePressEvent } from "../../input/types"
import type { TNativeTextRender } from "../Text/Text"
import type { TNativeTextProps, TNativeTextRef } from "../Text/types"

import type { TNativeComboBoxGroupProps } from "./CollectionComboBoxGroup"
import type { TNativeComboBoxListProps } from "./CollectionComboBoxList"
import type { TNativeComboBoxPopoverProps } from "./CollectionComboBoxPopover"
import type { TNativeComboBoxButtonProps } from "./CollectionComboBoxTrigger"
import type { TNativeComboBoxInputProps } from "./collectionInputTypes"
import type { TNativeCollectionComboBoxParentProps } from "./collectionTypes"
import type { TNativeComboBoxItemRequest } from "./itemActions"
import type { TNativeComboBoxPointerOptionRegistration } from "./pointerSelection"
import type { ComboBoxState, ValidationResult } from "./state/types"

export const NativeComboBoxStateContext = createContext<ComboBoxState<object> | null>(null)
export const NativeComboBoxContext =
  createContext<
    TNativeContextValue<
      Partial<
        Omit<
          TNativeCollectionComboBoxParentProps<object>,
          "getKey" | "getTextValue" | "children" | "renderItem" | "controlledItems" | "renderContent" | "popoverIsOpen"
        >
      >,
      View
    >
  >(null)
export const NativeComboBoxItemValueContext = createContext<{
  key: string | number
  value: unknown
  text: string
} | null>(null)
export const NativeComboBoxGroupContext =
  createContext<TNativeContextValue<Partial<TNativeComboBoxGroupProps>, View>>(null)
export const NativeComboBoxPopoverContext =
  createContext<TNativeContextValue<Partial<Omit<TNativeComboBoxPopoverProps, "children">>, View>>(null)
export type TNativeComboBoxLabelContext = Partial<TNativeTextProps> & {
  render?: TNativeTextRender
  labelTarget?: RefObject<TextInput | null>
  isDisabled?: boolean
}
export const NativeComboBoxLabelContext =
  createContext<TNativeContextValue<TNativeComboBoxLabelContext, TNativeTextRef>>(null)
export const NativeComboBoxTextContext =
  createContext<TNativeContextValue<Partial<TNativeTextProps> & { render?: TNativeTextRender }, TNativeTextRef>>(null)
export const NativeComboBoxItemTextBindingContext = createContext<
  | ((
      token: object,
      slot: "label" | "description",
      target: TNativeTextRef | null,
      nativeID: string | undefined,
    ) => void)
  | null
>(null)
export const NativeComboBoxFieldErrorContext = createContext<ValidationResult | null>(null)
export const NativeComboBoxInputContext =
  createContext<TNativeContextValue<Partial<TNativeComboBoxInputProps>, TextInput>>(null)
export const NativeComboBoxButtonContext =
  createContext<TNativeContextValue<Partial<TNativeComboBoxButtonProps>, View>>(null)
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
  list: string
}> | null>(null)
export const NativeComboBoxListContext =
  createContext<TNativeContextValue<Partial<TNativeComboBoxListProps>, View>>(null)
export const NativeComboBoxOptionsContext = createContext<{
  input: RefObject<TextInput | null>
  isDisabled: boolean
  isReadOnly: boolean
  isVirtualized: boolean
  register: (node: TNativeCollectionNode<unknown>, target: View | null) => void
  registerPointerOption: TNativeComboBoxPointerOptionRegistration
  press: (
    node: TNativeCollectionNode<unknown>,
    target: View | null,
    event: TNativePressEvent | TNativeWindowPointerEvent,
    admitted?: () => boolean,
    request?: TNativeComboBoxItemRequest,
    settled?: (outcome: TNativeCollectionActionOutcome) => void,
  ) => void
} | null>(null)
