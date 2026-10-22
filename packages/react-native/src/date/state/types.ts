import type { DateFieldStateOptions } from "react-stately/useDateFieldState"
import type { DateValue, Granularity, MappedDateValue } from "react-stately/useDateFieldState"
import type { MappedTimeValue, TimePickerProps, TimeValue } from "react-stately/useTimeFieldState"

export type { DateValue, Granularity, MappedDateValue, MappedTimeValue, TimePickerProps, TimeValue }
export type DatePickerProps<T extends DateValue> = DateFieldStateOptions<T>
