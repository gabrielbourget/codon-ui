import "../../../collection/__tests__/nativeReceipts"

import { CalendarDate, CalendarDateTime, parseZonedDateTime, Time } from "@internationalized/date"
import { act, cleanup, renderHook } from "@testing-library/react-native"
import type { Ref } from "react"
import { AccessibilityInfo, type View } from "react-native"

import { renderWithNativeCollections as render } from "../../../collection/__tests__/nativeReceipts"
import { DateTimeRangePicker } from "../../../components/DateTimeRangePicker/DateTimeRangePicker"
import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeLocaleProvider } from "../../../locale/NativeLocaleProvider"
import { NativeThemeProvider } from "../../../theme"
import type { DateValue } from "../types"
import { useDateRangePickerState, type DateRangePickerState } from "../useDateRangePickerState"

jest.mock("../../../input/specs/CUIDateSegmentNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestSegmentFocus: jest.fn(), requestSegmentBlur: jest.fn() },
}))
jest.mock("../../../components/ClickPopover/ClickPopover", () => ({
  NativeFloatingSurface: ({ children, isOpen }: { children: React.ReactNode; isOpen?: boolean }) =>
    isOpen ? children : null,
}))
jest.mock("../../../input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest
    .requireActual("react")
    .forwardRef((props: object, ref: Ref<View>) =>
      jest.requireActual("react").createElement(jest.requireActual("react-native").View, { ...props, ref }),
    ),
}))

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  cleanup()
})

const timeExamples = [
  new CalendarDateTime(2024, 11, 1, 13, 45, 7),
  parseZonedDateTime("2024-11-01T13:45:07[America/New_York]"),
]
const examples = [new CalendarDate(2024, 11, 1), ...timeExamples]
const rangeFor = (start: DateValue) => ({
  start,
  end: "hour" in start ? start.add({ days: 1, hours: 4, minutes: 5 }) : start.add({ days: 1 }),
})

it.each(examples)("composes paired calendar endpoint edits before one commit: %s", async (start) => {
  const original = rangeFor(start),
    change = jest.fn(),
    nextStart = new CalendarDate(2024, 11, 3),
    nextEnd = new CalendarDate(2024, 11, 5)
  const { result } = await renderHook(() => useDateRangePickerState({ defaultValue: original, onChange: change }))
  await act(() => {
    const state = result.current
    state.setDate("start", nextStart)
    state.setDate("end", nextEnd)
  })
  expect(change).toHaveBeenCalledTimes(2)
  expect(change.mock.calls[0][0].start.toString()).toBe(original.start.set({ day: 3 }).toString())
  expect(change.mock.calls[0][0].end.toString()).toBe(original.end.toString())
  const requested = change.mock.calls[1][0]
  expect(requested.start).toBeInstanceOf(original.start.constructor)
  expect(requested.end).toBeInstanceOf(original.end.constructor)
  expect(requested.start.toString()).toBe(original.start.set({ day: 3 }).toString())
  expect(requested.end.toString()).toBe(original.end.set({ day: 5 }).toString())
  expect(result.current.value).toBe(requested)
  expect(result.current.defaultValue).toBe(original)
  if (!("hour" in start)) {
    expect(requested.start).toBe(nextStart)
    expect(requested.end).toBe(nextEnd)
  }
})

it.each(timeExamples)("composes paired time endpoint edits before one commit: %s", async (start) => {
  const original = rangeFor(start),
    change = jest.fn()
  const { result } = await renderHook(() => useDateRangePickerState({ defaultValue: original, onChange: change }))
  await act(() => {
    const state = result.current
    state.setTime("start", start.set({ hour: 9, minute: 10, second: 11 }))
    state.setTime("end", start.set({ day: 2, hour: 19, minute: 20, second: 21 }))
  })
  expect(change).toHaveBeenCalledTimes(2)
  expect(change.mock.calls[0][0].end.toString()).toBe(original.end.toString())
  const requested = change.mock.calls[1][0]
  expect(requested.start).toBeInstanceOf(original.start.constructor)
  expect(requested.end).toBeInstanceOf(original.end.constructor)
  expect(requested.start.toString()).toBe(original.start.set({ hour: 9, minute: 10, second: 11 }).toString())
  expect(requested.end.toString()).toBe(original.end.set({ hour: 19, minute: 20, second: 21 }).toString())
  expect(result.current.value).toBe(requested)
})

it("completes an empty date range from paired endpoint edits in one commit", async () => {
  const change = jest.fn(),
    start = new CalendarDate(2024, 11, 3),
    end = new CalendarDate(2024, 11, 5)
  const { result } = await renderHook(() => useDateRangePickerState<CalendarDate>({ onChange: change }))
  await act(() => {
    const state = result.current
    state.setDate("start", start)
    expect(change).not.toHaveBeenCalled()
    state.setDate("end", end)
  })
  expect(change).toHaveBeenCalledTimes(1)
  expect(change.mock.calls[0][0]).toEqual({ start, end })
  expect(result.current.value.start).toBe(start)
  expect(result.current.value.end).toBe(end)
})

