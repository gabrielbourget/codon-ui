import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { Dimensions } from "react-native"

import { NativeThemeProvider } from "@codon-ui/react-native"

import { ComboBoxScene } from "../ComboBoxScene"

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})
beforeEach(() => {
  jest.useFakeTimers()
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const tags = new WeakMap<object, number>()
  let nextTarget = 1000
  jest.spyOn(native, "findNodeHandle").mockImplementation((target) => {
    if (!target || typeof target !== "object") return typeof target === "number" ? target : null
    if (!tags.has(target)) tags.set(target, ++nextTarget)
    return tags.get(target)!
  })
})
afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
})
const fixture = (mode: "light" | "dark" = "light") => (
  <NativeThemeProvider mode={mode}>
    <ComboBoxScene />
  </NativeThemeProvider>
)
const enter = async () => {
  const view = await render(fixture())
  const user = userEvent.setup()
  return {
    ...view,
    press: async (name: string) => {
      await readyCurrentWindow()
      await user.press(screen.getByRole("button", { name }))
    },
  }
}
const input = () => screen.getByLabelText("Public ComboBox query")
const state = () => screen.getByTestId("public-combo-state")
const requests = () => screen.getByTestId("public-combo-requests")
const readyCurrentWindow = async () => {
  const current = () => screen.queryByTestId("public-combo-example-floating-host")
  const initial = current()
  if (!initial || !initial.props.enabled) return
  for (const ready of initial.props.acceptedWindowId ? [true] : [false, true]) {
    const props = current()!.props
    await act(() =>
      props.onNativeScopeStatus({
        nativeEvent: {
          ownerId: props.ownerId,
          windowId: `${props.ownerId}:source-modal-window`,
          epoch: 1,
          ready,
          windowActive: props.enabled,
          policyRevision: props.policyRevision,
        },
      }),
    )
  }
}
const pressSdk = async (host: ReturnType<typeof screen.getByRole>) => {
  await readyCurrentWindow()
  const event = {
    persist: jest.fn(),
    stopPropagation: jest.fn(),
    target: 17,
    currentTarget: 17,
    nativeEvent: {
      target: 17,
      timestamp: Date.now(),
      identifier: 1,
      pageX: 1,
      pageY: 1,
      locationX: 1,
      locationY: 1,
      touches: [],
      changedTouches: [],
    },
  }
  if (typeof host.props.onResponderGrant !== "function" || typeof host.props.onResponderRelease !== "function") {
    expect(host.props.nativePressable).toBe(false)
    expect(host.props.onResponderGrant).toBeUndefined()
    expect(host.props.onResponderRelease).toBeUndefined()
    return
  }
  await act(() => host.props.onResponderGrant(event))
  await act(() => host.props.onResponderRelease(event))
}
const choose = (name: string) => pressSdk(screen.getByRole("radio", { name }))
const replace = () => pressSdk(screen.getByRole("button", { name: "Replace ComboBox items after 125 ms" }))

it("keeps query, typed selection and open owners independent across ordinary selection and Close", async () => {
  const { press } = await enter()
  await press("Choose typed item")
  await fireEvent.changeText(input(), "held query")
  await choose("String zero")
  expect(state()).toHaveTextContent(/Query: "held query".*Selection: string:"0".*Open: false/)
  expect(requests()).toHaveTextContent(
    /Query requests: \["held query"\].*Selection requests: \["0"\].*Open requests: \[true,false\]/,
  )
  await press("Choose typed item")
  expect(input()).toHaveDisplayValue("held query")
  expect(screen.getByRole("radio", { name: "String zero" })).toBeChecked()
  await press("Close public ComboBox")
  expect(state()).toHaveTextContent(/Selection: string:"0".*Open: false/)
  expect(screen.getByTestId("public-combo-refs")).toHaveTextContent(
    /Root attached: true.*Editor attached: false.*Root mounts: 1.*Editor mounts: 2/,
  )
})

