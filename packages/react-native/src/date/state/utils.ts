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

import type { Calendar } from "@internationalized/date"
import {
  DateFormatter,
  getLocalTimeZone,
  now,
  Time,
  toCalendar,
  toCalendarDate,
  toCalendarDateTime,
} from "@internationalized/date"
import { useState } from "react"

import type { ValidationResult } from "../../components/ComboBox/state/types"
import { mergeValidation, VALID_VALIDITY_STATE } from "../../components/ComboBox/state/useFormValidationState"
import { LocalizedStringDictionary, LocalizedStringFormatter } from "../strings"

import i18nMessages from "./messages"
import type { DatePickerProps, DateValue, Granularity, TimeValue } from "./types"

type RangeValue<T> = { start: T; end: T }

const dictionary = new LocalizedStringDictionary(i18nMessages)

// Native validation follows the actual host Intl locale, as platform validation does.
const getLocale = () => new Intl.DateTimeFormat().resolvedOptions().locale

export function getValidationResult(
  value: DateValue | null,
  minValue: DateValue | null | undefined,
  maxValue: DateValue | null | undefined,
  isDateUnavailable: ((v: DateValue) => boolean) | undefined,
  options: FormatterOptions,
): ValidationResult {
  const rangeOverflow = value != null && maxValue != null && value.compare(maxValue) > 0
  const rangeUnderflow = value != null && minValue != null && value.compare(minValue) < 0
  const isUnavailable = (value != null && isDateUnavailable?.(value)) || false
  const isInvalid = rangeOverflow || rangeUnderflow || isUnavailable
  const errors: string[] = []

  if (isInvalid) {
    const locale = getLocale()
    const strings = dictionary
    const formatter = new LocalizedStringFormatter(locale, strings)
    const dateFormatter = new DateFormatter(locale, getFormatOptions({}, options))
    const timeZone = dateFormatter.resolvedOptions().timeZone

    if (rangeUnderflow && minValue != null) {
      errors.push(formatter.format("rangeUnderflow", { minValue: dateFormatter.format(minValue.toDate(timeZone)) }))
    }

    if (rangeOverflow && maxValue != null) {
      errors.push(formatter.format("rangeOverflow", { maxValue: dateFormatter.format(maxValue.toDate(timeZone)) }))
    }

    if (isUnavailable) {
      errors.push(formatter.format("unavailableDate"))
    }
  }

  return {
    isInvalid,
    validationErrors: errors,
    validationDetails: {
      badInput: isUnavailable,
      customError: false,
      patternMismatch: false,
      rangeOverflow,
      rangeUnderflow,
      stepMismatch: false,
      tooLong: false,
      tooShort: false,
      typeMismatch: false,
      valueMissing: false,
      valid: !isInvalid,
    },
  }
}

export function getRangeValidationResult(
  value: RangeValue<DateValue | null> | null,
  minValue: DateValue | null | undefined,
  maxValue: DateValue | null | undefined,
  isDateUnavailable: ((v: DateValue) => boolean) | undefined,
  options: FormatterOptions,
): ValidationResult {
  const startValidation = getValidationResult(value?.start ?? null, minValue, maxValue, isDateUnavailable, options)

  const endValidation = getValidationResult(value?.end ?? null, minValue, maxValue, isDateUnavailable, options)

  let result = mergeValidation(startValidation, endValidation)
  if (value?.end != null && value.start != null && value.end.compare(value.start) < 0) {
    const strings = dictionary
    result = mergeValidation(result, {
      isInvalid: true,
      validationErrors: [strings.getStringForLocale("rangeReversed", getLocale())],
      validationDetails: {
        ...VALID_VALIDITY_STATE,
        rangeUnderflow: true,
        rangeOverflow: true,
        valid: false,
      },
    })
  }

  return result
}

export type FieldOptions = Pick<Intl.DateTimeFormatOptions, "year" | "month" | "day" | "hour" | "minute" | "second">
export interface FormatterOptions {
  timeZone?: string
  hideTimeZone?: boolean
  granularity?: DatePickerProps<DateValue>["granularity"]
  maxGranularity?: "year" | "month" | DatePickerProps<DateValue>["granularity"]
  hourCycle?: 12 | 24
  showEra?: boolean
  shouldForceLeadingZeros?: boolean
}

