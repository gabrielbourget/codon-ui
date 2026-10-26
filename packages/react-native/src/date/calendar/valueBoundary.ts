import { CalendarDate, GregorianCalendar, toCalendarDate } from "@internationalized/date"

import type { DateValue } from "../state/types"

// Metro can select the public calendar hook's CommonJS entry while the owned
// field uses ESM. Date outputs retain the owner's actual constructor/calendar;
// callback-only calendar days use the same owned value runtime as the fields.
export const nativeCalendarOutput = (date: DateValue, original: DateValue | null): DateValue => {
  if (original) return original.set(toCalendarDate(date))
  return new CalendarDate(new GregorianCalendar(), date.era, date.year, date.month, date.day)
}
export const nativeCalendarCallbackDate = (date: DateValue) =>
  new CalendarDate(date.calendar, date.era, date.year, date.month, date.day)
