import { CalendarDate, createCalendar } from "@internationalized/date"
import { act, renderHook } from "@testing-library/react-native"
import { useCalendarState } from "react-stately/useCalendarState"
import { useRangeCalendarState, type RangeCalendarStateOptions } from "react-stately/useRangeCalendarState"

import type { TNativeKeyboardEvent } from "../../../input/types"
import { handleNativeCalendarKey } from "../keys"
import { activateNativeRangeCalendarDay, NativeCalendarRangeGesture } from "../rangeGesture"

const day = (value: number) => new CalendarDate(2024, 10, value)
const mouse = { id: 1, type: "mouse" } as const
const touch = { id: 2, type: "touch" } as const
const key = (value: string, extra = {}) =>
  ({
    nativeEvent: { key: value, phase: "down", cancelled: false, shiftKey: false, ...extra },
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  }) as unknown as TNativeKeyboardEvent

const range = async (props: Partial<RangeCalendarStateOptions<CalendarDate>> = {}) => {
  const result = await renderHook(() =>
    useRangeCalendarState({ locale: "en-US", createCalendar, defaultFocusedValue: day(10), ...props }),
  )
  let active = true,
    revision = "owner:1"
  const gesture = new NativeCalendarRangeGesture(() => ({
    state: result.result.current,
    revision,
    canAct: () => active,
    admit: (_date, run) => {
      if (active) run(result.result.current)
    },
  }))
  return {
    ...result,
    gesture,
    active: (value: boolean) => {
      active = value
    },
    revise: () => {
      revision = "owner:2"
    },
  }
}
afterEach(() => jest.useRealTimers())

it("moves real calendar days, rows, month/year pages and boundaries with original key defaults and repeats", async () => {
  const { result } = await renderHook(() =>
    useCalendarState({ locale: "en-US", createCalendar, defaultFocusedValue: day(10) }),
  )
  const send = async (name: string, extra = {}) => {
    const event = key(name, extra)
    await act(() => handleNativeCalendarKey(result.current, event, "ltr"))
    return event
  }
  expect((await send("ArrowRight", { repeat: true })).preventDefault).toHaveBeenCalledTimes(1)
  expect(result.current.focusedDate.toString()).toBe("2024-10-11")
  await send("ArrowDown")
  expect(result.current.focusedDate.day).toBe(18)
  await send("ArrowUp")
  expect(result.current.focusedDate.day).toBe(11)
  await send("Home")
  expect(result.current.focusedDate.day).toBe(1)
  await send("End")
  expect(result.current.focusedDate.day).toBe(31)
  await send("PageDown")
  expect(result.current.focusedDate.toString()).toBe("2024-11-30")
  await send("PageUp", { shiftKey: true })
  expect(result.current.focusedDate.toString()).toBe("2023-11-30")
  const event = key("ArrowLeft")
  await act(() => handleNativeCalendarKey(result.current, event, "rtl"))
  expect(result.current.focusedDate.toString()).toBe("2023-12-01")
  const tab = await send("Tab")
  expect(tab.preventDefault).not.toHaveBeenCalled()
  const cancelled = await send("ArrowRight", { cancelled: true })
  expect(cancelled.preventDefault).not.toHaveBeenCalled()
})

it("clears the range anchor on Escape and preserves original event propagation policy", async () => {
  const { result } = await range()
  await act(() => result.current.selectDate(day(10)))
  expect(result.current.anchorDate).toEqual(day(10))
  const event = key("Escape")
  await act(() => handleNativeCalendarKey(result.current, event, "ltr"))
  expect(result.current.anchorDate).toBeNull()
  expect(event.preventDefault).toHaveBeenCalled()
  expect(event.stopPropagation).not.toHaveBeenCalled()
})

it("commits reversed mouse drag endpoints using the real range state", async () => {
  const { result, gesture } = await range()
  await act(() => gesture.down(day(15), mouse))
  expect(result.current.anchorDate).toEqual(day(15))
  await act(() => gesture.enter(day(10), mouse))
  expect(result.current.highlightedRange).toEqual({ start: day(10), end: day(15) })
  await act(() => gesture.up(day(10), mouse))
  expect(result.current.value).toEqual({ start: day(10), end: day(15) })
  expect(result.current.isDragging).toBe(false)
})

