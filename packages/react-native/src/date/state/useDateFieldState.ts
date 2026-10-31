/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import type { Calendar, CalendarIdentifier } from "@internationalized/date"
import { DateFormatter, GregorianCalendar, isEqualCalendar, toCalendar } from "@internationalized/date"
import { NumberFormatter } from "@internationalized/number"
import { useMemo, useState } from "react"

import { useControlledState } from "../../collection/state/useControlledState"
import type { FormValidationState } from "../../components/ComboBox/state/useFormValidationState"
import { useFormValidationState } from "../../components/ComboBox/state/useFormValidationState"

import { IncompleteDate } from "./IncompleteDate"
import { getPlaceholder } from "./placeholders"
import type { DatePickerProps, DateValue, Granularity, MappedDateValue } from "./types"
import { convertValue, createPlaceholderDate, getFormatOptions, getValidationResult, useDefaultProps } from "./utils"
import type { FieldOptions, FormatterOptions } from "./utils"
type ValidationState = "valid" | "invalid"

export type DateSegmentType =
  | "era"
  | "year"
  | "month"
  | "day"
  | "hour"
  | "minute"
  | "second"
  | "dayPeriod"
  | "literal"
  | "timeZoneName"
export interface DateSegment {
  /** The type of segment. */
  type: DateSegmentType
  /** The formatted text for the segment. */
  text: string
  /** The numeric value for the segment, if applicable. */
  value?: number | null
  /** The minimum numeric value for the segment, if applicable. */
  minValue?: number
  /** The maximum numeric value for the segment, if applicable. */
  maxValue?: number
  /** Whether the value is a placeholder. */
  isPlaceholder: boolean
  /** A placeholder string for the segment. */
  placeholder: string
  /** Whether the segment is editable. */
  isEditable: boolean
}

export interface DateFieldState extends FormValidationState {
  /** The current field value. */
  value: DateValue | null
  /** The default field value. */
  defaultValue: DateValue | null
  /** The current value, converted to a native JavaScript `Date` object.  */
  dateValue: Date
  /** The calendar system currently in use. */
  calendar: Calendar
  /** Sets the field's value. */
  setValue(value: DateValue | null): void
  /** A list of segments for the current value. */
  segments: DateSegment[]
  /** A date formatter configured for the current locale and format. */
  dateFormatter: DateFormatter
  /**
   * The current validation state of the date field, based on the `validationState`, `minValue`, and `maxValue` props.
   * @deprecated Use `isInvalid` instead.
   */
  validationState: ValidationState | null
  /** Whether the date field is invalid, based on the `isInvalid`, `minValue`, and `maxValue` props. */
  isInvalid: boolean
  /** The granularity for the field, based on the `granularity` prop and current value. */
  granularity: Granularity
  /** The maximum date or time unit that is displayed in the field. */
  maxGranularity: "year" | "month" | Granularity
  /** Whether the field is disabled. */
  isDisabled: boolean
  /** Whether the field is read only. */
  isReadOnly: boolean
  /** Whether the field is required. */
  isRequired: boolean
  /** Increments the given segment. Upon reaching the minimum or maximum value, the value wraps around to the opposite limit. */
  increment(type: DateSegmentType): void
  /** Decrements the given segment. Upon reaching the minimum or maximum value, the value wraps around to the opposite limit. */
  decrement(type: DateSegmentType): void
  /**
   * Increments the given segment by a larger amount, rounding it to the nearest increment.
   * The amount to increment by depends on the field, for example 15 minutes, 7 days, and 5 years.
   * Upon reaching the minimum or maximum value, the value wraps around to the opposite limit.
   */
  incrementPage(type: DateSegmentType): void
  /**
   * Decrements the given segment by a larger amount, rounding it to the nearest increment.
   * The amount to decrement by depends on the field, for example 15 minutes, 7 days, and 5 years.
   * Upon reaching the minimum or maximum value, the value wraps around to the opposite limit.
   */
  decrementPage(type: DateSegmentType): void
  /** Increments the given segment to its maxiumum value. */
  incrementToMax(type: DateSegmentType): void
  /** Decrements the given segment to its minimum value. */
  decrementToMin(type: DateSegmentType): void
  /** Sets the value of the given segment. */
  setSegment(type: "era", value: string): void
  setSegment(type: DateSegmentType, value: number): void
  /** Updates the remaining unfilled segments with the placeholder value. */
  confirmPlaceholder(): void
  /** Clears the value of the given segment, reverting it to the placeholder. */
  clearSegment(type: DateSegmentType): void
  /** Formats the current date value using the given options. */
  formatValue(fieldOptions: FieldOptions): string
  /** Gets a formatter based on state's props. */
  getDateFormatter(locale: string, formatOptions: FormatterOptions): DateFormatter
}

