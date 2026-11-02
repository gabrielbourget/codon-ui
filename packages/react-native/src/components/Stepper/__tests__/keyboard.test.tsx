import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import type { TextInput } from "react-native"

import { Stepper, type StepperProps } from "../../.."
import type { TNativeStepperKeyboardEvent } from "../types"

jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestKeyboardFocus: jest.fn(), requestKeyboardBlur: jest.fn(), inspectAccessibility: jest.fn() },
}))

const names = { accessibilityLabel: "Quantity", incrementLabel: "Add quantity", decrementLabel: "Reduce quantity" }
const originalRef = createRef<TextInput>()
const input = () => screen.getByTestId("stepper-input")
const root = () => screen.getByTestId("stepper")
const show = (props: Partial<StepperProps> = {}) => render(<Stepper {...names} ref={originalRef} {...props} />)
const acknowledge = async (epoch = 1) => {
  for (const ready of [false, true]) {
    const props = root().props
    await act(() =>
      props.onNativeScopeStatus({
        nativeEvent: {
          ownerId: props.ownerId,
          windowId: "stepper-window",
          epoch,
          policyRevision: props.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
  const props = root().props
  for (const binding of props.ordinaryEditorBindings)
    await act(() =>
      props.onNativeOrdinaryEditorStatus({
        nativeEvent: {
          ...binding,
          ownerId: props.ownerId,
          target: 17,
          windowId: "stepper-window",
          epoch,
          sequence: epoch,
          ready: true,
          windowActive: true,
          error: "",
        },
      }),
    )
}
type TPacketOptions = Partial<{
  key: string
  phase: "down" | "up"
  repeat: boolean
  isComposing: boolean
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  capsLock: boolean
  cancelled: boolean
}>
const packets = (dispatchId: number, options: TPacketOptions = {}) => {
  const props = root().props,
    binding = props.ordinaryEditorBindings[0],
    policy = props.policies[0]
  const { isComposing = false, ...overrides } = options
  const data = {
    kind: "keyboard",
    ownerId: props.ownerId,
    policyId: policy?.id ?? "disabled",
    target: 9,
    focusedTarget: 17,
    windowId: "stepper-window",
    epoch: props.acceptedEpoch,
    policyRevision: props.policyRevision,
    key: "ArrowUp",
    nativeCode: 19,
    characters: "",
    phase: "down",
    repeat: false,
    cancelled: false,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    capsLock: false,
    nativeModifierData: "0",
    nativeDefaultHandled: !!policy,
    timestamp: dispatchId,
    ...overrides,
  }
  const frame = { ...data, ...binding, targetTag: 17, dispatchId, admitted: !!policy, isComposing }
  const internal = { nativeEvent: { ...data, originalEditorAction: JSON.stringify(frame) } }
  const original = {
    target: originalRef.current,
    currentTarget: originalRef.current,
    persist: jest.fn(),
    preventDefault: jest.fn(),
    nativeEvent: {
      ...data,
      ...binding,
      target: 17,
      eventId: dispatchId,
      code: data.key,
      location: 0,
      isComposing,
      observerBindings: "[]",
      originalEditorAction: JSON.stringify(frame),
    },
  }
  return { internal, original }
}
const dispatch = async (event: ReturnType<typeof packets>) => {
  await act(() => root().props.onNativeScopedKey(event.internal))
  await act(() => input().props.onNativeOrdinaryEditorKey(event.original))
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockImplementation(() => 17)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("ST-KEY-01 requests numeric change before root/input callbacks on the unchanged genuine editor event", async () => {
  const order: string[] = [],
    change = jest.fn(() => order.push("numeric")),
    rootKey = jest.fn((event: TNativeStepperKeyboardEvent) => {
      order.push("root")
      const original: TextInput = event.currentTarget
      const composing: boolean = event.nativeEvent.isComposing
      expect(original).toBe(originalRef.current)
      expect(composing).toBe(false)
      event.preventDefault()
    }),
    inputKey = jest.fn((_event: TNativeStepperKeyboardEvent) => order.push("input"))
  await show({ value: 2, step: 0.5, onChange: change, onKeyDown: rootKey, inputProps: { onKeyDown: inputKey } })
  await acknowledge()
  const original = originalRef.current,
    event = packets(1)
  expect(root().props.policies[0]).toMatchObject({ originalEditorAction: true, targetTag: 17 })
  expect(root().props.ordinaryEditorBindings).toHaveLength(1)
  expect(root().props.ordinaryEditorBindings[0]).toHaveProperty("originalEditorAction", true)
  await dispatch(event)
  expect(order).toEqual(["numeric", "root", "input"])
  expect(change).toHaveBeenCalledWith(2.5)
  expect(rootKey.mock.calls[0][0]).toBe(event.original)
  expect(inputKey.mock.calls[0][0]).toBe(event.original)
  expect(rootKey.mock.calls[0][0].nativeEvent).toBe(event.original.nativeEvent)
  expect(event.original.target).toBe(original)
  expect(event.original.currentTarget).toBe(original)
  expect(event.original.preventDefault).toHaveBeenCalledTimes(1)
  expect(input()).toHaveDisplayValue("2")
  expect(originalRef.current).toBe(original)
  expect(input().props.onKeyPress).toBeUndefined()
})

it.each([
  ["ArrowUp", 2.5],
  ["PageUp", 2.5],
  ["ArrowDown", 1.5],
  ["PageDown", 1.5],
])("ST-KEY-02 %s makes one canonical step, including repeated controlled veto", async (key, expected) => {
  const change = jest.fn()
  await show({ value: 2, step: 0.5, onChange: change })
  await acknowledge()
  await dispatch(packets(1, { key }))
  await dispatch(packets(2, { key, repeat: true }))
  expect(change.mock.calls).toEqual([[expected], [expected]])
  expect(input()).toHaveDisplayValue("2")
})

it.each([
  ["Home", 0],
  ["End", 0.9],
])("ST-KEY-03 %s uses its exact private feasible endpoint once", async (key, expected) => {
  const change = jest.fn()
  await show({ defaultValue: 0.5, minValue: 0, maxValue: 1, step: 0.3, onChange: change })
  await acknowledge()
  const event = packets(1, { key })
  await dispatch(event)
  await dispatch(event)
  expect(change.mock.calls).toEqual([[expected]])
  expect(input()).toHaveDisplayValue(String(expected))
})

it("ST-KEY-04 an absent endpoint leaves the genuine draft available for the normal end commit", async () => {
  const change = jest.fn()
  await show({ defaultValue: 2, onChange: change })
  await acknowledge()
  await fireEvent.changeText(input(), "4")
  await dispatch(packets(1, { key: "Home" }))
  expect(change).not.toHaveBeenCalled()
  expect(input()).toHaveDisplayValue("4")
  await fireEvent(input(), "endEditing", { nativeEvent: { text: "4" } })
  expect(change.mock.calls).toEqual([[4]])
})

it("ST-KEY-05 readonly preserves genuine down/up and composing observations without numeric capture", async () => {
  const down = jest.fn(),
    up = jest.fn(),
    childDown = jest.fn(),
    childUp = jest.fn(),
    change = jest.fn()
  await show({
    defaultValue: 2,
    isReadOnly: true,
    onChange: change,
    onKeyDown: down,
    onKeyUp: up,
    inputProps: { onKeyDown: childDown, onKeyUp: childUp },
  })
  await acknowledge()
  const original = originalRef.current,
    first = packets(1, { isComposing: true }),
    second = packets(2, { phase: "up", ctrlKey: true, cancelled: true })
  expect(root().props.policies).toEqual([])
  await dispatch(first)
  await dispatch(second)
  expect(down.mock.calls[0][0]).toBe(first.original)
  expect(childDown.mock.calls[0][0]).toBe(first.original)
  expect(up.mock.calls[0][0]).toBe(second.original)
  expect(childUp.mock.calls[0][0]).toBe(second.original)
  expect(up.mock.calls[0][0].nativeEvent.cancelled).toBe(true)
  expect(down.mock.calls[0][0].nativeEvent.isComposing).toBe(true)
  expect(change).not.toHaveBeenCalled()
  expect(input().props.editable).toBe(false)
  expect(originalRef.current).toBe(original)
})

it.each(["shiftKey", "altKey", "ctrlKey", "metaKey", "isComposing"] as const)(
  "ST-KEY-06 %s leaves numeric value intact and delivers the original observation",
  async (flag) => {
    const change = jest.fn(),
      observe = jest.fn()
    await show({ defaultValue: 2, onChange: change, onKeyDown: observe })
    await acknowledge()
    const event = packets(1, { [flag]: true })
    await dispatch(event)
    expect(change).not.toHaveBeenCalled()
    expect(observe.mock.calls[0][0]).toBe(event.original)
    expect(input()).toHaveDisplayValue("2")
  },
)

it("ST-KEY-07 CapsLock alone retains numeric stepping", async () => {
  const change = jest.fn()
  await show({ value: 2, onChange: change })
  await acknowledge()
  await dispatch(packets(1, { capsLock: true }))
  expect(change.mock.calls).toEqual([[3]])
})

it("ST-KEY-08 callback replacement uses current callbacks without retiring the original editor or binding", async () => {
  const old = jest.fn(),
    current = jest.fn(),
    child = jest.fn(),
    change = jest.fn()
  const view = await show({ value: 2, onChange: change, onKeyDown: old })
  await acknowledge()
  const event = packets(1),
    original = originalRef.current,
    binding = root().props.ordinaryEditorBindings[0]
  await view.rerender(
    <Stepper
      {...names}
      ref={originalRef}
      value={2}
      onChange={change}
      onKeyDown={current}
      inputProps={{ onKeyDown: child }}
    />,
  )
  expect(root().props.ordinaryEditorBindings[0]).toEqual(binding)
  await dispatch(event)
  expect(old).not.toHaveBeenCalled()
  expect(current.mock.calls[0][0]).toBe(event.original)
  expect(child.mock.calls[0][0]).toBe(event.original)
  expect(change.mock.calls).toEqual([[3]])
  expect(originalRef.current).toBe(original)
})

it.each(["config", "disabled", "window"] as const)(
  "ST-KEY-09 %s retirement permanently rejects old action and original observations after restoration",
  async (reason) => {
    const change = jest.fn(),
      observe = jest.fn()
    const view = await show({ value: 2, onChange: change, onKeyDown: observe })
    await acknowledge()
    const event = packets(1)
    if (reason === "window") {
      const props = root().props
      await act(() =>
        props.onNativeScopeStatus({
          nativeEvent: {
            ownerId: props.ownerId,
            windowId: "stepper-window",
            epoch: 2,
            policyRevision: props.policyRevision,
            ready: false,
            windowActive: false,
          },
        }),
      )
    } else {
      await view.rerender(
        <Stepper
          {...names}
          ref={originalRef}
          value={2}
          step={reason === "config" ? 2 : 1}
          isDisabled={reason === "disabled"}
          onChange={change}
          onKeyDown={observe}
        />,
      )
    }
    await dispatch(event)
    await view.rerender(<Stepper {...names} ref={originalRef} value={2} onChange={change} onKeyDown={observe} />)
    await acknowledge(2)
    await dispatch(event)
    expect(change).not.toHaveBeenCalled()
    expect(observe).not.toHaveBeenCalled()
    const fresh = packets(2)
    await dispatch(fresh)
    expect(change.mock.calls).toEqual([[3]])
    expect(observe.mock.calls[0][0]).toBe(fresh.original)
  },
)

it("ST-KEY-10 original ref detachment/unmount rejects retained public receivers", async () => {
  const change = jest.fn(),
    observe = jest.fn()
  const view = await show({ value: 2, onChange: change, onKeyDown: observe })
  await acknowledge()
  const receive = input().props.onNativeOrdinaryEditorKey,
    scoped = root().props.onNativeScopedKey,
    event = packets(1)
  await view.unmount()
  await act(() => {
    scoped(event.internal)
    receive(event.original)
  })
  expect(originalRef.current).toBeNull()
  expect(change).not.toHaveBeenCalled()
  expect(observe).not.toHaveBeenCalled()
})

it("ST-KEY-11 controlled echo keeps the same binding and subsequent requests use the current value", async () => {
  const change = jest.fn(),
    observe = jest.fn()
  const view = await show({ value: 2, onChange: change, onKeyDown: observe })
  await acknowledge()
  const binding = root().props.ordinaryEditorBindings[0],
    original = originalRef.current
  await dispatch(packets(1))
  await view.rerender(<Stepper {...names} ref={originalRef} value={3} onChange={change} onKeyDown={observe} />)
  expect(root().props.ordinaryEditorBindings[0]).toEqual(binding)
  await dispatch(packets(2))
  expect(change.mock.calls).toEqual([[3], [4]])
  expect(observe).toHaveBeenCalledTimes(2)
  expect(input()).toHaveDisplayValue("3")
  expect(originalRef.current).toBe(original)
})

it.each(["target", "receiver", "binding"] as const)(
  "ST-KEY-12 foreign %s cannot forge numeric action or original public observation",
  async (foreign) => {
    const change = jest.fn(),
      observe = jest.fn()
    await show({ value: 2, onChange: change, onKeyDown: observe })
    await acknowledge()
    const event = packets(1),
      frame = JSON.parse(event.internal.nativeEvent.originalEditorAction)
    if (foreign === "target") {
      frame.targetTag = 99
      event.internal.nativeEvent.focusedTarget = 99
      event.original.target = null
    } else if (foreign === "receiver") {
      frame.targetTag = 99
      event.original.currentTarget = null
    } else {
      frame.bindingRevision = "foreign"
      event.original.nativeEvent.bindingRevision = "foreign"
    }
    event.internal.nativeEvent.originalEditorAction = JSON.stringify(frame)
    event.original.nativeEvent.originalEditorAction = JSON.stringify(frame)
    await dispatch(event)
    expect(change).not.toHaveBeenCalled()
    expect(observe).not.toHaveBeenCalled()
    const fresh = packets(2)
    await dispatch(fresh)
    expect(change.mock.calls).toEqual([[3]])
    expect(observe.mock.calls[0][0]).toBe(fresh.original)
  },
)

it("ST-KEY-13 rejecting a foreign action policy does not suppress its separately genuine original observation", async () => {
  const change = jest.fn(),
    observe = jest.fn()
  await show({ value: 2, onChange: change, onKeyDown: observe })
  await acknowledge()
  const event = packets(1),
    frame = JSON.parse(event.internal.nativeEvent.originalEditorAction)
  frame.policyRevision = -1
  event.internal.nativeEvent.policyRevision = -1
  event.internal.nativeEvent.originalEditorAction = JSON.stringify(frame)
  event.original.nativeEvent.originalEditorAction = JSON.stringify(frame)
  await dispatch(event)
  expect(change).not.toHaveBeenCalled()
  expect(observe.mock.calls[0][0]).toBe(event.original)
  expect(input()).toHaveDisplayValue("2")
})
