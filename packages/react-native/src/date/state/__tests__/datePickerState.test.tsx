import { CalendarDate, CalendarDateTime, parseZonedDateTime } from "@internationalized/date"
import { act, renderHook } from "@testing-library/react-native"
import type { ReactNode } from "react"
import { useDatePickerState as usePinnedDatePickerState } from "react-stately/useDatePickerState"
import { useDateRangePickerState as usePinnedDateRangePickerState } from "react-stately/useDateRangePickerState"

import { FormValidationContext } from "../../../components/ComboBox/state/useFormValidationState"
import { nativeDatePickerData } from "../../../form/datePicker"
import type { DateValue } from "../types"
import { useDatePickerState } from "../useDatePickerState"
import { useDateRangePickerState } from "../useDateRangePickerState"

const examples = [
  new CalendarDate(2024, 10, 1),
  new CalendarDateTime(2024, 10, 1, 13, 45, 7),
  parseZonedDateTime("2024-10-01T13:45:07[America/New_York]"),
]

it.each(examples)("retains date class, zone and held owner for calendar requests: %s", async (value) => {
  const change = jest.fn()
  const { result } = await renderHook(() => useDatePickerState({ value, onChange: change, isOpen: false }))
  for (let index = 0; index < 2; index++) await act(() => result.current.setDateValue(new CalendarDate(2024, 10, 3)))
  expect(change).toHaveBeenCalledTimes(2)
  expect(result.current.value).toBe(value)
  for (const [requested] of change.mock.calls) {
    expect(requested).toBeInstanceOf(value.constructor)
    expect(requested.toString()).toBe(value.set({ day: 3 }).toString())
  }
})

it.each(examples)("retains independent range endpoint times and original value classes: %s", async (start) => {
  const end = "hour" in start ? start.add({ days: 4, hours: 4, minutes: 5 }) : start.add({ days: 4 })
  const value = { start, end },
    change = jest.fn()
  const { result } = await renderHook(() => useDateRangePickerState({ value, onChange: change, isOpen: false }))
  for (let index = 0; index < 2; index++)
    await act(() =>
      result.current.setDateRange({ start: new CalendarDate(2024, 10, 3), end: new CalendarDate(2024, 10, 8) }),
    )
  expect(result.current.value).toBe(value)
  expect(change).toHaveBeenCalledTimes(2)
  for (const [requested] of change.mock.calls) {
    expect(requested.start).toBeInstanceOf(start.constructor)
    expect(requested.end).toBeInstanceOf(end.constructor)
    expect(requested.start.toString()).toBe(start.set({ day: 3 }).toString())
    expect(requested.end.toString()).toBe(end.set({ day: 8 }).toString())
  }
})

it("preserves original zoned endpoint times across the DST transition", async () => {
  const value = {
    start: parseZonedDateTime("2024-11-01T13:45[America/New_York]"),
    end: parseZonedDateTime("2024-11-02T18:20[America/New_York]"),
  }
  const { result } = await renderHook(() => useDateRangePickerState({ defaultValue: value }))
  await act(() =>
    result.current.setDateRange({ start: new CalendarDate(2024, 11, 3), end: new CalendarDate(2024, 11, 4) }),
  )
  expect(result.current.value.start?.toString()).toBe("2024-11-03T13:45:00-05:00[America/New_York]")
  expect(result.current.value.end?.toString()).toBe("2024-11-04T18:20:00-05:00[America/New_York]")
})

it("retains partial range drafts and controlled-null requests without fabricating a complete value", async () => {
  const change = jest.fn()
  const { result } = await renderHook(() => useDateRangePickerState<CalendarDate>({ value: null, onChange: change }))
  await act(() => result.current.setDateTime("start", new CalendarDate(2024, 10, 1)))
  expect(result.current.value.start?.toString()).toBe("2024-10-01")
  expect(result.current.value.end).toBeNull()
  expect(change).not.toHaveBeenCalled()
  await act(() => result.current.setDateTime("end", new CalendarDate(2024, 10, 5)))
  expect(change).toHaveBeenCalledWith({ start: new CalendarDate(2024, 10, 1), end: new CalendarDate(2024, 10, 5) })
})

it("uses the existing native form server-validation context and reset behavior", async () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <FormValidationContext.Provider value={{ when: "Server date", start: "Server interval" }}>
      {children}
    </FormValidationContext.Provider>
  )
  const { result } = await renderHook(
    () => ({
      single: useDatePickerState({ name: "when", defaultValue: examples[0], validationBehavior: "native" }),
      range: useDateRangePickerState({
        startName: "start",
        endName: "end",
        defaultValue: { start: examples[0], end: examples[0].add({ days: 2 }) },
        validationBehavior: "native",
      }),
    }),
    { wrapper },
  )
  expect(result.current.single.displayValidation.validationErrors).toEqual(["Server date"])
  expect(result.current.range.displayValidation.validationErrors).toEqual(["Server interval"])
  await act(() => {
    result.current.single.resetValidation()
    result.current.range.resetValidation()
  })
  expect(result.current.single.displayValidation.isInvalid).toBe(false)
  expect(result.current.range.displayValidation.isInvalid).toBe(false)
})

it("produces exact ordered date strings and duplicate endpoint names while retaining disabled/read-only policy", async () => {
  const value = { start: examples[2], end: examples[2].add({ days: 2, hours: 4 }) }
  const { result } = await renderHook(() => ({
    single: useDatePickerState({ defaultValue: examples[2] }),
    range: useDateRangePickerState({ defaultValue: value }),
  }))
  expect(nativeDatePickerData({ name: "date" }, result.current.single).entries).toEqual([
    ["date", examples[2].toString()],
  ])
  const data = nativeDatePickerData({ startName: "date", endName: "date", isReadOnly: true }, result.current.range)
  expect(data.entries).toEqual([
    ["date", value.start.toString()],
    ["date", value.end.toString()],
  ])
  expect(data.isDisabled).toBe(false)
  expect(data.isReadOnly).toBe(false)
  expect(nativeDatePickerData({ isDisabled: true }, result.current.range).isDisabled).toBe(true)
  expect(nativeDatePickerData({ startName: "", endName: "" }, result.current.range).entries).toEqual([])
})

