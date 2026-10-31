import { Time } from "@internationalized/date"
import { act, renderHook } from "@testing-library/react-native"

import type { TNativeFocusWithinEvent } from "../../../input/focusWithin"
import { useTimeFieldState } from "../../state/useTimeFieldState"
import { useNativeDateFieldLifecycle } from "../useLifecycle"

const event = (within: boolean, sequence = 1): TNativeFocusWithinEvent =>
  ({
    nativeEvent: {
      ownerId: "field",
      bindingId: "binding:1",
      target: 2,
      surfaceId: 11,
      windowId: "window:1",
      scopeOwnerId: "scope",
      scopeEpoch: 1,
      sequence,
      attached: true,
      active: true,
      within,
      focusedTarget: within ? 3 : 0,
      textInputFocused: false,
      origin: "keyboard",
      observedAt: 1,
    },
  }) as TNativeFocusWithinEvent
const setup = async (value: Time | null = new Time(13, 45)) => {
  const calls: unknown[] = [],
    onFocus = jest.fn((original) => calls.push(["focus", original])),
    onBlur = jest.fn((original) => calls.push(["blur", original])),
    onFocusChange = jest.fn((focused) => calls.push(["change", focused]))
  let admitted = true
  const initial = { value, isDisabled: false, isReadOnly: false, onFocus, onBlur, onFocusChange }
  const view = await renderHook(
    (props: typeof initial) => {
      const state = useTimeFieldState({
        locale: "en-GB",
        value: props.value,
        isDisabled: props.isDisabled,
        isReadOnly: props.isReadOnly,
        granularity: "second",
      })
      const original = {
        ...state,
        confirmPlaceholder: () => {
          calls.push("confirm")
          state.confirmPlaceholder()
        },
        commitValidation: () => {
          calls.push("validate")
          state.commitValidation()
        },
      }
      return { state, lifecycle: useNativeDateFieldLifecycle(original, props, () => admitted) }
    },
    { initialProps: initial },
  )
  return {
    ...view,
    calls,
    initial,
    admit: (value: boolean) => {
      admitted = value
    },
  }
}
it("forwards the exact original observations once per field transition", async () => {
  const view = await setup(),
    focus = event(true),
    blur = event(false, 3)
  await act(() => view.result.current.lifecycle.receive(focus))
  await act(() => view.result.current.lifecycle.receive(event(true, 2)))
  await act(() => view.result.current.lifecycle.receive(blur))
  expect(view.calls).toEqual([["focus", focus], ["change", true], "confirm", ["blur", blur], ["change", false]])
})
it("commits changed-value validation after placeholder confirmation and before the original blur callback", async () => {
  const view = await setup(),
    focus = event(true),
    blur = event(false, 2)
  await act(() => view.result.current.lifecycle.receive(focus))
  await view.rerender({ ...view.initial, value: new Time(18, 20) })
  view.calls.length = 0
  await act(() => view.result.current.lifecycle.receive(blur))
  expect(view.calls).toEqual(["confirm", "validate", ["blur", blur], ["change", false]])
})
it("uses source reference identity even when the replacement value formats identically", async () => {
  const view = await setup()
  await act(() => view.result.current.lifecycle.receive(event(true)))
  await view.rerender({ ...view.initial, value: new Time(13, 45) })
  view.calls.length = 0
  await act(() => view.result.current.lifecycle.receive(event(false, 2)))
  expect(view.calls[0]).toBe("confirm")
  expect(view.calls[1]).toBe("validate")
})
it("uses latest committed callbacks without forgetting the original value-on-focus snapshot", async () => {
  const view = await setup(),
    latest = jest.fn()
  await act(() => view.result.current.lifecycle.receive(event(true)))
  await view.rerender({ ...view.initial, value: new Time(18, 20), onBlur: latest })
  const original = event(false, 2)
  await act(() => view.result.current.lifecycle.receive(original))
  expect(latest).toHaveBeenCalledWith(original)
  expect(view.initial.onBlur).not.toHaveBeenCalled()
  expect(view.calls).toContain("validate")
})
it("preserves readonly field focus and ignores disabled or unadmitted observations", async () => {
  const view = await setup()
  await view.rerender({ ...view.initial, isReadOnly: true })
  await act(() => view.result.current.lifecycle.receive(event(true)))
  expect(view.initial.onFocus).toHaveBeenCalledTimes(1)
  view.calls.length = 0
  view.admit(false)
  await act(() => view.result.current.lifecycle.receive(event(false, 2)))
  expect(view.calls).toEqual([])
  view.admit(true)
  await view.rerender({ ...view.initial, isDisabled: true })
  await act(() => view.result.current.lifecycle.receive(event(false, 3)))
  expect(view.calls).toEqual([])
})
it("retires without fabricating blur events or confirming placeholders on unmount", async () => {
  const view = await setup(null)
  await act(() => view.result.current.lifecycle.receive(event(true)))
  const lifecycle = view.result.current.lifecycle
  view.calls.length = 0
  await act(() => lifecycle.retire())
  await act(() => lifecycle.receive(event(false, 2)))
  await view.unmount()
  await act(() => lifecycle.receive(event(true, 3)))
  expect(view.calls).toEqual([])
})