const EDITABLE_SEGMENTS: Partial<Record<DateSegmentType, boolean>> = {
  year: true,
  month: true,
  day: true,
  hour: true,
  minute: true,
  second: true,
  dayPeriod: true,
  era: true,
}

const PAGE_STEP: Partial<Record<DateSegmentType, number>> = {
  year: 5,
  month: 2,
  day: 7,
  hour: 2,
  minute: 15,
  second: 15,
}

const TYPE_MAPPING: Partial<Record<string, DateSegmentType>> = {
  // Node seems to convert everything to lowercase...
  dayperiod: "dayPeriod",
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts#named_years
  relatedYear: "year",
  yearName: "literal", // not editable
  unknown: "literal",
}

export interface DateFieldStateOptions<T extends DateValue = DateValue> extends DatePickerProps<T> {
  /**
   * The maximum unit to display in the date field.
   * @default 'year'
   */
  maxGranularity?: "year" | "month" | Granularity
  /** The locale to display and edit the value according to. */
  locale: string
  /**
   * A function that creates a [Calendar](../internationalized/date/Calendar.html)
   * object for a given calendar identifier. Such a function may be imported from the
   * `@internationalized/date` package, or manually implemented to include support for
   * only certain calendars.
   */
  createCalendar: (name: CalendarIdentifier) => Calendar
}

/**
 * Provides state management for a date field component.
 * A date field allows users to enter and edit date and time values using a keyboard.
 * Each part of a date value is displayed in an individually editable segment.
 */
