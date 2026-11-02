import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import type { TextInput } from "react-native"

import { ComboBox, type TNativeComboBoxProps } from "../../.."

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})
beforeEach(() => {
  jest.useFakeTimers()
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const tags = new WeakMap<object, number>()
  let serial = 100
  jest.spyOn(native, "findNodeHandle").mockImplementation((target) => {
    if (!target || typeof target !== "object") return typeof target === "number" ? target : null
    if (!tags.has(target)) tags.set(target, ++serial)
    return tags.get(target)!
  })
})
afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
})
const base = {
  items: [{ id: 0, name: "Zero" }],
  getKey: (item: { id: number }) => item.id,
  getTextValue: (item: { name: string }) => item.name,
  accessibilityLabel: "Choose",
  inputLabel: "Query",
  closeLabel: "Close",
  isOpen: true,
} satisfies TNativeComboBoxProps<{ id: number; name: string }>
const host = () => screen.getByTestId("combo-box-floating-host")
const input = () => screen.getByTestId("combo-box-input")
const tag = (original: TextInput) =>
  jest.requireActual<typeof import("react-native")>("react-native").findNodeHandle(original)!
let sequence = 0
const ready = async (original: TextInput) => {
  for (const value of [false, true])
    await act(() => {
      const props = host().props
      props.onNativeScopeStatus({
        nativeEvent: {
          ownerId: props.ownerId,
          windowId: "ordinary-simple-source",
          epoch: 1,
          ready: value,
          windowActive: true,
          policyRevision: props.policyRevision,
        },
      })
    })
  await act(() => {
    const props = host().props
    const binding = props.ordinaryEditorBindings.find(
      (value: { targetTag: number }) => value.targetTag === tag(original),
    )
    props.onNativeOrdinaryEditorStatus({
      nativeEvent: {
        ...binding,
        ownerId: props.ownerId,
        target: tag(original),
        windowId: props.acceptedWindowId,
        epoch: props.acceptedEpoch,
        sequence: ++sequence,
        ready: true,
        windowActive: true,
        error: "",
      },
    })
  })
}
const packet = (original: TextInput, eventId: number, phase: "down" | "up" = "down") => {
  const props = host().props
  const binding = props.ordinaryEditorBindings.find((value: { targetTag: number }) => value.targetTag === tag(original))
  return {
    target: original,
    currentTarget: original,
    persist: jest.fn(),
    preventDefault: jest.fn(),
    isPropagationStopped: () => false,
    nativeEvent: {
      ...binding,
      ownerId: props.ownerId,
      windowId: props.acceptedWindowId,
      epoch: props.acceptedEpoch,
      target: tag(original),
      eventId,
      kind: "keyboard",
      key: "x",
      nativeCode: 52,
      characters: "x",
      code: "KeyX",
      location: 0,
      phase,
      repeat: false,
      cancelled: false,
      isComposing: false,
      shiftKey: true,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "0",
      nativeDefaultHandled: false,
      timestamp: eventId,
      observerBindings: "[]",
    },
  }
}

it("delivers the same original down/up to root before input callbacks, including readonly observations", async () => {
  const original = createRef<TextInput>(),
    calls: unknown[][] = [],
    selected = jest.fn(),
    query = jest.fn()
  const props = {
    ...base,
    inputRef: original,
    onChange: selected,
    onInputChange: query,
    onKeyDown: (event: unknown) => calls.push(["root-down", event]),
    onKeyUp: (event: unknown) => calls.push(["root-up", event]),
    inputProps: {
      onKeyDown: (event: unknown) => calls.push(["input-down", event]),
      onKeyUp: (event: unknown) => calls.push(["input-up", event]),
    },
  }
  const view = await render(<ComboBox {...props} />)
  await ready(original.current!)
  const down = packet(original.current!, 1),
    up = packet(original.current!, 2, "up")
  await act(() => input().props.onNativeOrdinaryEditorKey(down))
  await act(() => input().props.onNativeOrdinaryEditorKey(up))
  expect(calls).toEqual([
    ["root-down", down],
    ["input-down", down],
    ["root-up", up],
    ["input-up", up],
  ])
  expect(down.target).toBe(original.current)
  expect(down.currentTarget).toBe(original.current)
  expect(input().props.onKeyDown).toBeUndefined()
  expect(input().props.onKeyUp).toBeUndefined()
  await view.rerender(<ComboBox {...props} isReadOnly />)
  await ready(original.current!)
  const readOnly = packet(original.current!, 3)
  await act(() => input().props.onNativeOrdinaryEditorKey(readOnly))
  expect(calls.slice(-2)).toEqual([
    ["root-down", readOnly],
    ["input-down", readOnly],
  ])
  expect(input().props.editable).toBe(false)
  expect(selected).not.toHaveBeenCalled()
  expect(query).not.toHaveBeenCalled()
})

it("refuses foreign, duplicate, disabled and unmounted ordinary frames without rewriting their objects", async () => {
  const original = createRef<TextInput>(),
    observe = jest.fn()
  const props = { ...base, inputRef: original, onKeyDown: observe }
  const view = await render(<ComboBox {...props} />)
  await ready(original.current!)
  const event = packet(original.current!, 1),
    receive = input().props.onNativeOrdinaryEditorKey
  await act(() => receive({ ...event, target: {} }))
  expect(observe).not.toHaveBeenCalled()
  await act(() => receive(event))
  await act(() => receive(event))
  expect(observe.mock.calls).toEqual([[event]])
  const retired = packet(original.current!, 2)
  await view.rerender(<ComboBox {...props} isDisabled />)
  await act(() => receive(retired))
  expect(observe).toHaveBeenCalledTimes(1)
  await view.unmount()
  await act(() => receive(retired))
  expect(observe).toHaveBeenCalledTimes(1)
  expect(event.target).toBe(event.currentTarget)
})
