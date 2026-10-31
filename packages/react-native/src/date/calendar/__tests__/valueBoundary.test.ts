import { CalendarDate, CalendarDateTime, JapaneseCalendar, parseZonedDateTime } from "@internationalized/date"

import { nativeCalendarCallbackDate, nativeCalendarOutput } from "../valueBoundary"

let foreign: typeof import("@internationalized/date")
jest.isolateModules(() => {
  foreign = jest.requireActual("@internationalized/date")
})

it("returns owned CalendarDate values when the public calendar uses another module instance", () => {
  const date = new foreign.CalendarDate(2024, 11, 3)
  expect(date instanceof CalendarDate).toBe(false)
  const result = nativeCalendarOutput(date, null)
  expect(result).toBeInstanceOf(CalendarDate)
  expect(result.toString()).toBe("2024-11-03")
})

it("preserves the original non-Gregorian calendar and CalendarDate class", () => {
  const calendar = new JapaneseCalendar()
  const original = new CalendarDate(calendar, "reiwa", 6, 10, 10)
  const date = new foreign.CalendarDate(calendar, "reiwa", 6, 11, 3)
  const result = nativeCalendarOutput(date, original)
  expect(result).toBeInstanceOf(CalendarDate)
  expect(result.calendar).toBe(calendar)
  expect(result.toString()).toBe("2024-11-03")
  expect(original.toString()).toBe("2024-10-10")
})

it("preserves hidden CalendarDateTime precision when only the calendar day changes", () => {
  const original = new CalendarDateTime(2024, 10, 10, 17, 26, 35, 456)
  const result = nativeCalendarOutput(new foreign.CalendarDate(2024, 11, 3), original)
  expect(result).toBeInstanceOf(CalendarDateTime)
  expect(result.toString()).toBe("2024-11-03T17:26:35.456")
  expect(original.toString()).toBe("2024-10-10T17:26:35.456")
})

it("retains separate endpoint times and resolves DST through the original ZonedDateTime", () => {
  const start = parseZonedDateTime("2024-10-10T08:15-04:00[America/New_York]")
  const end = parseZonedDateTime("2024-10-11T19:45-04:00[America/New_York]")
  const selectedStart = nativeCalendarOutput(new foreign.CalendarDate(2024, 11, 4), start)
  const selectedEnd = nativeCalendarOutput(new foreign.CalendarDate(2024, 11, 5), end)
  expect(selectedStart.constructor).toBe(start.constructor)
  expect(selectedEnd.constructor).toBe(end.constructor)
  expect(selectedStart.calendar.constructor).toBe(start.calendar.constructor)
  expect(selectedStart.calendar.identifier).toBe(start.calendar.identifier)
  expect(selectedStart.toString()).toBe("2024-11-04T08:15:00-05:00[America/New_York]")
  expect(selectedEnd.toString()).toBe("2024-11-05T19:45:00-05:00[America/New_York]")
  expect(start.toString()).toBe("2024-10-10T08:15:00-04:00[America/New_York]")
})

it("passes owned CalendarDate objects and the original display calendar to availability callbacks", () => {
  const calendar = new JapaneseCalendar()
  const date = new foreign.CalendarDate(calendar, "reiwa", 6, 11, 3)
  const result = nativeCalendarCallbackDate(date)
  expect(result).toBeInstanceOf(CalendarDate)
  expect(result.calendar).toBe(calendar)
  expect(result.toString()).toBe("2024-11-03")
})