it("admits required complete values and reports missing single/partial range data without readonly exclusion", async () => {
  const { result } = await renderHook(() => ({
    single: useDatePickerState<DateValue>({ value: null }),
    range: useDateRangePickerState<DateValue>({ value: null }),
  }))
  await act(() => result.current.range.setDateTime("start", examples[0]))
  expect(
    nativeDatePickerData({ name: "date", isRequired: true, isReadOnly: true }, result.current.single).validation
      .validationDetails.valueMissing,
  ).toBe(true)
  expect(
    nativeDatePickerData({ startName: "start", endName: "end", isRequired: true }, result.current.range).entries,
  ).toEqual([
    ["start", "2024-10-01"],
    ["end", ""],
  ])
  expect(
    nativeDatePickerData({ isRequired: true }, result.current.range).validation.validationDetails.valueMissing,
  ).toBe(true)
  expect(nativeDatePickerData({ isRequired: true, isDisabled: true }, result.current.range).validation.isInvalid).toBe(
    false,
  )
})

it.each(["en-GB", "ar-EG"])(
  "retains single picker formatter and null contracts against the pinned model in %s",
  async (locale) => {
    for (const value of [null, ...examples]) {
      const { result, unmount } = await renderHook(() => ({
        native: useDatePickerState({ value, hourCycle: 24 }),
        pinned: usePinnedDatePickerState({ value, hourCycle: 24 }),
      }))
      const options = { year: "numeric", month: "long", day: "numeric" } as const
      expect(result.current.native.formatValue(locale, options)).toBe(
        result.current.pinned.formatValue(locale, options),
      )
      expect(
        result.current.native
          .getDateFormatter(locale, { granularity: "second", hideTimeZone: true, hourCycle: 24 })
          .resolvedOptions(),
      ).toEqual(
        result.current.pinned
          .getDateFormatter(locale, { granularity: "second", hideTimeZone: true, hourCycle: 24 })
          .resolvedOptions(),
      )
      expect(result.current.native.value).toBe(value)
      if (value === null) expect(result.current.native.formatValue(locale, options)).toBe("")
      await unmount()
    }
  },
)

it.each(["en-GB", "ar-EG"])(
  "retains range formatter empty, equal, reversed and mixed-zone contracts against the pinned model in %s",
  async (locale) => {
    const start = parseZonedDateTime("2024-11-01T13:45[America/New_York]")
    const ranges = [
      null,
      { start: examples[0], end: examples[0] },
      { start, end: start.add({ days: 3 }) },
      { start: start.add({ days: 3 }), end: start },
      { start, end: parseZonedDateTime("2024-11-04T19:45[Europe/Paris]") },
    ]
    for (const value of ranges) {
      const { result, unmount } = await renderHook(() => ({
        native: useDateRangePickerState({ value, hourCycle: 24 }),
        pinned: usePinnedDateRangePickerState({ value, hourCycle: 24 }),
      }))
      const options = { year: "numeric", month: "long", day: "numeric" } as const
      expect(result.current.native.formatValue(locale, options)).toEqual(
        result.current.pinned.formatValue(locale, options),
      )
      expect(
        result.current.native
          .getDateFormatter(locale, { granularity: "second", hideTimeZone: true, hourCycle: 24 })
          .resolvedOptions(),
      ).toEqual(
        result.current.pinned
          .getDateFormatter(locale, { granularity: "second", hideTimeZone: true, hourCycle: 24 })
          .resolvedOptions(),
      )
      if (value) expect(result.current.native.value).toBe(value)
      else expect(result.current.native.formatValue(locale, options)).toBeNull()
      await unmount()
    }
  },
)

it.each(["single", "range"] as const)(
  "retains %s min/max and unavailable validation through commit, reset and custom-error precedence",
  async (kind) => {
    const low = new CalendarDate(2024, 10, 1),
      high = new CalendarDate(2024, 10, 8)
    const { result, rerender } = await renderHook(
      ({ custom }: { custom: boolean }) => {
        const props = {
          minValue: low.add({ days: 1 }),
          maxValue: high.subtract({ days: 1 }),
          isDateUnavailable: (date: DateValue) => date.day === 1,
          validationBehavior: "native" as const,
          validate: custom ? () => "Owner validation" : undefined,
        }
        const single = useDatePickerState({ ...props, value: low })
        const range = useDateRangePickerState({ ...props, value: { start: low, end: high } })
        return kind === "single" ? single : range
      },
      { initialProps: { custom: false } },
    )
    expect(result.current.realtimeValidation.validationDetails).toMatchObject({
      rangeUnderflow: true,
      badInput: true,
      customError: false,
      valid: false,
    })
    if (kind === "range") expect(result.current.realtimeValidation.validationDetails.rangeOverflow).toBe(true)
    expect(result.current.displayValidation.isInvalid).toBe(false)
    await act(() => result.current.commitValidation())
    expect(result.current.displayValidation.isInvalid).toBe(true)
    await act(() => result.current.resetValidation())
    expect(result.current.displayValidation.isInvalid).toBe(false)
    await rerender({ custom: true })
    expect(result.current.realtimeValidation.validationErrors).toEqual(["Owner validation"])
    expect(result.current.realtimeValidation.validationDetails.customError).toBe(true)
  },
)