const DEFAULT_FIELD_OPTIONS: FieldOptions = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
}

const TWO_DIGIT_FIELD_OPTIONS: FieldOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
}

export function getFormatOptions(fieldOptions: FieldOptions, options: FormatterOptions): Intl.DateTimeFormatOptions {
  const defaultFieldOptions = options.shouldForceLeadingZeros ? TWO_DIGIT_FIELD_OPTIONS : DEFAULT_FIELD_OPTIONS
  fieldOptions = { ...defaultFieldOptions, ...fieldOptions }
  const granularity = options.granularity || "minute"
  const keys = Object.keys(fieldOptions) as (keyof FieldOptions)[]
  let startIdx = keys.indexOf(options.maxGranularity ?? "year")
  if (startIdx < 0) {
    startIdx = 0
  }

  let endIdx = keys.indexOf(granularity)
  if (endIdx < 0) {
    endIdx = 2
  }

  if (startIdx > endIdx) {
    throw new Error("maxGranularity must be greater than granularity")
  }

  const opts = keys.slice(startIdx, endIdx + 1).reduce<Intl.DateTimeFormatOptions>((opts, key) => {
    Object.assign(opts, { [key]: fieldOptions[key] })
    return opts
  }, {})

  if (options.hourCycle != null) {
    opts.hour12 = options.hourCycle === 12
  }

  opts.timeZone = options.timeZone || "UTC"

  const hasTime = granularity === "hour" || granularity === "minute" || granularity === "second"
  if (hasTime && options.timeZone && !options.hideTimeZone) {
    opts.timeZoneName = "short"
  }

  if (options.showEra && startIdx === 0) {
    opts.era = "short"
  }

  return opts
}

export function getPlaceholderTime(placeholderValue: DateValue | null | undefined): TimeValue {
  if (placeholderValue && "hour" in placeholderValue) {
    return placeholderValue
  }

  return new Time()
}

export function convertValue(value: DateValue | null | undefined, calendar: Calendar): DateValue | null | undefined {
  if (value === null) {
    return null
  }

  if (!value) {
    return undefined
  }

  return toCalendar(value, calendar)
}

export function createPlaceholderDate(
  placeholderValue: DateValue | null | undefined,
  granularity: string,
  calendar: Calendar,
  timeZone: string | undefined,
): DateValue {
  if (placeholderValue) {
    return convertValue(placeholderValue, calendar)!
  }

  const date = toCalendar(
    now(timeZone ?? getLocalTimeZone()).set({
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
    }),
    calendar,
  )

  if (granularity === "year" || granularity === "month" || granularity === "day") {
    return toCalendarDate(date)
  }

  if (!timeZone) {
    return toCalendarDateTime(date)
  }

  return date
}

export function useDefaultProps(
  v: DateValue | null,
  granularity: Granularity | undefined,
): [Granularity, string | undefined] {
  // Compute default granularity and time zone from the value. If the value becomes null, keep the last values.
  const defaultTimeZone = v && "timeZone" in v ? v.timeZone : undefined
  const defaultGranularity: Granularity = v && "minute" in v ? "minute" : "day"

  // props.granularity must actually exist in the value if one is provided.
  if (v && granularity && !(granularity in v)) {
    throw new Error("Invalid granularity " + granularity + " for value " + v.toString())
  }

  const [lastValue, setLastValue] = useState<[Granularity, string | undefined]>([defaultGranularity, defaultTimeZone])

  // If the granularity or time zone changed, update the last value.
  if (v && (lastValue[0] !== defaultGranularity || lastValue[1] !== defaultTimeZone)) {
    setLastValue([defaultGranularity, defaultTimeZone])
  }

  if (!granularity) {
    granularity = v ? defaultGranularity : lastValue[0]
  }

  const timeZone = v ? defaultTimeZone : lastValue[1]
  return [granularity, timeZone]
}
