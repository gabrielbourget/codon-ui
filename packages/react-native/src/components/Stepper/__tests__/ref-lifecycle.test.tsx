import { fireEvent, render, screen } from "@testing-library/react-native"
import type { ComponentType, RefAttributes } from "react"
import { Platform, type TextInput, type TextInputProps } from "react-native"

import { Stepper } from "../Stepper"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")

let mockNativeHostKey = 0
jest.mock("react-native/Libraries/Components/TextInput/RCTSingelineTextInputNativeComponent", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const native = jest.requireActual<{ default: ComponentType<TextInputProps & RefAttributes<TextInput>> }>(
    "react-native/Libraries/Components/TextInput/RCTSingelineTextInputNativeComponent",
  )
  return {
    ...native,
    default: React.forwardRef<TextInput, TextInputProps>((props, ref) =>
      React.createElement(native.default, { ...props, ref, key: mockNativeHostKey }),
    ),
  }
})

type TStockNativeInput = TextInput & { getNativeRef: () => TextInput | null }

const names = { accessibilityLabel: "Quantity", incrementLabel: "Add quantity", decrementLabel: "Reduce quantity" }
const input = () => screen.getByTestId("stepper-input")

beforeEach(() => {
  mockNativeHostKey = 0
  jest.replaceProperty(Platform, "OS", "ios")
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockImplementation(() => 17)
})
afterEach(() => jest.restoreAllMocks())

it("retains one caller attachment while the stock TextInput updates its native event count", async () => {
  const caller = jest.fn((_target: TextInput | null) => undefined)
  const raw = jest.fn()
  const { unmount } = await render(<Stepper {...names} ref={caller} value={0} step={0.1} onChangeText={raw} />)
  expect(caller).toHaveBeenCalledTimes(1)
  const original = caller.mock.calls[0][0]
  expect(original).toBeTruthy()
  await fireEvent(input(), "change", { nativeEvent: { text: "0.3", eventCount: 1, target: 17 } })
  expect(raw).toHaveBeenCalledWith("0.3")
  expect(caller.mock.calls.filter(([target]) => target !== null).at(-1)?.[0]).toBe(original)
  expect((original as TStockNativeInput | null)?.getNativeRef()).toBe(original)
  expect(caller).toHaveBeenCalledTimes(1)
  await unmount()
  expect(caller).toHaveBeenCalledTimes(2)
  expect(caller.mock.calls[1][0]).toBeNull()
})

it("preserves callback-ref cleanup ownership through editing and a real caller-ref handoff", async () => {
  const firstCleanup = jest.fn(),
    secondCleanup = jest.fn()
  const first = jest.fn((_target: TextInput | null) => firstCleanup)
  const second = jest.fn((_target: TextInput | null) => secondCleanup)
  const props = { ...names, value: 0, step: 0.1 }
  const { rerender, unmount } = await render(<Stepper {...props} ref={first} />)
  const original = first.mock.calls[0][0]
  await fireEvent(input(), "change", { nativeEvent: { text: "0.1", eventCount: 1, target: 17 } })
  expect(first).toHaveBeenCalledTimes(1)
  expect(firstCleanup).not.toHaveBeenCalled()
  await rerender(<Stepper {...props} ref={second} />)
  expect(firstCleanup).toHaveBeenCalledTimes(1)
  expect(second).toHaveBeenCalledTimes(1)
  expect(second.mock.calls[0][0]).toBe(original)
  await fireEvent(input(), "change", { nativeEvent: { text: "0.3", eventCount: 2, target: 17 } })
  expect(second).toHaveBeenCalledTimes(1)
  expect(secondCleanup).not.toHaveBeenCalled()
  await unmount()
  expect(firstCleanup).toHaveBeenCalledTimes(1)
  expect(secondCleanup).toHaveBeenCalledTimes(1)
  expect(second).toHaveBeenCalledTimes(1)
})

it("clears the old object ref and publishes the actual current editor to its new owner", async () => {
  const first = { current: null as TextInput | null },
    second = { current: null as TextInput | null }
  const props = { ...names, value: 0, step: 0.1 }
  const { rerender, unmount } = await render(<Stepper {...props} ref={first} />)
  const original = first.current
  await fireEvent(input(), "change", { nativeEvent: { text: "0.3", eventCount: 1, target: 17 } })
  expect(first.current).toBe(original)
  await rerender(<Stepper {...props} ref={second} />)
  expect(first.current).toBeNull()
  expect(second.current).toBe(original)
  expect((second.current as TStockNativeInput | null)?.getNativeRef()).toBe(original)
  await unmount()
  expect(second.current).toBeNull()
})

it("publishes a genuinely replaced native host within the same Stepper and detaches it on teardown", async () => {
  const caller = jest.fn((_target: TextInput | null) => undefined)
  const props = { ...names, value: 0, step: 0.1 }
  const { rerender, unmount } = await render(<Stepper {...props} ref={caller} />)
  const original = caller.mock.calls[0][0]
  expect(caller).toHaveBeenCalledTimes(1)
  mockNativeHostKey = 1
  await rerender(<Stepper {...props} ref={caller} />)
  expect(caller).toHaveBeenCalledTimes(3)
  expect(caller.mock.calls[1][0]).toBeNull()
  const replacement = caller.mock.calls[2][0]
  expect(replacement).not.toBeNull()
  expect(replacement).not.toBe(original)
  expect((replacement as TStockNativeInput | null)?.getNativeRef()).toBe(replacement)
  await unmount()
  expect(caller).toHaveBeenCalledTimes(4)
  expect(caller.mock.calls[3][0]).toBeNull()
})