it.each(timeExamples)("completes pending times and dates before one commit: %s", async (placeholderValue) => {
  const change = jest.fn()
  const { result } = await renderHook(() =>
    useDateRangePickerState({ placeholderValue, granularity: "second", shouldCloseOnSelect: false, onChange: change }),
  )
  await act(() => {
    const state = result.current
    state.setTime("start", placeholderValue.set({ hour: 9, minute: 10, second: 11 }))
    state.setTime("end", placeholderValue.set({ hour: 19, minute: 20, second: 21 }))
    state.setDate("start", new CalendarDate(2024, 11, 3))
    expect(change).not.toHaveBeenCalled()
    state.setDate("end", new CalendarDate(2024, 11, 5))
  })
  expect(change).toHaveBeenCalledTimes(1)
  const requested = change.mock.calls[0][0]
  expect(requested.start).toBeInstanceOf(placeholderValue.constructor)
  expect(requested.end).toBeInstanceOf(placeholderValue.constructor)
  expect(requested.start.toString()).toBe(placeholderValue.set({ day: 3, hour: 9, minute: 10, second: 11 }).toString())
  expect(requested.end.toString()).toBe(placeholderValue.set({ day: 5, hour: 19, minute: 20, second: 21 }).toString())
  expect(result.current.value).toBe(requested)
})

it.each(examples)("retains original direct endpoint values and clears the next range draft: %s", async (start) => {
  const change = jest.fn(),
    end = rangeFor(start).end
  const { result } = await renderHook(() => useDateRangePickerState<DateValue>({ onChange: change }))
  await act(() => {
    const state = result.current
    state.setDateTime("start", start)
    state.setDateTime("end", end)
  })
  expect(change).toHaveBeenCalledTimes(1)
  expect(result.current.value.start).toBe(start)
  expect(result.current.value.end).toBe(end)
  await act(() => {
    const state = result.current
    state.setValue(null)
    state.setDateTime("start", start.add({ days: 5 }))
  })
  expect(change).toHaveBeenLastCalledWith(null)
  expect(result.current.value.start?.toString()).toBe(start.add({ days: 5 }).toString())
  expect(result.current.value.end).toBeNull()
  expect(result.current.defaultValue).toBeNull()
})

it.each(examples)(
  "restarts paired range requests from a vetoed owner and accepts its exact echo: %s",
  async (start) => {
    const owner = rangeFor(start),
      change = jest.fn(),
      nextStart = new CalendarDate(2024, 11, 3),
      nextEnd = new CalendarDate(2024, 11, 5)
    const { result, rerender } = await renderHook(
      ({ value }: { value: ReturnType<typeof rangeFor> }) => useDateRangePickerState({ value, onChange: change }),
      { initialProps: { value: owner } },
    )
    await act(() => {
      const state = result.current
      state.setDate("start", nextStart)
      state.setDate("end", nextEnd)
    })
    const requested = change.mock.calls[1][0]
    expect(requested.start.toString()).toBe(owner.start.set({ day: 3 }).toString())
    expect(requested.end.toString()).toBe(owner.end.set({ day: 5 }).toString())
    expect(result.current.value).toBe(owner)
    await act(() => result.current.setDate("end", nextEnd))
    expect(change).toHaveBeenCalledTimes(3)
    expect(change.mock.calls[2][0].start.toString()).toBe(owner.start.toString())
    expect(result.current.value).toBe(owner)
    await rerender({ value: requested })
    expect(result.current.value).toBe(requested)
    expect(result.current.defaultValue).toBe(owner)
  },
)

it("composes date and time requests from the public range renderer without losing either endpoint", async () => {
  const original = {
      start: new CalendarDateTime(2024, 11, 1, 13, 45, 7),
      end: new CalendarDateTime(2024, 11, 2, 18, 50, 7),
    },
    change = jest.fn()
  let current!: DateRangePickerState
  await render(
    <NativeThemeProvider>
      <NativeLocaleProvider locale="en-US">
        <DateTimeRangePicker
          defaultValue={original}
          onChange={change}
          isOpen={false}
          render={(props, { state }) => {
            current = state
            return <NativeFocusView {...props} />
          }}
        />
      </NativeLocaleProvider>
    </NativeThemeProvider>,
  )
  await act(() => {
    const state = current
    state.setDate("start", new CalendarDate(2024, 11, 3))
    state.setDate("end", new CalendarDate(2024, 11, 5))
    state.setTime("start", new Time(9, 10, 11))
    state.setTime("end", new Time(19, 20, 21))
  })
  expect(change).toHaveBeenCalledTimes(4)
  const requested = change.mock.calls[3][0]
  expect(requested.start.toString()).toBe("2024-11-03T09:10:11")
  expect(requested.end.toString()).toBe("2024-11-05T19:20:21")
  expect(current.value).toBe(requested)
  expect(current.defaultValue).toBe(original)
})

