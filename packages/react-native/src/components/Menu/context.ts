import { createContext, type RefObject } from "react"
import type { TextStyle, View } from "react-native"

import type { TNativeContextValue } from "../../collection/context"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import type { TNativeTreeState } from "../../collection/state"
import type { SelectionManager } from "../../collection/state/SelectionManager"
import type { FocusStrategy } from "../../collection/state/types"
import type { TNativePressEvent } from "../../input/types"

import type { TNativeMenuKey, TNativeMenuSelectionMode } from "./model"
import type { TNativeRootMenuTriggerState, TNativeSubmenuTriggerState } from "./triggerState"
import type { TNativeMenuItemProps, TNativeMenuListProps, TNativeMenuProps } from "./types"

export type TNativeMenuRegistration = {
  id: TNativeMenuKey
  node: TNativeCollectionNode<unknown>
  view: RefObject<View | null>
  props: () => TNativeMenuItemProps
  text: () => string
  selectionManager: () => SelectionManager
  submenu: () => TNativeSubmenuTriggerState | null
}
export type TNativeMenuContext = {
  root: RefObject<View | null>
  register: (row: TNativeMenuRegistration) => () => void
  refresh: (row: TNativeMenuRegistration) => void
  mode: TNativeMenuSelectionMode
  text: TextStyle
  virtualFocus: boolean
  focusVisible: boolean
  disabled: (row: TNativeMenuRegistration) => boolean
  selected: (row: TNativeMenuRegistration) => boolean
  focus: (row: TNativeMenuRegistration) => boolean
  requestFocus: (row: TNativeMenuRegistration) => boolean
  activate: (row: TNativeMenuRegistration, event: TNativePressEvent) => void
  openSubmenu: (row: TNativeMenuRegistration, strategy?: FocusStrategy, isCurrent?: () => boolean) => void
  layout: (row: TNativeMenuRegistration, frame: { y: number; height: number }) => void
  typeahead: (row: TNativeMenuRegistration, value: string, time: number) => void
}
export const NativeMenuActionsContext = createContext<TNativeMenuContext | null>(null)

export const NativeMenuStateContext = createContext<TNativeTreeState<object> | null>(null)
export const NativeMenuContext =
  createContext<TNativeContextValue<Partial<Omit<TNativeMenuProps, "children">>, View>>(null)
export const NativeMenuListContext = createContext<TNativeContextValue<Partial<TNativeMenuListProps>, View>>(null)
export const NativeMenuItemContext = createContext<TNativeContextValue<Partial<TNativeMenuItemProps>, View>>(null)
export const NativeMenuSelectionManagerContext = createContext<SelectionManager | null>(null)
export const NativeMenuHeaderContext = createContext<{
  nativeID: string
  ref: (target: View | null, nativeID: string) => void
} | null>(null)

export const NativeRootMenuTriggerStateContext = createContext<TNativeRootMenuTriggerState | null>(null)
export const NativeMenuDirectionContext = createContext<"ltr" | "rtl" | null>(null)
export const NativeSubmenuContext = createContext<{
  state: TNativeSubmenuTriggerState
  triggerRef: RefObject<View | null>
  triggerID: string
  menuID: string
  direction: "ltr" | "rtl"
  restoreRef: RefObject<View | null>
} | null>(null)
export const NativeSubmenuItemContext = createContext<{
  state: TNativeSubmenuTriggerState
  triggerID: string
  direction: "ltr" | "rtl"
  hover: (hovered: boolean, requestOpen: (isCurrent: () => boolean) => void) => void
} | null>(null)
