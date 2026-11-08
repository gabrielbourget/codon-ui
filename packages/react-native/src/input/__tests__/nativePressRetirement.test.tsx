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

it("accepts the first fresh press after read-only removed a cancelled cycle's release handler", async () => {
  const press = jest.fn(),
    end = jest.fn(),
    ref = createRef<View>()
  const node = (enabled: boolean) => (
    <NativeButton ref={ref} nativeInteraction={enabled} onPress={press} onPressEnd={end}>
      Action
    </NativeButton>
  )
  await render(node(true))
  const original = ref.current
  await act(() => root().props.onResponderGrant(pointer()))
  await screen.rerender(node(false))
  expect(root().props.onResponderRelease).toBeUndefined()
  expect(end).toHaveBeenCalledTimes(1)
  expect(press).not.toHaveBeenCalled()
  await screen.rerender(node(true))
  expect(ref.current).toBe(original)
  await act(() => root().props.onResponderGrant(pointer()))
  const released = pointer()
  await act(() => root().props.onResponderRelease(released))
  expect(press).toHaveBeenCalledTimes(1)
  expect(press.mock.calls[0][0]).toBe(released)
  await act(() => jest.runOnlyPendingTimers())
  expect(end).toHaveBeenCalledTimes(2)
})

it("keeps the original held press cancelled when read-only clears before release", async () => {
  const press = jest.fn(),
    end = jest.fn()
  const node = (enabled: boolean) => (
    <NativeButton nativeInteraction={enabled} onPress={press} onPressEnd={end}>
      Action
    </NativeButton>
  )
  await render(node(true))
  await act(() => root().props.onResponderGrant(pointer()))
  await screen.rerender(node(false))
  await screen.rerender(node(true))
  await act(() => root().props.onResponderRelease(pointer()))
  expect(press).not.toHaveBeenCalled()
  expect(end).toHaveBeenCalledTimes(1)
  await act(() => root().props.onResponderGrant(pointer()))
  await act(() => root().props.onResponderRelease(pointer()))
  expect(press).toHaveBeenCalledTimes(1)
  await act(() => jest.runOnlyPendingTimers())
  expect(end).toHaveBeenCalledTimes(2)
})
