import { CalendarDateTime, Time, parseZonedDateTime } from "@internationalized/date"
import { act, renderHook } from "@testing-library/react-native"
import { useTimeFieldState as usePinnedTimeFieldState } from "react-stately/useTimeFieldState"

import { FormValidationContext } from "../../components/ComboBox/state/useFormValidationState"
import type { TimeValue } from "../state/types"
import type { DateSegmentType, DateFieldState } from "../state/useDateFieldState"
import { useTimeFieldState, type TimeFieldState, type TimeFieldStateOptions } from "../state/useTimeFieldState"

type THook = (props: TimeFieldStateOptions) => TimeFieldState
const examples = [
  { name: "Time", value: new Time(13, 45, 7), next: "14:45:07" },
  { name: "CalendarDateTime", value: new CalendarDateTime(2024, 10, 1, 13, 45, 7), next: "2024-10-01T14:45:07" },
  {
    name: "ZonedDateTime",
    value: parseZonedDateTime("2024-10-01T13:45:07[America/New_York]"),
    next: "2024-10-01T14:45:07-04:00[America/New_York]",
  },
]
const observe = (state: TimeFieldState) => ({
  surface: Object.keys(state).sort(),
  value: state.value?.toString() ?? null,
  timeValue: state.timeValue?.toString() ?? null,
  defaultValue: state.defaultValue?.toString() ?? null,
  segments: state.segments,
  granularity: state.granularity,
  maxGranularity: state.maxGranularity,
  calendar: state.calendar.identifier,
  invalid: state.isInvalid,
  readonly: state.isReadOnly,
  disabled: state.isDisabled,
  required: state.isRequired,
  validationState: state.validationState,
  realtime: state.realtimeValidation,
  display: state.displayValidation,
  formatted: state.formatValue({ hour: "numeric", minute: "2-digit" }),
  formatOptions: state.getDateFormatter("fr-FR", { hourCycle: 12 }).resolvedOptions(),
})
const trace = async (hook: THook, locale: string, defaultValue: TimeValue) => {
  const changes: string[] = []
  const { result, unmount } = await renderHook(() =>
    hook({
      locale,
      defaultValue,
      granularity: "second",
      hourCycle: 12,
      shouldForceLeadingZeros: true,
      onChange: (value) => changes.push(value?.toString() ?? "null"),
    }),
  )
  const observations = [observe(result.current)]
  const operations: ((state: DateFieldState) => void)[] = [
    (state) => state.increment("hour"),
    (state) => state.decrement("minute"),
    (state) => state.incrementPage("minute"),
    (state) => state.decrementPage("second"),
    (state) => state.incrementToMax("hour"),
    (state) => state.decrementToMin("hour"),
    (state) => state.setSegment("dayPeriod", 0),
    (state) => state.clearSegment("minute"),
    (state) => state.setSegment("minute", 5),
    (state) => state.clearSegment("hour"),
    (state) => state.confirmPlaceholder(),
    (state) => state.setValue(null),
    (state) => state.setSegment("hour", 9),
    (state) => state.setSegment("minute", 12),
    (state) => state.setSegment("second", 34),
    (state) => state.setSegment("dayPeriod", 1),
    (state) => state.confirmPlaceholder(),
  ]
  for (const operation of operations) {
    await act(() => operation(result.current))
    observations.push(observe(result.current))
  }
  await unmount()
  return { observations, changes }
}

for (const locale of ["en-GB", "en-US", "ar-EG", "ja-JP"]) {
  it.each(examples)(`matches the full pinned uncontrolled $name trace in ${locale}`, async ({ value }) => {
    expect(await trace(useTimeFieldState, locale, value)).toEqual(await trace(usePinnedTimeFieldState, locale, value))
  })
}

it.each(examples)("retains $name and repeats each controlled request after owner veto", async ({ value, next }) => {
  const request = jest.fn()
  const { result } = await renderHook(() =>
    useTimeFieldState({ locale: "en-GB", value, onChange: request, granularity: "second", hourCycle: 24 }),
  )
  await act(() => result.current.increment("hour"))
  await act(() => result.current.increment("hour"))
  expect(request).toHaveBeenCalledTimes(2)
  for (const [proposed] of request.mock.calls) {
    expect(proposed).toBeInstanceOf(value.constructor)
    expect(proposed.toString()).toBe(next)
    expect(proposed).not.toBe(value)
  }
  expect(result.current.timeValue.hour).toBe(13)
  expect(value.hour).toBe(13)
})

it("preserves defined null, partial entry and owner echo without treating defaultValue as authority", async () => {
  const request = jest.fn()
  const { result, rerender } = await renderHook(
    ({ value }: { value: Time | null }) =>
      useTimeFieldState({ locale: "en-GB", value, defaultValue: new Time(8, 15), onChange: request, hourCycle: 24 }),
    { initialProps: { value: null } },
  )
  const editable = () => result.current.segments.filter((segment) => segment.isEditable)
  expect(editable().every((segment) => segment.isPlaceholder)).toBe(true)
  await act(() => result.current.setSegment("hour", 9))
  expect(request).not.toHaveBeenCalled()
  expect(editable().find((segment) => segment.type === "hour")?.text).toBe("9")
  await act(() => result.current.setSegment("minute", 12))
  expect(request).toHaveBeenLastCalledWith(new Time(9, 12))
  expect(result.current.timeValue).toBeNull()
  await rerender({ value: new Time(9, 12) })
  expect(result.current.timeValue.toString()).toBe("09:12:00")
})

