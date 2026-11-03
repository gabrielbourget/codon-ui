import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { Dimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockImplementation(() => 17)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const enter = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Stepper scene")
  return press
}
const editor = () => screen.getByTestId("stepper-example-input")
const state = () => screen.getByTestId("stepper-state")
const plus = () => screen.getByRole("button", { name: "Increase controlled quantity" })

it("retains controlled requests and veto through theme/window/fixture changes and explicit reset", async () => {
  const press = await enter()
  await press("Increase controlled quantity")
  expect(state()).toHaveTextContent(/Value: 0.1.*Request: 0.1.*Requests: 1/)
  await press("Toggle stepper owner veto")
  await press("Increase controlled quantity")
  await press("Increase controlled quantity")
  expect(state()).toHaveTextContent(/Value: 0.1.*Request: 0.2.*Requests: 3/)
  await press("Dark theme")
  await press("Vertical blocked region")
  await act(() =>
    Dimensions.set({
      window: { width: 844, height: 390, scale: 1, fontScale: 1 },
      screen: { width: 844, height: 390, scale: 1, fontScale: 1 },
    }),
  )
  expect(editor()).toHaveDisplayValue("0.1")
  expect(state()).toHaveTextContent(/Requests: 3.*Parent: veto/)
  await press("Reset scene")
  await press("Stepper scene")
  expect(state()).toHaveTextContent(/Value: 0.*Request: none.*Requests: 0.*Parent: echo.*Type: segmented/)
})

it("commits the native draft, preserves empty/zero, and exercises every style owner and presentation control", async () => {
  const press = await enter()
  await fireEvent.changeText(editor(), "0.3")
  await fireEvent(editor(), "endEditing", { nativeEvent: { text: "0.4" } })
  expect(state()).toHaveTextContent(/Value: 0.4.*Requests: 1.*Raw: 0.3/)
  await press("Set stepper empty")
  expect(editor()).toHaveDisplayValue("")
  await press("Increase controlled quantity")
  expect(editor()).toHaveDisplayValue("-1")
  await press("Set stepper zero")
  await press("Toggle stepper type")
  await press("Toggle stepper orientation")
  await press("Toggle stepper color mode")
  await press("Next stepper order")
  await press("Next stepper geometry")
  await press("Next stepper text size")
  await press("Next stepper status")
  await press("Toggle stepper styles")
  await press("Toggle stepper icons")
  await press("Toggle stepper locale")
  expect(state()).toHaveTextContent(
    /Value: 0.*Type: cohesive.*Orientation: vertical.*Mode: outline.*Order: primary.*Geometry: rounded.*Size: small.*Locale: fr-CA.*Status: error/,
  )
  expect(screen.getByTestId("stepper-example")).toHaveStyle({ padding: 8, borderWidth: 2 })
  expect(screen.getByTestId("stepper-example-group")).toHaveStyle({ gap: 12, flexDirection: "column-reverse" })
  expect(editor()).toHaveStyle({ fontSize: 18, maxWidth: 80 })
  expect(plus()).toHaveStyle({ width: 44, height: 44, paddingHorizontal: 0, borderRadius: 5 })
  expect(screen.getByText("+", { includeHiddenElements: true })).toBeOnTheScreen()
  await press("Toggle stepper zero width")
  expect(screen.getByTestId("stepper-example")).toHaveStyle({ width: 0 })
  await fireEvent(screen.getByTestId("stepper-example"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 10 } },
  })
  expect(screen.getByTestId("stepper-frame")).toHaveTextContent(/0 x 10/)
})