export function useDateFieldState<T extends DateValue = DateValue>(props: DateFieldStateOptions<T>): DateFieldState {
  const {
    locale,
    createCalendar,
    hideTimeZone,
    isDisabled = false,
    isReadOnly = false,
    isRequired = false,
    minValue,
    maxValue,
    isDateUnavailable,
  } = props

  const v: DateValue | null = props.value || props.defaultValue || props.placeholderValue || null
  const [granularity, defaultTimeZone] = useDefaultProps(v, props.granularity)
  const timeZone = defaultTimeZone || "UTC"

  // props.granularity must actually exist in the value if one is provided.
  if (v && !(granularity in v)) {
    throw new Error("Invalid granularity " + granularity + " for value " + v.toString())
  }

  // Resolve default hour cycle and calendar system.
  const [calendar, hourCycle] = useMemo(() => {
    const formatter = new DateFormatter(locale, {
      dateStyle: "short",
      timeStyle: "short",
      hour12: props.hourCycle != null ? props.hourCycle === 12 : undefined,
    })
    const opts = formatter.resolvedOptions()
    const calendar = createCalendar(opts.calendar as CalendarIdentifier)
    return [calendar, opts.hourCycle!]
  }, [locale, props.hourCycle, createCalendar])

  const [value, setDate] = useControlledState<DateValue | null, MappedDateValue<T> | null>(
    props.value,
    props.defaultValue ?? null,
    props.onChange,
  )

  const [initialValue] = useState(value)
  const calendarValue = useMemo(() => convertValue(value, calendar) ?? null, [value, calendar])
  const [initialDisplayValue, setDisplayValue] = useState(() => new IncompleteDate(calendar, hourCycle, calendarValue))

  let displayValue = initialDisplayValue

  const showEra = calendar.identifier === "gregory" && displayValue.era === "BC"
  const formatOpts = useMemo(
    () => ({
      granularity,
      maxGranularity: props.maxGranularity ?? "year",
      timeZone: defaultTimeZone,
      hideTimeZone,
      hourCycle: props.hourCycle,
      showEra,
      shouldForceLeadingZeros: props.shouldForceLeadingZeros,
    }),
    [
      props.maxGranularity,
      granularity,
      props.hourCycle,
      props.shouldForceLeadingZeros,
      defaultTimeZone,
      hideTimeZone,
      showEra,
    ],
  )
  const opts = useMemo(() => getFormatOptions({}, formatOpts), [formatOpts])

  const dateFormatter = useMemo(() => new DateFormatter(locale, opts), [locale, opts])
  const resolvedOptions = useMemo(() => dateFormatter.resolvedOptions(), [dateFormatter])
  const placeholder = useMemo(
    () => createPlaceholderDate(props.placeholderValue, granularity, calendar, defaultTimeZone),
    [props.placeholderValue, granularity, calendar, defaultTimeZone],
  )
  const displaySegments = useMemo(() => {
    const is12HourClock = hourCycle === "h11" || hourCycle === "h12"
    const segments: DateSegmentType[] = [
      "era",
      "year",
      "month",
      "day",
      "hour",
      ...(is12HourClock ? ["dayPeriod" as const] : []),
      "minute",
      "second",
    ]
    const minIndex = segments.indexOf(props.maxGranularity || "era")
    const maxIndex = segments.indexOf(granularity === "hour" && is12HourClock ? "dayPeriod" : granularity)
    return segments.slice(minIndex, maxIndex + 1)
  }, [props.maxGranularity, granularity, hourCycle])

  const [lastValue, setLastValue] = useState(calendarValue)
  const [lastCalendar, setLastCalendar] = useState(calendar)
  const [lastHourCycle, setLastHourCycle] = useState(hourCycle)
  if (calendarValue !== lastValue || hourCycle !== lastHourCycle || !isEqualCalendar(calendar, lastCalendar)) {
    displayValue = new IncompleteDate(calendar, hourCycle, calendarValue)
    setLastValue(calendarValue)
    setLastCalendar(calendar)
    setLastHourCycle(hourCycle)
    setDisplayValue(displayValue)
  }

  const setValue = (newValue: DateValue | IncompleteDate | null) => {
    if (props.isDisabled || props.isReadOnly) {
      return
    }

    if (newValue == null || (newValue instanceof IncompleteDate && newValue.isCleared(displaySegments))) {
      setDisplayValue(new IncompleteDate(calendar, hourCycle, calendarValue))
      setDate(null)
    } else if (!(newValue instanceof IncompleteDate)) {
      // The display calendar should not have any effect on the emitted value.
      // Emit dates in the same calendar as the original value, if any, otherwise gregorian.
      newValue = toCalendar(newValue, v?.calendar || new GregorianCalendar())
      setDisplayValue(new IncompleteDate(calendar, hourCycle, calendarValue))
      setDate(newValue)
    } else {
      // If the new value is complete and valid, trigger onChange eagerly.
      // If it represents an incomplete or invalid value (e.g. February 30th),
      // wait until the field is blurred to trigger onChange.
      if (newValue.isComplete(displaySegments)) {
        const dateValue = newValue.toValue(calendarValue ?? placeholder)
        if (newValue.validate(dateValue, displaySegments)) {
          const newDateValue = toCalendar(dateValue, v?.calendar || new GregorianCalendar())
          if (!value || newDateValue.compare(value) !== 0) {
            setDisplayValue(new IncompleteDate(calendar, hourCycle, calendarValue)) // reset in case prop isn't updated
            setDate(newDateValue)
            return
          }
        }
      }

      // Incomplete/invalid value. Set temporary display override.
      setDisplayValue(newValue)
    }
  }

  const dateValue = useMemo(() => {
    const v = displayValue.toValue(calendarValue ?? placeholder)
    return v.toDate(timeZone)
  }, [displayValue, timeZone, calendarValue, placeholder])

  const segments = useMemo(
    () => processSegments(dateValue, displayValue, dateFormatter, resolvedOptions, calendar, locale, granularity),
    [dateValue, dateFormatter, resolvedOptions, displayValue, calendar, locale, granularity],
  )

  const adjustSegment = (type: DateSegmentType, amount: number) => {
    setValue(displayValue.cycle(type, amount, placeholder, displaySegments))
  }

  const builtinValidation = useMemo(
    () => getValidationResult(value, minValue, maxValue, isDateUnavailable, formatOpts),
    [value, minValue, maxValue, isDateUnavailable, formatOpts],
  )

  const validation = useFormValidationState({
    ...props,
    value: value as MappedDateValue<T> | null,
    builtinValidation,
  })

  const isValueInvalid = validation.displayValidation.isInvalid
  const validationState: ValidationState | null = props.validationState || (isValueInvalid ? "invalid" : null)

  return {
    ...validation,
    value: calendarValue,
    defaultValue: props.defaultValue ?? initialValue,
    dateValue,
    calendar,
    setValue,
    segments,
    dateFormatter,
    validationState,
    isInvalid: isValueInvalid,
    granularity,
    maxGranularity: props.maxGranularity ?? "year",
    isDisabled,
    isReadOnly,
    isRequired,
    increment(part) {
      adjustSegment(part, 1)
    },
    decrement(part) {
      adjustSegment(part, -1)
    },
    incrementPage(part) {
      adjustSegment(part, PAGE_STEP[part] || 1)
    },
    decrementPage(part) {
      adjustSegment(part, -(PAGE_STEP[part] || 1))
    },
    incrementToMax(part) {
      const maxValue = part === "hour" && hourCycle === "h12" ? 11 : displayValue.getSegmentLimits(part)!.maxValue
      setValue(displayValue.set(part, maxValue, placeholder))
    },
    decrementToMin(part) {
      const minValue = part === "hour" && hourCycle === "h12" ? 12 : displayValue.getSegmentLimits(part)!.minValue
      setValue(displayValue.set(part, minValue, placeholder))
    },
    setSegment(part, v: string | number) {
      setValue(displayValue.set(part, v, placeholder))
    },
    confirmPlaceholder() {
      if (props.isDisabled || props.isReadOnly) {
        return
      }

      // If the display value is complete but invalid, we need to constrain it and emit onChange on blur.
      if (displayValue.isComplete(displaySegments)) {
        const dateValue = displayValue.toValue(calendarValue ?? placeholder)
        const newDateValue = toCalendar(dateValue, v?.calendar || new GregorianCalendar())
        if (!value || newDateValue.compare(value) !== 0) {
          setDate(newDateValue)
        }
        setDisplayValue(new IncompleteDate(calendar, hourCycle, calendarValue))
      }
    },
    clearSegment(part) {
      let value = displayValue

      if (part !== "timeZoneName" && part !== "literal") {
        value = displayValue.clear(part)
      }

      setValue(value)
    },
    formatValue(fieldOptions: FieldOptions) {
      if (!calendarValue) {
        return ""
      }

      const formatOptions = getFormatOptions(fieldOptions, formatOpts)
      const formatter = new DateFormatter(locale, formatOptions)
      return formatter.format(dateValue)
    },
    getDateFormatter(locale, formatOptions: FormatterOptions) {
      const newOptions = { ...formatOpts, ...formatOptions }
      const newFormatOptions = getFormatOptions({}, newOptions)
      return new DateFormatter(locale, newFormatOptions)
    },
  }
}

