import { CalendarDate, CalendarDateTime, parseZonedDateTime } from "@internationalized/date"

import { DateTimePicker, DateTimeRangePicker, TimePicker } from "../src"

const date = new CalendarDate(2024, 10, 1)
const dateTime = new CalendarDateTime(2024, 10, 1, 13, 45)
const zoned = parseZonedDateTime("2024-10-01T13:45-04:00[America/New_York]")

export const DateOnlyInference = (
  <DateTimePicker
    value={date}
    onChange={(next) => {
      void (next satisfies CalendarDate | null)
      next?.year.toFixed()
      // @ts-expect-error A date-only value does not gain time fields.
      void next?.hour
    }}
  />
)

export const DateTimeDefaultInference = (
  <DateTimePicker
    defaultValue={dateTime}
    onChange={(next) => {
      void (next satisfies CalendarDateTime | null)
      next?.hour.toFixed()
      // @ts-expect-error An unzoned date-time does not gain a time zone.
      void next?.timeZone
    }}
  />
)

export const ZonedRangeInference = (
  <DateTimeRangePicker
    value={{ start: zoned, end: zoned.add({ hours: 1 }) }}
    onChange={(next) => {
      void (next satisfies { start: typeof zoned; end: typeof zoned } | null)
      next?.start.timeZone.toUpperCase()
      next?.end.offset.toFixed()
      // @ts-expect-error Date values retain their class rather than becoming JavaScript Date objects.
      next?.end.toISOString()
    }}
  />
)

export const DateTimeRangeDefaultInference = (
  <DateTimeRangePicker
    defaultValue={{ start: dateTime, end: dateTime.add({ hours: 1 }) }}
    onChange={(next) => {
      void (next satisfies { start: CalendarDateTime; end: CalendarDateTime } | null)
      next?.start.hour.toFixed()
      // @ts-expect-error Unzoned range endpoints do not gain a time zone.
      void next?.end.timeZone
    }}
  />
)

export const ZonedTimeInference = (
  <TimePicker
    value={zoned}
    onChange={(next) => {
      void (next satisfies typeof zoned | null)
      next?.timeZone.toUpperCase()
      next?.year.toFixed()
      // @ts-expect-error Zoned time values are not JavaScript Date objects.
      next?.toISOString()
    }}
  />
)

export const DateTimeTimeDefaultInference = (
  <TimePicker
    defaultValue={dateTime}
    onChange={(next) => {
      void (next satisfies CalendarDateTime | null)
      next?.month.toFixed()
      // @ts-expect-error An unzoned time value does not gain a time zone.
      void next?.timeZone
    }}
  />
)
