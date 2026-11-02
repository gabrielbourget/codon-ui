import { fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"

import { ToggleScene } from "../../../../../../apps/native-showcase/src/scenes/ToggleScene"
import { ToggleCompositionCandidate } from "../../../../../../planning/component-library/fixtures/native-base-controls/toggle-composition.native.candidate"

import { createToggleKeyboardFixture } from "./keyboard-fixture"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const press = (name: string, role: "button" | "radio" = "button") =>
  userEvent.setup().press(screen.getByRole(role, { name }))

it("exercises typed-key veto/echo, owner modes, multi-indicators and original held editor through live render/style/theme/large-text changes", async () => {
  const keyboard = createToggleKeyboardFixture()
  await render(keyboard.wrap(<ToggleCompositionCandidate />))
  const editor = screen.getByTestId("composition-editor"),
    group = screen.getByTestId("composition-group")
  await fireEvent.changeText(editor, "held draft")
  await press("Toggle composition veto")
  await press("String zero", "radio")
  await press("String zero", "radio")
  expect(screen.getByTestId("composition-owner")).toHaveTextContent(
    'Owner: number:0. Request: string:"0". Requests: 2. Veto: true.',
  )
  expect(screen.getByRole("radio", { name: "Numeric zero" }).props.accessibilityState.checked).toBe(true)
  await press("Echo composition request")
  expect(screen.getByRole("radio", { name: "String zero" }).props.accessibilityState.checked).toBe(true)
  await press("Toggle composition veto")
  await press("Empty key", "radio")
  expect(screen.getByTestId("composition-current")).toHaveTextContent('Actual: string:"". Mode: single.')
  await press("Toggle composition selection mode")
  await press("Numeric zero")
  expect(screen.getByTestId('indicator-string:""')).toBeOnTheScreen()
  expect(screen.getByTestId("indicator-number:0")).toBeOnTheScreen()
  for (const control of [
    "Toggle composition render and styles",
    "Toggle composition orientation",
    "Toggle composition theme",
    "Toggle composition large text",
  ])
    await press(control)
  expect(screen.getByTestId("composition-group")).toBe(group)
  expect(screen.getByTestId("composition-editor")).toBe(editor)
  expect(editor).toHaveDisplayValue("held draft")
  expect(group).toHaveStyle({ padding: 7, gap: 9, flexDirection: "column" })
  expect(screen.getByRole("button", { name: "Numeric zero" })).toHaveStyle({ minHeight: 60, borderRadius: 0 })
})

it("exercises guard independence, nested ownership, removal/replacement/reset and an explicit host window request", async () => {
  const keyboard = createToggleKeyboardFixture(),
    requestWindow = jest.fn()
  await render(keyboard.wrap(<ToggleCompositionCandidate onRequestWindow={requestWindow} />))
  await press("Toggle composition member guard")
  expect(screen.getByRole("radio", { name: "String zero" })).toBeDisabled()
  await press("Toggle composition group guard")
  expect(screen.getByRole("radio", { name: "Numeric zero" })).toBeDisabled()
  const owner = screen.getByTestId("composition-owner")
  await press("Independent toggle")
  expect(screen.getByRole("button", { name: "Independent toggle" }).props.accessibilityState.checked).toBe(true)
  await press("Nested member", "radio")
  expect(screen.getByTestId("composition-owner")).toBe(owner)
  expect(owner).toHaveTextContent("Owner: number:0. Request: none. Requests: 0. Veto: false.")
  await press("Open composition window")
  expect(requestWindow).toHaveBeenCalledTimes(1)
  await press("Toggle composition member removal")
  expect(screen.queryByRole("radio", { name: "String zero" })).toBeNull()
  const originalEditor = screen.getByTestId("composition-editor")
  await press("Replace composition owner")
  expect(screen.getByTestId("composition-editor")).not.toBe(originalEditor)
  await press("Reset composition")
  expect(screen.getByTestId("composition-owner")).toHaveTextContent(
    "Owner: number:0. Request: none. Requests: 0. Veto: false.",
  )
})

it("retains the canonical initial controlled Set on control handback and composes an actual peer portal without transferring selection ownership", async () => {
  const keyboard = createToggleKeyboardFixture()
  await render(keyboard.wrap(<ToggleCompositionCandidate />))
  await press("Toggle composition control")
  expect(screen.getByTestId("composition-current")).toHaveTextContent("Actual: number:0. Mode: single.")
  await press("String zero", "radio")
  expect(screen.getByRole("radio", { name: "String zero" }).props.accessibilityState.checked).toBe(true)
  await press("Toggle composition portal")
  expect(screen.getByRole("radio", { name: "Portalled member" })).toBeOnTheScreen()
  await press("Portalled member", "radio")
  expect(screen.getByTestId("composition-current")).toHaveTextContent('Actual: string:"portal". Mode: single.')
  await press("Toggle composition portal")
  expect(screen.queryByRole("radio", { name: "Portalled member" })).toBeNull()
})

it("reaches the complete composition from the maintained public scene and opens an independently hosted native-window fixture", async () => {
  const keyboard = createToggleKeyboardFixture()
  await render(keyboard.wrap(<ToggleScene />))
  await press("Controlled flag")
  const standalone = screen.getByRole("button", { name: "Controlled flag" })
  expect(standalone.props.accessibilityState.checked).toBe(true)
  await press("Toggle complete toggle composition")
  expect(screen.getByRole("radio", { name: "Numeric zero" })).toBeOnTheScreen()
  await press("Open composition window")
  expect(screen.getByRole("radio", { name: "Separate window member" })).toBeOnTheScreen()
  expect(standalone.props.accessibilityState.checked).toBe(true)
  await fireEvent(screen.getByTestId("composition-window"), "requestClose")
  await press("Toggle complete toggle composition")
  expect(screen.queryByRole("radio", { name: "Numeric zero" })).toBeNull()
  expect(screen.getByRole("button", { name: "Controlled flag" })).toBe(standalone)
  expect(standalone.props.accessibilityState.checked).toBe(true)
})
