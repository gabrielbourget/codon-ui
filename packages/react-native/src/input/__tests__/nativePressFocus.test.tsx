import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import type { View } from "react-native"

import { NativeButton } from "../../components/Button/Button"
import * as focus from "../focus"

const root = () => screen.getByRole("button")
const touch = (timestamp = 0) => ({
  persist: jest.fn(),
  currentTarget: 17,
  target: 17,
  nativeEvent: { target: 17, timestamp, identifier: 0, locationX: 0, locationY: 0, pageX: 0, pageY: 0 },
})
const pointerPress = async () => {
  const down = touch(),
    up = touch(200)
  await act(() => root().props.onResponderGrant(down))
  await act(() => root().props.onResponderRelease(up))
  await act(() => jest.runOnlyPendingTimers())
  return { down, up }
}
beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("requests the same original only after existing press-start callbacks and preserves activation when native focus refuses", async () => {
  const ref = createRef<View>(),
    order: string[] = [],
    observed = jest.fn(),
    press = jest.fn(() => order.push("press"))
  const request = jest.spyOn(focus, "focusNativeTarget").mockImplementation((original) => {
    expect(original).toBe(ref.current)
    order.push("focus-request")
    return false
  })
  const start = jest.fn((_event: unknown) => order.push("start"))
  await render(
    <NativeButton ref={ref} nativeFocusOnPress onPressStart={start} onPress={press} onFocus={observed}>
      Action
    </NativeButton>,
  )
  const original = ref.current
  const event = await pointerPress()
  expect(request).toHaveBeenCalledTimes(1)
  expect(request).toHaveBeenCalledWith(original)
  expect(start.mock.calls[0][0]).toBe(event.down)
  expect(order).toEqual(["start", "focus-request", "press"])
  expect(press).toHaveBeenCalledTimes(1)
  expect(observed).not.toHaveBeenCalled()
  expect(ref.current).toBe(original)
})
it.each([false, undefined])(
  "skips pointer focus for private flag %s while retaining the same activation",
  async (nativeFocusOnPress) => {
    const request = jest.spyOn(focus, "focusNativeTarget").mockReturnValue(true),
      press = jest.fn()
    await render(
      <NativeButton nativeFocusOnPress={nativeFocusOnPress} onPress={press}>
        Action
      </NativeButton>,
    )
    await pointerPress()
    expect(request).not.toHaveBeenCalled()
    expect(press).toHaveBeenCalledTimes(1)
  },
)
it.each(["disabled", "pending"] as const)(
  "does not request focus or activate an inadmissible %s pointer press",
  async (guard) => {
    const request = jest.spyOn(focus, "focusNativeTarget").mockReturnValue(true),
      press = jest.fn()
    await render(
      <NativeButton
        nativeFocusOnPress
        isDisabled={guard === "disabled"}
        isPending={guard === "pending"}
        onPress={press}
      >
        Action
      </NativeButton>,
    )
    await pointerPress()
    expect(request).not.toHaveBeenCalled()
    expect(press).not.toHaveBeenCalled()
  },
)
it("retires the retained focus lease without suppressing activation or fabricating a completion", async () => {
  jest.spyOn(focus, "captureNativeFocusTarget").mockReturnValue(() => false)
  const request = jest.spyOn(focus, "focusNativeTarget").mockReturnValue(true),
    press = jest.fn(),
    observed = jest.fn()
  await render(
    <NativeButton nativeFocusOnPress onPress={press} onFocus={observed}>
      Action
    </NativeButton>,
  )
  await pointerPress()
  expect(request).not.toHaveBeenCalled()
  expect(press).toHaveBeenCalledTimes(1)
  expect(observed).not.toHaveBeenCalled()
})
it("leaves keyboard and accessibility activation outside the opted-in pointer focus path", async () => {
  const request = jest.spyOn(focus, "focusNativeTarget").mockReturnValue(true),
    press = jest.fn()
  await render(
    <NativeButton nativeFocusOnPress onPress={press}>
      Action
    </NativeButton>,
  )
  const key = (phase: "down" | "up") => ({
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
  await act(() => root().props.onNativeKey(key("down")))
  await act(() => root().props.onNativeKey(key("up")))
  await act(() =>
    root().props.onNativeActivation({
      nativeEvent: {
        kind: "activation",
        ownerId: root().props.ownerId,
        target: 17,
        source: "ios-accessibility-activate",
        observedAt: 0,
        activationId: 1,
        scopeOwnerId: "",
        windowId: "window",
        epoch: 0,
      },
    }),
  )
  expect(request).not.toHaveBeenCalled()
  expect(press).toHaveBeenCalledTimes(2)
})
