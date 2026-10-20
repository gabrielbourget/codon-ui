import { createContext, type RefObject } from "react"
import type { View, TextStyle } from "react-native"

import type { TNativeContextValue } from "../../collection/context"
import type { TNativeCollectionScrollHost } from "../../collection/renderer"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import type { TNativeListState as ListState } from "../../collection/state"
import type { TNativeKeyboardEvent, TNativePressEvent } from "../../input/types"

import type { TNativeTagGroupActionState, TNativeTagGroupPointerType, TNativeTagGroupPressPhase } from "./intent"
import type { TNativeTagGroupKey, TNativeTagGroupSelectionBehavior, TNativeTagGroupSelectionMode } from "./model"
import type { TNativeGroupedTagProps, TNativeTagGroupLabels, TNativeTagGroupProps, TNativeTagListProps } from "./types"

export type TNativeTagRegistration = Readonly<{
  key: TNativeTagGroupKey
  node: TNativeCollectionNode<unknown>
  view: RefObject<View | null>
  removeView: RefObject<View | null>
  props: () => TNativeGroupedTagProps
  text: () => string
  order?: number
}>
export type TNativeTagPressMetadata = Readonly<{
  pointerType: TNativeTagGroupPointerType
  key?: string
  shiftKey: boolean
  selectionModifier: boolean
  nonContiguousModifier: boolean
  primaryAtStart?: boolean
  suppressed?: boolean
}>
export const NativeTagItemValueContext = createContext<{
  key: TNativeTagGroupKey
  order: number
  value?: unknown
} | null>(null)
export const NativeTagGroupActionsContext = createContext<{
  text: TextStyle
  register: (row: TNativeTagRegistration) => () => void
  refresh: (row: TNativeTagRegistration) => void
  mode: TNativeTagGroupSelectionMode
  behavior: TNativeTagGroupSelectionBehavior
  allowsRemoving: boolean
  labels: TNativeTagGroupLabels
  disabled: (row: TNativeTagRegistration, props?: TNativeGroupedTagProps) => boolean
  selected: (row: TNativeTagRegistration) => boolean
  semantics: (row: TNativeTagRegistration) => string
  actionState: (row: TNativeTagRegistration, props?: TNativeGroupedTagProps) => TNativeTagGroupActionState
  focus: (row: TNativeTagRegistration, focused: boolean, visible: boolean) => void
  keyCapture: (row: TNativeTagRegistration, event: TNativeKeyboardEvent) => void
  press: (
    row: TNativeTagRegistration,
    phase: TNativeTagGroupPressPhase,
    event: TNativePressEvent,
    metadata: TNativeTagPressMetadata,
  ) => void
  remove: (row: TNativeTagRegistration, source: "button" | "keyboard", event: TNativePressEvent) => void
} | null>(null)

export const NativeTagGroupStateContext = createContext<ListState<object> | null>(null)

export const NativeTagGroupContext =
  createContext<TNativeContextValue<Partial<Omit<TNativeTagGroupProps, "children" | "items" | "getKey">>, View>>(null)
export type TNativeTagListContextProps = Partial<TNativeTagListProps> & {
  nativeLabelledBy?: readonly string[]
  nativeDescribedBy?: readonly string[]
  nativeDetailsBy?: readonly string[]
  nativeDescriptionLabel?: string
  nativeDetailsLabel?: string
}
export const NativeTagListContext = createContext<TNativeContextValue<TNativeTagListContextProps, View>>(null)
export const NativeTagListRenderContext = createContext<{
  persistedKeys: Set<TNativeTagGroupKey> | null
  scrollRef: RefObject<TNativeCollectionScrollHost | null>
  defaultStyle: TextStyle
} | null>(null)
