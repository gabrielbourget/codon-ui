import "../../../collection/__tests__/nativeReceipts"

import { CalendarDate, CalendarDateTime, parseZonedDateTime, Time } from "@internationalized/date"
import { act, cleanup, renderHook } from "@testing-library/react-native"
import type { Ref } from "react"
import { AccessibilityInfo, type View } from "react-native"

import { renderWithNativeCollections as render } from "../../../collection/__tests__/nativeReceipts"
import { DateTimePicker } from "../../../components/DateTimePicker/DateTimePicker"
import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeLocaleProvider } from "../../../locale/NativeLocaleProvider"
import { NativeThemeProvider } from "../../../theme"
import type { DateValue } from "../types"
import { useDatePickerState, type DatePickerState } from "../useDatePickerState"

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

const original = new CalendarDateTime(2024, 11, 1, 13, 45, 7)
const zoned = parseZonedDateTime("2024-11-01T13:45:07[America/New_York]")
const nextDate = new CalendarDate(2024, 11, 3)
const nextTime = new Time(9, 10, 11)
const zonedTime = zoned.set({ hour: 9, minute: 10, second: 11 })
const cases = [
  { label: "empty date first", initial: undefined, placeholder: original, time: nextTime, dateFirst: true },
  { label: "empty zoned time first", initial: undefined, placeholder: zoned, time: zonedTime, dateFirst: false },
  { label: "complete zoned date first", initial: zoned, placeholder: zoned, time: zonedTime, dateFirst: true },
  { label: "complete time first", initial: original, placeholder: original, time: nextTime, dateFirst: false },
]

it.each(cases)("composes single picker date and time before one commit: $label", async (test) => {
  const change = jest.fn()
  const { result } = await renderHook(() =>
    useDatePickerState({
      defaultValue: test.initial,
      placeholderValue: test.placeholder,
      granularity: "second",
      shouldCloseOnSelect: false,
      onChange: change,
    }),
  )
  await act(() => {
    const state = result.current
    if (test.dateFirst) {
      state.setDateValue(nextDate)
      state.setTimeValue(test.time)
    } else {
      state.setTimeValue(test.time)
      state.setDateValue(nextDate)
    }
  })
  expect(change).toHaveBeenCalledTimes(test.initial ? 2 : 1)
  const requested = change.mock.calls.at(-1)![0]
  expect(requested).toBeInstanceOf(test.placeholder.constructor)
  expect(requested.toString()).toBe(test.placeholder.set({ day: 3, hour: 9, minute: 10, second: 11 }).toString())
  expect(result.current.value).toBe(requested)
  expect(result.current.defaultValue).toBe(test.initial ?? null)
  if (test.initial) {
    expect(change.mock.calls[0][0].toString()).toBe(
      test.dateFirst
        ? test.initial.set({ day: 3 }).toString()
        : test.initial.set({ hour: 9, minute: 10, second: 11 }).toString(),
    )
  }
})

it("resets a vetoed single picker request to the owner and accepts its exact echo", async () => {
  const change = jest.fn()
  const { result, rerender } = await renderHook(
    ({ value }: { value: DateValue | null }) => useDatePickerState({ value, onChange: change }),
    { initialProps: { value: zoned } },
  )
  await act(() => {
    const state = result.current
    state.setDateValue(nextDate)
    state.setTimeValue(zonedTime)
  })
  expect(change).toHaveBeenCalledTimes(2)
  const requested = change.mock.calls[1][0]
  expect(requested.toString()).toBe("2024-11-03T09:10:11-05:00[America/New_York]")
  expect(result.current.value).toBe(zoned)
  await act(() => result.current.setDateValue(new CalendarDate(2024, 11, 5)))
  expect(change.mock.calls[2][0].toString()).toBe("2024-11-05T13:45:07-05:00[America/New_York]")
  expect(result.current.value).toBe(zoned)
  await rerender({ value: requested })
  expect(result.current.value).toBe(requested)
  expect(result.current.defaultValue).toBe(zoned)
})

it("completes paired single picker parts under a null owner without claiming acceptance", async () => {
  const change = jest.fn()
  const { result, rerender } = await renderHook(
    ({ value }: { value: DateValue | null }) =>
      useDatePickerState({ value, placeholderValue: zoned, shouldCloseOnSelect: false, onChange: change }),
    { initialProps: { value: null } },
  )
  await act(() => {
    const state = result.current
    state.setTimeValue(zonedTime)
    state.setDateValue(nextDate)
  })
  expect(change).toHaveBeenCalledTimes(1)
  const requested = change.mock.calls[0][0]
  expect(requested.toString()).toBe("2024-11-03T09:10:11-05:00[America/New_York]")
  expect(result.current.value).toBeNull()
  expect(result.current.dateValue).toBeNull()
  expect(result.current.timeValue).toBeNull()
  await rerender({ value: requested })
  expect(result.current.value).toBe(requested)
})

