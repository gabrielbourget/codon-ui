import { act, render, screen } from "@testing-library/react-native"
import { createRef, type Ref } from "react"
import type { View } from "react-native"

import { NativeButton } from "../../components/Button/Button"

const root = () => screen.getByRole("button")
const pointer = () => ({
  persist: jest.fn(),
  target: 17,
  currentTarget: 17,
  nativeEvent: { target: 17, timestamp: 0, identifier: 0, locationX: 0, locationY: 0, pageX: 0, pageY: 0 },
})
const keyboard = (phase = "down") => ({
  persist: jest.fn(),
  preventDefault: jest.fn(),
  isDefaultPrevented: () => false,
  nativeEvent: {
    kind: "keyboard",
    ownerId: root().props.ownerId,
    nativeCode: 40,
    key: "Enter",
    phase,
    nativeDefaultHandled: true,
  },
})
beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it.each(["pointer", "keyboard"] as const)(
  "ends an active original %s cycle exactly once when its receiver is removed",
  async (kind) => {
    const end = jest.fn(),
      press = jest.fn(),
      ref = createRef<View>()
    await render(
      <NativeButton ref={ref} onPressEnd={end} onPress={press}>
        Action
      </NativeButton>,
    )
    const original = ref.current
    const event = kind === "pointer" ? pointer() : keyboard()
    const retained = kind === "pointer" ? root().props.onResponderGrant : root().props.onNativeKey
    await act(() => retained(event))
    expect(end).not.toHaveBeenCalled()
    expect(ref.current).toBe(original)
    await screen.unmount()
    expect(end).toHaveBeenCalledTimes(1)
    expect(end.mock.calls[0][0]).toBe(event)
    await act(() => retained(event))
    await act(() => jest.advanceTimersByTime(600))
    expect(end).toHaveBeenCalledTimes(1)
    expect(press).not.toHaveBeenCalled()
  },
)
it("preserves an active pointer cycle through a transient same-host callback-ref handoff", async () => {
  const end = jest.fn(),
    press = jest.fn(),
    first = jest.fn(),
    next = jest.fn()
  const node = (ref: Ref<View>) => (
    <NativeButton ref={ref} onPressEnd={end} onPress={press}>
      Action
    </NativeButton>
  )
  await render(node(first))
  const original = first.mock.calls[0][0],
    event = pointer()
  await act(() => root().props.onResponderGrant(event))
  await screen.rerender(node(next))
  expect(next.mock.calls[0][0]).toBe(original)
  expect(end).not.toHaveBeenCalled()
  await screen.unmount()
  expect(end).toHaveBeenCalledTimes(1)
  expect(end.mock.calls[0][0]).toBe(event)
  expect(press).not.toHaveBeenCalled()
})
it.each(["ended", "cancelled"] as const)("does not cancel a %s keyboard cycle again during removal", async (state) => {
  const end = jest.fn(),
    press = jest.fn()
  const node = (disabled = false) => (
    <NativeButton isDisabled={disabled} onPressEnd={end} onPress={press}>
      Action
    </NativeButton>
  )
  await render(node())
  await act(() => root().props.onNativeKey(keyboard()))
  if (state === "ended") await act(() => root().props.onNativeKey(keyboard("up")))
  else await screen.rerender(node(true))
  expect(end).toHaveBeenCalledTimes(1)
  await screen.unmount()
  expect(end).toHaveBeenCalledTimes(1)
  expect(press).toHaveBeenCalledTimes(state === "ended" ? 1 : 0)
})