it("records repeated vetoes and blocks read-only/disabled edits and result mutations", async () => {
  const { press } = await enter()
  for (const axis of ["query", "selection", "open"]) await press(`Toggle ComboBox ${axis} veto`)
  await press("Choose typed item")
  expect(state()).toHaveTextContent(/Open: false/)
  await press("Open ComboBox from owner")
  await fireEvent.changeText(input(), "declined")
  await fireEvent.changeText(input(), "declined")
  await choose("String zero")
  await press("Close public ComboBox")
  expect(input()).toHaveDisplayValue("")
  expect(state()).toHaveTextContent(/Selection: number:0.*Open: true/)
  expect(requests()).toHaveTextContent(
    /Query requests: \["declined","declined"\].*Selection requests: \["0"\].*Open requests: \[true,false,false\]/,
  )
  await press("Toggle ComboBox read-only")
  await fireEvent.changeText(input(), "read-only")
  await pressSdk(screen.getByRole("radio", { name: "String zero" }))
  await press("Toggle ComboBox disabled")
  await fireEvent.changeText(input(), "disabled")
  await pressSdk(screen.getByRole("radio", { name: "Numeric zero" }))
  expect(input().props.editable).toBe(false)
  expect(requests()).toHaveTextContent(
    /Query requests: \["declined","declined"\].*Selection requests: \["0"\].*Open requests: \[true,false,false,false\]/,
  )
})

it("retains original hosts and observers through deferred typed-key replacement, theme and large-text window changes", async () => {
  const { press, rerender } = await enter()
  await press("Choose typed item")
  const originalInput = input(),
    originalRoot = screen.getByTestId("public-combo-example")
  await fireEvent.changeText(input(), "owner draft")
  await fireEvent(input(), "change", { nativeEvent: { text: "日本", eventCount: 7, target: 17 } })
  await fireEvent(input(), "selectionChange", { nativeEvent: { selection: { start: 1, end: 2 }, target: 17 } })
  await fireEvent(input(), "submitEditing", { nativeEvent: { text: "native submit", target: 17 } })
  await fireEvent(input(), "endEditing", { nativeEvent: { text: "native end", target: 17 } })
  await replace()
  await act(() => jest.advanceTimersByTime(124))
  expect(state()).toHaveTextContent(/Pending: true/)
  expect(screen.getByRole("radio", { name: "Numeric zero" })).toBeChecked()
  await rerender(fixture("dark"))
  const oldWindow = Dimensions.get("window"),
    oldScreen = Dimensions.get("screen")
  try {
    await act(() =>
      Dimensions.set({
        window: { width: 844, height: 390, scale: 1, fontScale: 2 },
        screen: { width: 844, height: 390, scale: 1, fontScale: 2 },
      }),
    )
    await act(() => jest.advanceTimersByTime(1))
    expect(input()).toBe(originalInput)
    expect(screen.getByTestId("public-combo-example")).toBe(originalRoot)
    expect(input()).toHaveDisplayValue("owner draft")
    expect(screen.getByRole("radio", { name: "Returned numeric zero" })).toBeChecked()
    expect(screen.getByTestId("public-combo-refs")).toHaveTextContent(/Root mounts: 1.*Editor mounts: 1/)
    expect(state()).toHaveTextContent(/Pending: false.*Theme: dark/)
    expect(screen.getByTestId("public-combo-native")).toHaveTextContent(
      /Changes: 1.*Text: "日本".*Event count: 7.*Selection: 1:2.*Submit: "native submit".*End: "native end"/,
    )
    expect(requests()).toHaveTextContent(
      /Query requests: \["owner draft"\].*Selection requests: \[\].*Open requests: \[true\]/,
    )
    await choose("Returned empty key")
    expect(state()).toHaveTextContent(/Query: "owner draft".*Selection: string:"".*Open: false/)
  } finally {
    await act(() => Dimensions.set({ window: oldWindow, screen: oldScreen }))
  }
})

it("cancels a pending response on reset and unmount without changing default owners", async () => {
  const { press, unmount } = await enter()
  await replace()
  await pressSdk(screen.getByRole("button", { name: "Reset ComboBox scene" }))
  await act(() => jest.advanceTimersByTime(125))
  await press("Choose typed item")
  expect(screen.getByRole("radio", { name: "Numeric zero" })).toBeChecked()
  expect(screen.queryByRole("radio", { name: "Returned numeric zero" })).toBeNull()
  expect(state()).toHaveTextContent(/Query: "".*Selection: number:0.*Pending: false/)
  await replace()
  await unmount()
  await act(() => jest.advanceTimersByTime(125))
})
