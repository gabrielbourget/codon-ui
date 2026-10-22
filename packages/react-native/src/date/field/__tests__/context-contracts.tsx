import type { ZonedDateTime } from "@internationalized/date"
import { CalendarDate, CalendarDateTime, Time } from "@internationalized/date"

import { NativeTimeFieldContext } from "../context"
import type { TNativeTimeFieldProps } from "../types"

const time: TNativeTimeFieldProps<Time> = {
  value: new Time(13, 45),
  onChange(value) {
    void value?.hour
    // @ts-expect-error Time owners do not gain calendar fields.
    void value?.year
  },
  onFocus(event) {
    void (event.nativeEvent.isFocused satisfies boolean)
    // @ts-expect-error Public focus callbacks keep the existing native focus-event shape.
    void event.nativeEvent.focusedTarget
  },
  onKeyDown(event) {
    void (event.nativeEvent.phase satisfies "down" | "up")
  },
  name: "clock",
  form: "owner-form",
  slot: null,
  autoComplete: "off",
}
const calendar: TNativeTimeFieldProps<CalendarDateTime> = {
  value: new CalendarDateTime(2024, 10, 1, 13, 45),
  onChange(value) {
    void value?.year
    void value?.hour
  },
  minValue: new Time(10),
}
const zoned: TNativeTimeFieldProps<ZonedDateTime> = {
  onChange(value) {
    void value?.timeZone
    void value?.offset
  },
}
const invalidValue: TNativeTimeFieldProps = {
  // @ts-expect-error Calendar-only values are not time-field values.
  value: new CalendarDate(2024, 10, 1),
}
const invalidDisplay: TNativeTimeFieldProps = {
  // @ts-expect-error Time fields preserve the source hour/minute/second boundary.
  granularity: "day",
}
const invalidLabel: TNativeTimeFieldProps = {
  // @ts-expect-error RAC TimeField omits direct label props in favor of its slot context.
  label: "Clock",
}
const nativeLabels: TNativeTimeFieldProps<Time> = {
  nativeAccessibilityLabels: { required: "Obligatoire", readOnly: "" },
}
const invalidNativeLabels: TNativeTimeFieldProps = {
  // @ts-expect-error Native captions are localizable text, not state flags.
  nativeAccessibilityLabels: { required: true },
}
const context = (
  <NativeTimeFieldContext.Provider
    value={{ value: calendar.value, onChange: (value: CalendarDateTime | null) => value?.day }}
  />
)
void time
void calendar
void zoned
void invalidValue
void invalidDisplay
void invalidLabel
void nativeLabels
void invalidNativeLabels
void context
