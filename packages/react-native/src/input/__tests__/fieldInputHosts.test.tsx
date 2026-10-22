import { act, render, screen } from "@testing-library/react-native"
import { findNodeHandle } from "react-native"

import { NativeFieldInputContext, type TNativeFieldKeyEvent } from "../fieldInput"
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
