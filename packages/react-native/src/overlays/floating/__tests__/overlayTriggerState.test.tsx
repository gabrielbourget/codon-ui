import { CalendarDate } from "@internationalized/date"
import { act, renderHook } from "@testing-library/react-native"

import {
  useOverlayTriggerState,
  type OverlayTriggerProps,
} from "../../../components/ComboBox/state/useOverlayTriggerState"
import { useDatePickerState } from "../../../date/state/useDatePickerState"

it.each([false, true])("composes uncontrolled popup toggles before one React commit from %s", async (defaultOpen) => {
  const onOpenChange = jest.fn()
  const { result } = await renderHook(() => useOverlayTriggerState({ defaultOpen, onOpenChange }))
  await act(() => {
    result.current.toggle()
    result.current.toggle()
  })
  expect(result.current.isOpen).toBe(defaultOpen)
  expect(onOpenChange.mock.calls).toEqual([[!defaultOpen], [defaultOpen]])
})

it("composes explicit popup requests and toggles in call order", async () => {
  const onOpenChange = jest.fn()
  const { result } = await renderHook(() => useOverlayTriggerState({ onOpenChange }))
  await act(() => {
    result.current.open()
    result.current.toggle()
    result.current.toggle()
    result.current.close()
  })
  expect(result.current.isOpen).toBe(false)
  expect(onOpenChange.mock.calls).toEqual([[true], [false], [true], [false]])
})

it.each([false, true])("retains controlled popup owner %s and deduplicates same-batch requests", async (isOpen) => {
  const onOpenChange = jest.fn()
  const { result } = await renderHook(() => useOverlayTriggerState({ isOpen, onOpenChange }))
  for (let batch = 0; batch < 2; batch++) {
    await act(() => {
      result.current.toggle()
      result.current.toggle()
    })
    expect(result.current.isOpen).toBe(isOpen)
    expect(onOpenChange.mock.calls).toEqual(Array.from({ length: batch + 1 }, () => [!isOpen]))
  }
})

it("reads the popup default only at mount and uses the current change callback", async () => {
  const first = jest.fn()
  const latest = jest.fn()
  const { result, rerender } = await renderHook((props: OverlayTriggerProps) => useOverlayTriggerState(props), {
    initialProps: { defaultOpen: false, onOpenChange: first },
  })
  await rerender({ defaultOpen: true, onOpenChange: latest })
  expect(result.current.isOpen).toBe(false)
  await act(() => {
    result.current.toggle()
    result.current.toggle()
  })
  expect(first).not.toHaveBeenCalled()
  expect(latest.mock.calls).toEqual([[true], [false]])
})

it("retains an accepted uncontrolled popup change when its callback throws", async () => {
  const error = new Error("popup callback")
  const onOpenChange = jest.fn((next: boolean) => {
    if (next) throw error
  })
  const { result } = await renderHook(() => useOverlayTriggerState({ onOpenChange }))
  await act(() => {
    expect(() => result.current.toggle()).toThrow(error)
    result.current.toggle()
  })
  expect(result.current.isOpen).toBe(false)
  expect(onOpenChange.mock.calls).toEqual([[true], [false]])
})

it("composes popup toggles through the date picker consumer without changing its selected date", async () => {
  const defaultValue = new CalendarDate(2026, 11, 11)
  const onOpenChange = jest.fn()
  const onChange = jest.fn()
  const { result } = await renderHook(() => useDatePickerState({ defaultValue, onOpenChange, onChange }))
  await act(() => {
    result.current.toggle()
    result.current.toggle()
  })
  expect(result.current.isOpen).toBe(false)
  expect(result.current.value).toBe(defaultValue)
  expect(onOpenChange.mock.calls).toEqual([[true], [false]])
  expect(onChange).not.toHaveBeenCalled()
})
