import { CalendarDateTime } from "@internationalized/date"
import { createRef } from "react"
import type { View } from "react-native"

import {
  DateTimePicker,
  DateTimeRangePicker,
  NativeFocusView,
  type TNativeDateTimePickerProps,
  type TNativeDateTimeRangePickerProps,
} from "../../../index"

const value = new CalendarDateTime(2024, 10, 1, 13, 45)
const authoredSize: string = "canonical-custom"
export const SingleRootContract = (
  <DateTimePicker
    value={value}
    accessible
    textSize={authoredSize}
    ref={createRef<View>()}
    render={(props) => <NativeFocusView {...props} />}
  />
)
export const RangeRootContract = (
  <DateTimeRangePicker
    value={{ start: value, end: value.add({ days: 2 }) }}
    accessible={false}
    textSize=""
    ref={createRef<View>()}
    render={(props) => <NativeFocusView {...props} />}
  />
)
export const SingleStringFallback: TNativeDateTimePickerProps<CalendarDateTime> = { textSize: authoredSize }
export const RangeStringFallback: TNativeDateTimeRangePickerProps<CalendarDateTime> = { textSize: authoredSize }

// @ts-expect-error Canonical string fallback does not admit numeric sizes.
export const SingleNumericSize = <DateTimePicker textSize={12} />
// @ts-expect-error Range size tokens remain strings, not arbitrary objects.
export const RangeObjectSize = <DateTimeRangePicker textSize={{ fontSize: 12 }} />
// @ts-expect-error Native root accessibility remains a boolean.
export const SingleInvalidAccessibility = <DateTimePicker accessible="true" />
// @ts-expect-error Native root accessibility remains a boolean for range too.
export const RangeInvalidAccessibility = <DateTimeRangePicker accessible={1} />
