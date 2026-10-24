import { act, render, screen } from "@testing-library/react-native"
import { findNodeHandle } from "react-native"

import {
  NativeFieldInputContext,
  type TNativeFieldKeyEvent,
  type TNativeFieldPointerEvent,
  type TNativeFieldPointerPhase,
} from "../fieldInput"
import { NativeFocusHost } from "../NativeFocusView"
import type { TNativeKeyboardEvent } from "../types"

jest.mock("../specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestKeyboardFocus: jest.fn(), requestKeyboardBlur: jest.fn(), inspectAccessibility: jest.fn() },
}))

const originalEvent = () => {
  const identity = {
    ownerId: "field",
    bindingId: "field:1",
    bindingRevision: "revision:1",
    metadataTarget: 15,
    outerTarget: 2,
    inputTarget: 3,
    surfaceId: 11,
    target: 10,
    documentId: "document:1",
    documentRevision: "7",
    windowId: "window:1",
    mountRevision: "mount:7",
    outerInstance: "outer:1",
    inputInstance: "input:1",
    nativeInstance: "component:10",
    editorInstance: "editor:10",
    epoch: 2,
  }
  const packet = {
    moduleLease: "module:1",
    token: 1,
    eventId: 1,
    phase: "down",
    identity,
    groups: [
      { target: 3, bindingId: "field:1", bindingRevision: "revision:1", scopeTarget: 2 },
      { target: 2, bindingId: "field:1", bindingRevision: "revision:1", scopeTarget: 2 },
    ],
  }
  let prevented = false,
    stopped = false
  return {
    nativeEvent: {
      kind: "keyboard",
      ownerId: "original-child",
      target: 10,
      key: "ArrowRight",
      phase: "down",
      cancelled: false,
      nativeDefaultHandled: false,
      fieldDispatch: JSON.stringify(packet),
    },
    persist: jest.fn(),
    preventDefault: () => {
      prevented = true
    },
    stopPropagation: () => {
      stopped = true
    },
    isPropagationStopped: () => stopped,
    isDefaultPrevented: () => prevented,
    get defaultPrevented() {
      return prevented
    },
  } as unknown as TNativeFieldKeyEvent
}
const setup = () => ({
  bindingId: "field:1",
  bindingRevision: "revision:1",
  current: () => true,
  native: {
    getLease: () => "module:1",
    acceptsField: jest.fn(() => true),
    settleField: jest.fn((_request: string) => true),
    moveFieldFocus: jest.fn(),
  },
})
afterEach(() => jest.restoreAllMocks())

const originalPointer = (phase: TNativeFieldPointerPhase) => {
  const original = originalEvent() as unknown as TNativeFieldPointerEvent
  const packet = JSON.parse(original.nativeEvent.fieldDispatch)
  packet.phase = phase
  const payload = original.nativeEvent as unknown as Record<string, unknown>
  for (const key of Object.keys(payload)) delete payload[key]
  Object.assign(payload, {
    target: 10,
    pointerId: 0,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    fieldDispatch: JSON.stringify(packet),
  })
  return original
}

it.each([
  ["onPointerDown", "pointer-start"],
  ["onPointerUp", "pointer-end"],
  ["onPointerCancel", "pointer-cancel"],
  ["onClick", "pointer-click"],
] as const)("carries the actual host %s event through the shared field receiver", async (name, phase) => {
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockReturnValue(10)
  const scope = setup(),
    event = originalPointer(phase),
    caller = jest.fn((received: TNativeFieldPointerEvent) => {
      expect(received).toBe(event)
      received.preventDefault()
      received.stopPropagation()
    })
  await render(
    <NativeFieldInputContext.Provider value={scope}>
      <NativeFocusHost testID="field-pointer" {...{ [name]: caller }} />
    </NativeFieldInputContext.Provider>,
  )
  await act(() => screen.getByTestId("field-pointer").props[name](event))
  expect(caller).toHaveBeenCalledTimes(1)
  expect(scope.native.settleField).toHaveBeenCalledTimes(1)
  expect(JSON.parse(scope.native.settleField.mock.calls[0][0])).toMatchObject({
    phase,
    preventDefault: phase !== "pointer-cancel",
  })
})

it("keeps ordinary pointer callbacks intact both outside and inside a field context", async () => {
  const caller = jest.fn(),
    original = { nativeEvent: { target: 10, pointerId: 0 } }
  await render(<NativeFocusHost testID="field-pointer" onPointerDown={caller} />)
  expect(screen.getByTestId("field-pointer").props.onPointerDown).toBe(caller)
  const scope = setup()
  await screen.rerender(
    <NativeFieldInputContext.Provider value={scope}>
      <NativeFocusHost testID="field-pointer" onPointerDown={caller} />
    </NativeFieldInputContext.Provider>,
  )
  await act(() => screen.getByTestId("field-pointer").props.onPointerDown(original))
  expect(caller).toHaveBeenCalledTimes(1)
  expect(caller).toHaveBeenCalledWith(original)
  expect(scope.native.acceptsField).not.toHaveBeenCalled()
  expect(scope.native.settleField).not.toHaveBeenCalled()
})