it.each(["isReadOnly", "isDisabled"] as const)("keeps %s authoritative across every mutation method", async (guard) => {
  const request = jest.fn()
  const value = new Time(13, 45)
  const { result } = await renderHook(() =>
    useTimeFieldState({ locale: "en-US", value, onChange: request, [guard]: true }),
  )
  for (const operation of [
    (s: TimeFieldState) => s.increment("hour"),
    (s: TimeFieldState) => s.decrementPage("minute"),
    (s: TimeFieldState) => s.setSegment("hour", 6),
    (s: TimeFieldState) => s.clearSegment("minute"),
    (s: TimeFieldState) => s.confirmPlaceholder(),
    (s: TimeFieldState) => s.setValue(null),
  ])
    await act(() => operation(result.current))
  expect(request).not.toHaveBeenCalled()
  expect(result.current.timeValue).toBe(value)
})

it("reconciles live locale/hour cycle and callback replacement while holding owner values", async () => {
  const value = new Time(13, 45)
  const old = jest.fn(),
    current = jest.fn()
  const { result, rerender } = await renderHook(
    (props: { locale: string; hourCycle: 12 | 24; onChange: (v: Time | null) => void }) =>
      useTimeFieldState({ ...props, value }),
    { initialProps: { locale: "en-US", hourCycle: 12, onChange: old } },
  )
  expect(result.current.segments.some((segment) => segment.type === "dayPeriod")).toBe(true)
  await rerender({ locale: "ar-EG", hourCycle: 24, onChange: current })
  expect(result.current.segments.some((segment) => segment.type === "dayPeriod")).toBe(false)
  await act(() => result.current.increment("minute"))
  expect(current).toHaveBeenCalledWith(new Time(13, 46))
  expect(old).not.toHaveBeenCalled()
  expect(result.current.timeValue).toBe(value)
})

it("shares named server/custom validation and native commit/reset semantics with NativeForm", async () => {
  const value = new Time(8),
    minValue = new Time(9),
    maxValue = new Time(17)
  const { result } = await renderHook(
    () =>
      useTimeFieldState({
        locale: "en-GB",
        value,
        minValue,
        maxValue,
        validationBehavior: "native",
        name: "clock",
        validate: () => "Custom clock error",
      } as TimeFieldStateOptions & { name: string }),
    {
      wrapper: ({ children }) => (
        <FormValidationContext.Provider value={{ clock: "Server clock error" }}>
          {children}
        </FormValidationContext.Provider>
      ),
    },
  )
  expect(result.current.displayValidation.validationErrors).toContain("Server clock error")
  await act(() => result.current.commitValidation())
  expect(result.current.displayValidation.isInvalid).toBe(true)
  await act(() => result.current.resetValidation())
  expect(result.current.displayValidation.isInvalid).toBe(false)
  expect(result.current.realtimeValidation.validationDetails.customError).toBe(true)
  expect(result.current.realtimeValidation.validationErrors).toEqual(["Custom clock error"])
})

it("retains time-zone DST overlap offsets through field cycling", async () => {
  const value = parseZonedDateTime("2024-11-03T01:30:00-04:00[America/New_York]")
  const { result } = await renderHook(() => useTimeFieldState({ locale: "en-US", defaultValue: value, hourCycle: 24 }))
  await act(() => result.current.increment("hour"))
  const current = result.current.value
  expect(current && "timeZone" in current && current.timeZone).toBe("America/New_York")
  expect(await trace(useTimeFieldState, "en-US", value)).toEqual(await trace(usePinnedTimeFieldState, "en-US", value))
})

it("keeps every declared editable segment represented by the complete state surface", async () => {
  const { result } = await renderHook(() =>
    useTimeFieldState({ locale: "en-US", granularity: "second", hourCycle: 12 }),
  )
  const parts: DateSegmentType[] = ["hour", "minute", "second", "dayPeriod"]
  expect(
    result.current.segments
      .filter((s) => s.isEditable)
      .map((s) => s.type)
      .sort(),
  ).toEqual(parts.sort())
})

it("matches pinned range validation without overriding custom validation precedence", async () => {
  const props = {
    locale: "en-GB",
    defaultValue: new Time(8),
    minValue: new Time(9),
    maxValue: new Time(17),
    validationBehavior: "native" as const,
  }
  const native = await renderHook(() => useTimeFieldState(props))
  const pinned = await renderHook(() => usePinnedTimeFieldState(props))
  expect(native.result.current.realtimeValidation).toEqual(pinned.result.current.realtimeValidation)
  expect(native.result.current.realtimeValidation.validationDetails.rangeUnderflow).toBe(true)
  await act(() => native.result.current.commitValidation())
  await act(() => pinned.result.current.commitValidation())
  expect(native.result.current.displayValidation).toEqual(pinned.result.current.displayValidation)
})