function processSegments(
  dateValue: Date,
  displayValue: IncompleteDate,
  dateFormatter: Intl.DateTimeFormat,
  resolvedOptions: Intl.ResolvedDateTimeFormatOptions,
  calendar: Calendar,
  locale: string,
  granularity: Granularity,
): DateSegment[] {
  const timeValue = ["hour", "minute", "second"]
  const segments = dateFormatter.formatToParts(dateValue)

  // In order to allow formatting temporarily invalid dates during editing (e.g. February 30th),
  // use a NumberFormatter to manually format segments directly from raw numbers.
  // When the user blurs the date field, the invalid segments will be constrained.
  const numberFormatter = new NumberFormatter(locale, { useGrouping: false })
  const twoDigitFormatter = new NumberFormatter(locale, { useGrouping: false, minimumIntegerDigits: 2 })
  for (const segment of segments) {
    if (segment.type === "year" || segment.type === "month" || segment.type === "day" || segment.type === "hour") {
      const value = displayValue[segment.type] ?? 0
      if (resolvedOptions[segment.type] === "2-digit") {
        segment.value = twoDigitFormatter.format(value)
      } else {
        segment.value = numberFormatter.format(value)
      }
    }
  }

  const processedSegments: DateSegment[] = []
  for (const segment of segments) {
    const type = TYPE_MAPPING[segment.type] || (segment.type as DateSegmentType)
    let isEditable = EDITABLE_SEGMENTS[type]
    if (type === "era" && calendar.getEras().length === 1) {
      isEditable = false
    }

    const isPlaceholder =
      EDITABLE_SEGMENTS[type] &&
      (displayValue as unknown as Partial<Record<string, number | string | null>>)[segment.type] == null
    const placeholder = EDITABLE_SEGMENTS[type] ? getPlaceholder(type, segment.value, locale) : null

    const dateSegment = {
      type,
      text: isPlaceholder ? placeholder : segment.value,
      ...displayValue.getSegmentLimits(type),
      isPlaceholder,
      placeholder,
      isEditable,
    } as DateSegment

    // There is an issue in RTL languages where time fields render (minute:hour) instead of (hour:minute).
    // To force an LTR direction on the time field since, we wrap the time segments in LRI (left-to-right) isolate unicode. See https://www.w3.org/International/questions/qa-bidi-unicode-controls.
    // These unicode characters will be added to the array of processed segments as literals and will mark the start and end of the embedded direction change.
    if (type === "hour") {
      // This marks the start of the embedded direction change.
      processedSegments.push({
        type: "literal",
        text: "\u2066",
        isPlaceholder: false,
        placeholder: "",
        isEditable: false,
      })
      processedSegments.push(dateSegment)
      // This marks the end of the embedded direction change in the case that the granularity it set to "hour".
      if (type === granularity) {
        processedSegments.push({
          type: "literal",
          text: "\u2069",
          isPlaceholder: false,
          placeholder: "",
          isEditable: false,
        })
      }
    } else if (timeValue.includes(type) && type === granularity) {
      processedSegments.push(dateSegment)
      // This marks the end of the embedded direction change.
      processedSegments.push({
        type: "literal",
        text: "\u2069",
        isPlaceholder: false,
        placeholder: "",
        isEditable: false,
      })
    } else {
      // We only want to "wrap" the unicode around segments that are hour, minute, or second. If they aren't, just process as normal.
      processedSegments.push(dateSegment)
    }
  }

  return processedSegments
}
