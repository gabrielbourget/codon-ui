import { CalendarDate, CalendarDateTime, Time } from "@internationalized/date"

import {
  DateTimePicker,
  DateTimeRangePicker,
  TimePicker,
  type TNativeDateTimePickerProps,
  type TNativeDateTimeRangePickerProps,
} from "../src"

export const CalendarOptions: TNativeDateTimePickerProps<CalendarDate> = {
  value: new CalendarDate(2024, 10, 10),
  firstDayOfWeek: "mon",
  pageBehavior: "visible",
  dayLength: "long",
  multiMonth: false,
  labels: { inputButtonGroupAriaLabel: "", calendarAriaLabel: "Dates" },
  onChange: (value) => {
    void value?.calendar.identifier
    // @ts-expect-error CalendarDate ownership does not add time fields.
    void value?.hour
  },
}
export const RangeOptions: TNativeDateTimeRangePickerProps<CalendarDateTime> = {
  value: { start: new CalendarDateTime(2024, 10, 10, 13), end: new CalendarDateTime(2024, 10, 12, 19) },
  allowsNonContiguousRanges: true,
  firstDayOfWeek: "sun",
  pageBehavior: "single",
  shouldCloseOnSelect: () => false,
  isDateUnavailable: (value) => value.day === 14,
  customCalendarGridBodyCellStyles: { borderRadius: 0 },
  onChange: (value) => value?.end.hour,
}
export const PublicCalendarOptions = <DateTimePicker {...CalendarOptions} />
export const PublicRangeOptions = <DateTimeRangePicker {...RangeOptions} />
export const PublicTimeGranularity = <TimePicker value={new Time(13)} granularity="second" />

// @ts-expect-error Calendar weekday options use the declared weekday identifiers.
export const InvalidWeekday = <DateTimePicker firstDayOfWeek="monday" />
// @ts-expect-error Page behavior describes calendar pages, not a numeric interval.
export const InvalidPageBehavior = <DateTimeRangePicker pageBehavior={2} />
// @ts-expect-error Weekday text length does not admit arbitrary display strings.
export const InvalidDayLength = <DateTimeRangePicker dayLength="full" />
// @ts-expect-error Date labels are strings, including explicit empty strings.
export const InvalidCalendarLabel = <DateTimePicker labels={{ calendarAriaLabel: false }} />
// @ts-expect-error Time granularity cannot include a date-only segment.
export const InvalidTimeGranularity = <TimePicker granularity="day" />
// @ts-expect-error Canonical dynamic text-size fallback remains a string boundary.
export const InvalidTimeSize = <TimePicker textSize={14} />
// @ts-expect-error The single picker does not expose a range-selection policy.
export const InvalidSingleRangePolicy = <DateTimePicker allowsNonContiguousRanges />
