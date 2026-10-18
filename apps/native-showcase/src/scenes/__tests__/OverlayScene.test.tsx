import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"

import { NativeOverlayProvider, NativeThemeProvider } from "@codon-ui/react-native"

import { OverlayScene } from "../OverlayScene"

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})

const dismissals = new Map<string, () => void>()
const show = async (id: string) => {
  const window = screen.getByTestId(`${id}-window`, { includeHiddenElements: true })
  dismissals.set(id, window.props.onDismiss)
  await fireEvent(window, "show")
}
const retire = async (id: string) => {
  await act(() => dismissals.get(id)!())
  await act(() => jest.runAllTimers())
}
const press = async (name: string) => userEvent.setup().press(screen.getByRole("button", { name }))
// Mock Modal retains its React ancestry; deliver activation to the ready native child explicitly.
const childActivation = async (name: string, role: "button" | "radio" = "button") => {
  const node = screen.getByRole(role, { name, includeHiddenElements: true })
  await act(() => node.props.onClick({ nativeEvent: {}, stopPropagation: () => undefined }))
}
const renderScene = async () =>
  render(
    <NativeThemeProvider>
      <NativeOverlayProvider>
        <OverlayScene />
      </NativeOverlayProvider>
    </NativeThemeProvider>,
  )

beforeEach(() => {
  dismissals.clear()
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => undefined)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("retains parent-local state and uncontrolled native drafts across child windows and resets them after complete closure", async () => {
  await renderScene()
  await press("Open parent dialog")
  await show("overlay-parent")
  await fireEvent.changeText(screen.getByTestId("overlay-draft"), "owner draft")
  await fireEvent.changeText(screen.getByTestId("overlay-local-input"), "local retained draft")
  await press("Increase local overlay count")
  await press("Open nested dialog")
  await show("overlay-child")
  expect(screen.getByTestId("overlay-child-context", { includeHiddenElements: true })).toHaveTextContent(
    /local caller context/,
  )
  await fireEvent(screen.getByTestId("overlay-child-window", { includeHiddenElements: true }), "requestClose")
  await retire("overlay-child")
  expect(screen.getByTestId("overlay-local-state")).toHaveTextContent(
    "Local body count: 1. Local raw: local retained draft.",
  )
  expect(screen.getByTestId("overlay-local-input")).toHaveDisplayValue("local retained draft")
  await press("Nested direction")
  await show("overlay-select")
  await childActivation("South", "radio")
  await retire("overlay-select")
  expect(screen.getByTestId("overlay-local-state")).toHaveTextContent(/Local body count: 1\./)
  expect(screen.getByTestId("overlay-select-trigger").props.accessibilityValue.text).toBe("South")
  await press("Close entire chain")
  await retire("overlay-parent")
  await press("Open parent dialog")
  await show("overlay-parent")
  expect(screen.getByTestId("overlay-local-state")).toHaveTextContent(
    "Local body count: 0. Local raw: local body draft.",
  )
  expect(screen.getByTestId("overlay-local-input")).toHaveDisplayValue("local body draft")
  expect(screen.getByTestId("overlay-draft")).toHaveDisplayValue("owner draft")
})

it("composes confirmation actions, controlled decline and note state without inventing business callbacks", async () => {
  await renderScene()
  await press("Open parent dialog")
  await show("overlay-parent")
  await press("Open alert confirmation")
  await show("overlay-alert")
  await fireEvent.changeText(screen.getByTestId("overlay-alert-note", { includeHiddenElements: true }), "retained note")
  await childActivation("Toggle confirmation close echo")
  await childActivation("Confirm overlay confirmation")
  await childActivation("Confirm overlay confirmation")
  expect(screen.getByTestId("overlay-alert-state", { includeHiddenElements: true })).toHaveTextContent(
    /Confirms: 2.*Cancels: 0.*Requests: 2.*declines/,
  )
  await childActivation("Toggle confirmation close echo")
  await childActivation("Cancel overlay confirmation")
  await retire("overlay-alert")
  await press("Open alert confirmation")
  await show("overlay-alert")
  expect(screen.getByTestId("overlay-alert-note", { includeHiddenElements: true })).toHaveDisplayValue("retained note")
  await fireEvent(screen.getByTestId("overlay-alert-window", { includeHiddenElements: true }), "requestClose")
  await retire("overlay-alert")
  expect(screen.getByTestId("overlay-action-state")).toHaveTextContent(/Confirms: 2.*Cancels: 1.*Requests: 4/)
})

it("uses the configured guards, long labels, type/icon/cancel/style choices and explicit reset", async () => {
  await renderScene()
  for (const name of [
    "Toggle overlay backdrop guard",
    "Toggle overlay system guard",
    "Toggle overlay geometry",
    "Toggle overlay custom styles",
    "Toggle long overlay copy",
    "Next overlay order",
    "Next alert type",
    "Next alert icon",
    "Toggle alert cancellation",
  ])
    await press(name)
  await press("Open parent dialog")
  await show("overlay-parent")
  expect(screen.getByTestId("overlay-parent")).toHaveStyle({ width: "90%", borderWidth: 3, borderRadius: 0 })
  await fireEvent(screen.getByTestId("overlay-parent-window"), "requestClose")
  await fireEvent.press(screen.getByTestId("overlay-parent-backdrop"))
  expect(screen.getByTestId("overlay-state")).toHaveTextContent(/Close requests: 0\./)
  await press("Open alert confirmation")
  await show("overlay-alert")
  expect(screen.getByTestId("overlay-alert-title", { includeHiddenElements: true })).toHaveTextContent(
    /Vérifiez les paramètres/,
  )
  expect(screen.getByTestId("overlay-alert-ribbon", { includeHiddenElements: true })).toHaveStyle({
    backgroundColor: "#a66b00",
  })
  expect(
    screen.getByRole("button", { name: "Confirm overlay confirmation", includeHiddenElements: true }),
  ).toHaveTextContent("Continue")
  expect(screen.queryByRole("button", { name: "Cancel overlay confirmation", includeHiddenElements: true })).toBeNull()
  await childActivation("Unmount alert owner")
  await press("Reset overlay examples")
  expect(screen.getByTestId("overlay-configuration")).toHaveTextContent(
    /Backdrop enabled.*System enabled.*rounded.*Order: none.*Alert: info.*short.*Icon: 0.*Cancel: true/,
  )
  expect(screen.getByTestId("overlay-action-state")).toHaveTextContent(
    /Confirms: 0.*Cancels: 0.*Requests: 0.*confirmation note/,
  )
})

it("recovers from the isolated competing-branch diagnostic without corrupting the provider", async () => {
  jest.spyOn(console, "error").mockImplementation(() => undefined)
  await renderScene()
  await press("Run competing-window diagnostic")
  expect(screen.getByTestId("overlay-diagnostic")).toHaveTextContent(/competing overlay branches/)
  await press("Dismiss overlay diagnostic")
  await press("Open parent dialog")
  await show("overlay-parent")
  expect(screen.getByTestId("overlay-context")).toHaveTextContent(/local caller context/)
})

it("leaves removed restoration targets null and exposes the uncontrolled starter composition", async () => {
  await renderScene()
  await press("Open starter dialog")
  await show("modal")
  expect(screen.getByText("Modal Title")).toBeOnTheScreen()
  await press("Close Modal")
  await press("Open parent dialog")
  await show("overlay-parent")
  await press("Open nested dialog")
  await show("overlay-child")
  await childActivation("Remove parent focus target")
  const before = jest.mocked(AccessibilityInfo.sendAccessibilityEvent).mock.calls.length
  await fireEvent(screen.getByTestId("overlay-child-window", { includeHiddenElements: true }), "requestClose")
  await retire("overlay-child")
  expect(screen.queryByRole("button", { name: "Open nested dialog" })).toBeNull()
  expect(screen.getByRole("button", { name: "Restore active nested target" })).toBeOnTheScreen()
  expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledTimes(before)
})
