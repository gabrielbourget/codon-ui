import { fireEvent, render, screen } from "@testing-library/react-native"
import type { ComponentType, RefAttributes } from "react"
import { Platform, type TextInput, type TextInputProps } from "react-native"

import { TypeaheadSearch } from "../TypeaheadSearch"

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

const input = () => screen.getByTestId("typeahead-search-input")
const props = { accessibilityLabel: "Search", inputValue: "  held query  ", status: "idle" as const }

beforeEach(() => {
  mockNativeHostKey = 0
  jest.replaceProperty(Platform, "OS", "ios")
  const tags = new WeakMap<object, number>()
  let sequence = 100
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockImplementation((target: unknown) => {
    if (!target || typeof target !== "object") return null
    if (!tags.has(target)) tags.set(target, ++sequence)
    return tags.get(target)!
  })
})
afterEach(() => jest.restoreAllMocks())

it("retains one caller attachment and exact query/native callbacks while stock TextInput updates event counts", async () => {
  const caller = jest.fn((_target: TextInput | null) => undefined)
  const changed = jest.fn(),
    nativeChanged = jest.fn()
  const { unmount } = await render(
    <TypeaheadSearch {...props} inputRef={caller} onInputChange={changed} inputProps={{ onChange: nativeChanged }} />,
  )
  expect(caller).toHaveBeenCalledTimes(1)
  const original = caller.mock.calls[0][0]!
  expect(original).toBeTruthy()
  const event = { nativeEvent: { text: "  requested query  ", eventCount: 1, target: 17 } }
  await fireEvent(input(), "change", event)
  expect(changed.mock.calls).toEqual([["  requested query  "]])
  expect(nativeChanged.mock.calls[0][0]).toBe(event)
  expect(input().props.text).toBe("  held query  ")
  expect(caller.mock.calls.filter(([target]) => target !== null).at(-1)?.[0]).toBe(original)
  expect((original as TStockNativeInput).getNativeRef()).toBe(original)
  expect(caller).toHaveBeenCalledTimes(1)
  await unmount()
  expect(caller).toHaveBeenCalledTimes(2)
  expect(caller.mock.calls[1][0]).toBeNull()
})

it("preserves callback-ref cleanup through stock editing and a true caller-ref handoff", async () => {
  const firstCleanup = jest.fn(),
    secondCleanup = jest.fn()
  const first = jest.fn((_target: TextInput | null) => firstCleanup)
  const second = jest.fn((_target: TextInput | null) => secondCleanup)
  const changed = jest.fn()
  const { rerender, unmount } = await render(<TypeaheadSearch {...props} inputRef={first} onInputChange={changed} />)
  const original = first.mock.calls[0][0]
  await fireEvent(input(), "change", { nativeEvent: { text: "first", eventCount: 1, target: 17 } })
  expect(first).toHaveBeenCalledTimes(1)
  expect(firstCleanup).not.toHaveBeenCalled()
  await rerender(<TypeaheadSearch {...props} inputRef={second} onInputChange={changed} />)
  expect(firstCleanup).toHaveBeenCalledTimes(1)
  expect(second).toHaveBeenCalledTimes(1)
  expect(second.mock.calls[0][0]).toBe(original)
  await fireEvent(input(), "change", { nativeEvent: { text: "second", eventCount: 2, target: 17 } })
  expect(second).toHaveBeenCalledTimes(1)
  expect(secondCleanup).not.toHaveBeenCalled()
  await unmount()
  expect(firstCleanup).toHaveBeenCalledTimes(1)
  expect(secondCleanup).toHaveBeenCalledTimes(1)
  expect(second).toHaveBeenCalledTimes(1)
})

it("clears the old object ref and publishes the same original editor to a new caller", async () => {
  const first = { current: null as TextInput | null },
    second = { current: null as TextInput | null }
  const changed = jest.fn()
  const { rerender, unmount } = await render(<TypeaheadSearch {...props} inputRef={first} onInputChange={changed} />)
  const original = first.current
  await fireEvent(input(), "change", { nativeEvent: { text: "request", eventCount: 1, target: 17 } })
  expect(first.current).toBe(original)
  await rerender(<TypeaheadSearch {...props} inputRef={second} onInputChange={changed} />)
  expect(first.current).toBeNull()
  expect(second.current).toBe(original)
  expect((second.current as TStockNativeInput | null)?.getNativeRef()).toBe(original)
  await unmount()
  expect(second.current).toBeNull()
})

it("publishes a genuinely replaced native host once and detaches it on teardown", async () => {
  const caller = jest.fn((_target: TextInput | null) => undefined)
  const changed = jest.fn()
  const { rerender, unmount } = await render(<TypeaheadSearch {...props} inputRef={caller} onInputChange={changed} />)
  const original = caller.mock.calls[0][0]
  expect(caller).toHaveBeenCalledTimes(1)
  mockNativeHostKey = 1
  await rerender(<TypeaheadSearch {...props} inputRef={caller} onInputChange={changed} />)
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
