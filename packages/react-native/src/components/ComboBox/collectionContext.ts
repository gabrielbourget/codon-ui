import { createContext, type RefObject } from "react"
import type { TextInput, View } from "react-native"

import type { TNativeContextValue } from "../../collection/context"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import type { TNativePressEvent } from "../../input/types"
import type { TNativeFocusViewProps } from "../../input/types"
import type { TNativeClickPopoverProps } from "../ClickPopover/types"

import type { ComboBoxState } from "./state/types"
import type { TNativeComboBoxProps } from "./types"

export const NativeComboBoxStateContext = createContext<ComboBoxState<object> | null>(null)
export const NativeComboBoxContext = createContext<
  TNativeContextValue<
    Partial<Omit<TNativeComboBoxProps<unknown>, "items" | "getKey" | "getTextValue" | "renderItem">> & {
      slot?: string | null
    },
    View
  >
>(null)
export const NativeComboBoxItemValueContext = createContext<{
  key: string | number
  value: unknown
  text: string
} | null>(null)
export const NativeComboBoxGroupContext = createContext<TNativeContextValue<Partial<TNativeFocusViewProps>, View>>(null)
export const NativeComboBoxPopoverContext =
  createContext<TNativeContextValue<Partial<Omit<TNativeClickPopoverProps, "children">>, View>>(null)
export const NativeComboBoxOptionsContext = createContext<{
  input: RefObject<TextInput | null>
  isDisabled: boolean
  isReadOnly: boolean
  isVirtualized: boolean
  register: (node: TNativeCollectionNode<unknown>, target: View | null) => void
  press: (node: TNativeCollectionNode<unknown>, target: View | null, event: TNativePressEvent) => void
} | null>(null)
