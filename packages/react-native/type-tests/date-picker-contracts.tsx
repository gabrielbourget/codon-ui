import { CalendarDate, CalendarDateTime, Time, parseZonedDateTime } from "@internationalized/date"
import { createRef } from "react"
import type { View } from "react-native"

import {
  DateTimePicker,
  DateTimeRangePicker,
  NativeFocusView,
  NativeDatePickerContext,
  NativeDateRangePickerContext,
  type TNativeDateTimePickerProps,
  type TNativeDateTimeRangePickerProps,
} from "../src"

export const DateClasses = [
  new CalendarDate(2024, 10, 1),
  new CalendarDateTime(2024, 10, 1, 13, 45, 7),
  parseZonedDateTime("2024-10-01T13:45[America/New_York]"),
]
export const Dates = DateClasses.map((value) => (
  <DateTimePicker
    value={value}
    ref={createRef<View>()}
    name="when"
    form="external"
    onChange={(value) => value?.calendar.identifier}
    shouldCloseOnSelect={false}
  />
))
export const Ranges = DateClasses.map((start) => (
  <DateTimeRangePicker
    ref={createRef<View>()}
    value={{ start, end: start.add({ days: 2 }) }}
    startName="date"
    endName="date"
    allowsNonContiguousRanges
    onChange={(next) => next?.end.toString()}
  />
))
export const TimePrecision: TNativeDateTimePickerProps<CalendarDateTime> = {
  value: new CalendarDateTime(2024, 10, 1, 13, 45),
  granularity: "second",
  onChange: (next) => next?.hour,
}
export const RangePrecision: TNativeDateTimeRangePickerProps<CalendarDateTime> = {
  value: { start: new CalendarDateTime(2024, 10, 1, 13), end: new CalendarDateTime(2024, 10, 2, 18) },
  onChange: (next) => next?.start.hour,
}
export const FullRenderer = (
  <DateTimeRangePicker
    value={null}
    defaultValue={{ start: DateClasses[0], end: DateClasses[0] }}
    hourCycle={24}
    isReadOnly
    isRequired
    labels={{ calendarAriaLabel: "" }}
    customStyles={{ opacity: 0 }}
    style={({ state, isFocusWithin, isFocusVisible, defaultStyle }) => [
      defaultStyle,
      { opacity: isFocusWithin && isFocusVisible ? 0.5 : 1, margin: state.isInvalid ? 0 : 2 },
    ]}
    render={(props, state) => <NativeFocusView {...props} accessibilityLabel={state.isOpen ? "Open" : "Closed"} />}
  />
)
export const Slots = (
  <NativeDatePickerContext.Provider
    value={{ slots: { start: { isReadOnly: true, style: { opacity: 0 }, ref: createRef<View>() } } }}
  >
    <DateTimePicker slot="start" isReadOnly={false} />
    <DateTimePicker slot={null} />
  </NativeDatePickerContext.Provider>
)
export const RangeContext = (
  <NativeDateRangePickerContext.Provider value={{ onChange: (range) => range?.start.toString() }}>
    <DateTimeRangePicker />
  </NativeDateRangePickerContext.Provider>
)
// @ts-expect-error Values retain the date class instead of becoming strings.
export const StringValue = <DateTimePicker value="2024-10-01" />
// @ts-expect-error A time without a date is not a date picker value.
export const TimeOnly = <DateTimePicker value={new Time(13)} />
// @ts-expect-error Endpoint partial drafts are internal state, not a complete controlled range.
export const IncompleteRange = <DateTimeRangePicker value={{ start: DateClasses[0], end: null }} />
// @ts-expect-error Source range forms use the two endpoint names.
export const RangeName = <DateTimeRangePicker name="range" />
// @ts-expect-error The existing source cycles are 12 or 24.
export const InvalidCycle = <DateTimePicker hourCycle={13} />
// @ts-expect-error Native styles do not accept CSS units.
export const CSSFont = <DateTimePicker customInputStyles={{ fontSize: "1rem" }} />
// @ts-expect-error The root exposes the actual original View.
export const FakeRef = <DateTimePicker ref={createRef<{ focus: () => void }>()} />
// @ts-expect-error Range refs also retain the original native View.
export const FakeRangeRef = <DateTimeRangePicker ref={createRef<{ focus: () => void }>()} />
// @ts-expect-error A renderer returns its original host element.
export const MissingHost = <DateTimePicker render={() => null} />
// @ts-expect-error Wrapper-owned appearance is calibrated before the base picker context.
export const WrapperContext = <NativeDatePickerContext.Provider value={{ customStyles: { opacity: 0 } }} />
