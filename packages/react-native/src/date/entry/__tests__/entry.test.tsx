import { CalendarDate, GregorianCalendar, Time } from "@internationalized/date"
import { act, renderHook } from "@testing-library/react-native"
import { useMemo } from "react"

import { useDateFieldState } from "../../state/useDateFieldState"
import { useTimeFieldState } from "../../state/useTimeFieldState"
import { handleNativeDateGroupKey } from "../groupKey"
import {
  createNativeDateDisplayNames,
  getNativeDateFieldDescription,
  getNativeDateSegmentSemantics,
} from "../semantics"
import type { TNativeDateSegmentKeyEvent } from "../useNativeDateSegmentEntry"
import { useNativeDateSegmentEntry } from "../useNativeDateSegmentEntry"

const event = (
  key: string,
  extra: Partial<TNativeDateSegmentKeyEvent["nativeEvent"]> = {},
): TNativeDateSegmentKeyEvent => ({
  nativeEvent: {
    kind: "keyboard",
    ownerId: "entry",
    target: 71,
    key,
    nativeCode: 0,
    characters: "",
    phase: "down",
    repeat: false,
    cancelled: false,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    capsLock: false,
    nativeModifierData: "",
    nativeDefaultHandled: true,
    timestamp: 1,
    ...extra,
  },
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
})
const useEntry = (props: Parameters<typeof useTimeFieldState>[0], type = "hour") => {
  const state = useTimeFieldState(props)
  const segment = state.segments.find((part) => part.type === type)!
  const { focusNext, focusPrevious } = useMemo(() => ({ focusNext: jest.fn(), focusPrevious: jest.fn() }), [])
  return {
    state,
    segment,
    entry: useNativeDateSegmentEntry(segment, state, props.locale, { focusNext, focusPrevious }),
    focusNext,
    focusPrevious,
  }
}
it("accepts localized digits and a leading zero as pinned partial input, then advances on completion", async () => {
  const request = jest.fn()
  const { result } = await renderHook(() =>
    useEntry({ locale: "ar-EG", value: null, onChange: request, hourCycle: 24 }),
  )
  await act(() => result.current.entry.input("٠"))
  expect(request).not.toHaveBeenCalled()
  expect(result.current.segment.value).toBe(0)
  await act(() => result.current.entry.input("٩"))
  expect(result.current.focusNext).toHaveBeenCalledTimes(1)
  expect(result.current.state.timeValue).toBeNull()
})
it("uses full locale day periods for typed and composition admission", async () => {
  const value = new Time(13, 45),
    request = jest.fn()
  const { result } = await renderHook(() =>
    useEntry({ locale: "en-US", value, onChange: request, hourCycle: 12 }, "dayPeriod"),
  )
  await act(() => result.current.entry.compositionText("a"))
  await act(() => result.current.entry.compositionText("a"))
  expect(request.mock.calls.map(([v]) => v.toString())).toEqual(["01:45:00", "01:45:00"])
  expect(result.current.state.timeValue.hour).toBe(13)
  await act(() => result.current.entry.compositionText("3"))
  expect(request).toHaveBeenCalledTimes(2)
})
it("defers numeric composition until an owned commit reaches the entry controller", async () => {
  const value = new Time(13, 45),
    request = jest.fn()
  const { result } = await renderHook(() => useEntry({ locale: "en-GB", value, onChange: request, hourCycle: 24 }))
  await act(() => result.current.entry.compositionText("2"))
  expect(request).not.toHaveBeenCalled()
  await act(() => result.current.entry.input("2"))
  expect(request).toHaveBeenCalledWith(new Time(2, 45))
})
it("moves backward from a placeholder without manufacturing a value", async () => {
  const request = jest.fn()
  const { result } = await renderHook(() =>
    useEntry({ locale: "en-GB", value: null, onChange: request, hourCycle: 24 }),
  )
  await act(() => result.current.entry.backspace())
  expect(result.current.focusPrevious).toHaveBeenCalledTimes(1)
  expect(request).not.toHaveBeenCalled()
})
it.each(["isReadOnly", "isDisabled"] as const)(
  "retains %s against text, composition and all six adjustments",
  async (guard) => {
    const value = new Time(13, 45),
      request = jest.fn()
    const { result } = await renderHook(() =>
      useEntry({ locale: "en-US", value, onChange: request, hourCycle: 12, [guard]: true }),
    )
    for (const action of [
      "increment",
      "decrement",
      "incrementPage",
      "decrementPage",
      "incrementToMax",
      "decrementToMin",
    ] as const)
      await act(() => result.current.entry.adjust(action))
    await act(() => result.current.entry.input("2"))
    await act(() => result.current.entry.compositionText("a"))
    await act(() => result.current.entry.backspace())
    expect(request).not.toHaveBeenCalled()
    expect(result.current.state.timeValue).toBe(value)
  },
)
it.each([
  { phase: "up" as const },
  { cancelled: true },
  { ctrlKey: true },
  { metaKey: true },
  { altKey: true },
  { shiftKey: true },
])("does not spin from an ineligible original key: %o", async (extra) => {
  const value = new Time(13, 45),
    request = jest.fn()
  const { result } = await renderHook(() => useEntry({ locale: "en-GB", value, onChange: request, hourCycle: 24 }))
  await act(() => result.current.entry.keyDown(event("ArrowUp", extra)))
  expect(request).not.toHaveBeenCalled()
})
it("keeps composing spin guards separate from actual repeat keys and source delete handling", async () => {
  const value = new Time(13, 45),
    request = jest.fn()
  const { result } = await renderHook(() => useEntry({ locale: "en-GB", value, onChange: request, hourCycle: 24 }))
  await act(() => result.current.entry.keyDown(event("ArrowUp"), true))
  expect(request).not.toHaveBeenCalled()
  const original = event("ArrowUp", { repeat: true })
  await act(() => result.current.entry.keyDown(original))
  expect(original.preventDefault).toHaveBeenCalledTimes(1)
  expect(request).toHaveBeenCalledWith(new Time(14, 45))
  await act(() => result.current.entry.keyDown(event("Backspace"), true))
  expect(request).toHaveBeenLastCalledWith(new Time(1, 45))
})
it("resets entered prefixes only on actual focus or source adjustments", async () => {
  const value = new Time(13, 45),
    request = jest.fn()
  const { result } = await renderHook(() => useEntry({ locale: "en-GB", value, onChange: request, hourCycle: 24 }))
  await act(() => result.current.entry.input("1"))
  await act(() => result.current.entry.focus())
  await act(() => result.current.entry.input("2"))
  expect(request).toHaveBeenLastCalledWith(new Time(2, 45))
})
it("selects a full calendar era using the pinned formatted prefix", async () => {
  const value = new CalendarDate("BC", 2, 1, 1),
    request = jest.fn()
  const { result } = await renderHook(() => {
    const state = useDateFieldState({
      locale: "en-US",
      value,
      onChange: request,
      createCalendar: () => new GregorianCalendar(),
    })
    const segment = state.segments.find((part) => part.type === "era")!
    return useNativeDateSegmentEntry(segment, state, "en-US", { focusNext: jest.fn(), focusPrevious: jest.fn() })
  })
  await act(() => result.current.input("A"))
  expect(request.mock.calls[0][0].era).toBe("AD")
  expect(value.era).toBe("BC")
})
it.each(["ltr", "rtl"] as const)("preserves source group arrow behavior with %s focus routing", (direction) => {
  const focus = { focusNext: jest.fn(), focusPrevious: jest.fn(), focusVisual: jest.fn() }
  const left = event("ArrowLeft", { shiftKey: true }),
    right = event("ArrowRight")
  handleNativeDateGroupKey(left, direction, focus)
  handleNativeDateGroupKey(right, direction, focus)
  expect(left.preventDefault).toHaveBeenCalledTimes(1)
  expect(right.stopPropagation).toHaveBeenCalledTimes(1)
  if (direction === "rtl") expect(focus.focusVisual.mock.calls).toEqual([[-1], [1]])
  else {
    expect(focus.focusPrevious).toHaveBeenCalledTimes(1)
    expect(focus.focusNext).toHaveBeenCalledTimes(1)
  }
})
it("retains complete source platform semantics and per-segment description admission", async () => {
  const value = new Time(13, 45)
  const { result } = await renderHook(() => useEntry({ locale: "en-GB", value, hourCycle: 24 }))
  const { state, segment, entry } = result.current
  expect(getNativeDateSegmentSemantics(segment, state, entry.textValue, "en-GB", "android", "Clock")).toMatchObject({
    role: "spinbutton",
    label: "hour, Clock",
    value: 13,
    minimum: 0,
    maximum: 23,
    includeDescription: true,
  })
  expect(getNativeDateSegmentSemantics(segment, state, entry.textValue, "en-GB", "ios", "Clock")).toMatchObject({
    role: "textbox",
    value: null,
    minimum: null,
    maximum: null,
    textValue: null,
  })
  const minute = state.segments.find((s) => s.type === "minute")!
  expect(getNativeDateSegmentSemantics(minute, state, minute.text, "en-GB", "android")).toMatchObject({
    includeDescription: false,
  })
  expect(getNativeDateFieldDescription(state, "en-GB")).toContain("13:45")
})
it("retains all pinned locale field-name fallbacks when Intl lacks dateTimeField support", () => {
  const constructor = jest.spyOn(Intl, "DisplayNames").mockImplementation(() => {
    throw new RangeError("No dateTimeField support")
  })
  expect(createNativeDateDisplayNames("fr-CA").of("hour")).toBe("heure")
  expect(createNativeDateDisplayNames("ar-EG").of("minute")).toBe("الدقائق")
  expect(createNativeDateDisplayNames("en-GB").of("dayPeriod")).toBe("AM/PM")
  constructor.mockRestore()
})
