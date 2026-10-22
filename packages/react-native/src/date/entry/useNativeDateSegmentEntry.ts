/*
 * Copyright 2020 Adobe. All rights reserved.
 * Licensed under the Apache License, Version 2.0.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

import { CalendarDate, DateFormatter, toCalendar } from "@internationalized/date"
import { NumberParser } from "@internationalized/number"
import { useMemo, useRef } from "react"

import type { TNativeKeyboardEvent } from "../../input/types"
import type { DateFieldState, DateSegment } from "../state/useDateFieldState"

export type TNativeDateSegmentFocus = Readonly<{
  focusNext: () => void
  focusPrevious: () => void
}>
export type TNativeDateSegmentAdjustment =
  | "increment"
  | "decrement"
  | "incrementPage"
  | "decrementPage"
  | "incrementToMax"
  | "decrementToMin"
export type TNativeDateSegmentKeyEvent = Pick<
  TNativeKeyboardEvent,
  "nativeEvent" | "preventDefault" | "stopPropagation"
>

const commonPrefixLength = (strings: string[]) => {
  strings.sort()
  const first = strings[0],
    last = strings[strings.length - 1]
  for (let index = 0; index < first.length; index++) if (first[index] !== last[index]) return index
  return 0
}

// Keep the pinned entered-key algebra separate from native event and focus admission.
export const useNativeDateSegmentEntry = (
  segment: DateSegment,
  state: DateFieldState,
  locale: string,
  focus: TNativeDateSegmentFocus,
) => {
  const enteredKeys = useRef("")
  const parser = useMemo(() => new NumberParser(locale, { maximumFractionDigits: 0 }), [locale])
  const collator = useMemo(() => new Intl.Collator(locale, { usage: "search", sensitivity: "base" }), [locale])
  const startsWith = (text: string, prefix: string) => {
    if (prefix.length === 0) return true
    text = text.normalize("NFC")
    prefix = prefix.normalize("NFC")
    return collator.compare(text.slice(0, prefix.length), prefix) === 0
  }
  const periodFormatter = useMemo(() => new DateFormatter(locale, { hour: "numeric", hour12: true }), [locale])
  const periods = useMemo(() => {
    const amDate = new Date(),
      pmDate = new Date()
    amDate.setHours(0)
    pmDate.setHours(12)
    return {
      am: periodFormatter.formatToParts(amDate).find((part) => part.type === "dayPeriod")!.value,
      pm: periodFormatter.formatToParts(pmDate).find((part) => part.type === "dayPeriod")!.value,
    }
  }, [periodFormatter])
  const eraFormatter = useMemo(
    () => new DateFormatter(locale, { year: "numeric", era: "narrow", timeZone: "UTC" }),
    [locale],
  )
  const eras = useMemo(() => {
    if (segment.type !== "era") return []
    const date = toCalendar(new CalendarDate(1, 1, 1), state.calendar)
    const values = state.calendar.getEras().map((era) => ({
      era,
      formatted: eraFormatter
        .formatToParts(date.set({ year: 1, month: 1, day: 1, era }).toDate("UTC"))
        .find((part) => part.type === "era")!.value,
    }))
    const prefixLength = commonPrefixLength(values.map((value) => value.formatted))
    if (prefixLength) for (const value of values) value.formatted = value.formatted.slice(prefixLength)
    return values
  }, [eraFormatter, state.calendar, segment.type])

  const input = (key: string) => {
    if (state.isDisabled || state.isReadOnly) return
    const newValue = enteredKeys.current + key
    switch (segment.type) {
      case "dayPeriod":
        if (startsWith(periods.am, key)) state.setSegment("dayPeriod", 0)
        else if (startsWith(periods.pm, key)) state.setSegment("dayPeriod", 1)
        else break
        focus.focusNext()
        break
      case "era": {
        const matched = eras.find((era) => startsWith(era.formatted, key))
        if (matched) {
          state.setSegment("era", matched.era)
          focus.focusNext()
        }
        break
      }
      case "day":
      case "hour":
      case "minute":
      case "second":
      case "month":
      case "year": {
        if (!parser.isValidPartialNumber(newValue)) return
        const numberValue = parser.parse(newValue)
        let segmentValue = numberValue
        if (segment.maxValue !== undefined && numberValue > segment.maxValue) segmentValue = parser.parse(key)
        if (isNaN(numberValue)) return
        state.setSegment(segment.type, segmentValue)
        if (
          segment.maxValue !== undefined &&
          (Number(numberValue + "0") > segment.maxValue || newValue.length >= String(segment.maxValue).length)
        ) {
          enteredKeys.current = ""
          focus.focusNext()
        } else enteredKeys.current = newValue
        break
      }
    }
  }
  const backspace = () => {
    if (state.isDisabled) return
    if (segment.text === segment.placeholder) focus.focusPrevious()
    if (parser.isValidPartialNumber(segment.text) && !state.isReadOnly && !segment.isPlaceholder) {
      let newValue = segment.text.slice(0, -1)
      const parsed = parser.parse(newValue)
      newValue = parsed === 0 ? "" : newValue
      if (newValue.length === 0 || parsed === 0) state.clearSegment(segment.type)
      else state.setSegment(segment.type, parsed)
      enteredKeys.current = newValue
    } else if (segment.type === "dayPeriod" || segment.type === "era") state.clearSegment(segment.type)
  }
  const adjust = (action: TNativeDateSegmentAdjustment) => {
    if (state.isDisabled || state.isReadOnly || !segment.isEditable) return
    enteredKeys.current = ""
    state[action](segment.type)
  }
  const keyDown = (event: TNativeDateSegmentKeyEvent, isComposing = false) => {
    const data = event.nativeEvent
    if (state.isDisabled || data.phase !== "down" || data.cancelled) return
    // The two supported native targets use the source's non-Mac Ctrl+A rule.
    if (data.key === "a" && data.ctrlKey) event.preventDefault()
    if (data.ctrlKey || data.metaKey || data.shiftKey || data.altKey) return
    if (!isComposing && !state.isReadOnly && segment.isEditable) {
      const actions: Partial<Record<string, TNativeDateSegmentAdjustment>> = {
        PageUp: "incrementPage",
        ArrowUp: "increment",
        Up: "increment",
        PageDown: "decrementPage",
        ArrowDown: "decrement",
        Down: "decrement",
        Home: "decrementToMin",
        End: "incrementToMax",
      }
      const action = actions[data.key]
      if (action) {
        event.preventDefault()
        adjust(action)
      }
    }
    // The pinned segment's delete handler remains separate from spinbutton composing guards.
    if (data.key === "Backspace" || data.key === "Delete") {
      event.preventDefault()
      event.stopPropagation()
      backspace()
    }
  }
  const compositionText = (text: string) => {
    // Pinned Android/Pinyin composition admits matching AM/PM text here; numeric
    // composition reaches input only when the owned SDK reports its commit.
    if (startsWith(periods.am, text) || startsWith(periods.pm, text)) input(text)
  }
  const options = state.dateFormatter.resolvedOptions()
  const hourFormatter = useMemo(
    () => new DateFormatter(locale, { hour: "numeric", hour12: options.hour12, timeZone: options.timeZone }),
    [locale, options.hour12, options.timeZone],
  )
  const monthFormatter = useMemo(
    () => new DateFormatter(locale, { month: "long", timeZone: options.timeZone }),
    [locale, options.timeZone],
  )
  let textValue = segment.isPlaceholder ? "" : segment.text
  if (segment.type === "month" && !segment.isPlaceholder) {
    const month = monthFormatter.format(state.dateValue)
    textValue = month !== textValue ? `${textValue} – ${month}` : month
  } else if (segment.type === "hour" && !segment.isPlaceholder) textValue = hourFormatter.format(state.dateValue)
  return {
    input,
    backspace,
    adjust,
    keyDown,
    compositionText,
    focus: () => {
      enteredKeys.current = ""
    },
    textValue,
  }
}