it("uses current pointer callbacks and refuses a retired native field lease", async () => {
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockReturnValue(10)
  const scope = setup(),
    first = jest.fn(),
    next = jest.fn()
  const node = (caller: () => void) => (
    <NativeFieldInputContext.Provider value={scope}>
      <NativeFocusHost testID="field-pointer" onPointerDown={caller} />
    </NativeFieldInputContext.Provider>
  )
  await render(node(first))
  await screen.rerender(node(next))
  await act(() => screen.getByTestId("field-pointer").props.onPointerDown(originalPointer("pointer-start")))
  expect(first).not.toHaveBeenCalled()
  expect(next).toHaveBeenCalledTimes(1)
  scope.native.getLease = () => "retired"
  await act(() => screen.getByTestId("field-pointer").props.onPointerDown(originalPointer("pointer-start")))
  expect(next).toHaveBeenCalledTimes(1)
})

it("routes the original pointer and actual group target to its explicit policy without invoking the child path", async () => {
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockReturnValue(2)
  const scope = setup(),
    group = jest.fn(),
    child = jest.fn(),
    event = originalPointer("pointer-end")
  await render(
    <NativeFieldInputContext.Provider value={scope}>
      <NativeFocusHost testID="field-group" nativeFieldGroupPointerHandler={group} onPointerUp={child} />
    </NativeFieldInputContext.Provider>,
  )
  await act(() => screen.getByTestId("field-group").props.onPointerUp(event))
  expect(group).toHaveBeenCalledWith(event, 2, "pointer-end")
  expect(child).not.toHaveBeenCalled()
  expect(scope.native.settleField).not.toHaveBeenCalled()
})

it("delivers the original child event through the context and settles its own stop/default before returning", async () => {
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockReturnValue(10)
  const scope = setup(),
    event = originalEvent(),
    caller = jest.fn((received: TNativeKeyboardEvent) => {
      expect(received).toBe(event)
      received.preventDefault()
      received.stopPropagation()
    })
  await render(
    <NativeFieldInputContext.Provider value={scope}>
      <NativeFocusHost testID="field-child" onKeyDown={caller} />
    </NativeFieldInputContext.Provider>,
  )
  const deliver = screen.getByTestId("field-child").props.onNativeFieldKey
  await act(() => deliver(event))
  expect(findNodeHandle).toHaveBeenCalled()
  expect(caller).toHaveBeenCalledTimes(1)
  expect(JSON.parse(scope.native.settleField.mock.calls[0][0])).toMatchObject({ current: true, preventDefault: true })
  await screen.unmount()
  await act(() => deliver(originalEvent()))
  expect(caller).toHaveBeenCalledTimes(1)
})

it("uses the current child callback and refuses a retired native lease", async () => {
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockReturnValue(10)
  const scope = setup(),
    first = jest.fn(),
    next = jest.fn()
  const node = (caller: () => void) => (
    <NativeFieldInputContext.Provider value={scope}>
      <NativeFocusHost testID="field-child" onKeyDown={caller} />
    </NativeFieldInputContext.Provider>
  )
  await render(node(first))
  await screen.rerender(node(next))
  await act(() => screen.getByTestId("field-child").props.onNativeFieldKey(originalEvent()))
  expect(first).not.toHaveBeenCalled()
  expect(next).toHaveBeenCalledTimes(1)
  scope.native.getLease = () => "module:retired"
  await act(() => screen.getByTestId("field-child").props.onNativeFieldKey(originalEvent()))
  expect(next).toHaveBeenCalledTimes(1)
})

it("gives the explicit group receiver the original event and its actual root tag without also invoking the child path", async () => {
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockReturnValue(2)
  const scope = setup(),
    group = jest.fn(),
    child = jest.fn(),
    event = originalEvent()
  await render(
    <NativeFieldInputContext.Provider value={scope}>
      <NativeFocusHost testID="field-group" nativeFieldGroupHandler={group} onKeyDown={child} />
    </NativeFieldInputContext.Provider>,
  )
  await act(() => screen.getByTestId("field-group").props.onNativeFieldKey(event))
  expect(group).toHaveBeenCalledWith(event, 2)
  expect(child).not.toHaveBeenCalled()
  expect(scope.native.settleField).not.toHaveBeenCalled()
})

it("keeps an admitted field's negative tab stop programmatically focusable while retaining its separate tab policy", async () => {
  const scope = setup()
  await render(
    <NativeFieldInputContext.Provider value={scope}>
      <NativeFocusHost testID="field-child" tabIndex={-1} />
    </NativeFieldInputContext.Provider>,
  )
  expect(screen.getByTestId("field-child").props).toMatchObject({
    keyboardFocusable: true,
    focusable: true,
    nativeTabStop: false,
  })
  await screen.rerender(
    <NativeFieldInputContext.Provider value={scope}>
      <NativeFocusHost testID="field-child" tabIndex={-1} focusable={false} />
    </NativeFieldInputContext.Provider>,
  )
  expect(screen.getByTestId("field-child").props).toMatchObject({
    keyboardFocusable: false,
    focusable: false,
    nativeTabStop: false,
  })
  await screen.rerender(<NativeFocusHost testID="field-child" tabIndex={-1} />)
  expect(screen.getByTestId("field-child").props).toMatchObject({ keyboardFocusable: false, focusable: false })
})
