import { DateFormatter, isSameDay, isToday, type CalendarDate } from "@internationalized/date"

import { LocalizedStringDictionary, LocalizedStringFormatter } from "../strings"

import type { TNativeCalendarState } from "./keys"
import messages from "./messages"

const dictionary = new LocalizedStringDictionary(messages)
export const calendarStrings = (locale: string) => new LocalizedStringFormatter(locale, dictionary)
export const nativeCalendarTitle = (state: TNativeCalendarState, locale: string) => {
  const formatter = new DateFormatter(locale, { month: "long", year: "numeric", timeZone: state.timeZone })
  return formatter.formatRange(
    state.visibleRange.start.toDate(state.timeZone),
    state.visibleRange.end.toDate(state.timeZone),
  )
}
export const nativeCalendarSelection = (state: TNativeCalendarState, locale: string) => {
  const strings = calendarStrings(locale),
    format = new DateFormatter(locale, { month: "long", day: "numeric", year: "numeric", timeZone: state.timeZone })
  if ("anchorDate" in state)
    return state.value
      ? strings.format("selectedRangeDescription", {
          dateRange: strings.format("dateRange", {
            startDate: format.format(state.value.start.toDate(state.timeZone)),
            endDate: format.format(state.value.end.toDate(state.timeZone)),
          }),
        })
      : ""
  return state.value
    ? strings.format("selectedDateDescription", { date: format.format(state.value.toDate(state.timeZone)) })
    : ""
}
export const nativeCalendarDaySemantics = (
  state: TNativeCalendarState,
  date: CalendarDate,
  locale: string,
  outsideMonth: boolean,
) => {
  const strings = calendarStrings(locale),
    selected = state.isSelected(date),
    focused = state.isCellFocused(date) && !outsideMonth
  const range = "anchorDate" in state
  const invalid =
    state.isValueInvalid &&
    (range
      ? !state.anchorDate &&
        !!state.highlightedRange &&
        date.compare(state.highlightedRange.start) >= 0 &&
        date.compare(state.highlightedRange.end) <= 0
      : !!state.value && isSameDay(state.value, date))
  const boundary = range
    ? !!state.highlightedRange &&
      (isSameDay(state.highlightedRange.start, date) || isSameDay(state.highlightedRange.end, date))
    : false
  let label = new DateFormatter(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: state.timeZone,
    era: date.calendar.identifier === "gregory" && date.era !== "BC" ? undefined : "short",
  }).format(date.toDate(state.timeZone))
  if (
    range &&
    state.value &&
    !state.anchorDate &&
    (isSameDay(state.value.start, date) || isSameDay(state.value.end, date))
  )
    label = nativeCalendarSelection(state, locale) + ", " + label
  if (isToday(date, state.timeZone))
    label = strings.format(selected ? "todayDateSelected" : "todayDate", { date: label })
  else if (selected) label = strings.format("dateSelected", { date: label })
  if (state.minValue && isSameDay(state.minValue, date)) label += ", " + strings.format("minimumDate")
  else if (state.maxValue && isSameDay(state.maxValue, date)) label += ", " + strings.format("maximumDate")
  return {
    selected: selected || invalid,
    focused,
    invalid,
    boundary,
    label,
    disabled: state.isCellDisabled(date),
    unavailable: state.isCellUnavailable(date),
    today: isToday(date, state.timeZone),
    prompt:
      range && focused && !state.isReadOnly && !state.isCellDisabled(date) && !state.isCellUnavailable(date)
        ? strings.format(state.anchorDate ? "finishRangeSelectionPrompt" : "startRangeSelectionPrompt")
        : "",
  }
}
