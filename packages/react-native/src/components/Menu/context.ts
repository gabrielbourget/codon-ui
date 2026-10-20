import { createContext, type RefObject } from "react"
import type { TextStyle, View } from "react-native"

import type { TNativeContextValue } from "../../collection/context"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import type { TNativeTreeState } from "../../collection/state"
import type { SelectionManager } from "../../collection/state/SelectionManager"
import type { TNativePressEvent } from "../../input/types"

import type { TNativeMenuKey, TNativeMenuSelectionMode } from "./model"
import type { TNativeMenuItemProps, TNativeMenuProps } from "./types"

export type TNativeMenuRegistration = {
  id: TNativeMenuKey
  node: TNativeCollectionNode<unknown>
  view: RefObject<View | null>
  props: () => TNativeMenuItemProps
  text: () => string
  selectionManager: () => SelectionManager
}
export type TNativeMenuContext = {
  register: (row: TNativeMenuRegistration) => () => void
  refresh: (row: TNativeMenuRegistration) => void
  mode: TNativeMenuSelectionMode
  text: TextStyle
  disabled: (row: TNativeMenuRegistration) => boolean
  selected: (row: TNativeMenuRegistration) => boolean
  focus: (row: TNativeMenuRegistration) => boolean
  requestFocus: (row: TNativeMenuRegistration) => boolean
  activate: (row: TNativeMenuRegistration, event: TNativePressEvent) => void
  layout: (row: TNativeMenuRegistration, frame: { y: number; height: number }) => void
  typeahead: (row: TNativeMenuRegistration, value: string, time: number) => void
}
export const NativeMenuActionsContext = createContext<TNativeMenuContext | null>(null)

export const NativeMenuStateContext = createContext<TNativeTreeState<object> | null>(null)
export const NativeMenuContext =
  createContext<TNativeContextValue<Partial<Omit<TNativeMenuProps, "children">>, View>>(null)
export const NativeMenuItemContext = createContext<TNativeContextValue<Partial<TNativeMenuItemProps>, View>>(null)
export const NativeMenuSelectionManagerContext = createContext<SelectionManager | null>(null)
export const NativeMenuHeaderContext = createContext<{
  nativeID: string
  ref: (target: View | null, nativeID: string) => void
} | null>(null)
