import type { CalendarDate } from "@internationalized/date"
import { createContext, type RefObject } from "react"
import type { View } from "react-native"

import type { TNativeCollectionSnapshot } from "../../collection/snapshot"
import type { TNativeDatePickerAppearanceResult } from "../picker/appearance"
import type { TNativeDatePickerOptions } from "../picker/NativeDatePickerView"
import type { TNativeDatePickerLabels } from "../picker/types"

import type { TNativeCalendarState } from "./keys"
import type { NativeCalendarRangeGesture } from "./rangeGesture"
import type { NativeCalendarTargets } from "./targets"
import type { useNativeCalendarPointers } from "./useCalendarPointers"
export type TCalendarProps = {
  options: TNativeDatePickerOptions & { locale: string; direction: "ltr" | "rtl" }
  appearance: TNativeDatePickerAppearanceResult
  labels: TNativeDatePickerLabels
  initialFocusRef: RefObject<View | null>
  testID: string
}
export type TCalendarOwner = TCalendarProps & {
  state: TNativeCalendarState
  targets: NativeCalendarTargets
  gesture: NativeCalendarRangeGesture | null
  pointers: ReturnType<typeof useNativeCalendarPointers>
  canAct: () => boolean
  request: (date: CalendarDate, run: (state: TNativeCalendarState) => void) => void
}
export const Owner = createContext<TCalendarOwner | null>(null)
export const Grid = createContext<{
  collection: TNativeCollectionSnapshot<object>
  target: number
  headers: Map<number, number>
  registerHeader: (index: number, target: number) => void
} | null>(null)
