import { createContext, type RefObject } from "react"
import type { View } from "react-native"

import type { TNativeKeyboardEvent, TNativePressEvent } from "../../input/types"

import type { TNativeTagGroupActionState, TNativeTagGroupPointerType, TNativeTagGroupPressPhase } from "./intent"
import type { TNativeTagGroupKey, TNativeTagGroupSelectionBehavior, TNativeTagGroupSelectionMode } from "./model"
import type { TNativeGroupedTagProps, TNativeTagGroupLabels } from "./types"

export type TNativeTagRegistration = Readonly<{
  key: TNativeTagGroupKey
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
export const NativeTagItemValueContext = createContext<{ key: TNativeTagGroupKey; order: number } | null>(null)
export const NativeTagGroupContext = createContext<{
  register: (row: TNativeTagRegistration) => () => void
  refresh: (row: TNativeTagRegistration) => void
  mode: TNativeTagGroupSelectionMode
  behavior: TNativeTagGroupSelectionBehavior
  allowsRemoving: boolean
  labels: TNativeTagGroupLabels
  disabled: (row: TNativeTagRegistration, props?: TNativeGroupedTagProps) => boolean
  selected: (row: TNativeTagRegistration) => boolean
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
