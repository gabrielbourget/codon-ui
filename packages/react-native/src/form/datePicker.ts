import type { DateValue } from "../date/state/types"
import type { DatePickerState } from "../date/state/useDatePickerState"
import type { DateRangePickerState } from "../date/state/useDateRangePickerState"

import { nativeDateFieldFormData, type TNativeTimeFieldFormOptions } from "./timeField"
import type { TNativeFormEntry } from "./types"

export type TNativeDatePickerFormOptions = TNativeTimeFieldFormOptions & {
  startName?: string
  endName?: string
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
}
type TDateState = Pick<DatePickerState, "value" | "realtimeValidation">
type TRangeState = Pick<DateRangePickerState, "value" | "realtimeValidation">

export const nativeDatePickerData = (props: TNativeDatePickerFormOptions, state: TDateState | TRangeState) => {
  const range = state.value !== null && "start" in state.value
  const entries: TNativeFormEntry[] = []
  const append = (name: string | undefined, value: DateValue | null) => {
    if (name) entries.push([name, value?.toString() ?? ""])
  }
  if (range) {
    const value = (state as TRangeState).value
    append(props.startName, value.start)
    append(props.endName, value.end)
  } else append(props.name, state.value as DateValue | null)
  const complete = range
    ? !!((state as TRangeState).value.start && (state as TRangeState).value.end)
    : state.value !== null
  return nativeDateFieldFormData(
    props,
    {
      isDisabled: props.isDisabled ?? false,
      isReadOnly: props.isReadOnly ?? false,
      isRequired: props.isRequired ?? false,
      realtimeValidation: state.realtimeValidation,
    },
    entries,
    !complete,
  )
}