it("holds the original 200ms touch admission and selects a quick tap on release", async () => {
  jest.useFakeTimers()
  const { result, gesture } = await range()
  await act(() => gesture.down(day(10), touch))
  await act(() => jest.advanceTimersByTime(199))
  expect(result.current.anchorDate).toBeNull()
  await act(() => gesture.up(day(10), touch))
  expect(result.current.anchorDate).toEqual(day(10))
  expect(result.current.isDragging).toBe(false)
  await act(() => jest.runOnlyPendingTimers())
  expect(result.current.value).toBeNull()
})

it("admits touch dragging at 200ms and commits another original day on release", async () => {
  jest.useFakeTimers()
  const { result, gesture } = await range()
  await act(() => gesture.down(day(10), touch))
  await act(() => jest.advanceTimersByTime(200))
  expect(result.current.isDragging).toBe(true)
  await act(() => gesture.enter(day(14), touch))
  await act(() => gesture.up(day(14), touch))
  expect(result.current.value).toEqual({ start: day(10), end: day(14) })
})

it("cancels scrolling/termination and rejects stale owner, foreign pointer and inactive-window work", async () => {
  jest.useFakeTimers()
  const { result, gesture, active, revise } = await range()
  await act(() => gesture.down(day(10), touch))
  await act(() => gesture.cancel())
  await act(() => jest.advanceTimersByTime(200))
  expect(result.current.anchorDate).toBeNull()
  await act(() => gesture.down(day(10), touch))
  expect(gesture.up(day(12), { ...touch, id: 3 })).toBe(false)
  revise()
  await act(() => jest.advanceTimersByTime(200))
  expect(result.current.anchorDate).toBeNull()
  await act(() => gesture.cancel())
  await act(() => gesture.down(day(10), touch))
  active(false)
  await act(() => jest.advanceTimersByTime(200))
  expect(result.current.anchorDate).toBeNull()
  await act(() => gesture.cancel())
})

it("drags an existing boundary while preserving the opposite endpoint", async () => {
  const { result, gesture } = await range({ defaultValue: { start: day(10), end: day(14) } })
  await act(() => gesture.down(day(10), mouse))
  expect(result.current.anchorDate).toEqual(day(14))
  await act(() => gesture.enter(day(8), mouse))
  await act(() => gesture.up(day(8), mouse))
  expect(result.current.value).toEqual({ start: day(8), end: day(14) })
})

it("begins a new selection when an existing boundary is clicked without dragging", async () => {
  const { result, gesture } = await range({ defaultValue: { start: day(10), end: day(14) } })
  await act(() => gesture.down(day(10), mouse))
  await act(() => gesture.up(day(10), mouse))
  expect(result.current.anchorDate).toEqual(day(10))
  expect(result.current.value).toEqual({ start: day(10), end: day(14) })
})

it.each([false, true])(
  "retains unavailable-date contiguous policy (noncontiguous=%s)",
  async (allowsNonContiguousRanges) => {
    const { result, gesture } = await range({ allowsNonContiguousRanges, isDateUnavailable: (date) => date.day === 12 })
    await act(() => gesture.down(day(10), mouse))
    await act(() => gesture.enter(day(15), mouse))
    expect(result.current.isCellDisabled(day(15))).toBe(!allowsNonContiguousRanges)
    expect(result.current.highlightedRange?.end.day).toBe(allowsNonContiguousRanges ? 15 : 10)
    await act(() => gesture.up(day(15), mouse))
    if (allowsNonContiguousRanges) expect(result.current.value?.end.day).toBe(15)
    else {
      expect(result.current.value).toBeNull()
      expect(result.current.isDragging).toBe(false)
      await act(() => gesture.down(day(11), mouse))
      await act(() => gesture.up(day(11), mouse))
      expect(result.current.value).toEqual({ start: day(10), end: day(11) })
    }
  },
)

it("matches keyboard range advancement and virtual endpoint activation without a pointer stream", async () => {
  const { result } = await range()
  await act(() => activateNativeRangeCalendarDay(result.current, day(10), "keyboard"))
  expect(result.current.anchorDate).toEqual(day(10))
  expect(result.current.focusedDate).toEqual(day(11))
  await act(() => activateNativeRangeCalendarDay(result.current, day(14), "virtual"))
  expect(result.current.value).toEqual({ start: day(10), end: day(14) })
})

it.each([{ isDisabled: true }, { isReadOnly: true }, { isDateUnavailable: () => true }])(
  "rejects selection through guarded dates: %j",
  async (props) => {
    const { result, gesture } = await range(props)
    expect(gesture.down(day(10), mouse)).toBe(false)
    await act(() => activateNativeRangeCalendarDay(result.current, day(10), "virtual"))
    expect(result.current.anchorDate).toBeNull()
    expect(result.current.value).toBeNull()
  },
)
