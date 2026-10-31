import { createContext } from "react"
import type { View } from "react-native"

import type { TNativeContextValue } from "../../collection/context"
import type { DateValue } from "../state/types"
import type { DatePickerState } from "../state/useDatePickerState"
import type { DateRangePickerState } from "../state/useDateRangePickerState"

import type { TNativeDateTimePickerProps, TNativeDateTimeRangePickerProps, TNativeDatePickerAppearance } from "./types"

type TSingleContext = Omit<
  Partial<TNativeDateTimePickerProps>,
  keyof TNativeDatePickerAppearance | "onChange" | "validate"
> & {
  onChange?: { change(value: DateValue | null): void }["change"]
  validate?: { validate(value: DateValue): ReturnType<NonNullable<TNativeDateTimePickerProps["validate"]>> }["validate"]
}
type TRangeContext = Omit<
  Partial<TNativeDateTimeRangePickerProps>,
  keyof TNativeDatePickerAppearance | "onChange" | "validate"
> & {
  onChange?: { change(value: { start: DateValue; end: DateValue } | null): void }["change"]
  validate?: {
    validate(value: {
      start: DateValue
      end: DateValue
    }): ReturnType<NonNullable<TNativeDateTimeRangePickerProps["validate"]>>
  }["validate"]
}
export const NativeDatePickerContext = createContext<TNativeContextValue<TSingleContext, View>>(null)
export const NativeDateRangePickerContext = createContext<TNativeContextValue<TRangeContext, View>>(null)
export const NativeDatePickerStateContext = createContext<DatePickerState | null>(null)
export const NativeDateRangePickerStateContext = createContext<DateRangePickerState | null>(null)
