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

import type { CalendarDate } from "@internationalized/date"
import { DateFormatter, toCalendarDate, toCalendarDateTime } from "@internationalized/date"
import { useMemo, useState } from "react"
import type { DatePickerProps } from "react-stately/useDatePickerState"

import { useControlledState } from "../../collection/state/useControlledState"
import type { FormValidationState } from "../../components/ComboBox/state/useFormValidationState"
import { useFormValidationState } from "../../components/ComboBox/state/useFormValidationState"
import type { OverlayTriggerState } from "../../components/ComboBox/state/useOverlayTriggerState"
import { useOverlayTriggerState } from "../../components/ComboBox/state/useOverlayTriggerState"

import type { DateValue, Granularity, MappedDateValue, TimeValue } from "./types"
import type { FieldOptions, FormatterOptions } from "./utils"
import { getFormatOptions, getPlaceholderTime, getValidationResult, useDefaultProps } from "./utils"
type ValidationState = "valid" | "invalid"

export interface DatePickerStateOptions<T extends DateValue> extends DatePickerProps<T> {
  name?: string
  /**
   * Determines whether the date picker popover should close automatically when a date is selected.
   * @default true
   */
  shouldCloseOnSelect?: boolean | (() => boolean)
}

export interface DatePickerState extends OverlayTriggerState, FormValidationState {
  /** The currently selected date. */
  value: DateValue | null
  /** The default date. */
  defaultValue: DateValue | null
  /** Sets the selected date. */
  setValue(value: DateValue | null): void
  /**
   * The date portion of the value. This may be set prior to `value` if the user has
   * selected a date but has not yet selected a time.
   */
  dateValue: DateValue | null
  /** Sets the date portion of the value. */
  setDateValue(value: DateValue): void
  /**
   * The time portion of the value. This may be set prior to `value` if the user has
   * selected a time but has not yet selected a date.
   */
  timeValue: TimeValue | null
  /** Sets the time portion of the value. */
  setTimeValue(value: TimeValue): void
  /** The granularity for the field, based on the `granularity` prop and current value. */
  granularity: Granularity
  /** Whether the date picker supports selecting a time, according to the `granularity` prop and current value. */
  hasTime: boolean
  /** Whether the calendar popover is currently open. */
  isOpen: boolean
  /** Sets whether the calendar popover is open. */
  setOpen(isOpen: boolean): void
  /**
   * The current validation state of the date picker, based on the `validationState`, `minValue`, and `maxValue` props.
   * @deprecated Use `isInvalid` instead.
   */
  validationState: ValidationState | null
  /** Whether the date picker is invalid, based on the `isInvalid`, `minValue`, and `maxValue` props. */
  isInvalid: boolean
  /** Formats the selected value using the given options. */
  formatValue(locale: string, fieldOptions: FieldOptions): string
  /** Gets a formatter based on state's props. */
  getDateFormatter(locale: string, formatOptions: FormatterOptions): DateFormatter
}

/**
 * Provides state management for a date picker component.
 * A date picker combines a DateField and a Calendar popover to allow users to enter or select a date and time value.
 */
export function useDatePickerState<T extends DateValue = DateValue>(props: DatePickerStateOptions<T>): DatePickerState {
  const overlayState = useOverlayTriggerState(props)
  const [value, setValue] = useControlledState<DateValue | null, MappedDateValue<T> | null>(
    props.value,
    props.defaultValue || null,
    props.onChange,
  )
  const [initialValue] = useState(value)

  const v = value || props.placeholderValue || null
  const [granularity, defaultTimeZone] = useDefaultProps(v, props.granularity)
  const dateValue = value != null ? value.toDate(defaultTimeZone ?? "UTC") : null
  const hasTime = granularity === "hour" || granularity === "minute" || granularity === "second"
  const shouldCloseOnSelect = props.shouldCloseOnSelect ?? true

  const [selectedDateState, setSelectedDate] = useState<DateValue | null>(null)
  let selectedDate = selectedDateState
  const [selectedTimeState, setSelectedTime] = useState<TimeValue | null>(null)
  let selectedTime = selectedTimeState

  if (value) {
    selectedDate = value
    if ("hour" in value) {
      selectedTime = value
    }
  }

  // props.granularity must actually exist in the value if one is provided.
  if (v && !(granularity in v)) {
    throw new Error("Invalid granularity " + granularity + " for value " + v.toString())
  }

  const showEra = value?.calendar.identifier === "gregory" && value.era === "BC"
  const formatOpts = useMemo(
    () => ({
      granularity,
      timeZone: defaultTimeZone,
      hideTimeZone: props.hideTimeZone,
      hourCycle: props.hourCycle,
      shouldForceLeadingZeros: props.shouldForceLeadingZeros,
      showEra,
    }),
    [granularity, props.hourCycle, props.shouldForceLeadingZeros, defaultTimeZone, props.hideTimeZone, showEra],
  )

  const { minValue, maxValue, isDateUnavailable } = props
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

  const commitValue = (date: DateValue, time: TimeValue) => {
    setValue("timeZone" in time ? time.set(toCalendarDate(date)) : toCalendarDateTime(date, time))
    setSelectedDate(null)
    setSelectedTime(null)
    validation.commitValidation()
  }

  // Intercept setValue to make sure the Time section is not changed by date selection in Calendar
  const selectDate = (newValue: CalendarDate) => {
    const shouldClose = typeof shouldCloseOnSelect === "function" ? shouldCloseOnSelect() : shouldCloseOnSelect
    if (hasTime) {
      if (selectedTime || shouldClose) {
        commitValue(newValue, selectedTime || getPlaceholderTime(props.defaultValue || props.placeholderValue))
      } else {
        setSelectedDate(newValue)
      }
    } else {
      setValue(newValue)
      validation.commitValidation()
    }

    if (shouldClose) {
      overlayState.setOpen(false)
    }
  }

  const selectTime = (newValue: TimeValue) => {
    if (selectedDate && newValue) {
      commitValue(selectedDate, newValue)
    } else {
      setSelectedTime(newValue)
    }
  }

  return {
    ...validation,
    value,
    defaultValue: props.defaultValue ?? initialValue,
    setValue,
    dateValue: selectedDate,
    timeValue: selectedTime,
    setDateValue: selectDate,
    setTimeValue: selectTime,
    granularity,
    hasTime,
    ...overlayState,
    setOpen(isOpen) {
      // Commit the selected date when the calendar is closed. Use a placeholder time if one wasn't set.
      // If only the time was set and not the date, don't commit. The state will be preserved until
      // the user opens the popover again.
      if (!isOpen && !value && selectedDate && hasTime) {
        commitValue(selectedDate, selectedTime || getPlaceholderTime(props.defaultValue || props.placeholderValue))
      }

      overlayState.setOpen(isOpen)
    },
    validationState,
    isInvalid: isValueInvalid,
    formatValue(locale, fieldOptions) {
      if (!dateValue) {
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
