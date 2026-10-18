import { createContext, type RefObject } from "react"
import type { TextStyle, View } from "react-native"

import type { TNativePressEvent } from "../../input/types"

import type { TNativeMenuKey, TNativeMenuSelectionMode } from "./model"
import type { TNativeMenuItemProps } from "./types"

export type TNativeMenuRegistration = {
  id: TNativeMenuKey
  view: RefObject<View | null>
  props: () => TNativeMenuItemProps
  text: () => string
}
export type TNativeMenuContext = {
  register: (row: TNativeMenuRegistration) => () => void
  refresh: (row: TNativeMenuRegistration) => void
  mode: TNativeMenuSelectionMode
  text: TextStyle
  disabled: (row: TNativeMenuRegistration) => boolean
  selected: (row: TNativeMenuRegistration) => boolean
  focus: (row: TNativeMenuRegistration) => boolean
  activate: (row: TNativeMenuRegistration, event: TNativePressEvent) => void
  layout: (row: TNativeMenuRegistration, frame: { y: number; height: number }) => void
  typeahead: (row: TNativeMenuRegistration, value: string, time: number) => void
}
export const NativeMenuContext = createContext<TNativeMenuContext | null>(null)