it("observes held veto requests and retires repeat on owner guard takeover", async () => {
  const press = await enter()
  await press("Toggle stepper owner veto")
  const event = {
    persist: () => undefined,
    currentTarget: 17,
    target: 17,
    nativeEvent: { target: 17, timestamp: 1, identifier: 0, locationX: 0, locationY: 0, pageX: 0, pageY: 0 },
  }
  for (const ready of [false, true]) {
    const host = screen.getByTestId("stepper-example").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "stepper-scene-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
  await fireEvent(plus(), "responderGrant", event)
  await act(() => jest.advanceTimersByTime(600))
  await act(() => jest.advanceTimersByTime(60))
  expect(state()).toHaveTextContent(/Value: 0.*Request: 0.1.*Requests: 2/)
  await press("Toggle stepper read-only")
  const countAtTakeover = Number(
    state()
      .children.join("")
      .match(/Requests: (\d+)/)?.[1],
  )
  expect(countAtTakeover).toBeGreaterThanOrEqual(2)
  await act(() => jest.advanceTimersByTime(1000))
  expect(state()).toHaveTextContent(new RegExp(`Requests: ${countAtTakeover}.*Guard: read-only`))
  expect(plus()).toBeDisabled()
  await press("Toggle stepper read-only")
  await fireEvent(plus(), "responderRelease", event)
  await fireEvent.press(plus(), event)
  expect(state()).toHaveTextContent(new RegExp(`Requests: ${countAtTakeover}`))
  await press("Toggle stepper disabled")
  expect(editor().props.editable).toBe(false)
  await press("Set stepper maximum")
  expect(editor()).toHaveDisplayValue("1")
  expect(state()).toHaveTextContent(new RegExp(`Requests: ${countAtTakeover}`))
})

it("keeps the original editor while locale final payloads, owner veto and read-only compose", async () => {
  const press = await enter()
  const originalEditor = editor()
  await press("Toggle stepper locale")
  expect(editor()).toBe(originalEditor)
  await fireEvent.changeText(editor(), "0,1")
  await fireEvent(editor(), "submitEditing", { nativeEvent: { text: "0,2" } })
  await fireEvent(editor(), "endEditing", { nativeEvent: { text: "0,1" } })
  expect(state()).toHaveTextContent(/Value: 0.2.*Request: 0.2.*Requests: 1.*Raw: 0,1/)
  expect(editor()).toHaveDisplayValue("0,2")
  await press("Toggle stepper owner veto")
  await fireEvent.changeText(editor(), "0,5")
  await fireEvent(editor(), "endEditing", { nativeEvent: { text: "0,5" } })
  expect(state()).toHaveTextContent(/Value: 0.2.*Request: 0.5.*Requests: 2.*Raw: 0,5/)
  expect(editor()).toHaveDisplayValue("0,2")
  await press("Toggle stepper read-only")
  await fireEvent(editor(), "accessibilityAction", { nativeEvent: { actionName: "incrementValue" } })
  await press("Toggle stepper locale")
  expect(editor()).toBe(originalEditor)
  expect(editor()).toHaveDisplayValue("0.2")
  expect(state()).toHaveTextContent(/Value: 0.2.*Requests: 2.*Guard: read-only.*Locale: en-US/)
  await press("Toggle stepper read-only")
  await press("Increase controlled quantity")
  expect(state()).toHaveTextContent(/Value: 0.2.*Request: 0.3.*Requests: 3/)
})

const config = () => JSON.parse(screen.getByTestId("stepper-config").children.join(""))
const callbacks = (): { generation: number; kind: string; data: unknown }[] =>
  JSON.parse(screen.getByTestId("stepper-callbacks").children.join(""))

it("exposes defaults once, keeps uncontrolled ownership honest, and retains receipts through editor replacement", async () => {
  const press = await enter()
  await press("Next stepper default")
  await press("Next stepper default")
  expect(editor()).toHaveDisplayValue("0")
  await press("Toggle stepper controlled mode and remount")
  expect(config()).toMatchObject({ generation: 1, ownership: "uncontrolled", defaultValue: 0.4 })
  expect(editor()).toHaveDisplayValue("0.4")
  await press("Next stepper default")
  expect(config().defaultValue).toBeNull()
  expect(editor()).toHaveDisplayValue("0.4")
  expect(callbacks()).toEqual([])
  await press("Increase controlled quantity")
  expect(editor()).toHaveDisplayValue("0.5")
  expect(state()).toHaveTextContent(/Value: uncontrolled.*Request: 0.5.*Requests: 1/)
  expect(callbacks()).toEqual([{ generation: 1, kind: "request", data: 0.5 }])
  await press("Remount stepper editor")
  expect(editor()).toHaveDisplayValue("")
  await press("Remove or reinsert stepper editor")
  expect(screen.queryByTestId("stepper-example-input")).toBeNull()
  expect(screen.getByTestId("stepper-refs")).toHaveTextContent(/"attached":false/)
  await press("Remove or reinsert stepper editor")
  expect(editor()).toHaveDisplayValue("")
  expect(config()).toMatchObject({ generation: 3, mounted: true })
  expect(callbacks()).toEqual([{ generation: 1, kind: "request", data: 0.5 }])
  await press("Toggle stepper controlled mode and remount")
  expect(editor()).toHaveDisplayValue("0")
  expect(state()).toHaveTextContent(/Value: 0.*Requests: 1/)
})

it("exposes numeric and validation partitions and records a truthful unavailable native Form action", async () => {
  const press = await enter()
  await press("Next stepper numeric format")
  expect(editor()).toHaveDisplayValue("0.00")
  await press("Next stepper numeric format")
  expect(editor().props.value).toMatch(/0.00/)
  expect(config().format).toBe("currency")
  await press("Next stepper numeric format")
  await press("Next stepper numeric step")
  expect(editor()).toHaveDisplayValue("0%")
  expect(config().step).toBe("undefined")
  await press("Increase controlled quantity")
  expect(editor()).toHaveDisplayValue("1%")
  expect(state()).toHaveTextContent(/Value: 0.01.*Requests: 1/)
  await press("Next stepper numeric format")
  expect(config().format).toBe("unit")
  await press("Next stepper numeric format")
  expect(config().format).toBe("significant")
  await press("Toggle stepper commit validation")
  await press("Toggle stepper aria validation")
  await press("Toggle stepper required")
  await press("Toggle stepper custom validation")
  await press("Toggle stepper server error")
  await press("Next stepper explicit invalid")
  await press("Next stepper validation state")
  await press("Toggle stepper zero selection")
  expect(config()).toMatchObject({
    commit: "validate",
    validation: "aria",
    required: true,
    customValidation: true,
    serverError: true,
    isInvalid: false,
    validationState: "valid",
    selection: { start: 0, end: 0 },
  })
  expect(editor().props.selection).toEqual({ start: 0, end: 0 })
  await press("Submit stepper form")
  expect(screen.getByTestId("stepper-form-result")).toHaveTextContent(
    /"status":"retired".*native-action-lease-unavailable/,
  )
  expect(callbacks().filter(({ kind }) => kind === "form:submit")).toEqual([])
  expect(callbacks().filter(({ kind }) => kind === "request")).toHaveLength(1)
})

it("records final native payload order and exposes request-triggered removal without hiding late callback work", async () => {
  const press = await enter()
  await fireEvent(editor(), "focus", { nativeEvent: { target: 17 } })
  await fireEvent.changeText(editor(), "0.3")
  await fireEvent(editor(), "change", { nativeEvent: { text: "0.3", eventCount: 1, target: 17 } })
  await fireEvent(editor(), "selectionChange", { nativeEvent: { selection: { start: 0, end: 0 }, target: 17 } })
  await fireEvent(editor(), "submitEditing", { nativeEvent: { text: "0.4" } })
  await fireEvent(editor(), "endEditing", { nativeEvent: { text: "0.3" } })
  expect(callbacks().map(({ kind }) => kind)).toEqual([
    "native:focus",
    "raw",
    "native:change",
    "native:selection",
    "request",
    "native:submit",
    "native:end",
  ])
  expect(callbacks().slice(4)).toEqual([
    { generation: 0, kind: "request", data: 0.4 },
    { generation: 0, kind: "native:submit", data: "0.4" },
    { generation: 0, kind: "native:end", data: "0.3" },
  ])
  await press("Next stepper retirement on request")
  await press("Next stepper retirement on request")
  await press("Next stepper retirement on request")
  expect(config().retireOnRequest).toBe("remove")
  await press("Increase controlled quantity")
  expect(screen.queryByTestId("stepper-example-input")).toBeNull()
  expect(config()).toMatchObject({ mounted: false, retireOnRequest: "none" })
  expect(state()).toHaveTextContent(/Value: 0.5.*Requests: 2/)
  const afterRemoval = callbacks()
  await act(() => jest.advanceTimersByTime(1500))
  expect(callbacks()).toEqual(afterRemoval)
  await press("Remove or reinsert stepper editor")
  expect(editor()).toHaveDisplayValue("0.5")
  expect(callbacks()).toEqual(afterRemoval)
})

const teardown = (): {
  owner: string
  unmounted: boolean
  callbacks: { generation: number; kind: string; data: unknown; afterUnmount: boolean }[]
} => JSON.parse(screen.getByTestId("stepper-teardown").children.join(""))

it("keeps the retired scene observation through reset and observes no late held request", async () => {
  const press = await enter()
  await press("Arm stepper scene teardown observation")
  const observedOwner = teardown().owner
  const event = {
    persist: () => undefined,
    currentTarget: 17,
    target: 17,
    nativeEvent: { target: 17, timestamp: 1, identifier: 0, locationX: 0, locationY: 0, pageX: 0, pageY: 0 },
  }
  for (const ready of [false, true]) {
    const host = screen.getByTestId("stepper-example").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "stepper-scene-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
  await fireEvent(plus(), "responderGrant", event)
  await act(() => jest.advanceTimersByTime(600))
  await act(() => jest.advanceTimersByTime(60))
  expect(state()).toHaveTextContent(/Value: 0.2.*Requests: 2/)
  await press("Reset scene")
  await act(() => jest.advanceTimersByTime(1500))
  await press("Stepper scene")
  expect(teardown()).toMatchObject({ owner: observedOwner, unmounted: true })
  const observedRequests = teardown().callbacks.filter(({ kind }) => kind === "request")
  expect(observedRequests.slice(0, 2)).toEqual([
    { generation: 0, kind: "request", data: 0.1, afterUnmount: false },
    { generation: 0, kind: "request", data: 0.2, afterUnmount: false },
  ])
  expect(observedRequests.every(({ afterUnmount }) => !afterUnmount)).toBe(true)
  expect(state()).toHaveTextContent(/Value: 0.*Request: none.*Requests: 0/)
})

it("retains a late callback negative control after whole-scene unmount and isolates the next scene", async () => {
  const press = await enter()
  await press("Arm stepper scene teardown observation")
  const observedOwner = teardown().owner
  const lateSelection = editor().props.onSelectionChange
  await press("Reset scene")
  await act(() => lateSelection({ nativeEvent: { selection: { start: 0, end: 0 }, target: 17 } }))
  await press("Stepper scene")
  expect(teardown()).toEqual({
    owner: observedOwner,
    unmounted: true,
    callbacks: [{ generation: 0, kind: "native:selection", data: { start: 0, end: 0 }, afterUnmount: true }],
  })
  await press("Increase controlled quantity")
  await press("Read stepper scene teardown observation")
  expect(teardown().callbacks).toHaveLength(1)
  await act(() => lateSelection({ nativeEvent: { selection: { start: 1, end: 1 }, target: 17 } }))
  await press("Read stepper scene teardown observation")
  expect(teardown().callbacks[1]).toEqual({
    generation: 0,
    kind: "native:selection",
    data: { start: 1, end: 1 },
    afterUnmount: true,
  })
  expect(state()).toHaveTextContent(/Value: 0.1.*Requests: 1/)
})