it("does not revive a cleared date while accepting fresh time and date parts in one commit", async () => {
  const change = jest.fn()
  const { result } = await renderHook(() =>
    useDatePickerState({ defaultValue: original, shouldCloseOnSelect: false, granularity: "second", onChange: change }),
  )
  await act(() => {
    const state = result.current
    state.setValue(null)
    state.setTimeValue(nextTime)
    expect(change).toHaveBeenCalledTimes(1)
    expect(change).toHaveBeenLastCalledWith(null)
    state.setDateValue(nextDate)
  })
  expect(change).toHaveBeenCalledTimes(2)
  expect(change.mock.calls[1][0].toString()).toBe("2024-11-03T09:10:11")
  expect(result.current.value).toBe(change.mock.calls[1][0])
  expect(result.current.defaultValue).toBe(original)
})

it("uses the exact replacement value as the basis for the next calendar request", async () => {
  const replacement = new CalendarDateTime(2024, 12, 1, 19, 20, 21),
    change = jest.fn()
  const { result } = await renderHook(() => useDatePickerState({ defaultValue: original, onChange: change }))
  await act(() => {
    const state = result.current
    state.setValue(replacement)
    state.setDateValue(new CalendarDate(2024, 12, 5))
  })
  expect(change).toHaveBeenCalledTimes(2)
  expect(change.mock.calls[0][0]).toBe(replacement)
  expect(change.mock.calls[1][0].toString()).toBe("2024-12-05T19:20:21")
  expect(result.current.value).toBe(change.mock.calls[1][0])
})

it("propagates an owner callback failure while composing its already requested date with the next time", async () => {
  const error = new Error("Owner callback failed"),
    change = jest.fn().mockImplementationOnce(() => {
      throw error
    })
  const { result } = await renderHook(() => useDatePickerState({ defaultValue: original, onChange: change }))
  await act(() => {
    const state = result.current
    expect(() => state.setDateValue(nextDate)).toThrow(error)
    state.setTimeValue(nextTime)
  })
  expect(change).toHaveBeenCalledTimes(2)
  expect(change.mock.calls[1][0].toString()).toBe("2024-11-03T09:10:11")
  expect(result.current.value).toBe(change.mock.calls[1][0])
})

it("does not retain a date rejected by a throwing calendar selection policy", async () => {
  const error = new Error("Selection policy failed"),
    change = jest.fn(),
    shouldCloseOnSelect = jest.fn().mockImplementationOnce(() => {
      throw error
    })
  const { result } = await renderHook(() =>
    useDatePickerState({ defaultValue: original, onChange: change, shouldCloseOnSelect }),
  )
  await act(() => {
    const state = result.current
    expect(() => state.setDateValue(nextDate)).toThrow(error)
    state.setTimeValue(nextTime)
  })
  expect(change).toHaveBeenCalledTimes(1)
  expect(change.mock.calls[0][0].toString()).toBe("2024-11-01T09:10:11")
})

it("composes calendar and time requests from the public single picker renderer", async () => {
  const change = jest.fn()
  let current!: DatePickerState
  await render(
    <NativeThemeProvider>
      <NativeLocaleProvider locale="en-US">
        <DateTimePicker
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
    state.setDateValue(nextDate)
    state.setTimeValue(nextTime)
  })
  expect(change).toHaveBeenCalledTimes(2)
  expect(change.mock.calls[1][0].toString()).toBe("2024-11-03T09:10:11")
  expect(current.value).toBe(change.mock.calls[1][0])
})

it("retains original calendar-only callback objects and the initial default across paired requests", async () => {
  const initial = new CalendarDate(2024, 11, 1),
    last = new CalendarDate(2024, 11, 5),
    change = jest.fn()
  const { result } = await renderHook(() => useDatePickerState({ defaultValue: initial, onChange: change }))
  await act(() => {
    const state = result.current
    state.setDateValue(nextDate)
    state.setDateValue(last)
  })
  expect(change.mock.calls).toEqual([[nextDate], [last]])
  expect(change.mock.calls[0][0]).toBe(nextDate)
  expect(change.mock.calls[1][0]).toBe(last)
  expect(result.current.value).toBe(last)
  expect(result.current.defaultValue).toBe(initial)
})

it("retains a time-only draft without publishing a date until a later calendar selection", async () => {
  const change = jest.fn()
  const { result } = await renderHook(() =>
    useDatePickerState({ placeholderValue: zoned, shouldCloseOnSelect: false, onChange: change }),
  )
  await act(() => result.current.setTimeValue(zonedTime))
  expect(change).not.toHaveBeenCalled()
  expect(result.current.value).toBeNull()
  expect(result.current.dateValue).toBeNull()
  expect(result.current.timeValue).toBe(zonedTime)
  await act(() => result.current.setDateValue(nextDate))
  expect(change).toHaveBeenCalledTimes(1)
  expect(change.mock.calls[0][0].toString()).toBe("2024-11-03T09:10:11-05:00[America/New_York]")
})