it("completes a controlled null range while retaining owner veto and original endpoint objects", async () => {
  const change = jest.fn(),
    start = new CalendarDate(2024, 11, 3),
    end = new CalendarDate(2024, 11, 5)
  const { result, rerender } = await renderHook(
    ({ value }: { value: { start: CalendarDate; end: CalendarDate } | null }) =>
      useDateRangePickerState({ value, onChange: change }),
    { initialProps: { value: null } },
  )
  await act(() => {
    const state = result.current
    state.setDate("start", start)
    state.setDate("end", end)
  })
  expect(change).toHaveBeenCalledTimes(1)
  const requested = change.mock.calls[0][0]
  expect(requested.start).toBe(start)
  expect(requested.end).toBe(end)
  expect(result.current.value).toEqual({ start: null, end: null })
  await rerender({ value: requested })
  expect(result.current.value).toBe(requested)
})

it("propagates a change callback failure and composes the already requested date with the next time edit", async () => {
  const original = rangeFor(timeExamples[0]),
    error = new Error("Owner rejected callback"),
    change = jest.fn().mockImplementationOnce(() => {
      throw error
    })
  const { result } = await renderHook(() => useDateRangePickerState({ defaultValue: original, onChange: change }))
  await act(() => {
    const state = result.current
    expect(() => state.setDate("start", new CalendarDate(2024, 11, 3))).toThrow(error)
    state.setTime("end", new Time(19, 20, 21))
  })
  expect(change).toHaveBeenCalledTimes(2)
  const requested = change.mock.calls[1][0]
  expect(requested.start.toString()).toBe("2024-11-03T13:45:07")
  expect(requested.end.toString()).toBe("2024-11-02T19:20:21")
  expect(result.current.value).toBe(requested)
})

it("does not retain a calendar endpoint when the selection policy throws before accepting it", async () => {
  const original = rangeFor(examples[0]),
    change = jest.fn(),
    error = new Error("Selection policy failed"),
    shouldCloseOnSelect = jest.fn().mockImplementationOnce(() => {
      throw error
    })
  const { result } = await renderHook(() =>
    useDateRangePickerState({ defaultValue: original, onChange: change, shouldCloseOnSelect }),
  )
  await act(() => {
    const state = result.current
    expect(() => state.setDate("start", new CalendarDate(2024, 11, 3))).toThrow(error)
    state.setDate("end", new CalendarDate(2024, 11, 5))
  })
  expect(change).toHaveBeenCalledTimes(1)
  expect(change.mock.calls[0][0].start).toBe(original.start)
  expect(change.mock.calls[0][0].end.toString()).toBe("2024-11-05")
  expect(result.current.value).toBe(change.mock.calls[0][0])
})

it("clears pending endpoints before composing a fresh date and time range in the same commit", async () => {
  const original = rangeFor(timeExamples[0]),
    change = jest.fn()
  const { result } = await renderHook(() =>
    useDateRangePickerState({
      defaultValue: original,
      granularity: "minute",
      shouldCloseOnSelect: false,
      onChange: change,
    }),
  )
  await act(() => {
    const state = result.current
    state.setValue(null)
    state.setDate("start", new CalendarDate(2024, 11, 3))
    expect(change).toHaveBeenCalledTimes(1)
    expect(change).toHaveBeenLastCalledWith(null)
    state.setDate("end", new CalendarDate(2024, 11, 5))
    state.setTime("start", new Time(9, 10))
    expect(change).toHaveBeenCalledTimes(1)
    state.setTime("end", new Time(19, 20))
  })
  expect(change).toHaveBeenCalledTimes(2)
  const requested = change.mock.calls[1][0]
  expect(requested.start.toString()).toBe("2024-11-03T09:10:00")
  expect(requested.end.toString()).toBe("2024-11-05T19:20:00")
  expect(result.current.value).toBe(requested)
  expect(result.current.defaultValue).toBe(original)
})

it("uses the newly supplied full range for a following endpoint edit before the next commit", async () => {
  const original = rangeFor(timeExamples[0]),
    replacement = {
      start: new CalendarDateTime(2024, 12, 1, 9, 10),
      end: new CalendarDateTime(2024, 12, 2, 19, 20),
    },
    change = jest.fn()
  const { result } = await renderHook(() => useDateRangePickerState({ defaultValue: original, onChange: change }))
  await act(() => {
    const state = result.current
    state.setValue(replacement)
    state.setDate("end", new CalendarDate(2024, 12, 5))
  })
  expect(change).toHaveBeenCalledTimes(2)
  expect(change.mock.calls[0][0]).toBe(replacement)
  const requested = change.mock.calls[1][0]
  expect(requested.start.toString()).toBe("2024-12-01T09:10:00")
  expect(requested.end.toString()).toBe("2024-12-05T19:20:00")
  expect(result.current.value).toBe(requested)
  expect(result.current.defaultValue).toBe(original)
})
